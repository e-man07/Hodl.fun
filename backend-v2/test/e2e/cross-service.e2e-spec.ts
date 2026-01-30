/**
 * Cross-Service E2E Tests
 * Tests complete data flows across multiple services:
 * - Token creation → API availability
 * - Trade indexing → Holder updates → Candle aggregation
 * - Metrics calculation → Leaderboard updates
 * - Real-time event broadcasting
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ethers } from 'ethers';
import { TestAppModule } from './test-app.module';
import { PrismaService, PriceInterval } from '@hodlfun/database';
import { RedisService, CacheService, PubSubService } from '@hodlfun/redis';
import { GlobalExceptionFilter, TransformInterceptor } from '@hodlfun/common';
import {
  createMockToken,
  createMockBuyTrade,
  createMockSellTrade,
  resetTokenCounter,
  TokenStatus,
} from '../mocks/factories';
import { TEST_ADDRESSES } from '../mocks/ethers.mock';

describe('Cross-Service E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let cache: CacheService;
  let pubsub: PubSubService;

  // Test wallet for authentication
  const testWallet = ethers.Wallet.createRandom();
  const testWalletAddress = testWallet.address.toLowerCase();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as production
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redis = moduleFixture.get<RedisService>(RedisService);
    cache = moduleFixture.get<CacheService>(CacheService);
    pubsub = moduleFixture.get<PubSubService>(PubSubService);

    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    resetTokenCounter();
    await cleanDatabase();
  });

  async function cleanDatabase() {
    const keys = await redis.keys('*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    await prisma.$executeRaw`TRUNCATE TABLE "price_history" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "trades" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "holders" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "tokens" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "user_portfolios" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "indexer_state" CASCADE`;
  }

  /**
   * Simulates what the indexer does when processing a CreateCurve event
   */
  async function simulateTokenCreation(mockToken: ReturnType<typeof createMockToken>) {
    await prisma.token.create({
      data: {
        address: mockToken.address,
        name: mockToken.name,
        symbol: mockToken.symbol,
        tokenUri: mockToken.tokenUri,
        creatorAddress: mockToken.creatorAddress,
        curveAddress: mockToken.curveAddress,
        status: mockToken.status,
        currentPrice: mockToken.currentPrice,
        marketCap: mockToken.marketCap,
        virtualNative: mockToken.virtualNative,
        virtualToken: mockToken.virtualToken,
        realNative: mockToken.realNative,
        realToken: mockToken.realToken,
        k: mockToken.k,
        athPrice: mockToken.athPrice,
        athMarketCap: mockToken.athMarketCap,
        createdAt: mockToken.createdAt,
        createdBlock: mockToken.createdBlock,
      },
    });

    // Invalidate cache like the indexer would
    await cache.invalidate('tokens:list:*');
    await cache.invalidate('tokens:trending');
    await cache.invalidate('tokens:new');

    // Publish event like the indexer would
    await pubsub.publish('token:created', {
      address: mockToken.address,
      name: mockToken.name,
      symbol: mockToken.symbol,
      creatorAddress: mockToken.creatorAddress,
    });

    return mockToken;
  }

  /**
   * Simulates what the indexer does when processing a Buy/Sell event
   */
  async function simulateTrade(trade: ReturnType<typeof createMockBuyTrade>) {
    // Create trade record
    await prisma.trade.create({
      data: {
        tokenAddress: trade.tokenAddress,
        type: trade.type,
        traderAddress: trade.traderAddress,
        amountIn: trade.amountIn,
        amountOut: trade.amountOut,
        price: trade.price,
        feeAmount: trade.feeAmount,
        txHash: trade.txHash,
        blockNumber: trade.blockNumber,
        timestamp: trade.timestamp,
      },
    });

    // Update token price (like indexer does on Sync event)
    await prisma.token.update({
      where: { address: trade.tokenAddress },
      data: {
        currentPrice: trade.price,
        updatedAt: new Date(),
      },
    });

    // Update or create holder (like indexer does)
    const holderAddress = trade.traderAddress.toLowerCase();
    const existingHolder = await prisma.holder.findUnique({
      where: {
        tokenAddress_holderAddress: {
          tokenAddress: trade.tokenAddress,
          holderAddress,
        },
      },
    });

    if (existingHolder) {
      const currentBalance = BigInt(existingHolder.balance);
      const tradeAmount = BigInt(trade.type === 'BUY' ? trade.amountOut : trade.amountIn);
      const newBalance =
        trade.type === 'BUY' ? currentBalance + tradeAmount : currentBalance - tradeAmount;

      await prisma.holder.update({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: trade.tokenAddress,
            holderAddress,
          },
        },
        data: {
          balance: newBalance.toString(),
          lastActivityTimestamp: trade.timestamp,
        },
      });
    } else if (trade.type === 'BUY') {
      await prisma.holder.create({
        data: {
          tokenAddress: trade.tokenAddress,
          holderAddress,
          balance: trade.amountOut,
          firstBuyTimestamp: trade.timestamp,
          lastActivityTimestamp: trade.timestamp,
        },
      });

      // Update holder count
      await prisma.token.update({
        where: { address: trade.tokenAddress },
        data: {
          // Placeholder - in real implementation this would be calculated
        },
      });
    }

    // Invalidate caches
    await cache.invalidate(`token:${trade.tokenAddress}`);
    await cache.invalidate(`trades:${trade.tokenAddress}`);
    await cache.invalidate(`holders:${trade.tokenAddress}`);

    // Publish trade event
    await pubsub.publish('trade:new', {
      tokenAddress: trade.tokenAddress,
      type: trade.type,
      traderAddress: trade.traderAddress,
      amountIn: trade.amountIn,
      amountOut: trade.amountOut,
      price: trade.price,
    });

    return trade;
  }

  /**
   * Simulates what the worker does for candle aggregation
   */
  async function simulateCandleAggregation(
    tokenAddress: string,
    interval: PriceInterval,
    startTime: Date,
    endTime: Date,
  ) {
    const trades = await prisma.trade.findMany({
      where: {
        tokenAddress,
        timestamp: { gte: startTime, lt: endTime },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (trades.length === 0) return null;

    const prices = trades.map((t) => BigInt(t.price));
    const open = prices[0].toString();
    const close = prices[prices.length - 1].toString();
    const high = prices.reduce((a, b) => (a > b ? a : b)).toString();
    const low = prices.reduce((a, b) => (a < b ? a : b)).toString();

    const volumeNative = trades
      .filter((t) => t.type === 'BUY')
      .reduce((sum, t) => sum + BigInt(t.amountIn), 0n)
      .toString();

    const volumeToken = trades
      .reduce((sum, t) => {
        return t.type === 'BUY' ? sum + BigInt(t.amountOut) : sum + BigInt(t.amountIn);
      }, 0n)
      .toString();

    const candle = await prisma.priceHistory.upsert({
      where: {
        tokenAddress_interval_timestamp: {
          tokenAddress,
          interval,
          timestamp: startTime,
        },
      },
      update: { open, high, low, close, volumeNative, volumeToken, tradeCount: trades.length },
      create: {
        tokenAddress,
        interval,
        timestamp: startTime,
        open,
        high,
        low,
        close,
        volumeNative,
        volumeToken,
        tradeCount: trades.length,
      },
    });

    await cache.invalidate(`candles:${tokenAddress}:${interval}`);

    return candle;
  }

  /**
   * Simulates user portfolio calculation (worker job)
   */
  async function simulatePortfolioUpdate(walletAddress: string) {
    const trades = await prisma.trade.findMany({
      where: { traderAddress: walletAddress.toLowerCase() },
    });

    const totalInvested = trades
      .filter((t) => t.type === 'BUY')
      .reduce((sum, t) => sum + BigInt(t.amountIn), 0n);

    const totalReturned = trades
      .filter((t) => t.type === 'SELL')
      .reduce((sum, t) => sum + BigInt(t.amountOut), 0n);

    await prisma.userPortfolio.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: {
        totalInvested: totalInvested.toString(),
        totalReturned: totalReturned.toString(),
        totalTrades: trades.length,
      },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        totalInvested: totalInvested.toString(),
        totalReturned: totalReturned.toString(),
        totalTrades: trades.length,
      },
    });

    await cache.invalidate(`portfolio:${walletAddress.toLowerCase()}`);
  }

  describe('Token Creation → API Availability Flow', () => {
    it('should make newly created token available via API', async () => {
      const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });

      // Simulate indexer creating token
      await simulateTokenCreation(mockToken);

      // Verify token is available via API
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${mockToken.address}`)
        .expect(200);

      expect(response.body.data.address).toBe(mockToken.address);
      expect(response.body.data.name).toBe(mockToken.name);
      expect(response.body.data.symbol).toBe(mockToken.symbol);
    });

    it('should include new token in tokens list', async () => {
      const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(mockToken);

      const response = await request(app.getHttpServer())
        .get('/api/v1/tokens')
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].address).toBe(mockToken.address);
    });

    it('should show token in creator profile', async () => {
      const creatorAddress = TEST_ADDRESSES.user1.toLowerCase();
      const mockToken = createMockToken({
        status: 'TRADING' as TokenStatus,
        creatorAddress,
      });
      await simulateTokenCreation(mockToken);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${creatorAddress}/created-tokens`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].address).toBe(mockToken.address);
    });
  });

  describe('Trade Flow → Holder Updates → API Reflection', () => {
    let testToken: ReturnType<typeof createMockToken>;
    const traderAddress = TEST_ADDRESSES.user1.toLowerCase();

    beforeEach(async () => {
      testToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(testToken);
    });

    it('should reflect trades in token trade history', async () => {
      const trade = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
      });
      await simulateTrade(trade);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${testToken.address}/trades`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].type).toBe('BUY');
      expect(response.body.data.data[0].traderAddress).toBe(traderAddress);
    });

    it('should update holder list after buy', async () => {
      const trade = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
      });
      await simulateTrade(trade);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${testToken.address}/holders`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].holderAddress).toBe(traderAddress);
      expect(response.body.data.data[0].balance).toBe(trade.amountOut);
    });

    it('should update token price after trade', async () => {
      const newPrice = '50000000000000'; // Different from default
      const trade = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        price: newPrice,
      });
      await simulateTrade(trade);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${testToken.address}`)
        .expect(200);

      expect(response.body.data.currentPrice).toBe(newPrice);
    });

    it('should accumulate balance for multiple buys', async () => {
      const trade1 = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountOut: '1000000000000000000000', // 1000 tokens
      });
      const trade2 = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountOut: '2000000000000000000000', // 2000 tokens
      });

      await simulateTrade(trade1);
      await simulateTrade(trade2);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${testToken.address}/holders`)
        .expect(200);

      // Should have 3000 tokens total
      expect(response.body.data.data[0].balance).toBe('3000000000000000000000');
    });

    it('should reduce balance after sell', async () => {
      // First buy
      const buyTrade = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountOut: '10000000000000000000000', // 10000 tokens
      });
      await simulateTrade(buyTrade);

      // Then sell some
      const sellTrade = createMockSellTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountIn: '3000000000000000000000', // Sell 3000 tokens
      });
      await simulateTrade(sellTrade);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${testToken.address}/holders`)
        .expect(200);

      // Should have 7000 tokens remaining
      expect(response.body.data.data[0].balance).toBe('7000000000000000000000');
    });
  });

  describe('Trade Flow → Candle Aggregation', () => {
    let testToken: ReturnType<typeof createMockToken>;
    const traderAddress = TEST_ADDRESSES.user1.toLowerCase();

    beforeEach(async () => {
      testToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(testToken);
    });

    it('should aggregate trades into OHLCV candles', async () => {
      const startTime = new Date('2024-01-01T00:00:00Z');
      const endTime = new Date('2024-01-01T00:01:00Z');

      // Create multiple trades with different prices
      const trades = [
        createMockBuyTrade({
          tokenAddress: testToken.address,
          traderAddress,
          price: '100000000000000', // Open
          timestamp: new Date('2024-01-01T00:00:10Z'),
        }),
        createMockBuyTrade({
          tokenAddress: testToken.address,
          traderAddress,
          price: '150000000000000', // High
          timestamp: new Date('2024-01-01T00:00:20Z'),
        }),
        createMockSellTrade({
          tokenAddress: testToken.address,
          traderAddress,
          price: '80000000000000', // Low
          timestamp: new Date('2024-01-01T00:00:30Z'),
        }),
        createMockBuyTrade({
          tokenAddress: testToken.address,
          traderAddress,
          price: '120000000000000', // Close
          timestamp: new Date('2024-01-01T00:00:50Z'),
        }),
      ];

      // First trade creates holder
      await simulateTrade(trades[0]);
      // Subsequent trades
      for (let i = 1; i < trades.length; i++) {
        await prisma.trade.create({
          data: {
            tokenAddress: trades[i].tokenAddress,
            type: trades[i].type,
            traderAddress: trades[i].traderAddress,
            amountIn: trades[i].amountIn,
            amountOut: trades[i].amountOut,
            price: trades[i].price,
            feeAmount: trades[i].feeAmount,
            txHash: trades[i].txHash,
            blockNumber: trades[i].blockNumber,
            timestamp: trades[i].timestamp,
          },
        });
      }

      // Simulate worker candle aggregation
      const candle = await simulateCandleAggregation(
        testToken.address,
        'ONE_MINUTE' as PriceInterval,
        startTime,
        endTime,
      );

      expect(candle).not.toBeNull();
      expect(candle!.open).toBe('100000000000000');
      expect(candle!.high).toBe('150000000000000');
      expect(candle!.low).toBe('80000000000000');
      expect(candle!.close).toBe('120000000000000');
      expect(candle!.tradeCount).toBe(4);
    });

    it('should make candles available via API', async () => {
      const startTime = new Date('2024-01-01T00:00:00Z');
      const endTime = new Date('2024-01-01T00:01:00Z');

      const trade = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        timestamp: new Date('2024-01-01T00:00:30Z'),
      });
      await simulateTrade(trade);

      await simulateCandleAggregation(
        testToken.address,
        'ONE_MINUTE' as PriceInterval,
        startTime,
        endTime,
      );

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${testToken.address}/price-history`)
        .query({ interval: 'ONE_MINUTE' })
        .expect(200);

      // Price history returns an array directly (not paginated)
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].tradeCount).toBe(1);
    });
  });

  describe('User Portfolio Flow', () => {
    let testToken: ReturnType<typeof createMockToken>;
    const traderAddress = TEST_ADDRESSES.user1.toLowerCase();

    beforeEach(async () => {
      testToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(testToken);
    });

    it('should track user investments across trades', async () => {
      // Multiple buys
      const buy1 = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountIn: '1000000000000000000', // 1 PUSH
      });
      const buy2 = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountIn: '2000000000000000000', // 2 PUSH
      });

      await simulateTrade(buy1);
      await prisma.trade.create({
        data: {
          tokenAddress: buy2.tokenAddress,
          type: buy2.type,
          traderAddress: buy2.traderAddress,
          amountIn: buy2.amountIn,
          amountOut: buy2.amountOut,
          price: buy2.price,
          feeAmount: buy2.feeAmount,
          txHash: buy2.txHash,
          blockNumber: buy2.blockNumber,
          timestamp: buy2.timestamp,
        },
      });

      // Simulate worker portfolio update
      await simulatePortfolioUpdate(traderAddress);

      // Check via API
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${traderAddress}`)
        .expect(200);

      // Total invested should be 3 PUSH
      expect(response.body.data.portfolio.totalInvested).toBe('3000000000000000000');
      expect(response.body.data.portfolio.totalTrades).toBe(2);
    });

    it('should track returns from sells', async () => {
      const buy = createMockBuyTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountIn: '5000000000000000000', // 5 PUSH
      });
      await simulateTrade(buy);

      const sell = createMockSellTrade({
        tokenAddress: testToken.address,
        traderAddress,
        amountOut: '2000000000000000000', // 2 PUSH return
      });
      await prisma.trade.create({
        data: {
          tokenAddress: sell.tokenAddress,
          type: sell.type,
          traderAddress: sell.traderAddress,
          amountIn: sell.amountIn,
          amountOut: sell.amountOut,
          price: sell.price,
          feeAmount: sell.feeAmount,
          txHash: sell.txHash,
          blockNumber: sell.blockNumber,
          timestamp: sell.timestamp,
        },
      });

      await simulatePortfolioUpdate(traderAddress);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${traderAddress}`)
        .expect(200);

      expect(response.body.data.portfolio.totalInvested).toBe('5000000000000000000');
      expect(response.body.data.portfolio.totalReturned).toBe('2000000000000000000');
    });
  });

  describe('Multi-Token User Activity', () => {
    const traderAddress = TEST_ADDRESSES.user1.toLowerCase();

    it('should track holdings across multiple tokens', async () => {
      // Create multiple tokens
      const token1 = createMockToken({ status: 'TRADING' as TokenStatus, name: 'Token 1' });
      const token2 = createMockToken({ status: 'TRADING' as TokenStatus, name: 'Token 2' });
      const token3 = createMockToken({ status: 'TRADING' as TokenStatus, name: 'Token 3' });

      await simulateTokenCreation(token1);
      await simulateTokenCreation(token2);
      await simulateTokenCreation(token3);

      // Buy each token
      await simulateTrade(
        createMockBuyTrade({
          tokenAddress: token1.address,
          traderAddress,
          amountOut: '1000000000000000000000',
        }),
      );
      await simulateTrade(
        createMockBuyTrade({
          tokenAddress: token2.address,
          traderAddress,
          amountOut: '2000000000000000000000',
        }),
      );
      await simulateTrade(
        createMockBuyTrade({
          tokenAddress: token3.address,
          traderAddress,
          amountOut: '3000000000000000000000',
        }),
      );

      // Check user holdings
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${traderAddress}/holdings`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(3);

      // Verify each holding
      const holdings = response.body.data.data;
      const token1Holding = holdings.find((h: any) => h.tokenAddress === token1.address);
      const token2Holding = holdings.find((h: any) => h.tokenAddress === token2.address);
      const token3Holding = holdings.find((h: any) => h.tokenAddress === token3.address);

      expect(token1Holding.balance).toBe('1000000000000000000000');
      expect(token2Holding.balance).toBe('2000000000000000000000');
      expect(token3Holding.balance).toBe('3000000000000000000000');
    });

    it('should show all trades in user trade history', async () => {
      const token1 = createMockToken({ status: 'TRADING' as TokenStatus });
      const token2 = createMockToken({ status: 'TRADING' as TokenStatus });

      await simulateTokenCreation(token1);
      await simulateTokenCreation(token2);

      // Multiple trades across tokens
      await simulateTrade(
        createMockBuyTrade({ tokenAddress: token1.address, traderAddress }),
      );
      await simulateTrade(
        createMockBuyTrade({ tokenAddress: token2.address, traderAddress }),
      );

      // Create sell trade directly
      const sellTrade = createMockSellTrade({ tokenAddress: token1.address, traderAddress });
      await prisma.trade.create({
        data: {
          tokenAddress: sellTrade.tokenAddress,
          type: sellTrade.type,
          traderAddress: sellTrade.traderAddress,
          amountIn: sellTrade.amountIn,
          amountOut: sellTrade.amountOut,
          price: sellTrade.price,
          feeAmount: sellTrade.feeAmount,
          txHash: sellTrade.txHash,
          blockNumber: sellTrade.blockNumber,
          timestamp: sellTrade.timestamp,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${traderAddress}/trades`)
        .expect(200);

      expect(response.body.data.data).toHaveLength(3);
    });
  });

  describe('Cache Invalidation Flow', () => {
    it('should invalidate and refresh token list cache on new token', async () => {
      // First request should cache
      await request(app.getHttpServer()).get('/api/v1/tokens').expect(200);

      // Add new token
      const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(mockToken);

      // Second request should show new token
      const response = await request(app.getHttpServer())
        .get('/api/v1/tokens')
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].address).toBe(mockToken.address);
    });

    it('should invalidate token detail cache on trade', async () => {
      const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(mockToken);

      // First request caches the token
      const initialResponse = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${mockToken.address}`)
        .expect(200);

      const initialPrice = initialResponse.body.data.currentPrice;

      // Trade updates price
      const newPrice = '999999999999999';
      const trade = createMockBuyTrade({
        tokenAddress: mockToken.address,
        traderAddress: TEST_ADDRESSES.user1.toLowerCase(),
        price: newPrice,
      });
      await simulateTrade(trade);

      // Second request should show updated price
      const updatedResponse = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${mockToken.address}`)
        .expect(200);

      expect(updatedResponse.body.data.currentPrice).toBe(newPrice);
      expect(updatedResponse.body.data.currentPrice).not.toBe(initialPrice);
    });
  });

  describe('PubSub Event Flow', () => {
    it('should publish token created event', async () => {
      const receivedEvents: any[] = [];

      // Subscribe to events
      await pubsub.subscribe('token:created', (message) => {
        receivedEvents.push(message);
      });

      // Create token
      const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(mockToken);

      // Give time for event to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
      expect(receivedEvents[0].address).toBe(mockToken.address);
    });

    it('should publish trade event', async () => {
      const receivedEvents: any[] = [];

      await pubsub.subscribe('trade:new', (message) => {
        receivedEvents.push(message);
      });

      const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
      await simulateTokenCreation(mockToken);

      const trade = createMockBuyTrade({
        tokenAddress: mockToken.address,
        traderAddress: TEST_ADDRESSES.user1.toLowerCase(),
      });
      await simulateTrade(trade);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
      expect(receivedEvents[0].tokenAddress).toBe(mockToken.address);
      expect(receivedEvents[0].type).toBe('BUY');
    });
  });
});
