import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '@hodlfun/database';
import { PubSubService, CacheService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';
import { RpcService } from '../blockchain/rpc.service';
import { CORE_ABI, FACTORY_ABI, BONDING_CURVE_ABI } from '../blockchain/abis';

@Injectable()
export class EventProcessorService implements OnModuleInit {
  private readonly logger = new Logger(EventProcessorService.name);
  private isProcessing = false;
  private coreInterface: ethers.Interface;
  private factoryInterface: ethers.Interface;
  private bondingCurveInterface: ethers.Interface;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rpc: RpcService,
    private readonly pubsub: PubSubService,
    private readonly cache: CacheService,
    private readonly metrics: MetricsService,
  ) {
    this.coreInterface = new ethers.Interface(CORE_ABI);
    this.factoryInterface = new ethers.Interface(FACTORY_ABI);
    this.bondingCurveInterface = new ethers.Interface(BONDING_CURVE_ABI);
  }

  async onModuleInit() {
    this.logger.log('Event processor initialized');
  }

  @Interval(5000) // Poll every 5 seconds
  async processNewBlocks() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const currentBlock = await this.rpc.getBlockNumber();
      const state = await this.getIndexerState();
      const fromBlock = state.lastProcessedBlock + 1n;

      if (fromBlock > BigInt(currentBlock)) {
        this.metrics.indexerBlockLag.set(0);
        return;
      }

      const batchSize = parseInt(this.configService.get('INDEXER_BATCH_SIZE', '100'));
      const toBlock = Math.min(Number(fromBlock) + batchSize - 1, currentBlock);

      this.logger.debug(`Processing blocks ${fromBlock} to ${toBlock}`);
      this.metrics.indexerBlockLag.set(currentBlock - Number(fromBlock));

      await this.processBlockRange(Number(fromBlock), toBlock);
      await this.updateIndexerState(BigInt(toBlock));
    } catch (error) {
      this.logger.error(`Error processing blocks: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBlockRange(fromBlock: number, toBlock: number) {
    const coreAddress = this.configService.get('CORE_ADDRESS');
    const factoryAddress = this.configService.get('FACTORY_ADDRESS');

    // Fetch logs from Core and Factory
    const [coreLogs, factoryLogs] = await Promise.all([
      this.rpc.getLogs({
        address: coreAddress,
        fromBlock,
        toBlock,
      }),
      this.rpc.getLogs({
        address: factoryAddress,
        fromBlock,
        toBlock,
      }),
    ]);

    // Process in chronological order
    const allLogs = [...coreLogs, ...factoryLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.index - b.index;
    });

    for (const log of allLogs) {
      await this.processLog(log);
    }
  }

  private async processLog(log: ethers.Log) {
    const coreAddress = this.configService.get<string>('CORE_ADDRESS')?.toLowerCase();
    const factoryAddress = this.configService.get<string>('FACTORY_ADDRESS')?.toLowerCase();

    try {
      if (log.address.toLowerCase() === coreAddress) {
        await this.processCoreEvent(log);
      } else if (log.address.toLowerCase() === factoryAddress) {
        await this.processFactoryEvent(log);
      } else {
        // Try to parse as bonding curve event (each token has its own curve address)
        await this.processBondingCurveEvent(log);
      }
    } catch (error) {
      this.logger.error(`Error processing log: ${(error as Error).message}`, {
        txHash: log.transactionHash,
        logIndex: log.index,
      });
    }
  }

  private async processCoreEvent(log: ethers.Log) {
    const parsed = this.coreInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (!parsed) return;

    switch (parsed.name) {
      case 'CreateCurve':
        await this.handleCreateCurve(parsed, log);
        break;
      case 'Buy':
        await this.handleBuy(parsed, log);
        break;
      case 'Sell':
        await this.handleSell(parsed, log);
        break;
    }
  }

  private async processFactoryEvent(log: ethers.Log) {
    const parsed = this.factoryInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (!parsed) return;

    switch (parsed.name) {
      case 'Create':
        await this.handleFactoryCreate(parsed, log);
        break;
      case 'CreatorFeesAccumulated':
        await this.handleCreatorFeesAccumulated(parsed);
        break;
      case 'CreatorFeesClaimed':
        await this.handleCreatorFeesClaimed(parsed);
        break;
    }
  }

  private async processBondingCurveEvent(log: ethers.Log) {
    // Check if this is a known bonding curve by looking up the token
    const token = await this.prisma.token.findFirst({
      where: { curveAddress: log.address.toLowerCase() },
    });

    if (!token) return; // Not a tracked bonding curve

    const parsed = this.bondingCurveInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (!parsed) return;

    switch (parsed.name) {
      case 'Sync':
        await this.handleSync(parsed, token.address);
        break;
      case 'Lock':
        await this.handleLock(parsed);
        break;
      case 'Listing':
        await this.handleListing(parsed, log);
        break;
      case 'NewATHPrice':
        await this.handleNewATHPrice(parsed);
        break;
      case 'NewATHMarketCap':
        await this.handleNewATHMarketCap(parsed);
        break;
    }
  }

  private async handleCreateCurve(parsed: ethers.LogDescription, log: ethers.Log) {
    const { creator, curve, token, tokenURI, name, symbol } = parsed.args;

    // Initial values - will be updated by Factory Create event with actual virtual reserves
    // Using placeholder values that will be overwritten by handleFactoryCreate
    await this.prisma.token.upsert({
      where: { address: token.toLowerCase() },
      update: {},
      create: {
        address: token.toLowerCase(),
        curveAddress: curve.toLowerCase(),
        creatorAddress: creator.toLowerCase(),
        name,
        symbol,
        tokenUri: tokenURI,
        // These placeholders will be updated by the Factory.Create event handler
        virtualNative: '0',
        virtualToken: '0',
        k: '0',
        currentPrice: '0',
        marketCap: '0',
        realNative: '0',
        realToken: '0',
        status: 'TRADING',
        createdBlock: BigInt(log.blockNumber),
      },
    });

    // Publish event
    await this.pubsub.publish('token_created', {
      type: 'token_created',
      token: {
        address: token.toLowerCase(),
        name,
        symbol,
        creator: creator.toLowerCase(),
      },
    });

    // Invalidate cache
    await this.cache.invalidatePattern('tokens:*');
    this.metrics.tokensCreatedTotal.inc();
    this.metrics.indexerEventsProcessed.inc({ event_type: 'CreateCurve' });

    this.logger.log(`Token created: ${name} (${symbol}) at ${token}`);
  }

  private async handleBuy(parsed: ethers.LogDescription, log: ethers.Log) {
    const { token, to, amountIn, amountOut, price, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();
    const traderAddress = to.toLowerCase();

    // Check for duplicate
    const existingTrade = await this.prisma.trade.findUnique({
      where: { txHash: log.transactionHash },
    });

    if (existingTrade) {
      this.logger.debug(`Skipping duplicate trade: ${log.transactionHash}`);
      return;
    }

    // Insert trade
    await this.prisma.trade.create({
      data: {
        tokenAddress,
        type: 'BUY',
        traderAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        feeAmount: (BigInt(amountIn) / 100n).toString(),
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        timestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update or create holder
    await this.prisma.holder.upsert({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress: traderAddress },
      },
      update: {
        balance: {
          set: (await this.getUpdatedBalance(tokenAddress, traderAddress, amountOut, true)),
        },
        lastActivityTimestamp: new Date(Number(timestamp) * 1000),
      },
      create: {
        tokenAddress,
        holderAddress: traderAddress,
        balance: amountOut.toString(),
        firstBuyTimestamp: new Date(Number(timestamp) * 1000),
        lastActivityTimestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update token price
    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: { currentPrice: price.toString() },
    });

    // Publish trade event
    await this.pubsub.publish('trade', {
      type: 'trade',
      tokenAddress,
      trade: {
        type: 'BUY',
        trader: traderAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        txHash: log.transactionHash,
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);

    this.metrics.tradesTotal.inc({ type: 'BUY', status: 'success' });
    this.metrics.tradingVolume.inc({ type: 'BUY' }, Number(amountIn));
    this.metrics.indexerEventsProcessed.inc({ event_type: 'Buy' });
  }

  private async handleSell(parsed: ethers.LogDescription, log: ethers.Log) {
    const { token, from, amountIn, amountOut, price, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();
    const sellerAddress = from.toLowerCase();

    // Check for duplicate
    const existingTrade = await this.prisma.trade.findUnique({
      where: { txHash: log.transactionHash },
    });

    if (existingTrade) {
      this.logger.debug(`Skipping duplicate trade: ${log.transactionHash}`);
      return;
    }

    // Insert trade
    await this.prisma.trade.create({
      data: {
        tokenAddress,
        type: 'SELL',
        traderAddress: sellerAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        feeAmount: (BigInt(amountOut) / 100n).toString(),
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        timestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update holder balance
    const holder = await this.prisma.holder.findUnique({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress: sellerAddress },
      },
    });

    if (holder) {
      const newBalance = BigInt(holder.balance) - BigInt(amountIn);

      // Validate balance won't go negative
      if (newBalance < 0n) {
        this.logger.error(
          `Invalid balance detected: ${sellerAddress} attempting to sell ${amountIn} but only holds ${holder.balance} of token ${tokenAddress}`,
        );
        // Still update to match on-chain state, but log the anomaly
      }

      await this.prisma.holder.update({
        where: {
          tokenAddress_holderAddress: { tokenAddress, holderAddress: sellerAddress },
        },
        data: {
          balance: (newBalance < 0n ? 0n : newBalance).toString(),
          lastActivityTimestamp: new Date(Number(timestamp) * 1000),
        },
      });
    }

    // Update token price
    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: { currentPrice: price.toString() },
    });

    // Publish trade event
    await this.pubsub.publish('trade', {
      type: 'trade',
      tokenAddress,
      trade: {
        type: 'SELL',
        trader: sellerAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        txHash: log.transactionHash,
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);

    this.metrics.tradesTotal.inc({ type: 'SELL', status: 'success' });
    this.metrics.tradingVolume.inc({ type: 'SELL' }, Number(amountOut));
    this.metrics.indexerEventsProcessed.inc({ event_type: 'Sell' });
  }

  private async handleFactoryCreate(parsed: ethers.LogDescription, _log: ethers.Log) {
    const { virtualNative, virtualToken, token } = parsed.args;
    const k = (BigInt(virtualNative) * BigInt(virtualToken)).toString();

    // Calculate initial price: virtualNative / virtualToken (scaled to 18 decimals)
    const PRECISION = 10n ** 18n;
    const initialPrice = (BigInt(virtualNative) * PRECISION) / BigInt(virtualToken);

    // Calculate initial market cap: price * total supply (1B tokens = 10^27 with 18 decimals)
    const TOTAL_SUPPLY = 10n ** 27n; // 1 billion tokens with 18 decimals
    const marketCap = (initialPrice * TOTAL_SUPPLY) / PRECISION;

    await this.prisma.token.update({
      where: { address: token.toLowerCase() },
      data: {
        virtualNative: virtualNative.toString(),
        virtualToken: virtualToken.toString(),
        k,
        currentPrice: initialPrice.toString(),
        marketCap: marketCap.toString(),
      },
    });

    this.metrics.indexerEventsProcessed.inc({ event_type: 'FactoryCreate' });
  }

  private async handleCreatorFeesAccumulated(parsed: ethers.LogDescription) {
    const { creator, totalAccumulated } = parsed.args;

    await this.prisma.creatorFee.upsert({
      where: { creatorAddress: creator.toLowerCase() },
      update: {
        accumulatedFees: totalAccumulated.toString(),
        lastAccumulationTimestamp: new Date(),
      },
      create: {
        creatorAddress: creator.toLowerCase(),
        accumulatedFees: totalAccumulated.toString(),
        lastAccumulationTimestamp: new Date(),
      },
    });

    this.metrics.indexerEventsProcessed.inc({ event_type: 'CreatorFeesAccumulated' });
  }

  private async handleCreatorFeesClaimed(parsed: ethers.LogDescription) {
    const { creator, amount } = parsed.args;

    const creatorFee = await this.prisma.creatorFee.findUnique({
      where: { creatorAddress: creator.toLowerCase() },
    });

    if (creatorFee) {
      const newClaimedFees = BigInt(creatorFee.claimedFees) + BigInt(amount);
      await this.prisma.creatorFee.update({
        where: { creatorAddress: creator.toLowerCase() },
        data: {
          claimedFees: newClaimedFees.toString(),
          lastClaimTimestamp: new Date(),
        },
      });
    }

    this.metrics.indexerEventsProcessed.inc({ event_type: 'CreatorFeesClaimed' });
    this.logger.log(`Creator ${creator} claimed ${amount} in fees`);
  }

  private async handleSync(parsed: ethers.LogDescription, tokenAddress: string) {
    const { realNative, realToken, virtualNative, virtualToken, price } = parsed.args;

    // Calculate market cap from price and circulating supply
    const PRECISION = 10n ** 18n;
    const TOTAL_SUPPLY = 10n ** 27n;
    const marketCap = (BigInt(price) * TOTAL_SUPPLY) / PRECISION;

    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: {
        realNative: realNative.toString(),
        realToken: realToken.toString(),
        virtualNative: virtualNative.toString(),
        virtualToken: virtualToken.toString(),
        currentPrice: price.toString(),
        marketCap: marketCap.toString(),
      },
    });

    // Publish price update for WebSocket clients
    await this.pubsub.publish('price_update', {
      type: 'price_update',
      tokenAddress,
      price: price.toString(),
      marketCap: marketCap.toString(),
      reserves: {
        realNative: realNative.toString(),
        realToken: realToken.toString(),
        virtualNative: virtualNative.toString(),
        virtualToken: virtualToken.toString(),
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);

    this.metrics.indexerEventsProcessed.inc({ event_type: 'Sync' });
  }

  private async handleLock(parsed: ethers.LogDescription) {
    const { token } = parsed.args;
    const tokenAddress = token.toLowerCase();

    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: {
        status: 'LOCKED',
        graduatedAt: new Date(),
      },
    });

    // Publish graduation event for WebSocket clients
    await this.pubsub.publish('graduation', {
      type: 'graduation',
      tokenAddress,
      status: 'LOCKED',
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidatePattern('tokens:*');

    this.metrics.indexerEventsProcessed.inc({ event_type: 'Lock' });
    this.logger.log(`Token ${tokenAddress} has graduated (locked)`);
  }

  private async handleListing(parsed: ethers.LogDescription, log: ethers.Log) {
    const { token, pool, amount0, amount1, liquidity } = parsed.args;
    const tokenAddress = token.toLowerCase();

    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: {
        status: 'LISTED',
        poolAddress: pool.toLowerCase(),
        listedAt: new Date(),
        listingBlock: BigInt(log.blockNumber),
      },
    });

    // Publish listing event for WebSocket clients
    await this.pubsub.publish('listing', {
      type: 'listing',
      tokenAddress,
      poolAddress: pool.toLowerCase(),
      liquidity: {
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        liquidity: liquidity.toString(),
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidatePattern('tokens:*');

    this.metrics.indexerEventsProcessed.inc({ event_type: 'Listing' });
    this.logger.log(`Token ${tokenAddress} listed on DEX at pool ${pool}`);
  }

  private async handleNewATHPrice(parsed: ethers.LogDescription) {
    const { token, newPrice, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();

    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: {
        athPrice: newPrice.toString(),
        athPriceTimestamp: new Date(Number(timestamp) * 1000),
      },
    });

    this.metrics.indexerEventsProcessed.inc({ event_type: 'NewATHPrice' });
    this.logger.log(`Token ${tokenAddress} reached new ATH price: ${newPrice}`);
  }

  private async handleNewATHMarketCap(parsed: ethers.LogDescription) {
    const { token, newMarketCap, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();

    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: {
        athMarketCap: newMarketCap.toString(),
        athMarketCapTimestamp: new Date(Number(timestamp) * 1000),
      },
    });

    this.metrics.indexerEventsProcessed.inc({ event_type: 'NewATHMarketCap' });
    this.logger.log(`Token ${tokenAddress} reached new ATH market cap: ${newMarketCap}`);
  }

  private async getUpdatedBalance(
    tokenAddress: string,
    holderAddress: string,
    amountChange: bigint,
    isAdd: boolean,
  ): Promise<string> {
    const holder = await this.prisma.holder.findUnique({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress },
      },
    });

    const currentBalance = holder ? BigInt(holder.balance) : 0n;
    const newBalance = isAdd ? currentBalance + amountChange : currentBalance - amountChange;
    return newBalance.toString();
  }

  private async getIndexerState() {
    let state = await this.prisma.indexerState.findUnique({
      where: { id: 'main' },
    });

    if (!state) {
      const startBlock = parseInt(this.configService.get('INDEXER_START_BLOCK', '0'));
      state = await this.prisma.indexerState.create({
        data: {
          id: 'main',
          lastProcessedBlock: BigInt(startBlock),
        },
      });
    }

    return state;
  }

  private async updateIndexerState(blockNumber: bigint) {
    await this.prisma.indexerState.update({
      where: { id: 'main' },
      data: { lastProcessedBlock: blockNumber },
    });
  }
}
