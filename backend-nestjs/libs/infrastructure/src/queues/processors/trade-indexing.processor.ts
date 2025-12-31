import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueueName } from '../config/queue-config';
import { IndexerService } from '../../indexer/indexer.service';
import { PrismaService } from '@core';
import {
  Trade,
  Token,
  TokenAddress,
  TokenPrice,
  MarketCap,
  ReserveBalance,
  ITradeRepository,
  ITokenRepository,
  TRADE_REPOSITORY,
  TOKEN_REPOSITORY,
} from '@domain';
import {
  ParsedEvent,
  BuyEvent,
  SellEvent,
  CreateCurveEvent,
  SyncEvent,
  LockEvent,
  ListingEvent,
  NewATHPriceEvent,
  NewATHMarketCapEvent,
  CreatorFeeDistributedEvent,
  CreatorFeeDeferredFromBuyEvent,
  CreatorFeesAccumulatedEvent,
  CreatorFeesClaimedEvent,
} from '../../contracts/types';

/**
 * Trade Indexing Processor
 *
 * Indexes blockchain events into database using the IndexerService.
 * Processes buy/sell/create events from the Core contract.
 * Emits WebSocket events for real-time updates.
 * Maintains audit trail of all trades and token states.
 */
@Processor(QueueName.TRADE_INDEXING)
export class TradeIndexingProcessor {
  private readonly logger = new Logger(TradeIndexingProcessor.name);

  constructor(
    private readonly indexerService: IndexerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: ITradeRepository,
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  /**
   * Process trade indexing job
   */
  @Process()
  async process(
    job: Job<{
      startBlock: number;
      endBlock: number;
      tokenAddress?: string;
    }>,
  ): Promise<{
    success: boolean;
    message?: string;
    startBlock?: number;
    endBlock?: number;
    eventsProcessed?: number;
    tradesCreated?: number;
    tokensCreated?: number;
  }> {
    try {
      const { startBlock, endBlock, tokenAddress } = job.data;

      this.logger.log(
        `Processing trade indexing from block ${startBlock} to ${endBlock}` +
          (tokenAddress ? ` for token ${tokenAddress}` : ''),
      );

      // Validate block range
      if (startBlock > endBlock) {
        throw new Error('Invalid block range: startBlock > endBlock');
      }

      const blockRange = endBlock - startBlock;
      if (blockRange > 10000) {
        this.logger.warn(
          `Large block range (${blockRange}), consider splitting into smaller chunks`,
        );
      }

      // Index events from blockchain
      let result;
      if (tokenAddress) {
        result = await this.indexerService.indexEventsForToken(
          tokenAddress,
          startBlock,
          endBlock,
        );
      } else {
        result = await this.indexerService.indexBlocks(startBlock, endBlock);
      }

      // Process events and save to database
      let tradesCreated = 0;
      let tokensCreated = 0;

      for (const event of result.events) {
        try {
          const processed = await this.processEvent(event);
          if (processed.tradeCreated) tradesCreated++;
          if (processed.tokenCreated) tokensCreated++;
        } catch (error) {
          this.logger.error(
            `Error processing event ${event.type}: ${error.message}`,
          );
          // Continue processing other events
        }
      }

      this.logger.log(
        `Trade indexing completed: ${result.events.length} events processed, ` +
          `${tradesCreated} trades created, ${tokensCreated} tokens created ` +
          `from blocks ${startBlock}-${endBlock}`,
      );

      return {
        success: true,
        startBlock,
        endBlock,
        eventsProcessed: result.events.length,
        tradesCreated,
        tokensCreated,
      };
    } catch (error) {
      this.logger.error(
        `Trade indexing failed for job ${job.id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Process a single parsed event
   */
  private async processEvent(
    event: ParsedEvent,
  ): Promise<{ tradeCreated: boolean; tokenCreated: boolean }> {
    switch (event.type) {
      case 'CreateCurve':
        await this.handleCreateCurve(event.data);
        return { tradeCreated: false, tokenCreated: true };

      case 'Buy':
        await this.handleBuy(event.data);
        return { tradeCreated: true, tokenCreated: false };

      case 'Sell':
        await this.handleSell(event.data);
        return { tradeCreated: true, tokenCreated: false };

      case 'Sync':
        await this.handleSync(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'Lock':
        await this.handleLock(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'Listing':
        await this.handleListing(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'NewATHPrice':
        await this.handleNewATHPrice(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'NewATHMarketCap':
        await this.handleNewATHMarketCap(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'CreatorFeeDistributed':
        await this.handleCreatorFeeDistributed(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'CreatorFeeDeferredFromBuy':
        await this.handleCreatorFeeDeferredFromBuy(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'CreatorFeesAccumulated':
        await this.handleCreatorFeesAccumulated(event.data);
        return { tradeCreated: false, tokenCreated: false };

      case 'CreatorFeesClaimed':
        await this.handleCreatorFeesClaimed(event.data);
        return { tradeCreated: false, tokenCreated: false };

      default:
        this.logger.warn(`Unknown event type: ${(event as ParsedEvent).type}`);
        return { tradeCreated: false, tokenCreated: false };
    }
  }

  /**
   * Handle CreateCurve event - create new token
   */
  private async handleCreateCurve(data: CreateCurveEvent): Promise<void> {
    const existingToken = await this.tokenRepository.findByAddressString(
      data.token,
    );

    if (existingToken) {
      this.logger.debug(
        `Token ${data.token} already exists, skipping creation`,
      );
      return;
    }

    // Default virtual reserves from factory config (will be updated by Sync)
    const defaultVirtualNative = BigInt('1000000000000000000'); // 1 PUSH in wei
    const defaultVirtualToken = BigInt('1000000000000000000000000000'); // 1B tokens
    const totalSupply = BigInt('1000000000000000000000000000'); // 1B tokens with 18 decimals

    // Create token with initial values using the correct static method signature
    const token = Token.create(
      data.token, // id is the token address
      TokenAddress.create(data.token),
      data.curve, // bonding curve contract address
      data.name,
      data.symbol,
      data.creator,
      18, // decimals (standard ERC20)
      totalSupply,
      defaultVirtualNative,
      defaultVirtualToken,
    );

    await this.tokenRepository.save(token);

    // Emit WebSocket event for new token creation
    this.eventEmitter.emit('token.created', {
      tokenAddress: data.token,
      curveAddress: data.curve,
      name: data.name,
      symbol: data.symbol,
      creator: data.creator,
      tokenURI: data.tokenURI,
      blockNumber: data.blockNumber,
      transactionHash: data.transactionHash,
    });

    this.logger.log(
      `Created token ${data.symbol} (${data.token}) by ${data.creator}`,
    );
  }

  /**
   * Handle Buy event - create trade and update token
   */
  private async handleBuy(data: BuyEvent): Promise<void> {
    // Create unique trade ID from transaction hash and log index
    const tradeId = `${data.transactionHash}-${data.logIndex}`;

    // Check if trade already exists (idempotency)
    const existingTrade = await this.tradeRepository.findById(tradeId);
    if (existingTrade) {
      this.logger.debug(`Trade ${tradeId} already exists, skipping`);
      return;
    }

    const trade = Trade.createBuy(
      tradeId,
      data.token,
      data.to,
      data.amountIn,
      data.amountOut,
      data.price,
      data.transactionHash,
      data.blockNumber,
      new Date(Number(data.timestamp) * 1000),
    );

    await this.tradeRepository.save(trade);

    // Update holder balance
    await this.updateHolderBalance(data.token, data.to, data.amountOut, true);

    // Update token volume
    await this.updateTokenVolume(data.token, data.amountIn);

    // Emit WebSocket event for real-time updates
    this.eventEmitter.emit('trade.buy', {
      tokenAddress: data.token,
      trader: data.to,
      amountIn: data.amountIn.toString(),
      amountOut: data.amountOut.toString(),
      price: data.price.toString(),
      timestamp: Number(data.timestamp),
      transactionHash: data.transactionHash,
    });

    this.logger.debug(
      `Created buy trade: ${data.amountIn} PUSH -> ${data.amountOut} tokens at ${data.price}`,
    );
  }

  /**
   * Handle Sell event - create trade
   */
  private async handleSell(data: SellEvent): Promise<void> {
    // Create unique trade ID from transaction hash and log index
    const tradeId = `${data.transactionHash}-${data.logIndex}`;

    // Check if trade already exists (idempotency)
    const existingTrade = await this.tradeRepository.findById(tradeId);
    if (existingTrade) {
      this.logger.debug(`Trade ${tradeId} already exists, skipping`);
      return;
    }

    const trade = Trade.createSell(
      tradeId,
      data.token,
      data.from,
      data.amountIn,
      data.amountOut,
      data.price,
      data.transactionHash,
      data.blockNumber,
      new Date(Number(data.timestamp) * 1000),
    );

    await this.tradeRepository.save(trade);

    // Update holder balance (decrease for sell)
    await this.updateHolderBalance(data.token, data.from, data.amountIn, false);

    // Update token volume
    await this.updateTokenVolume(data.token, data.amountOut);

    // Emit WebSocket event for real-time updates
    this.eventEmitter.emit('trade.sell', {
      tokenAddress: data.token,
      trader: data.from,
      amountIn: data.amountIn.toString(),
      amountOut: data.amountOut.toString(),
      price: data.price.toString(),
      timestamp: Number(data.timestamp),
      transactionHash: data.transactionHash,
    });

    this.logger.debug(
      `Created sell trade: ${data.amountIn} tokens -> ${data.amountOut} PUSH at ${data.price}`,
    );
  }

  /**
   * Handle Sync event - update token reserves and price
   */
  private async handleSync(data: SyncEvent): Promise<void> {
    const token = await this.tokenRepository.findByAddressString(data.token);

    if (!token) {
      this.logger.warn(`Token ${data.token} not found for Sync event`);
      return;
    }

    // Create new reserve balance from sync data
    const newReserveBalance = ReserveBalance.create(
      data.realNative,
      data.realToken,
      data.virtualNative,
      data.virtualToken,
    );

    // Calculate market cap from price and total supply
    const totalSupply = token.getTotalSupply();
    const decimals = token.getDecimals();
    const marketCapValue =
      (totalSupply / BigInt(10 ** decimals)) * data.price;

    const newPrice = TokenPrice.fromBigInt(data.price);
    const newMarketCap = MarketCap.fromBigInt(marketCapValue);

    // Update token metrics using the correct method
    token.updateMetrics(newPrice, newMarketCap, newReserveBalance);

    await this.tokenRepository.save(token);

    // Record price history for charts
    await this.recordPriceHistory(data);

    // Emit WebSocket event for real-time price updates
    this.eventEmitter.emit('token.sync', {
      tokenAddress: data.token,
      price: data.price.toString(),
      marketCap: marketCapValue.toString(),
      realNative: data.realNative.toString(),
      realToken: data.realToken.toString(),
      virtualNative: data.virtualNative.toString(),
      virtualToken: data.virtualToken.toString(),
      timestamp: Number(data.timestamp),
    });

    this.logger.debug(
      `Updated token ${data.token} price: ${data.price}, reserves: ${data.realNative}/${data.realToken}`,
    );
  }

  /**
   * Handle Lock event - mark token as locked
   */
  private async handleLock(data: LockEvent): Promise<void> {
    const token = await this.tokenRepository.findByAddressString(data.token);

    if (!token) {
      this.logger.warn(`Token ${data.token} not found for Lock event`);
      return;
    }

    token.lock();
    await this.tokenRepository.save(token);

    this.logger.log(`Token ${data.token} has been locked`);
  }

  /**
   * Handle Listing event - mark token as graduated/listed on DEX
   */
  private async handleListing(data: ListingEvent): Promise<void> {
    const token = await this.tokenRepository.findByAddressString(data.token);

    if (!token) {
      this.logger.warn(`Token ${data.token} not found for Listing event`);
      return;
    }

    // List the token on Uniswap V3 (must be locked first)
    if (!token.getIsLocked()) {
      this.logger.warn(
        `Token ${data.token} is not locked, cannot list on Uniswap`,
      );
      return;
    }

    token.listOnUniswapV3(data.pool);
    await this.tokenRepository.save(token);

    // Emit WebSocket event for graduation
    this.eventEmitter.emit('token.graduated', {
      tokenAddress: data.token,
      poolAddress: data.pool,
      liquidity: data.liquidity.toString(),
      amount0: data.amount0.toString(),
      amount1: data.amount1.toString(),
    });

    this.logger.log(
      `Token ${data.token} has graduated to DEX pool ${data.pool}`,
    );
  }

  /**
   * Handle NewATHPrice event - update token ATH price
   */
  private async handleNewATHPrice(data: NewATHPriceEvent): Promise<void> {
    try {
      // Update ATH price in database
      await this.prisma.token.update({
        where: { address: data.token },
        data: {
          athPrice: data.newPrice.toString(),
          athPriceTimestamp: new Date(Number(data.timestamp) * 1000),
        },
      });

      // Emit WebSocket event
      this.eventEmitter.emit('token.ath.price', {
        tokenAddress: data.token,
        newPrice: data.newPrice.toString(),
        timestamp: Number(data.timestamp),
      });

      this.logger.log(`New ATH price for ${data.token}: ${data.newPrice}`);
    } catch (error) {
      this.logger.error(`Failed to handle NewATHPrice: ${error.message}`);
    }
  }

  /**
   * Handle NewATHMarketCap event - update token ATH market cap
   */
  private async handleNewATHMarketCap(data: NewATHMarketCapEvent): Promise<void> {
    try {
      // Update ATH market cap in database
      await this.prisma.token.update({
        where: { address: data.token },
        data: {
          athMarketCap: data.newMarketCap.toString(),
          athMarketCapTimestamp: new Date(Number(data.timestamp) * 1000),
        },
      });

      // Emit WebSocket event
      this.eventEmitter.emit('token.ath.marketCap', {
        tokenAddress: data.token,
        newMarketCap: data.newMarketCap.toString(),
        timestamp: Number(data.timestamp),
      });

      this.logger.log(`New ATH market cap for ${data.token}: ${data.newMarketCap}`);
    } catch (error) {
      this.logger.error(`Failed to handle NewATHMarketCap: ${error.message}`);
    }
  }

  /**
   * Handle CreatorFeeDistributed event
   */
  private async handleCreatorFeeDistributed(
    data: CreatorFeeDistributedEvent,
  ): Promise<void> {
    try {
      // Try to find existing creator fee record
      const existingFee = await this.prisma.creatorFee.findUnique({
        where: {
          creatorAddress_tokenAddress: {
            creatorAddress: data.creator.toLowerCase(),
            tokenAddress: data.token.toLowerCase(),
          },
        },
      });

      if (existingFee) {
        // Update existing record with accumulated amounts
        const newAccumulated =
          BigInt(existingFee.accumulatedAmount) + data.amount;
        const newPending = BigInt(existingFee.pendingAmount) + data.amount;
        await this.prisma.creatorFee.update({
          where: { id: existingFee.id },
          data: {
            accumulatedAmount: newAccumulated.toString(),
            pendingAmount: newPending.toString(),
          },
        });
      } else {
        // Create new record
        await this.prisma.creatorFee.create({
          data: {
            creatorAddress: data.creator.toLowerCase(),
            tokenAddress: data.token.toLowerCase(),
            accumulatedAmount: data.amount.toString(),
            claimedAmount: '0',
            pendingAmount: data.amount.toString(),
          },
        });
      }

      // Store blockchain event
      await this.storeBlockchainEvent('CreatorFeeDistributed', data.token, {
        ...data,
        amount: data.amount.toString(),
      });

      this.logger.debug(
        `Creator fee distributed: ${data.amount} to ${data.creator} for ${data.token}`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle CreatorFeeDistributed: ${error.message}`);
    }
  }

  /**
   * Handle CreatorFeeDeferredFromBuy event
   */
  private async handleCreatorFeeDeferredFromBuy(
    data: CreatorFeeDeferredFromBuyEvent,
  ): Promise<void> {
    try {
      // Store blockchain event for tracking
      await this.storeBlockchainEvent('CreatorFeeDeferredFromBuy', data.token, {
        ...data,
        feeTokenAmount: data.feeTokenAmount.toString(),
        price: data.price.toString(),
      });

      this.logger.debug(
        `Creator fee deferred: ${data.feeTokenAmount} tokens at price ${data.price} for ${data.token}`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle CreatorFeeDeferredFromBuy: ${error.message}`);
    }
  }

  /**
   * Handle CreatorFeesAccumulated event
   * Note: This Factory event operates at the creator level, not per-token.
   * The totalAccumulated is the creator's aggregate across all their tokens.
   */
  private async handleCreatorFeesAccumulated(
    data: CreatorFeesAccumulatedEvent,
  ): Promise<void> {
    try {
      // Store blockchain event for tracking
      await this.storeBlockchainEvent('CreatorFeesAccumulated', null, {
        ...data,
        amount: data.amount.toString(),
        totalAccumulated: data.totalAccumulated.toString(),
      });

      // Emit WebSocket event for UI updates
      this.eventEmitter.emit('creator.fees.accumulated', {
        creatorAddress: data.creator,
        amount: data.amount.toString(),
        totalAccumulated: data.totalAccumulated.toString(),
      });

      this.logger.debug(
        `Creator fees accumulated: ${data.amount} (total: ${data.totalAccumulated}) for ${data.creator}`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle CreatorFeesAccumulated: ${error.message}`);
    }
  }

  /**
   * Handle CreatorFeesClaimed event
   * Note: This Factory event operates at the creator level, not per-token.
   * When claimed, all accumulated fees for a creator are withdrawn.
   */
  private async handleCreatorFeesClaimed(
    data: CreatorFeesClaimedEvent,
  ): Promise<void> {
    try {
      // Store blockchain event for tracking
      await this.storeBlockchainEvent('CreatorFeesClaimed', null, {
        ...data,
        amount: data.amount.toString(),
      });

      // Update all CreatorFee records for this creator
      // Mark all pending as claimed since the claim is aggregate
      const creatorFees = await this.prisma.creatorFee.findMany({
        where: { creatorAddress: data.creator.toLowerCase() },
      });

      for (const fee of creatorFees) {
        const newClaimed = BigInt(fee.claimedAmount) + BigInt(fee.pendingAmount);
        await this.prisma.creatorFee.update({
          where: {
            creatorAddress_tokenAddress: {
              creatorAddress: fee.creatorAddress,
              tokenAddress: fee.tokenAddress,
            },
          },
          data: {
            claimedAmount: newClaimed.toString(),
            pendingAmount: '0',
          },
        });
      }

      // Emit WebSocket event
      this.eventEmitter.emit('creator.fees.claimed', {
        creatorAddress: data.creator,
        amount: data.amount.toString(),
      });

      this.logger.log(
        `Creator fees claimed: ${data.amount} by ${data.creator}`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle CreatorFeesClaimed: ${error.message}`);
    }
  }

  /**
   * Record price history from Sync event
   */
  private async recordPriceHistory(data: SyncEvent): Promise<void> {
    try {
      // Get token for market cap calculation
      const token = await this.prisma.token.findUnique({
        where: { address: data.token },
        select: { totalSupply: true },
      });

      const totalSupply = token ? BigInt(token.totalSupply) : BigInt(0);
      const marketCap = (totalSupply / BigInt(10 ** 18)) * data.price;

      await this.prisma.priceHistory.create({
        data: {
          tokenAddress: data.token.toLowerCase(),
          price: data.price.toString(),
          marketCap: marketCap.toString(),
          volume: '0', // Will be updated by trade volume aggregation
          timestamp: new Date(Number(data.timestamp) * 1000),
          blockNumber: BigInt(data.blockNumber),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record price history: ${error.message}`);
    }
  }

  /**
   * Update holder balance from buy/sell event
   */
  private async updateHolderBalance(
    tokenAddress: string,
    holderAddress: string,
    amountChange: bigint,
    isBuy: boolean,
  ): Promise<void> {
    try {
      const normalizedToken = tokenAddress.toLowerCase();
      const normalizedHolder = holderAddress.toLowerCase();

      // Get current holder record
      const holder = await this.prisma.holder.findUnique({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: normalizedToken,
            holderAddress: normalizedHolder,
          },
        },
      });

      const currentBalance = holder ? BigInt(holder.balance) : BigInt(0);
      const newBalance = isBuy
        ? currentBalance + amountChange
        : currentBalance - amountChange;

      if (newBalance > 0n) {
        await this.prisma.holder.upsert({
          where: {
            tokenAddress_holderAddress: {
              tokenAddress: normalizedToken,
              holderAddress: normalizedHolder,
            },
          },
          create: {
            tokenAddress: normalizedToken,
            holderAddress: normalizedHolder,
            balance: newBalance.toString(),
          },
          update: {
            balance: newBalance.toString(),
            lastUpdated: new Date(),
          },
        });
      } else if (holder) {
        // Remove holder if balance is zero or negative
        await this.prisma.holder.delete({
          where: {
            tokenAddress_holderAddress: {
              tokenAddress: normalizedToken,
              holderAddress: normalizedHolder,
            },
          },
        });
      }

      // Update token holder count
      const holderCount = await this.prisma.holder.count({
        where: { tokenAddress: normalizedToken },
      });

      await this.prisma.token.update({
        where: { address: normalizedToken },
        data: { holderCount: holderCount },
      });
    } catch (error) {
      this.logger.error(`Failed to update holder balance: ${error.message}`);
    }
  }

  /**
   * Store blockchain event for querying
   */
  private async storeBlockchainEvent(
    eventType: string,
    tokenAddress: string | null,
    eventData: Record<string, unknown>,
  ): Promise<void> {
    try {
      // Convert bigints to strings for JSON storage
      const jsonSafeData = JSON.parse(
        JSON.stringify(eventData, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      );

      await this.prisma.blockchainEvent.create({
        data: {
          eventType,
          tokenAddress: tokenAddress?.toLowerCase() || null,
          blockNumber: BigInt((eventData.blockNumber as number) || 0),
          transactionHash: (eventData.transactionHash as string) || '',
          logIndex: (eventData.logIndex as number) || 0,
          data: jsonSafeData,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store blockchain event: ${error.message}`);
    }
  }

  /**
   * Update token volume statistics
   */
  private async updateTokenVolume(
    tokenAddress: string,
    volumeAmount: bigint,
  ): Promise<void> {
    try {
      const normalizedToken = tokenAddress.toLowerCase();

      // Get current token data
      const token = await this.prisma.token.findUnique({
        where: { address: normalizedToken },
        select: {
          volume24h: true,
          volume7d: true,
          volumeTotal: true,
          tradeCount: true,
        },
      });

      if (!token) return;

      // Update volumes and trade count
      const currentVolume24h = BigInt(token.volume24h || '0');
      const currentVolume7d = BigInt(token.volume7d || '0');
      const currentVolumeTotal = BigInt(token.volumeTotal || '0');
      const currentTradeCount = token.tradeCount || 0;

      await this.prisma.token.update({
        where: { address: normalizedToken },
        data: {
          volume24h: (currentVolume24h + volumeAmount).toString(),
          volume7d: (currentVolume7d + volumeAmount).toString(),
          volumeTotal: (currentVolumeTotal + volumeAmount).toString(),
          tradeCount: currentTradeCount + 1,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update token volume: ${error.message}`);
    }
  }
}
