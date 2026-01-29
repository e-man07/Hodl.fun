/**
 * Worker Service Integration Tests
 * Tests candle aggregation, metrics calculation, and cleanup with real database
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, PriceInterval } from '@hodlfun/database';
import { CacheService, RedisService, RedisModule } from '@hodlfun/redis';
import { CandleService } from '../../candle/candle.service';
import { MetricsProcessor } from '../../metrics/metrics.processor';
import { CleanupProcessor } from '../../cleanup/cleanup.processor';
import { createMockToken, TokenStatus } from '../../../../../test/mocks/factories/token.factory';
import { createMockBuyTrade, createMockSellTrade } from '../../../../../test/mocks/factories/trade.factory';
import { TEST_ADDRESSES } from '../../../../../test/mocks/ethers.mock';

describe('Worker Integration Tests', () => {
  let prisma: PrismaService;
  let cache: CacheService;
  let redis: RedisService;
  let candleService: CandleService;
  let metricsProcessor: MetricsProcessor;
  let cleanupProcessor: CleanupProcessor;
  let module: TestingModule;

  // Test data
  let testTokenAddress: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
      providers: [
        PrismaService,
        CandleService,
        MetricsProcessor,
        CleanupProcessor,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    redis = module.get<RedisService>(RedisService);
    candleService = module.get<CandleService>(CandleService);
    metricsProcessor = module.get<MetricsProcessor>(MetricsProcessor);
    cleanupProcessor = module.get<CleanupProcessor>(CleanupProcessor);

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.priceHistory.deleteMany({});
    await prisma.trade.deleteMany({});
    await prisma.holder.deleteMany({});
    await prisma.userPortfolio.deleteMany({});
    await prisma.token.deleteMany({});

    // Create test token
    const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
    testTokenAddress = mockToken.address;

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
  });

  describe('CandleService', () => {
    describe('aggregateCandles', () => {
      it('should aggregate trades into OHLCV candle', async () => {
        const startTime = new Date('2024-01-01T00:00:00Z');
        const endTime = new Date('2024-01-01T00:01:00Z');

        // Create trades with different prices
        const trades = [
          createMockBuyTrade({
            tokenAddress: testTokenAddress,
            price: '100000000000000', // Open
            timestamp: new Date('2024-01-01T00:00:10Z'),
          }),
          createMockBuyTrade({
            tokenAddress: testTokenAddress,
            price: '150000000000000', // High
            timestamp: new Date('2024-01-01T00:00:20Z'),
          }),
          createMockSellTrade({
            tokenAddress: testTokenAddress,
            price: '80000000000000', // Low
            timestamp: new Date('2024-01-01T00:00:30Z'),
          }),
          createMockBuyTrade({
            tokenAddress: testTokenAddress,
            price: '120000000000000', // Close
            timestamp: new Date('2024-01-01T00:00:50Z'),
          }),
        ];

        for (const trade of trades) {
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
        }

        // Aggregate candles
        await candleService.aggregateCandles(
          testTokenAddress,
          'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        );

        // Verify candle was created
        const candle = await prisma.priceHistory.findUnique({
          where: {
            tokenAddress_interval_timestamp: {
              tokenAddress: testTokenAddress,
              interval: 'ONE_MINUTE',
              timestamp: startTime,
            },
          },
        });

        expect(candle).not.toBeNull();
        expect(candle!.open).toBe('100000000000000');
        expect(candle!.high).toBe('150000000000000');
        expect(candle!.low).toBe('80000000000000');
        expect(candle!.close).toBe('120000000000000');
        expect(candle!.tradeCount).toBe(4);
      });

      it('should calculate volume correctly', async () => {
        const startTime = new Date('2024-01-01T00:00:00Z');
        const endTime = new Date('2024-01-01T00:01:00Z');

        // Create buy trades
        const buyTrade1 = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          amountIn: '1000000000000000000', // 1 PUSH
          amountOut: '50000000000000000000000', // 50k tokens
          timestamp: new Date('2024-01-01T00:00:10Z'),
        });
        const buyTrade2 = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          amountIn: '2000000000000000000', // 2 PUSH
          amountOut: '100000000000000000000000', // 100k tokens
          timestamp: new Date('2024-01-01T00:00:20Z'),
        });
        // Create sell trade
        const sellTrade = createMockSellTrade({
          tokenAddress: testTokenAddress,
          amountIn: '30000000000000000000000', // 30k tokens
          amountOut: '600000000000000000', // 0.6 PUSH
          timestamp: new Date('2024-01-01T00:00:30Z'),
        });

        for (const trade of [buyTrade1, buyTrade2, sellTrade]) {
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
        }

        await candleService.aggregateCandles(
          testTokenAddress,
          'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        );

        const candle = await prisma.priceHistory.findUnique({
          where: {
            tokenAddress_interval_timestamp: {
              tokenAddress: testTokenAddress,
              interval: 'ONE_MINUTE',
              timestamp: startTime,
            },
          },
        });

        // volumeNative = sum of BUY amountIn = 1 + 2 = 3 PUSH
        expect(candle!.volumeNative).toBe('3000000000000000000');
        // volumeToken = BUY amountOut + SELL amountIn = 50k + 100k + 30k = 180k tokens
        expect(candle!.volumeToken).toBe('180000000000000000000000');
      });

      it('should skip if no trades in window', async () => {
        const startTime = new Date('2024-01-01T00:00:00Z');
        const endTime = new Date('2024-01-01T00:01:00Z');

        await candleService.aggregateCandles(
          testTokenAddress,
          'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        );

        const candle = await prisma.priceHistory.findUnique({
          where: {
            tokenAddress_interval_timestamp: {
              tokenAddress: testTokenAddress,
              interval: 'ONE_MINUTE',
              timestamp: startTime,
            },
          },
        });

        expect(candle).toBeNull();
      });

      it('should update existing candle on re-aggregation', async () => {
        const startTime = new Date('2024-01-01T00:00:00Z');
        const endTime = new Date('2024-01-01T00:01:00Z');

        // First aggregation
        const trade1 = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          price: '100000000000000',
          timestamp: new Date('2024-01-01T00:00:10Z'),
        });

        await prisma.trade.create({
          data: {
            tokenAddress: trade1.tokenAddress,
            type: trade1.type,
            traderAddress: trade1.traderAddress,
            amountIn: trade1.amountIn,
            amountOut: trade1.amountOut,
            price: trade1.price,
            feeAmount: trade1.feeAmount,
            txHash: trade1.txHash,
            blockNumber: trade1.blockNumber,
            timestamp: trade1.timestamp,
          },
        });

        await candleService.aggregateCandles(
          testTokenAddress,
          'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        );

        let candle = await prisma.priceHistory.findUnique({
          where: {
            tokenAddress_interval_timestamp: {
              tokenAddress: testTokenAddress,
              interval: 'ONE_MINUTE',
              timestamp: startTime,
            },
          },
        });
        expect(candle!.tradeCount).toBe(1);

        // Add another trade and re-aggregate
        const trade2 = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          price: '200000000000000',
          timestamp: new Date('2024-01-01T00:00:20Z'),
        });

        await prisma.trade.create({
          data: {
            tokenAddress: trade2.tokenAddress,
            type: trade2.type,
            traderAddress: trade2.traderAddress,
            amountIn: trade2.amountIn,
            amountOut: trade2.amountOut,
            price: trade2.price,
            feeAmount: trade2.feeAmount,
            txHash: trade2.txHash,
            blockNumber: trade2.blockNumber,
            timestamp: trade2.timestamp,
          },
        });

        await candleService.aggregateCandles(
          testTokenAddress,
          'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        );

        candle = await prisma.priceHistory.findUnique({
          where: {
            tokenAddress_interval_timestamp: {
              tokenAddress: testTokenAddress,
              interval: 'ONE_MINUTE',
              timestamp: startTime,
            },
          },
        });
        expect(candle!.tradeCount).toBe(2);
        expect(candle!.high).toBe('200000000000000');
      });
    });

    describe('aggregateAllTokens', () => {
      it('should aggregate candles for all TRADING tokens', async () => {
        // Create a second token
        const token2 = createMockToken({ status: 'TRADING' as TokenStatus });
        await prisma.token.create({
          data: {
            address: token2.address,
            name: token2.name,
            symbol: token2.symbol,
            tokenUri: token2.tokenUri,
            creatorAddress: token2.creatorAddress,
            curveAddress: token2.curveAddress,
            status: 'TRADING',
            currentPrice: token2.currentPrice,
            marketCap: token2.marketCap,
            virtualNative: token2.virtualNative,
            virtualToken: token2.virtualToken,
            realNative: token2.realNative,
            realToken: token2.realToken,
            k: token2.k,
            athPrice: token2.athPrice,
            athMarketCap: token2.athMarketCap,
            createdAt: token2.createdAt,
            createdBlock: token2.createdBlock,
          },
        });

        const startTime = new Date('2024-01-01T00:00:00Z');
        const endTime = new Date('2024-01-01T00:01:00Z');

        // Create trades for both tokens
        for (const tokenAddr of [testTokenAddress, token2.address]) {
          const trade = createMockBuyTrade({
            tokenAddress: tokenAddr,
            timestamp: new Date('2024-01-01T00:00:10Z'),
          });
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
        }

        await candleService.aggregateAllTokens(
          'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        );

        // Both tokens should have candles
        const candles = await prisma.priceHistory.findMany({
          where: { interval: 'ONE_MINUTE' },
        });
        expect(candles.length).toBe(2);
      });

      it('should skip LOCKED tokens', async () => {
        // Create a locked token
        const lockedToken = createMockToken({ status: 'LOCKED' as TokenStatus });
        await prisma.token.create({
          data: {
            address: lockedToken.address,
            name: lockedToken.name,
            symbol: lockedToken.symbol,
            tokenUri: lockedToken.tokenUri,
            creatorAddress: lockedToken.creatorAddress,
            curveAddress: lockedToken.curveAddress,
            status: 'LOCKED',
            currentPrice: lockedToken.currentPrice,
            marketCap: lockedToken.marketCap,
            virtualNative: lockedToken.virtualNative,
            virtualToken: lockedToken.virtualToken,
            realNative: lockedToken.realNative,
            realToken: lockedToken.realToken,
            k: lockedToken.k,
            athPrice: lockedToken.athPrice,
            athMarketCap: lockedToken.athMarketCap,
            createdAt: lockedToken.createdAt,
            createdBlock: lockedToken.createdBlock,
          },
        });

        const startTime = new Date('2024-01-01T00:00:00Z');
        const endTime = new Date('2024-01-01T00:01:00Z');

        // Create trade for locked token
        const trade = createMockBuyTrade({
          tokenAddress: lockedToken.address,
          timestamp: new Date('2024-01-01T00:00:10Z'),
        });
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

        await candleService.aggregateAllTokens(
          'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        );

        // Only the TRADING token should have a candle (not the locked one)
        const candles = await prisma.priceHistory.findMany({
          where: { tokenAddress: lockedToken.address },
        });
        expect(candles.length).toBe(0);
      });
    });
  });

  describe('MetricsProcessor', () => {
    describe('handleUpdateUserPortfolio', () => {
      it('should calculate user portfolio from trades', async () => {
        const walletAddress = TEST_ADDRESSES.user1.toLowerCase();

        // Create buy trades
        const buyTrade1 = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          traderAddress: walletAddress,
          amountIn: '1000000000000000000', // 1 PUSH
        });
        const buyTrade2 = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          traderAddress: walletAddress,
          amountIn: '2000000000000000000', // 2 PUSH
        });

        // Create sell trade
        const sellTrade = createMockSellTrade({
          tokenAddress: testTokenAddress,
          traderAddress: walletAddress,
          amountOut: '500000000000000000', // 0.5 PUSH
        });

        for (const trade of [buyTrade1, buyTrade2, sellTrade]) {
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
        }

        // Create mock job
        const mockJob = {
          data: { walletAddress },
        } as any;

        await metricsProcessor.handleUpdateUserPortfolio(mockJob);

        const portfolio = await prisma.userPortfolio.findUnique({
          where: { walletAddress },
        });

        expect(portfolio).not.toBeNull();
        // Total invested = BUY amountIn = 1 + 2 = 3 PUSH
        expect(portfolio!.totalInvested).toBe('3000000000000000000');
        // Total returned = SELL amountOut = 0.5 PUSH
        expect(portfolio!.totalReturned).toBe('500000000000000000');
        expect(portfolio!.totalTrades).toBe(3);
      });

      it('should update existing portfolio', async () => {
        const walletAddress = TEST_ADDRESSES.user1.toLowerCase();

        // Create initial portfolio
        await prisma.userPortfolio.create({
          data: {
            walletAddress,
            totalInvested: '1000000000000000000',
            totalReturned: '0',
            totalTrades: 1,
          },
        });

        // Create additional trade
        const trade = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          traderAddress: walletAddress,
          amountIn: '2000000000000000000',
        });
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

        const mockJob = { data: { walletAddress } } as any;
        await metricsProcessor.handleUpdateUserPortfolio(mockJob);

        const portfolio = await prisma.userPortfolio.findUnique({
          where: { walletAddress },
        });

        // Should recalculate from all trades
        expect(portfolio!.totalInvested).toBe('2000000000000000000');
        expect(portfolio!.totalTrades).toBe(1);
      });
    });

    describe('handleCalculateLeaderboard', () => {
      it('should calculate new tokens leaderboard', async () => {
        // Create additional tokens with different creation times
        for (let i = 0; i < 3; i++) {
          const token = createMockToken({ status: 'TRADING' as TokenStatus });
          await prisma.token.create({
            data: {
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              tokenUri: token.tokenUri,
              creatorAddress: token.creatorAddress,
              curveAddress: token.curveAddress,
              status: 'TRADING',
              currentPrice: token.currentPrice,
              marketCap: token.marketCap,
              virtualNative: token.virtualNative,
              virtualToken: token.virtualToken,
              realNative: token.realNative,
              realToken: token.realToken,
              k: token.k,
              athPrice: token.athPrice,
              athMarketCap: token.athMarketCap,
              createdAt: new Date(Date.now() - i * 60000), // Different times
              createdBlock: token.createdBlock,
            },
          });
        }

        const mockJob = { data: { type: 'new' } } as any;
        await metricsProcessor.handleCalculateLeaderboard(mockJob);

        // Check cache was set
        const cached = await cache.get<any[]>('leaderboard:new');
        expect(cached).not.toBeNull();
        expect(cached!.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('CleanupProcessor', () => {
    describe('handleCleanupOldCandles', () => {
      it('should delete old 1-minute candles', async () => {
        // Create old candle (8 days ago)
        await prisma.priceHistory.create({
          data: {
            tokenAddress: testTokenAddress,
            interval: 'ONE_MINUTE',
            timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            open: '100',
            high: '100',
            low: '100',
            close: '100',
            volumeNative: '0',
            volumeToken: '0',
            tradeCount: 0,
          },
        });

        // Create recent candle (1 day ago)
        await prisma.priceHistory.create({
          data: {
            tokenAddress: testTokenAddress,
            interval: 'ONE_MINUTE',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            open: '100',
            high: '100',
            low: '100',
            close: '100',
            volumeNative: '0',
            volumeToken: '0',
            tradeCount: 0,
          },
        });

        const mockJob = {} as any;
        await cleanupProcessor.handleCleanupOldCandles(mockJob);

        const candles = await prisma.priceHistory.findMany({
          where: { tokenAddress: testTokenAddress, interval: 'ONE_MINUTE' },
        });

        // Only the recent candle should remain
        expect(candles.length).toBe(1);
      });

      it('should not delete candles of other intervals', async () => {
        // Create old 1-hour candle (8 days ago)
        await prisma.priceHistory.create({
          data: {
            tokenAddress: testTokenAddress,
            interval: 'ONE_HOUR',
            timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            open: '100',
            high: '100',
            low: '100',
            close: '100',
            volumeNative: '0',
            volumeToken: '0',
            tradeCount: 0,
          },
        });

        const mockJob = {} as any;
        await cleanupProcessor.handleCleanupOldCandles(mockJob);

        const candles = await prisma.priceHistory.findMany({
          where: { tokenAddress: testTokenAddress, interval: 'ONE_HOUR' },
        });

        // 1-hour candle should remain
        expect(candles.length).toBe(1);
      });
    });

    describe('handleCleanupZeroBalanceHolders', () => {
      it('should delete holders with zero balance', async () => {
        // Create zero-balance holder
        await prisma.holder.create({
          data: {
            tokenAddress: testTokenAddress,
            holderAddress: TEST_ADDRESSES.user1.toLowerCase(),
            balance: '0',
            firstBuyTimestamp: new Date(),
            lastActivityTimestamp: new Date(),
          },
        });

        const mockJob = {} as any;
        await cleanupProcessor.handleCleanupZeroBalanceHolders(mockJob);

        const holders = await prisma.holder.findMany({
          where: { tokenAddress: testTokenAddress },
        });

        expect(holders.length).toBe(0);
      });

      it('should not delete holders with non-zero balance', async () => {
        // Create holder with balance
        await prisma.holder.create({
          data: {
            tokenAddress: testTokenAddress,
            holderAddress: TEST_ADDRESSES.user1.toLowerCase(),
            balance: '1000000000000000000',
            firstBuyTimestamp: new Date(),
            lastActivityTimestamp: new Date(),
          },
        });

        const mockJob = {} as any;
        await cleanupProcessor.handleCleanupZeroBalanceHolders(mockJob);

        const holders = await prisma.holder.findMany({
          where: { tokenAddress: testTokenAddress },
        });

        expect(holders.length).toBe(1);
      });
    });
  });
});
