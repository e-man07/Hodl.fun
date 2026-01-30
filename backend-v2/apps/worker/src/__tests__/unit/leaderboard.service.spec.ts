import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { PrismaService } from '@hodlfun/database';
import { CacheService, PubSubService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockCache: jest.Mocked<CacheService>;
  let mockPubsub: jest.Mocked<PubSubService>;
  let mockMetrics: Partial<MetricsService>;

  const mockTokens = [
    {
      id: '1',
      address: '0xtoken1',
      name: 'Token 1',
      symbol: 'TK1',
      currentPrice: '1000000000000000',
      marketCap: '100000000000000000000',
      createdAt: new Date('2026-01-28'),
      status: 'TRADING',
    },
    {
      id: '2',
      address: '0xtoken2',
      name: 'Token 2',
      symbol: 'TK2',
      currentPrice: '2000000000000000',
      marketCap: '200000000000000000000',
      createdAt: new Date('2026-01-29'),
      status: 'TRADING',
    },
  ];

  const mockPriceHistory = [
    { tokenAddress: '0xtoken1', close: '500000000000000' }, // 50% gain
    { tokenAddress: '0xtoken2', close: '2500000000000000' }, // 20% loss
  ];

  beforeEach(async () => {
    mockPrisma = {
      token: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      priceHistory: {
        findMany: jest.fn(),
      },
      trade: {
        groupBy: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockCache = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    mockPubsub = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PubSubService>;

    mockMetrics = {
      queueJobsProcessed: { inc: jest.fn() },
      queueJobDuration: { observe: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: PubSubService, useValue: mockPubsub },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  describe('computeGainers', () => {
    it('should compute top gainers by 24h price change', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockPriceHistory);

      const result = await service.computeGainers(10);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'TRADING' },
        }),
      );
    });

    it('should sort by price change descending', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockPriceHistory);

      const result = await service.computeGainers(10);

      // Token 1 gained 100% (from 500000000000000 to 1000000000000000)
      // Token 2 lost 20% (from 2500000000000000 to 2000000000000000)
      expect(result[0].address).toBe('0xtoken1');
    });

    it('should include priceChange24h in result', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockPriceHistory);

      const result = await service.computeGainers(10);

      expect(result[0]).toHaveProperty('priceChange24h');
      expect(typeof result[0].priceChange24h).toBe('number');
    });

    it('should handle tokens without 24h price history', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue([]); // No history

      const result = await service.computeGainers(10);

      expect(result).toBeDefined();
      // Tokens without history should have 0 change
      result.forEach((token: { priceChange24h: number }) => {
        expect(token.priceChange24h).toBe(0);
      });
    });
  });

  describe('computeLosers', () => {
    it('should compute top losers by 24h price change', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockPriceHistory);

      const result = await service.computeLosers(10);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should sort by price change ascending (biggest losers first)', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockPriceHistory);

      const result = await service.computeLosers(10);

      // Token 2 lost 20%, should be first
      expect(result[0].address).toBe('0xtoken2');
    });
  });

  describe('computeVolumeLeaders', () => {
    it('should compute top tokens by 24h volume', async () => {
      mockPrisma.trade.groupBy.mockResolvedValue([
        { tokenAddress: '0xtoken1', _sum: { amountIn: '1000000000000000000' } },
        { tokenAddress: '0xtoken2', _sum: { amountIn: '500000000000000000' } },
      ]);
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);

      const result = await service.computeVolumeLeaders(10);

      expect(result).toBeDefined();
      expect(mockPrisma.trade.groupBy).toHaveBeenCalled();
    });

    it('should sort by volume descending', async () => {
      mockPrisma.trade.groupBy.mockResolvedValue([
        { tokenAddress: '0xtoken1', _sum: { amountIn: '1000000000000000000' } },
        { tokenAddress: '0xtoken2', _sum: { amountIn: '500000000000000000' } },
      ]);
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);

      const result = await service.computeVolumeLeaders(10);

      expect(result[0].address).toBe('0xtoken1');
    });

    it('should include volume24h in result', async () => {
      mockPrisma.trade.groupBy.mockResolvedValue([
        { tokenAddress: '0xtoken1', _sum: { amountIn: '1000000000000000000' } },
      ]);
      mockPrisma.token.findMany.mockResolvedValue([mockTokens[0]]);

      const result = await service.computeVolumeLeaders(10);

      expect(result[0]).toHaveProperty('volume24h');
    });
  });

  describe('computeNewest', () => {
    it('should return newest tokens sorted by createdAt', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);

      const result = await service.computeNewest(10);

      expect(result).toBeDefined();
      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('computeGraduated', () => {
    it('should return recently graduated tokens', async () => {
      const graduatedTokens = [
        { ...mockTokens[0], status: 'LISTED', graduatedAt: new Date() },
      ];
      mockPrisma.token.findMany.mockResolvedValue(graduatedTokens);

      const result = await service.computeGraduated(10);

      expect(result).toBeDefined();
      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'LISTED' },
        }),
      );
    });
  });

  describe('updateAllLeaderboards', () => {
    it('should compute and cache all leaderboards', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockPriceHistory);
      mockPrisma.trade.groupBy.mockResolvedValue([]);

      await service.updateAllLeaderboards();

      // Should cache 5 leaderboard types
      expect(mockCache.set).toHaveBeenCalledTimes(5);
      expect(mockCache.set).toHaveBeenCalledWith(
        'leaderboard:gainers',
        expect.any(Array),
        30,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'leaderboard:losers',
        expect.any(Array),
        30,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'leaderboard:volume',
        expect.any(Array),
        30,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'leaderboard:new',
        expect.any(Array),
        30,
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        'leaderboard:graduated',
        expect.any(Array),
        30,
      );
    });

    it('should publish leaderboard update event', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue([]);
      mockPrisma.trade.groupBy.mockResolvedValue([]);

      await service.updateAllLeaderboards();

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        'leaderboard_updated',
        expect.objectContaining({ updated: true }),
      );
    });

    it('should increment metrics on success', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue([]);
      mockPrisma.trade.groupBy.mockResolvedValue([]);

      await service.updateAllLeaderboards();

      expect(mockMetrics.queueJobsProcessed!.inc).toHaveBeenCalledWith({
        queue: 'leaderboard',
        status: 'completed',
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.token.findMany.mockRejectedValue(new Error('DB error'));

      await expect(service.updateAllLeaderboards()).rejects.toThrow('DB error');

      expect(mockMetrics.queueJobsProcessed!.inc).toHaveBeenCalledWith({
        queue: 'leaderboard',
        status: 'failed',
      });
    });
  });

  describe('getLeaderboard', () => {
    it('should return cached leaderboard if available', async () => {
      const cachedData = [{ address: '0xtoken1', priceChange24h: 100 }];
      mockCache.get.mockResolvedValue(cachedData);

      const result = await service.getLeaderboard('gainers');

      expect(result).toEqual(cachedData);
      expect(mockCache.get).toHaveBeenCalledWith('leaderboard:gainers');
    });

    it('should compute on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockPriceHistory);

      const result = await service.getLeaderboard('gainers');

      expect(result).toBeDefined();
      expect(mockCache.set).toHaveBeenCalled();
    });
  });
});
