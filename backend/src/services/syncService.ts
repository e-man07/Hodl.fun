// Fast RPC-based blockchain sync service
// Instead of scanning blocks, directly fetch current state via RPC

import { ethers } from 'ethers';
import { rpcService } from './rpcService';
import { contractService } from './contractService';
import { ipfsService } from './ipfsService';
import { db } from '../config/database';
import { blockchainConfig } from '../config';
import { TOKEN_FACTORY_ABI, MARKETPLACE_ABI, ERC20_ABI } from '../contracts/abis';
import logger from '../utils/logger';

export class SyncService {
  private factoryContract: ethers.Contract;
  private marketplaceContract: ethers.Contract;

  constructor() {
    const provider = rpcService.getProvider();
    this.factoryContract = new ethers.Contract(
      blockchainConfig.tokenFactory,
      TOKEN_FACTORY_ABI,
      provider
    );
    this.marketplaceContract = new ethers.Contract(
      blockchainConfig.marketplace,
      MARKETPLACE_ABI,
      provider
    );
  }

  /**
   * Sync all tokens from blockchain to database
   * Uses getAllTokens() from factory contract - MUCH faster than block scanning!
   */
  async syncAllTokens(): Promise<{ synced: number; skipped: number; errors: number }> {
    logger.info('🔄 Starting fast RPC-based token sync...');

    try {
      // Get all token addresses from factory contract
      logger.info('Fetching all token addresses from factory contract...');
      const tokenAddresses: string[] = await this.factoryContract.getAllTokens();
      logger.info(`Found ${tokenAddresses.length} tokens in factory contract`);

      // Batch fetch all existing tokens from DB (MUCH faster than individual lookups)
      const existingTokens = await db.token.findMany({
        select: { address: true, metricsUpdatedAt: true },
      });
      const existingAddresses = new Set(existingTokens.map(t => t.address.toLowerCase()));
      const tokensNeedingMetrics = new Set(
        existingTokens
          .filter(t => !t.metricsUpdatedAt)
          .map(t => t.address.toLowerCase())
      );

      let synced = 0;
      let skipped = 0;
      let errors = 0;

      // Process in batches with concurrency
      const BATCH_SIZE = 10; // Process 10 tokens concurrently

      for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
        const batch = tokenAddresses.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (tokenAddress) => {
            const addr = tokenAddress.toLowerCase();

            if (existingAddresses.has(addr)) {
              // Only update if missing metrics or trading status changed
              if (tokensNeedingMetrics.has(addr)) {
                await this.updateTokenData(addr);
              }
              return 'skipped';
            } else {
              await this.syncTokenFromRPC(addr);
              return 'synced';
            }
          })
        );

        // Count results
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            if (result.value === 'synced') synced++;
            else skipped++;
          } else {
            errors++;
            logger.error(`Error syncing token ${batch[idx]}:`, result.reason?.message);
          }
        });

        // Progress log
        logger.info(`Progress: ${Math.min(i + BATCH_SIZE, tokenAddresses.length)}/${tokenAddresses.length} tokens processed (${synced} new, ${skipped} existing, ${errors} errors)`);
      }

      logger.info(`✅ Sync complete: ${synced} synced, ${skipped} updated, ${errors} errors`);
      return { synced, skipped, errors };
    } catch (error: any) {
      logger.error('Failed to sync tokens:', error);
      throw error;
    }
  }

  /**
   * Sync a single token using RPC calls
   */
  private async syncTokenFromRPC(tokenAddress: string): Promise<void> {
    const provider = rpcService.getProvider();

    // Get token basic info from ERC20 contract
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [name, symbol, totalSupply] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.totalSupply(),
    ]);

    // We don't have creator and metadata from RPC, set defaults
    const creator = ethers.ZeroAddress; // Unknown creator
    const metadataURI = '';
    const reserveRatio = 500000; // Default 50%
    const createdAt = new Date(); // Approximate - we don't have exact timestamp

    // Get marketplace info
    const [, , , tradingEnabled] =
      await this.marketplaceContract.getTokenInfo(tokenAddress);

    // Fetch metadata from IPFS (with timeout fallback)
    let metadata: any = null;
    try {
      metadata = await Promise.race([
        ipfsService.fetchMetadata(metadataURI),
        new Promise((_, reject) => setTimeout(() => reject(new Error('IPFS timeout')), 5000))
      ]);
    } catch (error) {
      logger.warn(`Failed to fetch metadata for ${tokenAddress}, using defaults`);
    }

    // Fetch initial metrics from blockchain
    let currentPrice = 0;
    let marketCap = 0;
    let currentSupply = totalSupply.toString();
    let reserveBalance = '0';
    let holderCount = 0;

    try {
      const [priceBigInt, marketInfo, holders] = await Promise.all([
        contractService.getCurrentPrice(tokenAddress),
        contractService.getTokenMarketInfo(tokenAddress),
        db.holder.count({
          where: {
            tokenAddress: tokenAddress.toLowerCase(),
            balance: { not: '0' },
          },
        }),
      ]);

      currentPrice = Number(priceBigInt) / 1e18;
      currentSupply = marketInfo.currentSupply.toString();
      reserveBalance = marketInfo.reserveBalance.toString();
      marketCap = (Number(currentSupply) / 1e18) * currentPrice;
      holderCount = holders;

      logger.debug(`Fetched metrics for ${tokenAddress}: price=${currentPrice}, marketCap=${marketCap}`);
    } catch (error) {
      logger.warn(`Failed to fetch metrics for ${tokenAddress}, will be updated by worker`);
    }

    // Create token in database with metrics
    await db.token.create({
      data: {
        address: tokenAddress.toLowerCase(),
        name,
        symbol,
        creator: creator.toLowerCase(),
        totalSupply: totalSupply.toString(),
        reserveRatio: Number(reserveRatio),
        metadataURI,
        metadataCache: metadata as any,
        logoURL: metadata?.image || null,
        description: metadata?.description || null,
        socialLinks: metadata?.social as any,
        blockNumber: BigInt(0), // Unknown
        transactionHash: '', // Unknown
        tradingEnabled,
        createdAt,
        // Initial metrics
        currentPrice,
        marketCap,
        currentSupply,
        reserveBalance,
        holderCount,
        metricsUpdatedAt: new Date(),
      },
    });

    logger.info(`✅ Synced token: ${name} (${symbol}) at ${tokenAddress}`);
  }

  /**
   * Update existing token data from blockchain
   * Backfills metrics for tokens that don't have them
   */
  private async updateTokenData(tokenAddress: string): Promise<void> {
    try {
      // Check if token already has metrics
      const token = await db.token.findUnique({
        where: { address: tokenAddress },
        select: { metricsUpdatedAt: true, tradingEnabled: true },
      });

      if (!token) return;

      // Get marketplace info
      const [, , , tradingEnabled] =
        await this.marketplaceContract.getTokenInfo(tokenAddress);

      // If token has metrics and tradingEnabled hasn't changed, skip
      if (token.metricsUpdatedAt && token.tradingEnabled === tradingEnabled) {
        return;
      }

      // Fetch metrics if missing or tradingEnabled changed
      let updateData: any = {};

      if (!token.metricsUpdatedAt) {
        // Backfill metrics
        const [priceBigInt, marketInfo, holderCount] = await Promise.all([
          contractService.getCurrentPrice(tokenAddress),
          contractService.getTokenMarketInfo(tokenAddress),
          db.holder.count({
            where: {
              tokenAddress: tokenAddress.toLowerCase(),
              balance: { not: '0' },
            },
          }),
        ]);

        const currentPrice = Number(priceBigInt) / 1e18;
        const currentSupply = marketInfo.currentSupply.toString();
        const reserveBalance = marketInfo.reserveBalance.toString();
        const marketCap = (Number(currentSupply) / 1e18) * currentPrice;

        updateData = {
          currentPrice,
          marketCap,
          currentSupply,
          reserveBalance,
          holderCount,
          metricsUpdatedAt: new Date(),
        };
      }

      // Update tradingEnabled if changed
      if (token.tradingEnabled !== tradingEnabled) {
        updateData.tradingEnabled = tradingEnabled;
      }

      // Perform update
      await db.token.update({
        where: { address: tokenAddress },
        data: updateData,
      });

      logger.debug(`Updated token ${tokenAddress}: ${JSON.stringify(updateData)}`);
    } catch (error: any) {
      logger.error(`Error updating token ${tokenAddress}:`, error.message);
    }
  }

  /**
   * Sync holders for a specific token
   * Uses Transfer events to build holder list
   */
  async syncTokenHolders(tokenAddress: string): Promise<number> {
    logger.info(`Syncing holders for token ${tokenAddress}...`);

    const provider = rpcService.getProvider();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    try {
      // Get all Transfer events from deployment
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = blockchainConfig.startBlock;

      // Fetch in batches to avoid RPC limits
      const batchSize = 5000;
      const holderBalances = new Map<string, bigint>();

      for (let block = fromBlock; block <= currentBlock; block += batchSize) {
        const toBlock = Math.min(block + batchSize - 1, currentBlock);

        const events = await tokenContract.queryFilter(
          tokenContract.filters.Transfer(),
          block,
          toBlock
        );

        // Process transfers to calculate balances
        for (const event of events) {
          // Type guard to check if event has args
          if (!('args' in event)) continue;

          const from = event.args?.[0]?.toLowerCase();
          const to = event.args?.[1]?.toLowerCase();
          const value = event.args?.[2] as bigint;

          // Subtract from sender (skip zero address - minting)
          if (from !== ethers.ZeroAddress) {
            const current = holderBalances.get(from) || 0n;
            holderBalances.set(from, current - value);
          }

          // Add to receiver (skip zero address - burning)
          if (to !== ethers.ZeroAddress) {
            const current = holderBalances.get(to) || 0n;
            holderBalances.set(to, current + value);
          }
        }

        logger.debug(`Processed blocks ${block}-${toBlock} (${events.length} transfers)`);
      }

      // Save to database
      let holdersCount = 0;
      for (const [holderAddress, balance] of holderBalances.entries()) {
        if (balance > 0n) {
          await db.holder.upsert({
            where: {
              tokenAddress_holderAddress: {
                tokenAddress: tokenAddress.toLowerCase(),
                holderAddress,
              },
            },
            create: {
              tokenAddress: tokenAddress.toLowerCase(),
              holderAddress,
              balance: balance.toString(),
            },
            update: {
              balance: balance.toString(),
            },
          });
          holdersCount++;
        }
      }

      logger.info(`✅ Synced ${holdersCount} holders for ${tokenAddress}`);
      return holdersCount;
    } catch (error: any) {
      logger.error(`Error syncing holders for ${tokenAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Quick health check
   */
  async getStatus(): Promise<{
    factoryTokenCount: number;
    dbTokenCount: number;
    syncNeeded: boolean;
  }> {
    const tokenAddresses: string[] = await this.factoryContract.getAllTokens();
    const factoryTokenCount = tokenAddresses.length;
    const dbTokenCount = await db.token.count();

    return {
      factoryTokenCount,
      dbTokenCount,
      syncNeeded: factoryTokenCount !== dbTokenCount,
    };
  }
}

// Export singleton
export const syncService = new SyncService();
