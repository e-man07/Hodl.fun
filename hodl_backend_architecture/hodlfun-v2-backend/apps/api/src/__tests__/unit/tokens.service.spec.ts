/**
 * Tokens Service Unit Tests
 * Tests for token query operations
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TokensService } from '../../tokens/tokens.service';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';

// Mock factories
const createMockPrismaService = () => ({
  token: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  trade: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  holder: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  priceHistory: {
    findMany: jest.fn(),
  },
});

const createMockCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  getOrSet: jest.fn().mockImplementation(async (_key, _ttl, fn) => fn()),
  invalidate: jest.fn(),
  invalidatePattern: jest.fn(),
});

describe('TokensService', () => {
  let service: TokensService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockCache: ReturnType<typeof createMockCacheService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockCache = createMockCacheService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockTokens = [
      { address: '0x1', name: 'Token 1', symbol: 'TK1', status: 'TRADING' },
      { address: '0x2', name: 'Token 2', symbol: 'TK2', status: 'TRADING' },
    ];

    it('should return paginated tokens with default parameters', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.token.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.data).toEqual(mockTokens);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrisma.token.findMany.mockResolvedValue([mockTokens[0]]);
      mockPrisma.token.count.mockResolvedValue(1);

      await service.findAll({ status: 'TRADING' as any });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'TRADING' },
        }),
      );
    });

    it('should handle pagination', async () => {
      mockPrisma.token.findMany.mockResolvedValue([]);
      mockPrisma.token.count.mockResolvedValue(100);

      await service.findAll({ page: 3, limit: 10 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should handle custom sorting', async () => {
      mockPrisma.token.findMany.mockResolvedValue([]);
      mockPrisma.token.count.mockResolvedValue(0);

      await service.findAll({ sortBy: 'marketCap', sortOrder: 'desc' });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { marketCap: 'desc' },
        }),
      );
    });

    it('should return correct pagination metadata', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.token.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 50,
        totalPages: 5,
      });
    });
  });

  describe('findByAddress', () => {
    const mockToken = {
      address: '0xabc123',
      name: 'Test Token',
      symbol: 'TEST',
      status: 'TRADING',
    };

    it('should return cached token if available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockToken);

      const result = await service.findByAddress('0xABC123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'token:0xabc123',
        10,
        expect.any(Function),
      );
      expect(result).toEqual(mockToken);
    });

    it('should normalize address to lowercase', async () => {
      mockCache.getOrSet.mockResolvedValue(mockToken);

      await service.findByAddress('0xABC123');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'token:0xabc123',
        expect.any(Number),
        expect.any(Function),
      );
    });

    it('should throw NotFoundException when token not found', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPrisma.token.findUnique.mockResolvedValue(null);

      await expect(service.findByAddress('0x999')).rejects.toThrow(NotFoundException);
    });

    it('should fetch from database on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPrisma.token.findUnique.mockResolvedValue(mockToken);

      const result = await service.findByAddress('0xabc123');

      expect(mockPrisma.token.findUnique).toHaveBeenCalledWith({
        where: { address: '0xabc123' },
      });
      expect(result).toEqual(mockToken);
    });
  });

  describe('getTrades', () => {
    const mockTrades = [
      { id: '1', type: 'BUY', amountIn: '1000000000000000000' },
      { id: '2', type: 'SELL', amountIn: '500000000000000000' },
    ];

    it('should return paginated trades for a token', async () => {
      mockPrisma.trade.findMany.mockResolvedValue(mockTrades);
      mockPrisma.trade.count.mockResolvedValue(2);

      const result = await service.getTrades('0xABC123', { page: 1, limit: 20 });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: { tokenAddress: '0xabc123' },
        skip: 0,
        take: 20,
        orderBy: { timestamp: 'desc' },
      });
      expect(result.data).toEqual(mockTrades);
    });

    it('should normalize token address', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);
      mockPrisma.trade.count.mockResolvedValue(0);

      await service.getTrades('0xABC123', {});

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenAddress: '0xabc123' },
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);
      mockPrisma.trade.count.mockResolvedValue(100);

      const result = await service.getTrades('0x1', { page: 5, limit: 10 });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 10,
        }),
      );
      expect(result.meta.totalPages).toBe(10);
    });
  });

  describe('getHolders', () => {
    const mockHolders = [
      { holderAddress: '0x1', balance: '1000000000000000000' },
      { holderAddress: '0x2', balance: '500000000000000000' },
    ];

    it('should return paginated holders for a token', async () => {
      mockPrisma.holder.findMany.mockResolvedValue(mockHolders);
      mockPrisma.holder.count.mockResolvedValue(2);

      const result = await service.getHolders('0xTOKEN', { page: 1, limit: 20 });

      expect(mockPrisma.holder.findMany).toHaveBeenCalledWith({
        where: { tokenAddress: '0xtoken' },
        skip: 0,
        take: 20,
        orderBy: { balance: 'desc' },
      });
      expect(result.data).toEqual(mockHolders);
    });

    it('should normalize token address', async () => {
      mockPrisma.holder.findMany.mockResolvedValue([]);
      mockPrisma.holder.count.mockResolvedValue(0);

      await service.getHolders('0xTOKEN', {});

      expect(mockPrisma.holder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenAddress: '0xtoken' },
        }),
      );
    });
  });

  describe('getPriceHistory', () => {
    const mockCandles = [
      { timestamp: new Date(), open: '100', high: '110', low: '90', close: '105' },
    ];

    it('should return cached price history', async () => {
      mockCache.getOrSet.mockResolvedValue(mockCandles);

      const result = await service.getPriceHistory('0xTOKEN', 'ONE_MINUTE' as any);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'candles:0xtoken:ONE_MINUTE',
        5,
        expect.any(Function),
      );
      expect(result).toEqual(mockCandles);
    });

    it('should fetch from database on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPrisma.priceHistory.findMany.mockResolvedValue(mockCandles);

      await service.getPriceHistory('0xtoken', 'ONE_HOUR' as any);

      expect(mockPrisma.priceHistory.findMany).toHaveBeenCalledWith({
        where: {
          tokenAddress: '0xtoken',
          interval: 'ONE_HOUR',
        },
        orderBy: { timestamp: 'desc' },
        take: 500,
      });
    });
  });

  describe('getTrending', () => {
    const mockTokens = [
      { address: '0x1', marketCap: '1000000' },
      { address: '0x2', marketCap: '500000' },
    ];

    it('should return cached trending tokens', async () => {
      const paginatedResult = { data: mockTokens, meta: {} };
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      const result = await service.getTrending({ page: 1, limit: 20 });

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'trending:1:20',
        30,
        expect.any(Function),
      );
      expect(result).toEqual(paginatedResult);
    });

    it('should filter for tokens with recent trades', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, _ttl, fn) => fn());
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.token.count.mockResolvedValue(2);

      await service.getTrending({});

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'TRADING',
            trades: expect.objectContaining({
              some: expect.objectContaining({
                timestamp: expect.objectContaining({
                  gte: expect.any(Date),
                }),
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('getNew', () => {
    const mockTokens = [
      { address: '0x1', createdAt: new Date() },
      { address: '0x2', createdAt: new Date() },
    ];

    it('should return newly created tokens sorted by date', async () => {
      mockPrisma.token.findMany.mockResolvedValue(mockTokens);
      mockPrisma.token.count.mockResolvedValue(2);

      const result = await service.getNew({ page: 1, limit: 20 });

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'TRADING' },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.data).toEqual(mockTokens);
    });

    it('should filter for TRADING status only', async () => {
      mockPrisma.token.findMany.mockResolvedValue([]);
      mockPrisma.token.count.mockResolvedValue(0);

      await service.getNew({});

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'TRADING' },
        }),
      );
    });
  });
});
