/**
 * Tokens Service Integration Tests
 * Tests database and cache interactions for token operations
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TokensService } from '../../tokens/tokens.service';
import { PrismaService, PrismaModule } from '@hodlfun/database';
import { RedisModule, CacheService, RedisService } from '@hodlfun/redis';
import {
  createMockToken,
  createMockTrade,
  createMockHolder,
  resetTokenCounter,
  resetTradeCounter,
  resetHolderCounter,
} from '../../../../../test/mocks/factories';

describe('TokensService Integration', () => {
  let service: TokensService;
  let prisma: PrismaService;
  let cache: CacheService;
  let redis: RedisService;

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
      providers: [TokensService],
    }).compile();

    service = module.get<TokensService>(TokensService);
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
  }

  describe('findAll', () => {
    it('should return paginated tokens from database', async () => {
      // Create test tokens
      const tokens = [
        createMockToken({ status: 'TRADING' }),
        createMockToken({ status: 'TRADING' }),
        createMockToken({ status: 'LOCKED' }),
      ];
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(1);
    });

    it('should filter tokens by status', async () => {
      const tokens = [
        createMockToken({ status: 'TRADING' }),
        createMockToken({ status: 'TRADING' }),
        createMockToken({ status: 'LOCKED' }),
      ];
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const result = await service.findAll({ page: 1, limit: 10, status: 'TRADING' });

      expect(result.data).toHaveLength(2);
      result.data.forEach((token: any) => {
        expect(token.status).toBe('TRADING');
      });
    });

    it('should support pagination', async () => {
      const tokens = Array.from({ length: 5 }, () => createMockToken());
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const page1 = await service.findAll({ page: 1, limit: 2 });
      const page2 = await service.findAll({ page: 2, limit: 2 });

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      expect(page1.meta.totalPages).toBe(3);
    });

    it('should sort by specified field', async () => {
      const now = new Date();
      const tokens = [
        createMockToken({ createdAt: new Date(now.getTime() - 2000) }),
        createMockToken({ createdAt: new Date(now.getTime() - 1000) }),
        createMockToken({ createdAt: now }),
      ];
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      const dates = result.data.map((t: any) => new Date(t.createdAt).getTime());
      expect(dates[0]).toBeLessThan(dates[1]);
      expect(dates[1]).toBeLessThan(dates[2]);
    });
  });

  describe('findByAddress', () => {
    it('should return token by address', async () => {
      const token = createMockToken({ name: 'Test Token', symbol: 'TEST' });
      await prisma.token.create({ data: token as any });

      const result = (await service.findByAddress(token.address)) as any;

      expect(result.address).toBe(token.address);
      expect(result.name).toBe('Test Token');
      expect(result.symbol).toBe('TEST');
    });

    it('should cache token after first fetch', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      // First call - should fetch from DB
      await service.findByAddress(token.address);

      // Check cache
      const cached = await cache.get(`token:${token.address}`);
      expect(cached).toBeDefined();
      expect((cached as any).address).toBe(token.address);
    });

    it('should return cached token on subsequent calls', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      // First call
      await service.findByAddress(token.address);

      // Modify DB directly
      await prisma.token.update({
        where: { address: token.address },
        data: { name: 'Modified Name' },
      });

      // Second call should return cached (original) data
      const result = (await service.findByAddress(token.address)) as any;
      expect(result.name).toBe(token.name); // Original name from cache
    });

    it('should throw NotFoundException for non-existent token', async () => {
      await expect(
        service.findByAddress('0x0000000000000000000000000000000000000000'),
      ).rejects.toThrow('Token not found');
    });

    it('should normalize address to lowercase', async () => {
      const token = createMockToken({ address: '0xabcdef1234567890abcdef1234567890abcdef12' });
      await prisma.token.create({ data: token as any });

      // Query with uppercase address
      const result = (await service.findByAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')) as any;

      expect(result.address).toBe(token.address.toLowerCase());
    });
  });

  describe('getTrades', () => {
    it('should return trades for a token', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const trades = [
        createMockTrade({ tokenAddress: token.address, type: 'BUY' }),
        createMockTrade({ tokenAddress: token.address, type: 'SELL' }),
      ];
      for (const trade of trades) {
        await prisma.trade.create({ data: trade as any });
      }

      const result = await service.getTrades(token.address, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should order trades by timestamp descending', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const now = new Date();
      const trades = [
        createMockTrade({ tokenAddress: token.address, timestamp: new Date(now.getTime() - 2000) }),
        createMockTrade({ tokenAddress: token.address, timestamp: now }),
        createMockTrade({ tokenAddress: token.address, timestamp: new Date(now.getTime() - 1000) }),
      ];
      for (const trade of trades) {
        await prisma.trade.create({ data: trade as any });
      }

      const result = await service.getTrades(token.address, { page: 1, limit: 10 });

      const timestamps = result.data.map((t: any) => new Date(t.timestamp).getTime());
      expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
      expect(timestamps[1]).toBeGreaterThan(timestamps[2]);
    });

    it('should return empty array for token with no trades', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const result = await service.getTrades(token.address, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getHolders', () => {
    it('should return holders for a token', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const holders = [
        createMockHolder({ tokenAddress: token.address, balance: '1000000000000000000' }),
        createMockHolder({ tokenAddress: token.address, balance: '2000000000000000000' }),
      ];
      for (const holder of holders) {
        await prisma.holder.create({ data: holder as any });
      }

      const result = await service.getHolders(token.address, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should order holders by balance descending', async () => {
      const token = createMockToken();
      await prisma.token.create({ data: token as any });

      const holders = [
        createMockHolder({ tokenAddress: token.address, balance: '1000000000000000000' }),
        createMockHolder({ tokenAddress: token.address, balance: '3000000000000000000' }),
        createMockHolder({ tokenAddress: token.address, balance: '2000000000000000000' }),
      ];
      for (const holder of holders) {
        await prisma.holder.create({ data: holder as any });
      }

      const result = await service.getHolders(token.address, { page: 1, limit: 10 });

      // Note: Prisma sorts strings, so we check the order
      const balances = result.data.map((h: any) => h.balance);
      expect(balances[0]).toBe('3000000000000000000');
    });
  });

  describe('getTrending', () => {
    it('should return tokens with recent trades', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Token with recent trades
      const activeToken = createMockToken({ status: 'TRADING' });
      await prisma.token.create({ data: activeToken as any });
      await prisma.trade.create({
        data: createMockTrade({
          tokenAddress: activeToken.address,
          timestamp: new Date(now.getTime() - 1000),
        }) as any,
      });

      // Token with old trades only
      const inactiveToken = createMockToken({ status: 'TRADING' });
      await prisma.token.create({ data: inactiveToken as any });
      await prisma.trade.create({
        data: createMockTrade({
          tokenAddress: inactiveToken.address,
          timestamp: new Date(oneDayAgo.getTime() - 1000), // More than 24h ago
        }) as any,
      });

      const result = (await service.getTrending({ page: 1, limit: 10 })) as any;

      expect(result.data).toHaveLength(1);
      expect(result.data[0].address).toBe(activeToken.address);
    });

    it('should cache trending results', async () => {
      const token = createMockToken({ status: 'TRADING' });
      await prisma.token.create({ data: token as any });
      await prisma.trade.create({
        data: createMockTrade({ tokenAddress: token.address }) as any,
      });

      await service.getTrending({ page: 1, limit: 10 });

      const cached = await cache.get('trending:1:10');
      expect(cached).toBeDefined();
    });
  });

  describe('getNew', () => {
    it('should return tokens ordered by creation date', async () => {
      const now = new Date();
      const tokens = [
        createMockToken({ status: 'TRADING', createdAt: new Date(now.getTime() - 2000) }),
        createMockToken({ status: 'TRADING', createdAt: now }),
        createMockToken({ status: 'TRADING', createdAt: new Date(now.getTime() - 1000) }),
      ];
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const result = await service.getNew({ page: 1, limit: 10 });

      const dates = result.data.map((t: any) => new Date(t.createdAt).getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]);
      expect(dates[1]).toBeGreaterThan(dates[2]);
    });

    it('should only return TRADING status tokens', async () => {
      const tokens = [
        createMockToken({ status: 'TRADING' }),
        createMockToken({ status: 'LOCKED' }),
        createMockToken({ status: 'LISTED' }),
      ];
      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }

      const result = await service.getNew({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).status).toBe('TRADING');
    });
  });
});
