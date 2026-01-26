/**
 * Users Service Unit Tests
 * Tests for user portfolio and holdings operations
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';

// Mock factories
const createMockPrismaService = () => ({
  userPortfolio: {
    findUnique: jest.fn(),
  },
  holder: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  token: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  trade: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

const createMockCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  getOrSet: jest.fn().mockImplementation(async (_key, _ttl, fn) => fn()),
  invalidate: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockCache: ReturnType<typeof createMockCacheService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockCache = createMockCacheService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    const mockAddress = '0xABC123';
    const normalizedAddress = '0xabc123';

    it('should return user profile with portfolio and counts', async () => {
      const mockPortfolio = {
        walletAddress: normalizedAddress,
        totalInvested: '10000000000000000000',
        totalReturned: '15000000000000000000',
        totalTrades: 5,
      };

      mockPrisma.userPortfolio.findUnique.mockResolvedValue(mockPortfolio);
      mockPrisma.holder.count.mockResolvedValue(3);
      mockPrisma.token.count.mockResolvedValue(2);

      const result = await service.getUser(mockAddress);

      expect(result).toEqual({
        address: normalizedAddress,
        portfolio: mockPortfolio,
        holdingsCount: 3,
        createdTokensCount: 2,
      });
    });

    it('should normalize address to lowercase', async () => {
      mockPrisma.userPortfolio.findUnique.mockResolvedValue(null);
      mockPrisma.holder.count.mockResolvedValue(0);
      mockPrisma.token.count.mockResolvedValue(0);

      await service.getUser('0xABC123');

      expect(mockPrisma.userPortfolio.findUnique).toHaveBeenCalledWith({
        where: { walletAddress: '0xabc123' },
      });
    });

    it('should count only non-zero balance holdings', async () => {
      mockPrisma.userPortfolio.findUnique.mockResolvedValue(null);
      mockPrisma.holder.count.mockResolvedValue(5);
      mockPrisma.token.count.mockResolvedValue(0);

      await service.getUser(mockAddress);

      expect(mockPrisma.holder.count).toHaveBeenCalledWith({
        where: {
          holderAddress: normalizedAddress,
          balance: { not: '0' },
        },
      });
    });

    it('should return null portfolio for new users', async () => {
      mockPrisma.userPortfolio.findUnique.mockResolvedValue(null);
      mockPrisma.holder.count.mockResolvedValue(0);
      mockPrisma.token.count.mockResolvedValue(0);

      const result = await service.getUser(mockAddress);

      expect(result.portfolio).toBeNull();
      expect(result.holdingsCount).toBe(0);
      expect(result.createdTokensCount).toBe(0);
    });
  });

  describe('getPortfolio', () => {
    const mockAddress = '0xABC123';
    const normalizedAddress = '0xabc123';

    it('should return portfolio with calculated PnL', async () => {
      const mockPortfolio = {
        walletAddress: normalizedAddress,
        totalInvested: '10000000000000000000',
        totalReturned: '15000000000000000000',
        totalTrades: 5,
      };

      mockCache.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPrisma.userPortfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolio(mockAddress);

      expect(result.realizedPnl).toBe('5000000000000000000'); // 15 - 10 = 5
    });

    it('should use cache with 30 second TTL', async () => {
      mockCache.getOrSet.mockResolvedValue({});

      await service.getPortfolio(mockAddress);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `portfolio:${normalizedAddress}`,
        30,
        expect.any(Function),
      );
    });

    it('should return default portfolio for users without portfolio', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPrisma.userPortfolio.findUnique.mockResolvedValue(null);

      const result = await service.getPortfolio(mockAddress);

      expect(result).toEqual({
        walletAddress: normalizedAddress,
        totalInvested: '0',
        totalReturned: '0',
        totalTrades: 0,
        realizedPnl: '0',
      });
    });

    it('should handle negative PnL correctly', async () => {
      const mockPortfolio = {
        walletAddress: normalizedAddress,
        totalInvested: '20000000000000000000',
        totalReturned: '15000000000000000000',
        totalTrades: 10,
      };

      mockCache.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPrisma.userPortfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getPortfolio(mockAddress);

      expect(result.realizedPnl).toBe('-5000000000000000000');
    });
  });

  describe('getHoldings', () => {
    const mockAddress = '0xABC123';
    const normalizedAddress = '0xabc123';

    const mockHoldings = [
      {
        tokenAddress: '0xtoken1',
        balance: '1000000000000000000',
        token: { address: '0xtoken1', name: 'Token 1', symbol: 'TK1' },
      },
    ];

    it('should return paginated holdings with token info', async () => {
      mockPrisma.holder.findMany.mockResolvedValue(mockHoldings);
      mockPrisma.holder.count.mockResolvedValue(1);

      const result = await service.getHoldings(mockAddress, { page: 1, limit: 20 });

      expect(mockPrisma.holder.findMany).toHaveBeenCalledWith({
        where: {
          holderAddress: normalizedAddress,
          balance: { not: '0' },
        },
        skip: 0,
        take: 20,
        include: {
          token: {
            select: {
              address: true,
              name: true,
              symbol: true,
              currentPrice: true,
              marketCap: true,
            },
          },
        },
        orderBy: { lastActivityTimestamp: 'desc' },
      });
      expect(result.items).toEqual(mockHoldings);
    });

    it('should filter out zero balance holdings', async () => {
      mockPrisma.holder.findMany.mockResolvedValue([]);
      mockPrisma.holder.count.mockResolvedValue(0);

      await service.getHoldings(mockAddress, {});

      expect(mockPrisma.holder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            balance: { not: '0' },
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.holder.findMany.mockResolvedValue([]);
      mockPrisma.holder.count.mockResolvedValue(50);

      const result = await service.getHoldings(mockAddress, { page: 3, limit: 10 });

      expect(mockPrisma.holder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  describe('getTrades', () => {
    const mockAddress = '0xABC123';
    const normalizedAddress = '0xabc123';

    const mockTrades = [
      { id: '1', type: 'BUY', token: { name: 'Token 1' } },
      { id: '2', type: 'SELL', token: { name: 'Token 1' } },
    ];

    it('should return paginated trades with token info', async () => {
      mockPrisma.trade.findMany.mockResolvedValue(mockTrades);
      mockPrisma.trade.count.mockResolvedValue(2);

      const result = await service.getTrades(mockAddress, { page: 1, limit: 20 });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: { traderAddress: normalizedAddress },
        skip: 0,
        take: 20,
        include: {
          token: {
            select: {
              address: true,
              name: true,
              symbol: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(result.items).toEqual(mockTrades);
    });

    it('should order by timestamp descending', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);
      mockPrisma.trade.count.mockResolvedValue(0);

      await service.getTrades(mockAddress, {});

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: 'desc' },
        }),
      );
    });
  });

  describe('getCreatedTokens', () => {
    const mockAddress = '0xABC123';
    const normalizedAddress = '0xabc123';

    const mockTokens = [
      { address: '0x1', name: 'Token 1', creatorAddress: normalizedAddress },
      { address: '0x2', name: 'Token 2', creatorAddress: normalizedAddress },
    ];

    it('should return paginated created tokens', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.token.count.mockResolvedValue(2);

      const result = await service.getCreatedTokens(mockAddress, { page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith({
        where: { creatorAddress: normalizedAddress },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.items).toEqual(mockTokens);
    });

    it('should order by creation date descending', async () => {
      mockPrisma.token.findMany.mockResolvedValue([]);
      mockPrisma.token.count.mockResolvedValue(0);

      await service.getCreatedTokens(mockAddress, {});

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should normalize address to lowercase', async () => {
      mockPrisma.token.findMany.mockResolvedValue([]);
      mockPrisma.token.count.mockResolvedValue(0);

      await service.getCreatedTokens('0xABC123', {});

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creatorAddress: '0xabc123' },
        }),
      );
    });
  });
});
