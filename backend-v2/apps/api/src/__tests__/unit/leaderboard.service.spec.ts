import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';

describe('LeaderboardService (API)', () => {
  let service: LeaderboardService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockCache: jest.Mocked<CacheService>;

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

  const cachedLeaderboard = [
    { ...mockTokens[0], priceChange24h: 50 },
    { ...mockTokens[1], priceChange24h: 30 },
  ];

  beforeEach(async () => {
    mockPrisma = {
      token: {
        findMany: jest.fn().mockResolvedValue(mockTokens),
        count: jest.fn().mockResolvedValue(2),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockCache = {
      get: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  describe('getLeaderboard', () => {
    it('should return cached data when available', async () => {
      mockCache.get.mockResolvedValue(cachedLeaderboard);

      const result = await service.getLeaderboard('gainers', { page: 1, limit: 20 });

      expect(mockCache.get).toHaveBeenCalledWith('leaderboard:gainers');
      expect(result.data).toEqual(cachedLeaderboard);
      expect(result.meta.total).toBe(2);
    });

    it('should paginate cached data correctly', async () => {
      mockCache.get.mockResolvedValue(cachedLeaderboard);

      const result = await service.getLeaderboard('gainers', { page: 1, limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(1);
      expect(result.meta.total).toBe(2);
    });

    it('should fallback to on-demand computation on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getLeaderboard('gainers', { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it('should handle empty cache', async () => {
      mockCache.get.mockResolvedValue([]);

      const result = await service.getLeaderboard('losers', { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalled();
    });
  });

  describe('getLeaderboard - different types', () => {
    beforeEach(() => {
      mockCache.get.mockResolvedValue(null); // Force fallback
    });

    it('should query trading tokens for gainers', async () => {
      await service.getLeaderboard('gainers', { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'TRADING' },
          orderBy: { marketCap: 'desc' },
        }),
      );
    });

    it('should query trading tokens for losers', async () => {
      await service.getLeaderboard('losers', { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'TRADING' },
          orderBy: { marketCap: 'asc' },
        }),
      );
    });

    it('should query tokens with recent trades for volume', async () => {
      await service.getLeaderboard('volume', { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'TRADING',
            trades: expect.any(Object),
          }),
        }),
      );
    });

    it('should query by createdAt for new tokens', async () => {
      await service.getLeaderboard('new', { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should query LISTED tokens for graduated', async () => {
      await service.getLeaderboard('graduated', { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'LISTED' },
          orderBy: { graduatedAt: 'desc' },
        }),
      );
    });
  });

  describe('pagination', () => {
    it('should use default pagination values', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getLeaderboard('gainers', {});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should respect custom pagination', async () => {
      mockCache.get.mockResolvedValue(cachedLeaderboard);

      const result = await service.getLeaderboard('gainers', { page: 2, limit: 10 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
    });
  });
});
