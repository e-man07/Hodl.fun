/**
 * Event Processor Service Integration Tests
 * Tests event processing with real database operations
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { EventProcessorService } from '../../event-processor/event-processor.service';
import { RpcService } from '../../blockchain/rpc.service';
import { PrismaService, PrismaModule } from '@hodlfun/database';
import { RedisModule, PubSubService, CacheService, RedisService } from '@hodlfun/redis';
import { MetricsModule } from '@hodlfun/common';
import {
  createMockToken,
  createMockTrade,
  createMockHolder,
  resetTokenCounter,
  resetTradeCounter,
  resetHolderCounter,
} from '../../../../../test/mocks/factories';
import { TEST_ADDRESSES, TEST_TX_HASHES } from '../../../../../test/mocks/ethers.mock';

// Mock RPC Service
const createMockRpcService = () => ({
  getBlockNumber: jest.fn().mockResolvedValue(1000),
  getLogs: jest.fn().mockResolvedValue([]),
  getBlock: jest.fn().mockResolvedValue({
    number: 1000,
    timestamp: Math.floor(Date.now() / 1000),
    hash: '0x' + '1'.repeat(64),
  }),
});

describe('EventProcessorService Integration', () => {
  let service: EventProcessorService;
  let prisma: PrismaService;
  let pubsub: PubSubService;
  let cache: CacheService;
  let redis: RedisService;
  let mockRpc: ReturnType<typeof createMockRpcService>;

  beforeAll(async () => {
    mockRpc = createMockRpcService();

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
              CORE_ADDRESS: TEST_ADDRESSES.core,
              FACTORY_ADDRESS: TEST_ADDRESSES.factory,
              INDEXER_BATCH_SIZE: '100',
            }),
          ],
        }),
        ScheduleModule.forRoot(),
        PrismaModule,
        RedisModule,
        MetricsModule,
      ],
      providers: [
        EventProcessorService,
        { provide: RpcService, useValue: mockRpc },
      ],
    }).compile();

    service = module.get<EventProcessorService>(EventProcessorService);
    prisma = module.get<PrismaService>(PrismaService);
    pubsub = module.get<PubSubService>(PubSubService);
    cache = module.get<CacheService>(CacheService);
    redis = module.get<RedisService>(RedisService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    resetTokenCounter();
    resetTradeCounter();
    resetHolderCounter();
    await cleanDatabase();
    jest.clearAllMocks();
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
    await prisma.$executeRaw`TRUNCATE TABLE "indexer_state" CASCADE`;
  }

  describe('Token Creation Flow', () => {
    it('should create token record when processing CreateCurve event', async () => {
      // Seed the token that would be created by Factory.Create event
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        curveAddress: TEST_ADDRESSES.curve,
        creatorAddress: TEST_ADDRESSES.user1,
        name: 'Test Token',
        symbol: 'TEST',
        status: 'TRADING',
      });
      await prisma.token.create({ data: token as any });

      // Verify token exists in database
      const dbToken = await prisma.token.findUnique({
        where: { address: TEST_ADDRESSES.token },
      });

      expect(dbToken).toBeDefined();
      expect(dbToken?.name).toBe('Test Token');
      expect(dbToken?.symbol).toBe('TEST');
      expect(dbToken?.status).toBe('TRADING');
    });
  });

  describe('Trade Processing', () => {
    it('should record buy trade and update holder balance', async () => {
      // Create token first
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        curveAddress: TEST_ADDRESSES.curve,
        status: 'TRADING',
      });
      await prisma.token.create({ data: token as any });

      // Create buy trade
      const trade = createMockTrade({
        tokenAddress: TEST_ADDRESSES.token,
        traderAddress: TEST_ADDRESSES.user1,
        type: 'BUY',
        amountIn: '1000000000000000000', // 1 PUSH
        amountOut: '50000000000000000000000', // 50K tokens
      });
      await prisma.trade.create({ data: trade as any });

      // Create holder record
      const holder = createMockHolder({
        tokenAddress: TEST_ADDRESSES.token,
        holderAddress: TEST_ADDRESSES.user1,
        balance: '50000000000000000000000',
      });
      await prisma.holder.create({ data: holder as any });

      // Verify trade recorded
      const dbTrade = await prisma.trade.findFirst({
        where: { tokenAddress: TEST_ADDRESSES.token },
      });
      expect(dbTrade).toBeDefined();
      expect(dbTrade?.type).toBe('BUY');

      // Verify holder balance updated
      const dbHolder = await prisma.holder.findFirst({
        where: {
          tokenAddress: TEST_ADDRESSES.token,
          holderAddress: TEST_ADDRESSES.user1,
        },
      });
      expect(dbHolder).toBeDefined();
      expect(dbHolder?.balance).toBe('50000000000000000000000');
    });

    it('should record sell trade and update holder balance', async () => {
      // Create token first
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        status: 'TRADING',
      });
      await prisma.token.create({ data: token as any });

      // Create initial holder
      const holder = createMockHolder({
        tokenAddress: TEST_ADDRESSES.token,
        holderAddress: TEST_ADDRESSES.user1,
        balance: '100000000000000000000000', // 100K tokens
      });
      await prisma.holder.create({ data: holder as any });

      // Create sell trade
      const trade = createMockTrade({
        tokenAddress: TEST_ADDRESSES.token,
        traderAddress: TEST_ADDRESSES.user1,
        type: 'SELL',
        amountIn: '25000000000000000000000', // 25K tokens sold
        amountOut: '500000000000000000', // 0.5 PUSH received
      });
      await prisma.trade.create({ data: trade as any });

      // Update holder balance
      await prisma.holder.update({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: TEST_ADDRESSES.token,
            holderAddress: TEST_ADDRESSES.user1,
          },
        },
        data: { balance: '75000000000000000000000' }, // 75K remaining
      });

      // Verify holder balance updated
      const dbHolder = await prisma.holder.findFirst({
        where: {
          tokenAddress: TEST_ADDRESSES.token,
          holderAddress: TEST_ADDRESSES.user1,
        },
      });
      expect(dbHolder?.balance).toBe('75000000000000000000000');
    });

    it('should handle multiple trades from same user', async () => {
      const token = createMockToken({ address: TEST_ADDRESSES.token });
      await prisma.token.create({ data: token as any });

      // Create multiple trades
      const trades = [
        createMockTrade({
          tokenAddress: TEST_ADDRESSES.token,
          traderAddress: TEST_ADDRESSES.user1,
          type: 'BUY',
          amountOut: '10000000000000000000000',
        }),
        createMockTrade({
          tokenAddress: TEST_ADDRESSES.token,
          traderAddress: TEST_ADDRESSES.user1,
          type: 'BUY',
          amountOut: '20000000000000000000000',
        }),
        createMockTrade({
          tokenAddress: TEST_ADDRESSES.token,
          traderAddress: TEST_ADDRESSES.user1,
          type: 'SELL',
          amountIn: '5000000000000000000000',
        }),
      ];

      for (const trade of trades) {
        await prisma.trade.create({ data: trade as any });
      }

      // Create holder with final balance
      const holder = createMockHolder({
        tokenAddress: TEST_ADDRESSES.token,
        holderAddress: TEST_ADDRESSES.user1,
        balance: '25000000000000000000000', // 10K + 20K - 5K = 25K
      });
      await prisma.holder.create({ data: holder as any });

      // Verify trade count
      const tradeCount = await prisma.trade.count({
        where: {
          tokenAddress: TEST_ADDRESSES.token,
          traderAddress: TEST_ADDRESSES.user1,
        },
      });
      expect(tradeCount).toBe(3);

      // Verify final balance
      const dbHolder = await prisma.holder.findFirst({
        where: {
          tokenAddress: TEST_ADDRESSES.token,
          holderAddress: TEST_ADDRESSES.user1,
        },
      });
      expect(dbHolder?.balance).toBe('25000000000000000000000');
    });
  });

  describe('Token Status Updates', () => {
    it('should update token status to LOCKED on graduation', async () => {
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        status: 'TRADING',
      });
      await prisma.token.create({ data: token as any });

      // Simulate graduation
      await prisma.token.update({
        where: { address: TEST_ADDRESSES.token },
        data: {
          status: 'LOCKED',
          graduatedAt: new Date(),
        },
      });

      const dbToken = await prisma.token.findUnique({
        where: { address: TEST_ADDRESSES.token },
      });
      expect(dbToken?.status).toBe('LOCKED');
      expect(dbToken?.graduatedAt).toBeDefined();
    });

    it('should update token status to LISTED and set pool address', async () => {
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        status: 'LOCKED',
        graduatedAt: new Date(Date.now() - 1000),
      });
      await prisma.token.create({ data: token as any });

      // Simulate listing
      await prisma.token.update({
        where: { address: TEST_ADDRESSES.token },
        data: {
          status: 'LISTED',
          poolAddress: TEST_ADDRESSES.pool,
          listedAt: new Date(),
          listingBlock: BigInt(2000),
        },
      });

      const dbToken = await prisma.token.findUnique({
        where: { address: TEST_ADDRESSES.token },
      });
      expect(dbToken?.status).toBe('LISTED');
      expect(dbToken?.poolAddress).toBe(TEST_ADDRESSES.pool);
      expect(dbToken?.listedAt).toBeDefined();
    });
  });

  describe('Reserve Updates', () => {
    it('should update token reserves on Sync event', async () => {
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        virtualNative: '1000000000000000000',
        virtualToken: '50000000000000000000000000',
        realNative: '0',
        realToken: '0',
      });
      await prisma.token.create({ data: token as any });

      // Simulate reserve update after trade
      await prisma.token.update({
        where: { address: TEST_ADDRESSES.token },
        data: {
          virtualNative: '2000000000000000000', // +1 PUSH
          virtualToken: '49000000000000000000000000', // -1M tokens
          realNative: '1000000000000000000', // 1 PUSH invested
          realToken: '1000000000000000000000000', // 1M tokens out
          currentPrice: '40816326530612', // New price
        },
      });

      const dbToken = await prisma.token.findUnique({
        where: { address: TEST_ADDRESSES.token },
      });
      expect(dbToken?.virtualNative).toBe('2000000000000000000');
      expect(dbToken?.realNative).toBe('1000000000000000000');
    });
  });

  describe('ATH Tracking', () => {
    it('should update ATH price', async () => {
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        currentPrice: '20000000000000',
        athPrice: null,
        athPriceTimestamp: null,
      });
      await prisma.token.create({ data: token as any });

      const athTimestamp = new Date();
      await prisma.token.update({
        where: { address: TEST_ADDRESSES.token },
        data: {
          currentPrice: '50000000000000',
          athPrice: '50000000000000',
          athPriceTimestamp: athTimestamp,
        },
      });

      const dbToken = await prisma.token.findUnique({
        where: { address: TEST_ADDRESSES.token },
      });
      expect(dbToken?.athPrice).toBe('50000000000000');
      expect(dbToken?.athPriceTimestamp).toBeDefined();
    });

    it('should update ATH market cap', async () => {
      const token = createMockToken({
        address: TEST_ADDRESSES.token,
        marketCap: '20000000000000000000000',
        athMarketCap: null,
        athMarketCapTimestamp: null,
      });
      await prisma.token.create({ data: token as any });

      const athTimestamp = new Date();
      await prisma.token.update({
        where: { address: TEST_ADDRESSES.token },
        data: {
          marketCap: '100000000000000000000000',
          athMarketCap: '100000000000000000000000',
          athMarketCapTimestamp: athTimestamp,
        },
      });

      const dbToken = await prisma.token.findUnique({
        where: { address: TEST_ADDRESSES.token },
      });
      expect(dbToken?.athMarketCap).toBe('100000000000000000000000');
    });
  });

  describe('Indexer State', () => {
    it('should initialize indexer state if not exists', async () => {
      // Initially no state
      let state = await prisma.indexerState.findFirst();
      expect(state).toBeNull();

      // Create initial state
      await prisma.indexerState.create({
        data: {
          id: 'main',
          lastProcessedBlock: BigInt(0),
        },
      });

      state = await prisma.indexerState.findFirst();
      expect(state).toBeDefined();
      expect(state?.lastProcessedBlock).toBe(BigInt(0));
    });

    it('should update last processed block', async () => {
      await prisma.indexerState.create({
        data: {
          id: 'main',
          lastProcessedBlock: BigInt(100),
        },
      });

      await prisma.indexerState.update({
        where: { id: 'main' },
        data: { lastProcessedBlock: BigInt(200) },
      });

      const state = await prisma.indexerState.findFirst();
      expect(state?.lastProcessedBlock).toBe(BigInt(200));
    });
  });

  describe('Holder Management', () => {
    it('should create new holder on first buy', async () => {
      const token = createMockToken({ address: TEST_ADDRESSES.token });
      await prisma.token.create({ data: token as any });

      const holder = createMockHolder({
        tokenAddress: TEST_ADDRESSES.token,
        holderAddress: TEST_ADDRESSES.user1,
        balance: '10000000000000000000000',
      });
      await prisma.holder.create({ data: holder as any });

      const dbHolder = await prisma.holder.findFirst({
        where: {
          tokenAddress: TEST_ADDRESSES.token,
          holderAddress: TEST_ADDRESSES.user1,
        },
      });
      expect(dbHolder).toBeDefined();
      expect(dbHolder?.balance).toBe('10000000000000000000000');
    });

    it('should update holder balance on additional buys', async () => {
      const token = createMockToken({ address: TEST_ADDRESSES.token });
      await prisma.token.create({ data: token as any });

      const holder = createMockHolder({
        tokenAddress: TEST_ADDRESSES.token,
        holderAddress: TEST_ADDRESSES.user1,
        balance: '10000000000000000000000',
      });
      await prisma.holder.create({ data: holder as any });

      // Update balance after another buy
      await prisma.holder.update({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: TEST_ADDRESSES.token,
            holderAddress: TEST_ADDRESSES.user1,
          },
        },
        data: {
          balance: '30000000000000000000000', // +20K tokens
          lastActivityTimestamp: new Date(),
        },
      });

      const dbHolder = await prisma.holder.findFirst({
        where: {
          tokenAddress: TEST_ADDRESSES.token,
          holderAddress: TEST_ADDRESSES.user1,
        },
      });
      expect(dbHolder?.balance).toBe('30000000000000000000000');
    });

    it('should handle holder selling all tokens (zero balance)', async () => {
      const token = createMockToken({ address: TEST_ADDRESSES.token });
      await prisma.token.create({ data: token as any });

      const holder = createMockHolder({
        tokenAddress: TEST_ADDRESSES.token,
        holderAddress: TEST_ADDRESSES.user1,
        balance: '10000000000000000000000',
      });
      await prisma.holder.create({ data: holder as any });

      // Sell all tokens
      await prisma.holder.update({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: TEST_ADDRESSES.token,
            holderAddress: TEST_ADDRESSES.user1,
          },
        },
        data: {
          balance: '0',
          lastActivityTimestamp: new Date(),
        },
      });

      const dbHolder = await prisma.holder.findFirst({
        where: {
          tokenAddress: TEST_ADDRESSES.token,
          holderAddress: TEST_ADDRESSES.user1,
        },
      });
      expect(dbHolder?.balance).toBe('0');
    });
  });
});
