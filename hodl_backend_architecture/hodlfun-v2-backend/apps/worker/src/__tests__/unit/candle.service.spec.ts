/**
 * Candle Service Unit Tests
 * Tests for OHLCV candlestick aggregation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CandleService } from '../../candle/candle.service';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';

// Mock factories
const createMockPrismaService = () => ({
  trade: {
    findMany: jest.fn(),
  },
  priceHistory: {
    upsert: jest.fn(),
  },
  token: {
    findMany: jest.fn(),
  },
});

const createMockCacheService = () => ({
  invalidate: jest.fn(),
});

describe('CandleService', () => {
  let service: CandleService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockCache: ReturnType<typeof createMockCacheService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockCache = createMockCacheService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<CandleService>(CandleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('aggregateCandles', () => {
    const tokenAddress = '0xtoken123';
    const startTime = new Date('2024-01-01T00:00:00Z');
    const endTime = new Date('2024-01-01T00:01:00Z');

    it('should return early if no trades found', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await service.aggregateCandles(tokenAddress, 'ONE_MINUTE' as any, startTime, endTime);

      expect(mockPrisma.priceHistory.upsert).not.toHaveBeenCalled();
    });

    it('should calculate correct OHLC values', async () => {
      const trades = [
        { type: 'BUY', price: '100', amountIn: '1000', amountOut: '500', timestamp: new Date() },
        { type: 'BUY', price: '120', amountIn: '2000', amountOut: '800', timestamp: new Date() },
        { type: 'SELL', price: '90', amountIn: '300', amountOut: '1500', timestamp: new Date() },
        { type: 'BUY', price: '110', amountIn: '1500', amountOut: '700', timestamp: new Date() },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await service.aggregateCandles(tokenAddress, 'ONE_MINUTE' as any, startTime, endTime);

      expect(mockPrisma.priceHistory.upsert).toHaveBeenCalledWith({
        where: {
          tokenAddress_interval_timestamp: {
            tokenAddress,
            interval: 'ONE_MINUTE',
            timestamp: startTime,
          },
        },
        update: expect.objectContaining({
          open: '100', // First price
          high: '120', // Highest price
          low: '90', // Lowest price
          close: '110', // Last price
          tradeCount: 4,
        }),
        create: expect.objectContaining({
          tokenAddress,
          interval: 'ONE_MINUTE',
          timestamp: startTime,
        }),
      });
    });

    it('should calculate correct volume for buys', async () => {
      const trades = [
        { type: 'BUY', price: '100', amountIn: '1000', amountOut: '500', timestamp: new Date() },
        { type: 'BUY', price: '100', amountIn: '2000', amountOut: '1000', timestamp: new Date() },
        { type: 'SELL', price: '100', amountIn: '300', amountOut: '500', timestamp: new Date() },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await service.aggregateCandles(tokenAddress, 'ONE_MINUTE' as any, startTime, endTime);

      expect(mockPrisma.priceHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            volumeNative: '3000', // Sum of BUY amountIn: 1000 + 2000
          }),
        }),
      );
    });

    it('should calculate correct token volume', async () => {
      const trades = [
        { type: 'BUY', price: '100', amountIn: '1000', amountOut: '500', timestamp: new Date() },
        { type: 'SELL', price: '100', amountIn: '300', amountOut: '500', timestamp: new Date() },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await service.aggregateCandles(tokenAddress, 'ONE_MINUTE' as any, startTime, endTime);

      expect(mockPrisma.priceHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            volumeToken: '800', // BUY amountOut (500) + SELL amountIn (300)
          }),
        }),
      );
    });

    it('should query trades with correct time window', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await service.aggregateCandles(tokenAddress, 'ONE_HOUR' as any, startTime, endTime);

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: {
          tokenAddress,
          timestamp: { gte: startTime, lt: endTime },
        },
        orderBy: { timestamp: 'asc' },
      });
    });

    it('should invalidate cache after aggregation', async () => {
      const trades = [
        { type: 'BUY', price: '100', amountIn: '1000', amountOut: '500', timestamp: new Date() },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await service.aggregateCandles(tokenAddress, 'FIVE_MINUTES' as any, startTime, endTime);

      expect(mockCache.invalidate).toHaveBeenCalledWith(`candles:${tokenAddress}:FIVE_MINUTES`);
    });

    it('should handle single trade correctly', async () => {
      const trades = [
        { type: 'BUY', price: '100', amountIn: '1000', amountOut: '500', timestamp: new Date() },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await service.aggregateCandles(tokenAddress, 'ONE_MINUTE' as any, startTime, endTime);

      expect(mockPrisma.priceHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            open: '100',
            high: '100',
            low: '100',
            close: '100',
            tradeCount: 1,
          }),
        }),
      );
    });
  });

  describe('aggregateAllTokens', () => {
    const startTime = new Date('2024-01-01T00:00:00Z');
    const endTime = new Date('2024-01-01T00:01:00Z');

    it('should aggregate candles for all trading tokens', async () => {
      const tokens = [
        { address: '0xtoken1' },
        { address: '0xtoken2' },
        { address: '0xtoken3' },
      ];

      mockPrisma.token.findMany.mockResolvedValue(tokens);
      mockPrisma.trade.findMany.mockResolvedValue([]); // No trades for simplicity

      await service.aggregateAllTokens('ONE_MINUTE' as any, startTime, endTime);

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith({
        where: { status: 'TRADING' },
        select: { address: true },
      });

      // Should attempt to aggregate for each token
      expect(mockPrisma.trade.findMany).toHaveBeenCalledTimes(3);
    });

    it('should continue processing if one token fails', async () => {
      const tokens = [
        { address: '0xtoken1' },
        { address: '0xtoken2' },
        { address: '0xtoken3' },
      ];

      mockPrisma.token.findMany.mockResolvedValue(tokens);

      // First token throws error, others succeed
      mockPrisma.trade.findMany
        .mockRejectedValueOnce(new Error('DB Error'))
        .mockResolvedValue([]);

      await service.aggregateAllTokens('ONE_MINUTE' as any, startTime, endTime);

      // Should still try all 3 tokens
      expect(mockPrisma.trade.findMany).toHaveBeenCalledTimes(3);
    });

    it('should handle no trading tokens', async () => {
      mockPrisma.token.findMany.mockResolvedValue([]);

      await service.aggregateAllTokens('ONE_MINUTE' as any, startTime, endTime);

      expect(mockPrisma.trade.findMany).not.toHaveBeenCalled();
    });
  });
});
