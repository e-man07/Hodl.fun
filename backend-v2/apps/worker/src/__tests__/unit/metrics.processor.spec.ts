/**
 * Metrics Processor Unit Tests
 * Tests for leaderboard calculations and user portfolio updates
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsProcessor } from '../../metrics/metrics.processor';
import { PrismaService } from '@hodlfun/database';
import { CacheService, PubSubService } from '@hodlfun/redis';

// Mock factories
const createMockPrismaService = () => ({
  $queryRaw: jest.fn(),
  token: {
    findMany: jest.fn(),
  },
  trade: {
    findMany: jest.fn(),
  },
  userPortfolio: {
    upsert: jest.fn(),
  },
});

const createMockCacheService = () => ({
  set: jest.fn(),
});

const createMockPubSubService = () => ({
  subscribe: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(undefined),
});

describe('MetricsProcessor', () => {
  let processor: MetricsProcessor;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockCache: ReturnType<typeof createMockCacheService>;
  let mockPubsub: ReturnType<typeof createMockPubSubService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockCache = createMockCacheService();
    mockPubsub = createMockPubSubService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: PubSubService, useValue: mockPubsub },
      ],
    }).compile();

    processor = module.get<MetricsProcessor>(MetricsProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateLeaderboard', () => {
    it('should calculate and cache gainers leaderboard', async () => {
      const mockGainers = [
        { address: '0x1', name: 'Token1', price_change_24h: 50 },
        { address: '0x2', name: 'Token2', price_change_24h: 25 },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockGainers);

      await processor.calculateLeaderboard('gainers');

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('leaderboard:gainers', mockGainers, 30);
    });

    it('should calculate and cache volume leaders', async () => {
      const mockVolumeLeaders = [
        { address: '0x1', volume_24h: '1000000' },
        { address: '0x2', volume_24h: '500000' },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockVolumeLeaders);

      await processor.calculateLeaderboard('volume');

      expect(mockCache.set).toHaveBeenCalledWith('leaderboard:volume', mockVolumeLeaders, 30);
    });

    it('should calculate and cache new tokens', async () => {
      const mockNewTokens = [
        { address: '0x1', name: 'New Token 1', createdAt: new Date() },
        { address: '0x2', name: 'New Token 2', createdAt: new Date() },
      ];

      mockPrisma.token.findMany.mockResolvedValue(mockNewTokens);

      await processor.calculateLeaderboard('new');

      expect(mockPrisma.token.findMany).toHaveBeenCalledWith({
        where: { status: 'TRADING' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          address: true,
          name: true,
          symbol: true,
          currentPrice: true,
          marketCap: true,
          createdAt: true,
        },
      });
      expect(mockCache.set).toHaveBeenCalledWith('leaderboard:new', mockNewTokens, 30);
    });

    it('should cache empty array for unknown type', async () => {
      await processor.calculateLeaderboard('unknown');

      expect(mockCache.set).toHaveBeenCalledWith('leaderboard:unknown', [], 30);
    });

    it('should use 30 second TTL for cache', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await processor.calculateLeaderboard('gainers');

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        30, // TTL in seconds
      );
    });
  });

  describe('updateUserPortfolio', () => {
    const walletAddress = '0xUSER123';

    it('should calculate total invested from buy trades', async () => {
      const trades = [
        { type: 'BUY', amountIn: '1000000000000000000', amountOut: '500' },
        { type: 'BUY', amountIn: '2000000000000000000', amountOut: '1000' },
        { type: 'SELL', amountIn: '300', amountOut: '500000000000000000' },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await processor.updateUserPortfolio(walletAddress);

      expect(mockPrisma.userPortfolio.upsert).toHaveBeenCalledWith({
        where: { walletAddress: walletAddress.toLowerCase() },
        update: expect.objectContaining({
          totalInvested: '3000000000000000000', // Sum of BUY amountIn
        }),
        create: expect.objectContaining({
          totalInvested: '3000000000000000000',
        }),
      });
    });

    it('should calculate total returned from sell trades', async () => {
      const trades = [
        { type: 'BUY', amountIn: '1000', amountOut: '500' },
        { type: 'SELL', amountIn: '300', amountOut: '500000000000000000' },
        { type: 'SELL', amountIn: '200', amountOut: '300000000000000000' },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await processor.updateUserPortfolio(walletAddress);

      expect(mockPrisma.userPortfolio.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            totalReturned: '800000000000000000', // Sum of SELL amountOut
          }),
        }),
      );
    });

    it('should count total trades', async () => {
      const trades = [
        { type: 'BUY', amountIn: '1000', amountOut: '500' },
        { type: 'SELL', amountIn: '300', amountOut: '500' },
        { type: 'BUY', amountIn: '2000', amountOut: '1000' },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await processor.updateUserPortfolio(walletAddress);

      expect(mockPrisma.userPortfolio.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            totalTrades: 3,
          }),
        }),
      );
    });

    it('should normalize wallet address to lowercase', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await processor.updateUserPortfolio('0xABC123');

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: { traderAddress: '0xabc123' },
      });

      expect(mockPrisma.userPortfolio.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletAddress: '0xabc123' },
        }),
      );
    });

    it('should handle user with no trades', async () => {
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await processor.updateUserPortfolio(walletAddress);

      expect(mockPrisma.userPortfolio.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            totalInvested: '0',
            totalReturned: '0',
            totalTrades: 0,
          },
          create: {
            walletAddress: walletAddress.toLowerCase(),
            totalInvested: '0',
            totalReturned: '0',
            totalTrades: 0,
          },
        }),
      );
    });

    it('should handle large BigInt values correctly', async () => {
      const trades = [
        {
          type: 'BUY',
          amountIn: '999999999999999999999999999999', // Very large value
          amountOut: '500',
        },
      ];

      mockPrisma.trade.findMany.mockResolvedValue(trades);

      await processor.updateUserPortfolio(walletAddress);

      expect(mockPrisma.userPortfolio.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            totalInvested: '999999999999999999999999999999',
          }),
        }),
      );
    });
  });
});
