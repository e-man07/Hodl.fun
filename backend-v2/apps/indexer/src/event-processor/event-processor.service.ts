import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '@hodlfun/database';
import { Prisma } from '@prisma/client';
import { PubSubService, CacheService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';
import { RpcService } from '../blockchain/rpc.service';
import { WebSocketService } from '../blockchain/websocket.service';
import { CORE_ABI, FACTORY_ABI, BONDING_CURVE_ABI } from '../blockchain/abis';

@Injectable()
export class EventProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventProcessorService.name);
  private isProcessing = false;
  private coreInterface: ethers.Interface;
  private factoryInterface: ethers.Interface;
  private bondingCurveInterface: ethers.Interface;

  // WebSocket contracts for real-time event listening
  private coreContract: ethers.Contract | null = null;
  private factoryContract: ethers.Contract | null = null;
  private wsBlockUnsubscribe: (() => void) | null = null;
  private isWebSocketMode = false;
  private lastWebSocketBlock = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rpc: RpcService,
    private readonly ws: WebSocketService,
    private readonly pubsub: PubSubService,
    private readonly cache: CacheService,
    private readonly metrics: MetricsService,
  ) {
    this.coreInterface = new ethers.Interface(CORE_ABI);
    this.factoryInterface = new ethers.Interface(FACTORY_ABI);
    this.bondingCurveInterface = new ethers.Interface(BONDING_CURVE_ABI);
  }

  async onModuleInit() {
    this.logger.log('Event processor initializing...');

    // First, do historical backfill
    await this.backfillMissedBlocks();

    // Then set up WebSocket for real-time events
    await this.setupWebSocketListeners();

    this.logger.log('Event processor initialized');
  }

  async onModuleDestroy() {
    this.cleanupWebSocketListeners();
  }

  // =========================================================================
  // WebSocket Event Listening (Real-time)
  // =========================================================================

  private async setupWebSocketListeners() {
    if (!this.ws.isConnected()) {
      this.logger.warn('WebSocket not connected, falling back to polling mode');
      this.isWebSocketMode = false;
      return;
    }

    const coreAddress = this.configService.get<string>('CORE_ADDRESS');
    const factoryAddress = this.configService.get<string>('FACTORY_ADDRESS');

    if (!coreAddress || !factoryAddress) {
      this.logger.error('CORE_ADDRESS or FACTORY_ADDRESS not configured');
      return;
    }

    try {
      // Create contract instances for event listening
      this.coreContract = this.ws.getContract(coreAddress, CORE_ABI);
      this.factoryContract = this.ws.getContract(factoryAddress, FACTORY_ABI);

      if (!this.coreContract || !this.factoryContract) {
        this.logger.warn('Failed to create contract instances, falling back to polling');
        this.isWebSocketMode = false;
        return;
      }

      // Subscribe to Core events
      this.coreContract.on('CreateCurve', this.handleCreateCurveWs.bind(this));
      this.coreContract.on('Buy', this.handleBuyWs.bind(this));
      this.coreContract.on('Sell', this.handleSellWs.bind(this));

      // Subscribe to Factory events
      this.factoryContract.on('Create', this.handleFactoryCreateWs.bind(this));
      this.factoryContract.on('CreatorFeesAccumulated', this.handleCreatorFeesAccumulatedWs.bind(this));
      this.factoryContract.on('CreatorFeesClaimed', this.handleCreatorFeesClaimedWs.bind(this));

      // Subscribe to new blocks to track progress
      this.wsBlockUnsubscribe = this.ws.onBlock((blockNumber) => {
        this.lastWebSocketBlock = blockNumber;
        this.metrics.indexerBlockLag.set(0); // Real-time, no lag
      });

      this.isWebSocketMode = true;
      this.logger.log('WebSocket event listeners set up successfully');
      this.logger.log(`Listening to Core: ${coreAddress}`);
      this.logger.log(`Listening to Factory: ${factoryAddress}`);
    } catch (error) {
      this.logger.error(`Failed to set up WebSocket listeners: ${(error as Error).message}`);
      this.isWebSocketMode = false;
    }
  }

  private cleanupWebSocketListeners() {
    if (this.wsBlockUnsubscribe) {
      this.wsBlockUnsubscribe();
      this.wsBlockUnsubscribe = null;
    }

    if (this.coreContract) {
      this.coreContract.removeAllListeners();
      this.coreContract = null;
    }

    if (this.factoryContract) {
      this.factoryContract.removeAllListeners();
      this.factoryContract = null;
    }

    this.isWebSocketMode = false;
    this.logger.log('WebSocket listeners cleaned up');
  }

  // WebSocket event handlers (wrap the log-based handlers)
  private async handleCreateCurveWs(
    creator: string,
    curve: string,
    token: string,
    tokenURI: string,
    name: string,
    symbol: string,
    event: ethers.ContractEventPayload,
  ) {
    const log = event.log;
    this.logger.debug(`[WS] CreateCurve event: ${name} (${symbol})`);

    const parsed = this.coreInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (parsed) {
      await this.handleCreateCurve(parsed, log);
      await this.updateIndexerState(BigInt(log.blockNumber));
    }
  }

  private async handleBuyWs(
    token: string,
    to: string,
    amountIn: bigint,
    amountOut: bigint,
    price: bigint,
    timestamp: bigint,
    event: ethers.ContractEventPayload,
  ) {
    const log = event.log;
    this.logger.debug(`[WS] Buy event: ${ethers.formatEther(amountIn)} PUSH for token ${token}`);

    const parsed = this.coreInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (parsed) {
      await this.handleBuy(parsed, log);
      await this.updateIndexerState(BigInt(log.blockNumber));
    }
  }

  private async handleSellWs(
    token: string,
    from: string,
    to: string,
    amountIn: bigint,
    amountOut: bigint,
    price: bigint,
    timestamp: bigint,
    event: ethers.ContractEventPayload,
  ) {
    const log = event.log;
    this.logger.debug(`[WS] Sell event: ${ethers.formatEther(amountIn)} tokens for ${token}`);

    const parsed = this.coreInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (parsed) {
      await this.handleSell(parsed, log);
      await this.updateIndexerState(BigInt(log.blockNumber));
    }
  }

  private async handleFactoryCreateWs(
    creator: string,
    curve: string,
    token: string,
    tokenURI: string,
    name: string,
    symbol: string,
    virtualNative: bigint,
    virtualToken: bigint,
    event: ethers.ContractEventPayload,
  ) {
    const log = event.log;
    this.logger.debug(`[WS] Factory Create event: ${name}`);

    const parsed = this.factoryInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (parsed) {
      await this.handleFactoryCreate(parsed, log);
    }
  }

  private async handleCreatorFeesAccumulatedWs(
    creator: string,
    amount: bigint,
    totalAccumulated: bigint,
    event: ethers.ContractEventPayload,
  ) {
    const log = event.log;
    this.logger.debug(`[WS] CreatorFeesAccumulated: ${creator}`);

    const parsed = this.factoryInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (parsed) {
      await this.handleCreatorFeesAccumulated(parsed);
    }
  }

  private async handleCreatorFeesClaimedWs(
    creator: string,
    amount: bigint,
    event: ethers.ContractEventPayload,
  ) {
    const log = event.log;
    this.logger.debug(`[WS] CreatorFeesClaimed: ${creator} claimed ${ethers.formatEther(amount)}`);

    const parsed = this.factoryInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (parsed) {
      await this.handleCreatorFeesClaimed(parsed);
    }
  }

  // =========================================================================
  // Historical Backfill (On startup)
  // =========================================================================

  private async backfillMissedBlocks() {
    this.logger.log('Checking for missed blocks to backfill...');

    try {
      const currentBlock = await this.rpc.getBlockNumber();
      const state = await this.getIndexerState();
      const fromBlock = Number(state.lastProcessedBlock) + 1;

      if (fromBlock > currentBlock) {
        this.logger.log('No missed blocks to backfill');
        return;
      }

      const missedBlocks = currentBlock - fromBlock + 1;
      this.logger.log(`Backfilling ${missedBlocks} missed blocks (${fromBlock} to ${currentBlock})`);

      const batchSize = parseInt(this.configService.get('INDEXER_BATCH_SIZE', '100'));

      for (let start = fromBlock; start <= currentBlock; start += batchSize) {
        const end = Math.min(start + batchSize - 1, currentBlock);
        this.logger.debug(`Backfilling blocks ${start} to ${end}`);

        await this.processBlockRange(start, end);
        await this.updateIndexerState(BigInt(end));

        // Small delay to avoid rate limiting
        await this.delay(100);
      }

      this.logger.log('Backfill complete');
    } catch (error) {
      this.logger.error(`Backfill failed: ${(error as Error).message}`);
    }
  }

  // =========================================================================
  // Polling Fallback (When WebSocket is unavailable)
  // =========================================================================

  @Interval(5000) // Poll every 5 seconds to catch any missed events
  async pollForMissedBlocks() {
    // Always poll as a safety net - WebSocket event listeners may not
    // receive all events (e.g. if the RPC doesn't support eth_subscribe for logs).
    // The polling will be a no-op if there are no new blocks to process.

    // If WebSocket disconnected, try to reconnect
    if (!this.ws.isConnected() && this.isWebSocketMode) {
      this.logger.warn('WebSocket disconnected, attempting to reconnect...');
      this.cleanupWebSocketListeners();
      await this.setupWebSocketListeners();
    }

    await this.processNewBlocksPolling();
  }

  private async processNewBlocksPolling() {
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

      this.logger.debug(`[Polling] Processing blocks ${fromBlock} to ${toBlock}`);
      this.metrics.indexerBlockLag.set(currentBlock - Number(fromBlock));

      await this.processBlockRange(Number(fromBlock), toBlock);
      await this.updateIndexerState(BigInt(toBlock));
    } catch (error) {
      this.logger.error(`Error processing blocks: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  // =========================================================================
  // Block Range Processing (Used by both backfill and polling)
  // =========================================================================

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

    // Also fetch bonding curve logs for known tokens
    const tokens = await this.prisma.token.findMany({
      select: { curveAddress: true },
    });

    const curveAddresses = tokens.map((t) => t.curveAddress);
    let curveLogs: ethers.Log[] = [];

    if (curveAddresses.length > 0) {
      // Batch curve addresses to avoid too many concurrent requests
      const batchSize = 10;
      for (let i = 0; i < curveAddresses.length; i += batchSize) {
        const batch = curveAddresses.slice(i, i + batchSize);
        const batchLogs = await Promise.all(
          batch.map((addr) =>
            this.rpc.getLogs({
              address: addr,
              fromBlock,
              toBlock,
            }),
          ),
        );
        curveLogs = curveLogs.concat(batchLogs.flat());
      }
    }

    // Process in chronological order
    const allLogs = [...coreLogs, ...factoryLogs, ...curveLogs].sort((a, b) => {
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
      case 'Buy':
        // Handle BondingCurve Buy (different from Core.Buy) - used during initial token creation
        await this.handleBondingCurveBuy(parsed, log, token.address);
        break;
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

  /**
   * Handle BondingCurve Buy events (emitted during initial token creation buy)
   * Note: Core.Buy is emitted for regular buys via exactInBuy/exactOutBuy
   * But during createCurve, only BondingCurve.Buy is emitted
   *
   * During createCurve, the BondingCurve.Buy event has `to = Core contract` because
   * Core calls curve.buy(Core, tokens), then transfers tokens to creator.
   * We need to find the actual recipient from the Token Transfer events.
   */
  private async handleBondingCurveBuy(
    parsed: ethers.LogDescription,
    log: ethers.Log,
    tokenAddress: string,
  ) {
    const { to, amountNativeIn, amountOut, price, timestamp } = parsed.args;
    let traderAddress = to.toLowerCase();
    let actualAmountOut = amountOut;

    // During token creation, `to` is the Core contract, not the actual creator
    // We need to find the real recipient and actual amount from the Token Transfer events
    // Note: BondingCurve.Buy amountOut is PRE-FEE, but the actual transfer is POST-FEE
    const coreAddress = this.configService.get<string>('CORE_ADDRESS')?.toLowerCase();
    if (traderAddress === coreAddress) {
      // Get the actual recipient and amount from the Token Transfer event
      const receipt = await this.rpc.getTransactionReceipt(log.transactionHash);
      if (receipt) {
        // Look for Transfer event from Core to a user
        const transferTopic = ethers.id('Transfer(address,address,uint256)');
        const transferLogs = receipt.logs.filter(
          (l) => l.address.toLowerCase() === tokenAddress && l.topics[0] === transferTopic,
        );

        // Find the transfer FROM Core to the creator (usually the last one)
        for (const transferLog of transferLogs) {
          const from = ethers.getAddress('0x' + transferLog.topics[1].slice(26)).toLowerCase();
          const transferTo = ethers.getAddress('0x' + transferLog.topics[2].slice(26)).toLowerCase();
          if (from === coreAddress && transferTo !== coreAddress) {
            traderAddress = transferTo;
            // Get the actual amount transferred (this is POST-FEE)
            actualAmountOut = BigInt(transferLog.data);
            this.logger.debug(`[BondingCurve] Resolved creator address: ${traderAddress}, actual amount: ${actualAmountOut}`);
            break;
          }
        }
      }
    }

    // Check for duplicate (by tx hash - there could be multiple buys in same tx)
    const existingTrade = await this.prisma.trade.findUnique({
      where: { txHash: log.transactionHash },
    });

    if (existingTrade) {
      this.logger.debug(`Skipping duplicate BondingCurve buy: ${log.transactionHash}`);
      return;
    }

    // Insert trade (using actualAmountOut which is post-fee for initial buys)
    await this.prisma.trade.create({
      data: {
        tokenAddress,
        type: 'BUY',
        traderAddress,
        amountIn: amountNativeIn.toString(),
        amountOut: actualAmountOut.toString(),
        price: price.toString(),
        feeAmount: (BigInt(amountNativeIn) / 100n).toString(),
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        timestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update or create holder (using actualAmountOut which is post-fee for initial buys)
    await this.prisma.holder.upsert({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress: traderAddress },
      },
      update: {
        balance: {
          set: await this.getUpdatedBalance(tokenAddress, traderAddress, actualAmountOut, true),
        },
        lastActivityTimestamp: new Date(Number(timestamp) * 1000),
      },
      create: {
        tokenAddress,
        holderAddress: traderAddress,
        balance: actualAmountOut.toString(),
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
        amountIn: amountNativeIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        txHash: log.transactionHash,
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);

    this.metrics.tradesTotal.inc({ type: 'BUY', status: 'success' });
    this.metrics.tradingVolume.inc({ type: 'BUY' }, Number(amountNativeIn));
    this.metrics.indexerEventsProcessed.inc({ event_type: 'BondingCurveBuy' });

    // Enqueue portfolio update for the trader
    await this.enqueuePortfolioUpdate(traderAddress);

    this.logger.debug(`[BondingCurve] Buy indexed: ${ethers.formatEther(amountNativeIn)} PUSH for ${tokenAddress}`);
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  private async handleCreateCurve(parsed: ethers.LogDescription, log: ethers.Log) {
    const { creator, curve, token, tokenURI, name, symbol } = parsed.args;

    // Initial values - will be updated by Factory Create event with actual virtual reserves
    // Use race-safe upsert to handle concurrent creates from WebSocket and HTTP polling
    await this.raceSafeTokenUpsert(
      { address: token.toLowerCase() },
      {
        address: token.toLowerCase(),
        curveAddress: curve.toLowerCase(),
        creatorAddress: creator.toLowerCase(),
        name,
        symbol,
        tokenUri: tokenURI,
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
      {}, // Empty update - Factory Create event will set the actual values
    );

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

    // Fetch BondingCurve events from the same transaction (for initial buy during creation)
    // This is needed because the BondingCurve is newly created and we weren't subscribed to it
    await this.fetchAndProcessCurveEventsFromTransaction(log.transactionHash, curve.toLowerCase(), token.toLowerCase());
  }

  /**
   * Fetch and process BondingCurve events from a specific transaction.
   * Used after CreateCurve to catch the initial buy event.
   */
  private async fetchAndProcessCurveEventsFromTransaction(
    txHash: string,
    curveAddress: string,
    tokenAddress: string,
  ) {
    try {
      const receipt = await this.rpc.getTransactionReceipt(txHash);
      if (!receipt) return;

      // Filter logs from the bonding curve
      const curveLogs = receipt.logs.filter(
        (log) => log.address.toLowerCase() === curveAddress,
      );

      for (const log of curveLogs) {
        const parsed = this.bondingCurveInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed && parsed.name === 'Buy') {
          await this.handleBondingCurveBuy(parsed, log as ethers.Log, tokenAddress);
        }
      }
    } catch (error) {
      this.logger.error(`Error fetching curve events from tx ${txHash}: ${(error as Error).message}`);
    }
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
          set: await this.getUpdatedBalance(tokenAddress, traderAddress, amountOut, true),
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

    // Enqueue portfolio update for the trader
    await this.enqueuePortfolioUpdate(traderAddress);
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

      if (newBalance < 0n) {
        this.logger.error(
          `Invalid balance detected: ${sellerAddress} attempting to sell ${amountIn} but only holds ${holder.balance} of token ${tokenAddress}`,
        );
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

    // Enqueue portfolio update for the seller
    await this.enqueuePortfolioUpdate(sellerAddress);
  }

  private async handleFactoryCreate(parsed: ethers.LogDescription, log: ethers.Log) {
    const { virtualNative, virtualToken, token, creator, curve, name, symbol, tokenURI } =
      parsed.args;
    const k = (BigInt(virtualNative) * BigInt(virtualToken)).toString();

    // Calculate initial price: virtualNative / virtualToken (scaled to 18 decimals)
    const PRECISION = 10n ** 18n;
    const initialPrice = (BigInt(virtualNative) * PRECISION) / BigInt(virtualToken);

    // Calculate initial market cap: price * total supply (1B tokens = 10^27 with 18 decimals)
    const TOTAL_SUPPLY = 10n ** 27n;
    const marketCap = (initialPrice * TOTAL_SUPPLY) / PRECISION;

    // Use race-safe upsert since Factory.Create event may arrive before Core.CreateCurve event
    // in the same transaction (Factory.Create is at lower logIndex), and WebSocket/HTTP
    // can race to process the same event
    await this.raceSafeTokenUpsert(
      { address: token.toLowerCase() },
      {
        address: token.toLowerCase(),
        curveAddress: curve.toLowerCase(),
        creatorAddress: creator.toLowerCase(),
        name: name || 'Unknown Token',
        symbol: symbol || 'UNKNOWN',
        tokenUri: tokenURI || '',
        virtualNative: virtualNative.toString(),
        virtualToken: virtualToken.toString(),
        k,
        currentPrice: initialPrice.toString(),
        marketCap: marketCap.toString(),
        status: 'TRADING',
        createdBlock: BigInt(log.blockNumber),
      },
      {
        virtualNative: virtualNative.toString(),
        virtualToken: virtualToken.toString(),
        k,
        currentPrice: initialPrice.toString(),
        marketCap: marketCap.toString(),
      },
    );

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
        graduationTxHash: log.transactionHash,
        graduationAmount0: amount0.toString(),
        graduationAmount1: amount1.toString(),
        graduationLiquidity: liquidity.toString(),
      },
    });

    // Publish listing event for WebSocket clients
    await this.pubsub.publish('listing', {
      type: 'listing',
      tokenAddress,
      poolAddress: pool.toLowerCase(),
      graduationTxHash: log.transactionHash,
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

  // =========================================================================
  // Utility Methods
  // =========================================================================

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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Race-safe token upsert that handles concurrent creates from WebSocket and HTTP polling.
   * Prisma upsert can fail with P2002 (unique constraint) when two concurrent operations
   * both check for existence at the same time, find nothing, and both try to insert.
   * This helper catches that error and falls back to an update.
   */
  private async raceSafeTokenUpsert(
    where: { address: string },
    create: Prisma.TokenCreateInput,
    update: Prisma.TokenUpdateInput,
  ): Promise<void> {
    try {
      await this.prisma.token.upsert({
        where,
        create,
        update,
      });
    } catch (error) {
      // Handle race condition: if another concurrent operation created the token,
      // we get P2002 (unique constraint). Fall back to update.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(`Token ${where.address} already exists (race condition), updating instead`);
        await this.prisma.token.update({
          where,
          data: update,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Notify the worker to update a user's portfolio.
   * This publishes to the portfolio_update channel which the worker subscribes to.
   */
  private async enqueuePortfolioUpdate(walletAddress: string): Promise<void> {
    try {
      await this.pubsub.publish('portfolio_update', {
        type: 'portfolio_update',
        walletAddress: walletAddress.toLowerCase(),
        timestamp: Date.now(),
      });
      this.logger.debug(`Published portfolio update for ${walletAddress}`);
    } catch (error) {
      this.logger.error(`Failed to publish portfolio update: ${(error as Error).message}`);
    }
  }
}
