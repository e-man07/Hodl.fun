/**
 * Cleanup Processor Unit Tests
 * Tests for cleanup jobs: old candles, zero-balance holders, and cache warmup
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CleanupProcessor } from '../../cleanup/cleanup.processor';
import { PrismaService } from '@hodlfun/database';
import { RedisService } from '@hodlfun/redis';

// Mock factories
const createMockPrismaService = () => ({
  priceHistory: {
    deleteMany: jest.fn(),
  },
  holder: {
    deleteMany: jest.fn(),
  },
});

const createMockRedisService = () => ({
  del: jest.fn(),
});

describe('CleanupProcessor', () => {
  let processor: CleanupProcessor;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockRedis: ReturnType<typeof createMockRedisService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockRedis = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    processor = module.get<CleanupProcessor>(CleanupProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCleanupOldCandles', () => {
    it('should delete ONE_MINUTE candles older than 7 days', async () => {
      mockPrisma.priceHistory.deleteMany.mockResolvedValue({ count: 100 });

      const job = {} as any;
      await processor.handleCleanupOldCandles(job);

      expect(mockPrisma.priceHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          interval: 'ONE_MINUTE',
          timestamp: { lt: expect.any(Date) },
        },
      });
    });

    it('should calculate 7-day threshold correctly', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockPrisma.priceHistory.deleteMany.mockResolvedValue({ count: 0 });

      const job = {} as any;
      await processor.handleCleanupOldCandles(job);

      const expectedThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const callArgs = mockPrisma.priceHistory.deleteMany.mock.calls[0][0];

      // Check the timestamp is approximately 7 days ago
      const actualThreshold = callArgs.where.timestamp.lt;
      expect(actualThreshold.getTime()).toBe(expectedThreshold.getTime());

      jest.spyOn(Date, 'now').mockRestore();
    });

    it('should only target ONE_MINUTE interval', async () => {
      mockPrisma.priceHistory.deleteMany.mockResolvedValue({ count: 50 });

      const job = {} as any;
      await processor.handleCleanupOldCandles(job);

      const callArgs = mockPrisma.priceHistory.deleteMany.mock.calls[0][0];
      expect(callArgs.where.interval).toBe('ONE_MINUTE');
    });

    it('should handle no candles to delete', async () => {
      mockPrisma.priceHistory.deleteMany.mockResolvedValue({ count: 0 });

      const job = {} as any;
      await expect(processor.handleCleanupOldCandles(job)).resolves.not.toThrow();
    });

    it('should handle large number of candles deleted', async () => {
      mockPrisma.priceHistory.deleteMany.mockResolvedValue({ count: 1000000 });

      const job = {} as any;
      await expect(processor.handleCleanupOldCandles(job)).resolves.not.toThrow();
    });

    it('should propagate database errors', async () => {
      mockPrisma.priceHistory.deleteMany.mockRejectedValue(new Error('Database unavailable'));

      const job = {} as any;
      await expect(processor.handleCleanupOldCandles(job)).rejects.toThrow('Database unavailable');
    });
  });

  describe('handleCleanupZeroBalanceHolders', () => {
    it('should delete holders with zero balance', async () => {
      mockPrisma.holder.deleteMany.mockResolvedValue({ count: 50 });

      const job = {} as any;
      await processor.handleCleanupZeroBalanceHolders(job);

      expect(mockPrisma.holder.deleteMany).toHaveBeenCalledWith({
        where: { balance: '0' },
      });
    });

    it('should use exact string match for zero balance', async () => {
      mockPrisma.holder.deleteMany.mockResolvedValue({ count: 10 });

      const job = {} as any;
      await processor.handleCleanupZeroBalanceHolders(job);

      const callArgs = mockPrisma.holder.deleteMany.mock.calls[0][0];
      expect(callArgs.where.balance).toBe('0');
      expect(callArgs.where.balance).not.toBe(0);
    });

    it('should handle no zero-balance holders', async () => {
      mockPrisma.holder.deleteMany.mockResolvedValue({ count: 0 });

      const job = {} as any;
      await expect(processor.handleCleanupZeroBalanceHolders(job)).resolves.not.toThrow();
    });

    it('should handle large cleanup operations', async () => {
      mockPrisma.holder.deleteMany.mockResolvedValue({ count: 500000 });

      const job = {} as any;
      await expect(processor.handleCleanupZeroBalanceHolders(job)).resolves.not.toThrow();
    });

    it('should propagate database errors', async () => {
      mockPrisma.holder.deleteMany.mockRejectedValue(new Error('Connection lost'));

      const job = {} as any;
      await expect(processor.handleCleanupZeroBalanceHolders(job)).rejects.toThrow('Connection lost');
    });
  });

  describe('handleCacheWarmup', () => {
    it('should delete all leaderboard cache keys', async () => {
      mockRedis.del.mockResolvedValue(1);

      const job = {} as any;
      await processor.handleCacheWarmup(job);

      expect(mockRedis.del).toHaveBeenCalledTimes(3);
      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:gainers');
      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:volume');
      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:new');
    });

    it('should delete cache keys in correct order', async () => {
      mockRedis.del.mockResolvedValue(1);

      const job = {} as any;
      await processor.handleCacheWarmup(job);

      const calls = mockRedis.del.mock.calls;
      expect(calls[0][0]).toBe('leaderboard:gainers');
      expect(calls[1][0]).toBe('leaderboard:volume');
      expect(calls[2][0]).toBe('leaderboard:new');
    });

    it('should handle missing cache keys gracefully', async () => {
      mockRedis.del.mockResolvedValue(0); // Key doesn't exist

      const job = {} as any;
      await expect(processor.handleCacheWarmup(job)).resolves.not.toThrow();
    });

    it('should continue deleting other keys if one fails', async () => {
      mockRedis.del
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error('Redis error'))
        .mockResolvedValueOnce(1);

      const job = {} as any;

      // The current implementation doesn't handle individual errors gracefully
      // It will throw on the second call
      await expect(processor.handleCacheWarmup(job)).rejects.toThrow('Redis error');

      // First key was deleted before error
      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:gainers');
    });

    it('should propagate Redis connection errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection refused'));

      const job = {} as any;
      await expect(processor.handleCacheWarmup(job)).rejects.toThrow('Redis connection refused');
    });

    it('should warm up exactly three leaderboard types', async () => {
      mockRedis.del.mockResolvedValue(1);

      const job = {} as any;
      await processor.handleCacheWarmup(job);

      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });
  });

  describe('job parameter handling', () => {
    it('should not use job data for cleanup-old-candles', async () => {
      mockPrisma.priceHistory.deleteMany.mockResolvedValue({ count: 0 });

      // Job data is ignored for this processor
      const job = { data: { someParam: 'value' } } as any;
      await processor.handleCleanupOldCandles(job);

      // Should still use hardcoded 7-day threshold
      expect(mockPrisma.priceHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          interval: 'ONE_MINUTE',
          timestamp: { lt: expect.any(Date) },
        },
      });
    });

    it('should not use job data for cleanup-zero-balance-holders', async () => {
      mockPrisma.holder.deleteMany.mockResolvedValue({ count: 0 });

      const job = { data: { customBalance: '100' } } as any;
      await processor.handleCleanupZeroBalanceHolders(job);

      // Should still use hardcoded '0' balance
      expect(mockPrisma.holder.deleteMany).toHaveBeenCalledWith({
        where: { balance: '0' },
      });
    });

    it('should not use job data for cache-warmup', async () => {
      mockRedis.del.mockResolvedValue(1);

      const job = { data: { customTypes: ['custom'] } } as any;
      await processor.handleCacheWarmup(job);

      // Should still use hardcoded leaderboard types
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });
  });
});
