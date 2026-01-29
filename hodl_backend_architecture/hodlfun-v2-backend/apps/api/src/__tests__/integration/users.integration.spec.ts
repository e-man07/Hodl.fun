/**
 * Users Service Integration Tests
 * Tests database and cache interactions for user operations
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { PrismaService, PrismaModule } from '@hodlfun/database';
import { RedisModule, CacheService, RedisService } from '@hodlfun/redis';
import {
  createMockToken,
  createMockTrade,
  createMockHolder,
  createMockUserPortfolio,
  resetTokenCounter,
  resetTradeCounter,
  resetHolderCounter,
} from '../../../../../test/mocks/factories';

describe('UsersService Integration', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let cache: CacheService;
  let redis: RedisService;

  const testUserAddress = '0xabcdef1234567890abcdef1234567890abcdef12';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL:
                process.env.DATABASE_URL ||
                'postgresql://test:test@localhost:5432/hodlfun_test',
              REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
            }),
          ],
        }),
        PrismaModule,
        RedisModule,
      ],
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    redis = module.get<RedisService>(RedisService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset counters before cleaning database to ensure unique addresses
    resetTokenCounter();
    resetTradeCounter();
    resetHolderCounter();
    await cleanDatabase();
    // Reset again after clean to start fresh
    resetTokenCounter();
    resetTradeCounter();
    resetHolderCounter();
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
  }

  describe('getUser', () => {
    it('should return user data with portfolio and counts', async () => {
      // Create portfolio
      const portfolio = createMockUserPortfolio({ walletAddress: testUserAddress });
      await prisma.userPortfolio.create({ data: portfolio as any });

      // Create token by user
      const token = createMockToken({ creatorAddress: testUserAddress });
      await prisma.token.create({ data: token as any });

      // Create holding
      const holder = createMockHolder({
        tokenAddress: token.address,
        holderAddress: testUserAddress,
        balance: '1000000000000000000',
      });
      await prisma.holder.create({ data: holder as any });

      const result = await service.getUser(testUserAddress);

      expect(result.address).toBe(testUserAddress);
      expect(result.portfolio).toBeDefined();
      expect(result.holdingsCount).toBe(1);
      expect(result.createdTokensCount).toBe(1);
    });

    it('should return zero counts for new user', async () => {
      const result = await service.getUser(testUserAddress);

      expect(result.address).toBe(testUserAddress);
      expect(result.portfolio).toBeNull();
      expect(result.holdingsCount).toBe(0);
      expect(result.createdTokensCount).toBe(0);
    });

    it('should not count zero-balance holdings', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      // Create holder with zero balance
      const holder = createMockHolder({
        tokenAddress: token.address,
        holderAddress: testUserAddress,
        balance: '0',
      });
      await prisma.holder.create({ data: holder as any });

      const result = await service.getUser(testUserAddress);

      expect(result.holdingsCount).toBe(0);
    });

    it('should normalize address to lowercase', async () => {
      const result = await service.getUser('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');

      expect(result.address).toBe(testUserAddress);
    });
  });

  describe('getPortfolio', () => {
    it('should return portfolio with realized PnL', async () => {
      const portfolio = createMockUserPortfolio({
        walletAddress: testUserAddress,
        totalInvested: '10000000000000000000', // 10 PUSH
        totalReturned: '15000000000000000000', // 15 PUSH
        totalTrades: 5,
      });
      await prisma.userPortfolio.create({ data: portfolio as any });

      const result = await service.getPortfolio(testUserAddress);

      expect(result.walletAddress).toBe(testUserAddress);
      expect(result.totalInvested).toBe('10000000000000000000');
      expect(result.totalReturned).toBe('15000000000000000000');
      expect(result.realizedPnl).toBe('5000000000000000000'); // 5 PUSH profit
    });

    it('should return default portfolio for new user', async () => {
      const result = await service.getPortfolio(testUserAddress);

      expect(result.walletAddress).toBe(testUserAddress);
      expect(result.totalInvested).toBe('0');
      expect(result.totalReturned).toBe('0');
      expect(result.totalTrades).toBe(0);
      expect(result.realizedPnl).toBe('0');
    });

    it('should cache portfolio data', async () => {
      const portfolio = createMockUserPortfolio({ walletAddress: testUserAddress });
      await prisma.userPortfolio.create({ data: portfolio as any });

      await service.getPortfolio(testUserAddress);

      const cached = await cache.get(`portfolio:${testUserAddress}`);
      expect(cached).toBeDefined();
    });

    it('should calculate negative PnL correctly', async () => {
      const portfolio = createMockUserPortfolio({
        walletAddress: testUserAddress,
        totalInvested: '10000000000000000000', // 10 PUSH
        totalReturned: '3000000000000000000', // 3 PUSH
      });
      await prisma.userPortfolio.create({ data: portfolio as any });

      const result = await service.getPortfolio(testUserAddress);

      expect(result.realizedPnl).toBe('-7000000000000000000'); // -7 PUSH loss
    });
  });

  describe('getHoldings', () => {
    it('should return user holdings with token details', async () => {
      const token = createMockToken({ name: 'Test Token', symbol: 'TEST' });
      await prisma.token.create({ data: token as any });

      const holder = createMockHolder({
        tokenAddress: token.address,
        holderAddress: testUserAddress,
        balance: '1000000000000000000',
      });
      await prisma.holder.create({ data: holder as any });

      const result = await service.getHoldings(testUserAddress, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).token.name).toBe('Test Token');
      expect((result.data[0] as any).token.symbol).toBe('TEST');
    });

    it('should exclude zero-balance holdings', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const holders = [
        createMockHolder({
          tokenAddress: token.address,
          holderAddress: testUserAddress,
          balance: '1000000000000000000',
        }),
        createMockHolder({
          tokenAddress: token.address,
          holderAddress: testUserAddress + '1', // Different address for unique constraint
          balance: '0',
        }),
      ];
      
      // Create a second token for the zero balance holder
      const token2 = createMockToken();
      await prisma.token.create({ data: token2 as any });
      
      await prisma.holder.create({ data: holders[0] as any });
      await prisma.holder.create({
        data: {
          ...holders[1],
          tokenAddress: token2.address,
          holderAddress: testUserAddress,
        } as any,
      });

      const result = await service.getHoldings(testUserAddress, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).balance).not.toBe('0');
    });

    it('should order by last activity descending', async () => {
      const now = new Date();
      const token1 = createMockToken();
      const token2 = createMockToken();
      await prisma.token.create({ data: token1 as any });
      await prisma.token.create({ data: token2 as any });

      const holders = [
        createMockHolder({
          tokenAddress: token1.address,
          holderAddress: testUserAddress,
          lastActivityTimestamp: new Date(now.getTime() - 1000),
        }),
        createMockHolder({
          tokenAddress: token2.address,
          holderAddress: testUserAddress,
          lastActivityTimestamp: now,
        }),
      ];
      for (const holder of holders) {
        await prisma.holder.create({ data: holder as any });
      }

      const result = await service.getHoldings(testUserAddress, { page: 1, limit: 10 });

      const timestamps = result.data.map((h: any) => new Date(h.lastActivityTimestamp).getTime());
      expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
    });
  });

  describe('getTrades', () => {
    it('should return user trades with token details', async () => {
      const token = createMockToken({ name: 'Test Token', symbol: 'TEST' });
      await prisma.token.create({ data: token as any });

      const trade = createMockTrade({
        tokenAddress: token.address,
        traderAddress: testUserAddress,
        type: 'BUY',
      });
      await prisma.trade.create({ data: trade as any });

      const result = await service.getTrades(testUserAddress, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).token.name).toBe('Test Token');
    });

    it('should order trades by timestamp descending', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const now = new Date();
      const trades = [
        createMockTrade({
          tokenAddress: token.address,
          traderAddress: testUserAddress,
          timestamp: new Date(now.getTime() - 2000),
        }),
        createMockTrade({
          tokenAddress: token.address,
          traderAddress: testUserAddress,
          timestamp: now,
        }),
      ];
      for (const trade of trades) {
        await prisma.trade.create({ data: trade as any });
      }

      const result = await service.getTrades(testUserAddress, { page: 1, limit: 10 });

      const timestamps = result.data.map((t: any) => new Date(t.timestamp).getTime());
      expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
    });

    it('should paginate trades correctly', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const trades = Array.from({ length: 5 }, () =>
        createMockTrade({ tokenAddress: token.address, traderAddress: testUserAddress }),
      );
      for (const trade of trades) {
        await prisma.trade.create({ data: trade as any });
      }

      const page1 = await service.getTrades(testUserAddress, { page: 1, limit: 2 });
      const page2 = await service.getTrades(testUserAddress, { page: 2, limit: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      expect(page1.meta.total).toBe(5);
      expect(page1.meta.totalPages).toBe(3);
    });
  });

  describe('getCreatedTokens', () => {
    it('should return tokens created by user', async () => {
      const tokens = [
        createMockToken({ creatorAddress: testUserAddress, name: 'My Token 1' }),
        createMockToken({ creatorAddress: testUserAddress, name: 'My Token 2' }),
        createMockToken({ creatorAddress: '0xother' }), // Different creator
      ];
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const result = await service.getCreatedTokens(testUserAddress, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should order by creation date descending', async () => {
      const now = new Date();
      const tokens = [
        createMockToken({
          creatorAddress: testUserAddress,
          createdAt: new Date(now.getTime() - 2000),
        }),
        createMockToken({
          creatorAddress: testUserAddress,
          createdAt: now,
        }),
      ];
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const result = await service.getCreatedTokens(testUserAddress, { page: 1, limit: 10 });

      const dates = result.data.map((t: any) => new Date(t.createdAt).getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]);
    });

    it('should return empty for user with no created tokens', async () => {
      const result = await service.getCreatedTokens(testUserAddress, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });
});
