// Blockchain event indexer - Indexes all token events

import { rpcService } from '../services/rpcService';
import { contractService } from '../services/contractService';
import { ipfsService } from '../services/ipfsService';
import { db } from '../config/database';
import { blockchainConfig, indexerConfig } from '../config';
import logger from '../utils/logger';
// Types for event handling (used for type safety)
// @ts-ignore - Type imports for event handling
import type { TokenCreatedEvent, TokensBoughtEvent, TokensSoldEvent } from '../types';
import { ethers } from 'ethers';

export class BlockchainIndexer {
  private isRunning = false;
  private currentBlock = 0;
  private lastProcessedBlock = 0;

  constructor() {
    this.currentBlock = blockchainConfig.startBlock;
  }

  /**
   * Start the indexer
   */
  async start(): Promise<void> {
    if (!indexerConfig.enabled) {
      logger.info('Indexer is disabled in config');
      return;
    }

    if (this.isRunning) {
      logger.warn('Indexer is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting blockchain indexer...');

    // Load last processed block from database
    await this.loadLastProcessedBlock();

    // Start indexing loop
    this.indexLoop();
  }

  /**
   * Stop the indexer
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Stopping blockchain indexer...');
  }

  /**
   * Main indexing loop
   */
  private async indexLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processNewBlocks();
        await this.sleep(indexerConfig.pollInterval);
      } catch (error) {
        logger.error('Error in indexing loop:', error);
        await this.sleep(5000); // Wait 5s on error
      }
    }
  }

  /**
   * Process new blocks
   */
  private async processNewBlocks(): Promise<void> {
    try {
      const latestBlock = await rpcService.getBlockNumber();

      // Wait for confirmations
      const targetBlock = latestBlock - blockchainConfig.confirmations;

      if (this.currentBlock > targetBlock) {
        return; // No new blocks to process
      }

      // Process in batches
      const toBlock = Math.min(
        this.currentBlock + indexerConfig.batchSize,
        targetBlock
      );

      logger.info(`Indexing blocks ${this.currentBlock} to ${toBlock}`);

      // Index events in parallel
      await Promise.all([
        this.indexTokenCreatedEvents(this.currentBlock, toBlock),
        this.indexTokenListedEvents(this.currentBlock, toBlock),
        this.indexTradingEvents(this.currentBlock, toBlock),
      ]);

      // Update current block
      this.lastProcessedBlock = toBlock;
      this.currentBlock = toBlock + 1;

      // Save progress
      await this.saveLastProcessedBlock();

    } catch (error) {
      logger.error('Error processing blocks:', error);
      throw error;
    }
  }

  /**
   * Index TokenCreated events
   */
  private async indexTokenCreatedEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      const events = await contractService.getTokenCreatedEvents(fromBlock, toBlock);

      logger.info(`Found ${events.length} TokenCreated events`);

      for (const event of events) {
        await this.handleTokenCreated(event);
      }
    } catch (error) {
      logger.error('Error indexing TokenCreated events:', error);
    }
  }

  /**
   * Index TokenListed events
   */
  private async indexTokenListedEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      const events = await contractService.getTokenListedEvents(fromBlock, toBlock);

      logger.info(`Found ${events.length} TokenListed events`);

      for (const event of events) {
        await this.handleTokenListed(event);
      }
    } catch (error) {
      logger.error('Error indexing TokenListed events:', error);
    }
  }

  /**
   * Index trading events (buy/sell)
   */
  private async indexTradingEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    try {
      const [buyEvents, sellEvents] = await Promise.all([
        contractService.getTokensBoughtEvents(fromBlock, toBlock),
        contractService.getTokensSoldEvents(fromBlock, toBlock),
      ]);

      logger.info(`Found ${buyEvents.length} buy and ${sellEvents.length} sell events`);

      // Process buy events
      for (const event of buyEvents) {
        await this.handleTokensBought(event);
      }

      // Process sell events
      for (const event of sellEvents) {
        await this.handleTokensSold(event);
      }
    } catch (error) {
      logger.error('Error indexing trading events:', error);
    }
  }

  /**
   * Handle TokenCreated event
   */
  private async handleTokenCreated(event: any): Promise<void> {
    try {
      const tokenAddress = event.args[0].toLowerCase();
      const creator = event.args[1].toLowerCase();
      const name = event.args[2];
      const symbol = event.args[3];
      const totalSupply = event.args[4];
      const reserveRatio = event.args[5];
      const metadataURI = event.args[6];

      // Check if token already exists
      const existing = await db.token.findUnique({
        where: { address: tokenAddress },
      });

      if (existing) {
        logger.debug(`Token ${tokenAddress} already indexed`);
        return;
      }

      // Fetch metadata from IPFS
      const metadata = await ipfsService.fetchMetadata(metadataURI);

      // Get block details
      const block = await event.getBlock();

      // Fetch initial price and market metrics from blockchain
      let currentPrice = 0;
      let marketCap = 0;
      let currentSupply = totalSupply.toString();
      let reserveBalance = '0';

      try {
        // Get current price from marketplace
        const priceBigInt = await contractService.getCurrentPrice(tokenAddress);
        currentPrice = Number(priceBigInt) / 1e18;

        // Get market info (current supply and reserve balance)
        const marketInfo = await contractService.getTokenMarketInfo(tokenAddress);
        currentSupply = marketInfo.currentSupply.toString();
        reserveBalance = marketInfo.reserveBalance.toString();

        // Calculate market cap = currentSupply * price
        marketCap = (Number(currentSupply) / 1e18) * currentPrice;

        logger.debug(`Fetched metrics for ${tokenAddress}: price=${currentPrice}, marketCap=${marketCap}`);
      } catch (error) {
        logger.warn(`Failed to fetch initial metrics for ${tokenAddress}:`, error);
        // Continue with defaults (0 values)
      }

      // Use upsert to avoid race conditions
      await db.token.upsert({
        where: { address: tokenAddress },
        create: {
          address: tokenAddress,
          name,
          symbol,
          creator,
          totalSupply: totalSupply.toString(),
          reserveRatio: Number(reserveRatio),
          metadataURI,
          metadataCache: metadata as any,
          logoURL: metadata?.image,
          description: metadata?.description,
          socialLinks: metadata?.social as any,
          blockNumber: BigInt(event.blockNumber),
          transactionHash: event.transactionHash,
          tradingEnabled: false, // Will be updated when marketplace enables trading
          createdAt: new Date(block.timestamp * 1000),
          // Store initial metrics
          currentPrice,
          marketCap,
          currentSupply,
          reserveBalance,
          metricsUpdatedAt: new Date(),
        },
        update: {
          // If already exists, just keep it as is (this shouldn't happen due to check above)
        },
      });

      // Check if transaction already exists to avoid duplicates
      const existingTx = await db.transaction.findUnique({
        where: { hash: event.transactionHash },
      });

      if (!existingTx) {
        // Create initial transaction record
        await db.transaction.create({
          data: {
            hash: event.transactionHash,
            userAddress: creator,
            tokenAddress,
            type: 'CREATE',
            amountIn: '0',
            amountOut: totalSupply.toString(),
            price: 0,
            blockNumber: BigInt(event.blockNumber),
            timestamp: new Date(block.timestamp * 1000),
          },
        });
      }

      logger.info(`✅ Indexed new token: ${name} (${symbol}) at ${tokenAddress}`);
    } catch (error) {
      logger.error(`Error handling TokenCreated event:`, error);
    }
  }

  /**
   * Handle TokenListed event
   */
  private async handleTokenListed(event: any): Promise<void> {
    try {
      const tokenAddress = event.args[0].toLowerCase();
      const creator = event.args[1].toLowerCase();
      const metadataURI = event.args[2];
      const totalSupply = event.args[3];
      const reserveRatio = event.args[4];

      // Check if token already exists
      const existing = await db.token.findUnique({
        where: { address: tokenAddress },
      });

      if (existing) {
        logger.debug(`Token ${tokenAddress} already indexed, updating tradingEnabled flag`);
        // Update trading status if needed
        if (!existing.tradingEnabled) {
          await db.token.update({
            where: { address: tokenAddress },
            data: { tradingEnabled: true },
          });
          logger.info(`✅ Updated token ${tokenAddress} - trading now enabled`);
        }
        return;
      }

      // Fetch token name and symbol from contract
      const provider = rpcService.getProvider();
      const tokenContract = new ethers.Contract(tokenAddress, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
      ], provider);

      const [name, symbol] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
      ]);

      // Fetch metadata from IPFS
      const metadata = await ipfsService.fetchMetadata(metadataURI);

      // Get block details
      const block = await event.getBlock();

      // Fetch initial price and market metrics from blockchain
      let currentPrice = 0;
      let marketCap = 0;
      let currentSupply = totalSupply.toString();
      let reserveBalance = '0';

      try {
        // Get current price from marketplace
        const priceBigInt = await contractService.getCurrentPrice(tokenAddress);
        currentPrice = Number(priceBigInt) / 1e18;

        // Get market info (current supply and reserve balance)
        const marketInfo = await contractService.getTokenMarketInfo(tokenAddress);
        currentSupply = marketInfo.currentSupply.toString();
        reserveBalance = marketInfo.reserveBalance.toString();

        // Calculate market cap = currentSupply * price
        marketCap = (Number(currentSupply) / 1e18) * currentPrice;

        logger.debug(`Fetched metrics for ${tokenAddress}: price=${currentPrice}, marketCap=${marketCap}`);
      } catch (error) {
        logger.warn(`Failed to fetch initial metrics for ${tokenAddress}:`, error);
        // Continue with defaults (0 values)
      }

      // Use upsert to avoid race conditions
      await db.token.upsert({
        where: { address: tokenAddress },
        create: {
          address: tokenAddress,
          name,
          symbol,
          creator,
          totalSupply: totalSupply.toString(),
          reserveRatio: Number(reserveRatio),
          metadataURI,
          metadataCache: metadata as any,
          logoURL: metadata?.image,
          description: metadata?.description,
          socialLinks: metadata?.social as any,
          blockNumber: BigInt(event.blockNumber),
          transactionHash: event.transactionHash,
          tradingEnabled: true, // TokenListed means it's already on marketplace
          createdAt: new Date(block.timestamp * 1000),
          // Store initial metrics
          currentPrice,
          marketCap,
          currentSupply,
          reserveBalance,
          metricsUpdatedAt: new Date(),
        },
        update: {
          tradingEnabled: true, // Update trading status if token already exists
          // Update metrics if token already exists
          currentPrice,
          marketCap,
          currentSupply,
          reserveBalance,
          metricsUpdatedAt: new Date(),
        },
      });

      // Check if transaction already exists to avoid duplicates
      const existingTx = await db.transaction.findUnique({
        where: { hash: event.transactionHash },
      });

      if (!existingTx) {
        // Create initial transaction record
        await db.transaction.create({
          data: {
            hash: event.transactionHash,
            userAddress: creator,
            tokenAddress,
            type: 'CREATE',
            amountIn: '0',
            amountOut: totalSupply.toString(),
            price: 0,
            blockNumber: BigInt(event.blockNumber),
            timestamp: new Date(block.timestamp * 1000),
          },
        });
      }

      logger.info(`✅ Indexed new token via TokenListed: ${name} (${symbol}) at ${tokenAddress}`);
    } catch (error) {
      logger.error(`Error handling TokenListed event:`, error);
    }
  }

  /**
   * Handle TokensBought event
   */
  private async handleTokensBought(event: any): Promise<void> {
    try {
      const tokenAddress = event.args[0].toLowerCase();
      const buyer = event.args[1].toLowerCase();
      const ethAmount = event.args[2];
      const tokenAmount = event.args[3];
      // const newPrice = event.args[4];

      // Calculate price
      const price = Number(ethAmount) / Number(tokenAmount);

      // Check if transaction already indexed
      const existingTx = await db.transaction.findUnique({
        where: { hash: event.transactionHash },
      });

      if (existingTx) {
        logger.debug(`Transaction ${event.transactionHash} already indexed`);
        return;
      }

      // Get block details
      const block = await event.getBlock();

      // Create transaction record
      await db.transaction.create({
        data: {
          hash: event.transactionHash,
          userAddress: buyer,
          tokenAddress,
          type: 'BUY',
          amountIn: ethAmount.toString(),
          amountOut: tokenAmount.toString(),
          price,
          blockNumber: BigInt(event.blockNumber),
          timestamp: new Date(block.timestamp * 1000),
        },
      });

      // Update or create holder record
      await this.updateHolderBalance(tokenAddress, buyer);

      // Update portfolio
      await this.updateUserPortfolio(buyer, tokenAddress);

      // Update token metrics (price, marketCap, etc.)
      await this.updateTokenMetrics(tokenAddress);

      logger.debug(`Indexed buy transaction: ${event.transactionHash}`);
    } catch (error) {
      logger.error(`Error handling TokensBought event:`, error);
    }
  }

  /**
   * Handle TokensSold event
   */
  private async handleTokensSold(event: any): Promise<void> {
    try {
      const tokenAddress = event.args[0].toLowerCase();
      const seller = event.args[1].toLowerCase();
      const tokenAmount = event.args[2];
      const ethAmount = event.args[3];
      // const newPrice = event.args[4];

      // Calculate price
      const price = Number(ethAmount) / Number(tokenAmount);

      // Check if transaction already indexed
      const existingTx = await db.transaction.findUnique({
        where: { hash: event.transactionHash },
      });

      if (existingTx) {
        logger.debug(`Transaction ${event.transactionHash} already indexed`);
        return;
      }

      // Get block details
      const block = await event.getBlock();

      // Create transaction record
      await db.transaction.create({
        data: {
          hash: event.transactionHash,
          userAddress: seller,
          tokenAddress,
          type: 'SELL',
          amountIn: tokenAmount.toString(),
          amountOut: ethAmount.toString(),
          price,
          blockNumber: BigInt(event.blockNumber),
          timestamp: new Date(block.timestamp * 1000),
        },
      });

      // Update holder balance
      await this.updateHolderBalance(tokenAddress, seller);

      // Update portfolio
      await this.updateUserPortfolio(seller, tokenAddress);

      // Update token metrics (price, marketCap, etc.)
      await this.updateTokenMetrics(tokenAddress);

      logger.debug(`Indexed sell transaction: ${event.transactionHash}`);
    } catch (error) {
      logger.error(`Error handling TokensSold event:`, error);
    }
  }

  /**
   * Update holder balance
   */
  private async updateHolderBalance(
    tokenAddress: string,
    holderAddress: string
  ): Promise<void> {
    try {
      // Get current balance from blockchain
      const balance = await contractService.getTokenBalance(tokenAddress, holderAddress);

      // Update or create holder record
      await db.holder.upsert({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress,
            holderAddress,
          },
        },
        create: {
          tokenAddress,
          holderAddress,
          balance: balance.toString(),
        },
        update: {
          balance: balance.toString(),
        },
      });
    } catch (error) {
      logger.error(`Error updating holder balance:`, error);
    }
  }

  /**
   * Update user portfolio
   * Uses weighted average cost basis method for PnL calculation
   */
  private async updateUserPortfolio(
    userAddress: string,
    tokenAddress: string
  ): Promise<void> {
    try {
      // Get current balance
      const balance = await contractService.getTokenBalance(tokenAddress, userAddress);

      // Get user transactions for this token
      const transactions = await db.transaction.findMany({
        where: {
          userAddress,
          tokenAddress,
        },
        orderBy: { timestamp: 'asc' },
      });

      // Use weighted average cost basis method for accurate PnL tracking
      // This properly tracks cost basis through buys and sells
      let totalCostBasis = 0; // Total cost of tokens currently held
      let tokensHeld = 0; // Number of tokens currently held
      let realizedPnL = 0; // Profit/loss from completed sales
      let totalInvested = 0; // Total ETH ever invested (for reference)

      for (const tx of transactions) {
        if (tx.type === 'BUY') {
          const ethSpent = Number(tx.amountIn) / 1e18;
          const tokensBought = Number(tx.amountOut) / 1e18;

          // Add to cost basis and token count
          totalCostBasis += ethSpent;
          tokensHeld += tokensBought;
          totalInvested += ethSpent;

        } else if (tx.type === 'SELL') {
          const tokensSold = Number(tx.amountIn) / 1e18;
          const ethReceived = Number(tx.amountOut) / 1e18;

          // Calculate cost basis of tokens being sold (weighted average)
          const avgCostPerToken = tokensHeld > 0 ? totalCostBasis / tokensHeld : 0;
          const costBasisOfSoldTokens = avgCostPerToken * tokensSold;

          // Realized PnL = ETH received - cost basis of sold tokens
          realizedPnL += ethReceived - costBasisOfSoldTokens;

          // Remove sold tokens from holdings
          tokensHeld -= tokensSold;
          totalCostBasis -= costBasisOfSoldTokens;

          // Prevent negative values due to floating point errors
          if (tokensHeld < 0.0000001) tokensHeld = 0;
          if (totalCostBasis < 0) totalCostBasis = 0;

        } else if (tx.type === 'CREATE') {
          // Token creators receive initial supply at zero cost
          const tokensCreated = Number(tx.amountOut) / 1e18;
          tokensHeld += tokensCreated;
          // Cost basis is 0 for created tokens (they didn't pay for them)
        }
      }

      // Calculate average price (cost per token currently held)
      const averagePrice = tokensHeld > 0 ? totalCostBasis / tokensHeld : 0;

      // Get current price
      const currentPriceBigInt = await contractService.getCurrentPrice(tokenAddress);
      const currentPrice = Number(currentPriceBigInt) / 1e18;

      // Calculate unrealized PnL on remaining holdings
      const currentBalance = Number(balance) / 1e18;
      const currentValue = currentPrice * currentBalance;
      const unrealizedPnL = currentBalance > 0 ? currentValue - totalCostBasis : 0;

      // Update portfolio
      await db.userPortfolio.upsert({
        where: {
          userAddress_tokenAddress: {
            userAddress,
            tokenAddress,
          },
        },
        create: {
          userAddress,
          tokenAddress,
          balance: balance.toString(),
          averagePrice,
          totalInvested,
          realizedPnL,
          unrealizedPnL,
        },
        update: {
          balance: balance.toString(),
          averagePrice,
          totalInvested,
          realizedPnL,
          unrealizedPnL,
        },
      });
    } catch (error) {
      logger.error(`Error updating user portfolio:`, error);
    }
  }

  /**
   * Update token metrics (price, marketCap, volume, etc.)
   */
  private async updateTokenMetrics(tokenAddress: string): Promise<void> {
    try {
      // Fetch current price and market info from blockchain
      const [priceBigInt, marketInfo, holderCount] = await Promise.all([
        contractService.getCurrentPrice(tokenAddress),
        contractService.getTokenMarketInfo(tokenAddress),
        db.holder.count({
          where: {
            tokenAddress,
            balance: { not: '0' },
          },
        }),
      ]);

      const currentPrice = Number(priceBigInt) / 1e18;
      const currentSupply = marketInfo.currentSupply.toString();
      const reserveBalance = marketInfo.reserveBalance.toString();
      const marketCap = (Number(currentSupply) / 1e18) * currentPrice;

      // Calculate 24h volume from transactions
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTrades = await db.transaction.findMany({
        where: {
          tokenAddress,
          type: { in: ['BUY', 'SELL'] },
          timestamp: { gte: twentyFourHoursAgo },
        },
      });

      const volume24h = recentTrades.reduce((sum, tx) => {
        // For buy transactions, count ETH spent (amountIn)
        // For sell transactions, count ETH received (amountOut)
        const ethAmount = tx.type === 'BUY'
          ? Number(tx.amountIn) / 1e18
          : Number(tx.amountOut) / 1e18;
        return sum + ethAmount;
      }, 0);

      // Calculate 24h price change
      // Find the trade closest to 24 hours ago (not just the oldest in the range)
      let priceChange24h = 0;
      if (recentTrades.length > 0) {
        const twentyFourHoursAgoTime = twentyFourHoursAgo.getTime();

        // Sort by timestamp ascending
        const sortedTrades = [...recentTrades].sort((a, b) =>
          a.timestamp.getTime() - b.timestamp.getTime()
        );

        // Find the trade closest to 24h ago for baseline price
        let baselinePrice = sortedTrades[0]?.price || currentPrice;
        let closestTimeDiff = Math.abs(sortedTrades[0]?.timestamp.getTime() - twentyFourHoursAgoTime);

        for (const trade of sortedTrades) {
          const timeDiff = Math.abs(trade.timestamp.getTime() - twentyFourHoursAgoTime);
          if (timeDiff < closestTimeDiff) {
            closestTimeDiff = timeDiff;
            baselinePrice = trade.price;
          }
        }

        // Calculate percentage change from baseline
        if (baselinePrice > 0) {
          priceChange24h = ((currentPrice - baselinePrice) / baselinePrice) * 100;
        }
      }

      // Update token record with new metrics
      await db.token.update({
        where: { address: tokenAddress },
        data: {
          currentPrice,
          marketCap,
          volume24h,
          priceChange24h,
          currentSupply,
          reserveBalance,
          holderCount,
          metricsUpdatedAt: new Date(),
        },
      });

      logger.debug(`Updated metrics for ${tokenAddress}: price=${currentPrice}, marketCap=${marketCap}, volume24h=${volume24h}`);
    } catch (error) {
      logger.error(`Error updating token metrics for ${tokenAddress}:`, error);
    }
  }

  /**
   * Load last processed block from database
   */
  private async loadLastProcessedBlock(): Promise<void> {
    try {
      // Check if we should start from current block (skip historical sync)
      const startFromCurrent = process.env.INDEXER_START_FROM_CURRENT === 'true';

      if (startFromCurrent) {
        // Get current block number from blockchain
        const currentBlockNumber = await rpcService.getBlockNumber();
        this.currentBlock = currentBlockNumber;
        this.lastProcessedBlock = currentBlockNumber - 1;
        logger.info(`🚀 Starting from CURRENT block ${this.currentBlock} (historical sync skipped)`);
        logger.info(`💡 To sync historical data, run: npm run sync`);
        return;
      }

      // Get the highest block number from transactions
      const lastTransaction = await db.transaction.findFirst({
        orderBy: { blockNumber: 'desc' },
        select: { blockNumber: true },
      });

      if (lastTransaction) {
        this.currentBlock = Number(lastTransaction.blockNumber) + 1;
        this.lastProcessedBlock = Number(lastTransaction.blockNumber);
        logger.info(`Resuming from block ${this.currentBlock}`);
      } else {
        logger.info(`Starting from genesis block ${blockchainConfig.startBlock}`);
      }
    } catch (error) {
      logger.error('Error loading last processed block:', error);
    }
  }

  /**
   * Save last processed block
   */
  private async saveLastProcessedBlock(): Promise<void> {
    // Block number is implicitly saved via transaction records
    // This is more reliable than a separate state table
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get indexer status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentBlock: this.currentBlock,
      lastProcessedBlock: this.lastProcessedBlock,
    };
  }
}

// Export singleton instance
export const blockchainIndexer = new BlockchainIndexer();

// Start indexer if running as main module
if (require.main === module) {
  blockchainIndexer.start().catch((error) => {
    logger.error('Failed to start indexer:', error);
    process.exit(1);
  });
}
