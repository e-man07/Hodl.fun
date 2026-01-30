/**
 * Graduation Flow E2E Tests
 * Tests the complete graduation lifecycle:
 * - Lock event → Status update → Graduation broadcast
 * - Listing event → Pool address → Listing broadcast
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { PrismaService } from '@hodlfun/database';
import { RedisService, CacheService, PubSubService } from '@hodlfun/redis';
import { GlobalExceptionFilter, TransformInterceptor } from '@hodlfun/common';
import {
  createMockToken,
  resetTokenCounter,
  TokenStatus,
} from '../mocks/factories';
import { TEST_ADDRESSES } from '../mocks/ethers.mock';

describe('Graduation Flow E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let cache: CacheService;
  let pubsub: PubSubService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as production
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redis = moduleFixture.get<RedisService>(RedisService);
    cache = moduleFixture.get<CacheService>(CacheService);
    pubsub = moduleFixture.get<PubSubService>(PubSubService);

    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    resetTokenCounter();
    await cleanDatabase();
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
    await prisma.$executeRaw`TRUNCATE TABLE "indexer_state" CASCADE`;
  }

  /**
   * Creates a token in TRADING status
   */
  async function createTradingToken() {
    const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
    await prisma.token.create({
      data: {
        address: mockToken.address,
        name: mockToken.name,
        symbol: mockToken.symbol,
        tokenUri: mockToken.tokenUri,
        creatorAddress: mockToken.creatorAddress,
        curveAddress: mockToken.curveAddress,
        status: mockToken.status,
        currentPrice: mockToken.currentPrice,
        marketCap: mockToken.marketCap,
        virtualNative: mockToken.virtualNative,
        virtualToken: mockToken.virtualToken,
        realNative: mockToken.realNative,
        realToken: mockToken.realToken,
        k: mockToken.k,
        athPrice: mockToken.athPrice,
        athMarketCap: mockToken.athMarketCap,
        createdAt: mockToken.createdAt,
        createdBlock: mockToken.createdBlock,
      },
    });
    return mockToken;
  }

  /**
   * Simulates what the indexer does when processing a Lock event
   */
  async function simulateLockEvent(tokenAddress: string) {
    await prisma.token.update({
      where: { address: tokenAddress },
      data: {
        status: 'LOCKED',
        graduatedAt: new Date(),
      },
    });

    // Invalidate cache
    await cache.invalidate(`token:${tokenAddress}`);
    await cache.invalidatePattern('tokens:*');

    // Publish graduation event (what EventListenerService would receive)
    await pubsub.publish('graduation', {
      tokenAddress,
    });
  }

  /**
   * Simulates what the indexer does when processing a Listing event
   */
  async function simulateListingEvent(
    tokenAddress: string,
    poolAddress: string,
    listingBlock: bigint,
  ) {
    await prisma.token.update({
      where: { address: tokenAddress },
      data: {
        status: 'LISTED',
        poolAddress: poolAddress.toLowerCase(),
        listedAt: new Date(),
        listingBlock,
      },
    });

    // Invalidate cache
    await cache.invalidate(`token:${tokenAddress}`);
    await cache.invalidatePattern('tokens:*');

    // Publish listing event (what EventListenerService would receive)
    await pubsub.publish('listing', {
      tokenAddress,
      poolAddress: poolAddress.toLowerCase(),
    });
  }

  // =========================================================================
  // Lock Event → Status Update → API Reflection
  // =========================================================================

  describe('Lock Event Flow', () => {
    it('should update token status from TRADING to LOCKED on lock event', async () => {
      // Create token in TRADING status
      const token = await createTradingToken();

      // Verify initial status
      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(beforeResponse.body.data.status).toBe('TRADING');

      // Simulate lock event (graduation)
      await simulateLockEvent(token.address);

      // Verify status changed to LOCKED
      const afterResponse = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(afterResponse.body.data.status).toBe('LOCKED');
      expect(afterResponse.body.data.graduatedAt).toBeDefined();
    });

    it('should set graduatedAt timestamp on lock event', async () => {
      const token = await createTradingToken();
      const beforeLock = new Date();

      await simulateLockEvent(token.address);

      const dbToken = await prisma.token.findUnique({
        where: { address: token.address },
      });

      expect(dbToken).not.toBeNull();
      expect(dbToken!.graduatedAt).not.toBeNull();
      expect(new Date(dbToken!.graduatedAt!).getTime()).toBeGreaterThanOrEqual(
        beforeLock.getTime(),
      );
    });

    it('should invalidate cache on lock event', async () => {
      const token = await createTradingToken();

      // Warm up cache by fetching token
      await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      // Simulate lock event
      await simulateLockEvent(token.address);

      // Verify cache was invalidated (next fetch should get fresh data)
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(response.body.data.status).toBe('LOCKED');
    });

    it('should filter LOCKED tokens by status in API', async () => {
      // Create 3 tokens: 2 TRADING, 1 will be LOCKED
      const token1 = await createTradingToken();
      const token2 = await createTradingToken();
      const token3 = await createTradingToken();

      // Lock one token
      await simulateLockEvent(token2.address);

      // Get only LOCKED tokens
      const lockedResponse = await request(app.getHttpServer())
        .get('/api/v1/tokens')
        .query({ status: 'LOCKED' })
        .expect(200);

      expect(lockedResponse.body.data.data).toHaveLength(1);
      expect(lockedResponse.body.data.data[0].address).toBe(token2.address);

      // Get only TRADING tokens
      const tradingResponse = await request(app.getHttpServer())
        .get('/api/v1/tokens')
        .query({ status: 'TRADING' })
        .expect(200);

      expect(tradingResponse.body.data.data).toHaveLength(2);
      const tradingAddresses = tradingResponse.body.data.data.map(
        (t: { address: string }) => t.address,
      );
      expect(tradingAddresses).toContain(token1.address);
      expect(tradingAddresses).toContain(token3.address);
    });
  });

  // =========================================================================
  // Listing Event → Pool Address → API Reflection
  // =========================================================================

  describe('Listing Event Flow', () => {
    it('should update token status from LOCKED to LISTED on listing event', async () => {
      const token = await createTradingToken();
      const poolAddress = '0x' + 'a'.repeat(40);

      // First lock the token
      await simulateLockEvent(token.address);

      // Verify LOCKED status
      const lockedResponse = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(lockedResponse.body.data.status).toBe('LOCKED');

      // Now simulate listing
      await simulateListingEvent(token.address, poolAddress, BigInt(12345));

      // Verify LISTED status
      const listedResponse = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(listedResponse.body.data.status).toBe('LISTED');
      expect(listedResponse.body.data.poolAddress).toBe(
        poolAddress.toLowerCase(),
      );
    });

    it('should set listing metadata on listing event', async () => {
      const token = await createTradingToken();
      const poolAddress = '0x' + 'b'.repeat(40);
      const listingBlock = BigInt(54321);

      await simulateLockEvent(token.address);
      await simulateListingEvent(token.address, poolAddress, listingBlock);

      const dbToken = await prisma.token.findUnique({
        where: { address: token.address },
      });

      expect(dbToken).not.toBeNull();
      expect(dbToken!.status).toBe('LISTED');
      expect(dbToken!.poolAddress).toBe(poolAddress.toLowerCase());
      expect(dbToken!.listedAt).not.toBeNull();
      expect(dbToken!.listingBlock).toBe(listingBlock);
    });

    it('should filter LISTED tokens by status in API', async () => {
      // Create tokens with different statuses
      const tradingToken = await createTradingToken();
      const lockedToken = await createTradingToken();
      const listedToken = await createTradingToken();

      // Set up the statuses
      await simulateLockEvent(lockedToken.address);
      await simulateLockEvent(listedToken.address);
      await simulateListingEvent(
        listedToken.address,
        '0x' + 'c'.repeat(40),
        BigInt(100),
      );

      // Get only LISTED tokens
      const response = await request(app.getHttpServer())
        .get('/api/v1/tokens')
        .query({ status: 'LISTED' })
        .expect(200);

      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.data[0].address).toBe(listedToken.address);
    });

    it('should allow direct transition from TRADING to LISTED if lock and listing happen quickly', async () => {
      const token = await createTradingToken();
      const poolAddress = '0x' + 'd'.repeat(40);

      // Simulate both events in quick succession
      await simulateLockEvent(token.address);
      await simulateListingEvent(token.address, poolAddress, BigInt(200));

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(response.body.data.status).toBe('LISTED');
      expect(response.body.data.graduatedAt).toBeDefined();
      expect(response.body.data.listedAt).toBeDefined();
    });
  });

  // =========================================================================
  // PubSub Event Broadcasting
  // =========================================================================

  describe('PubSub Graduation Broadcasts', () => {
    it('should publish graduation event on lock', async () => {
      const token = await createTradingToken();
      const receivedMessages: unknown[] = [];

      // Subscribe to graduation channel
      await pubsub.subscribe('graduation', (message: unknown) => {
        receivedMessages.push(message);
      });

      // Wait a bit for subscription to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate lock event
      await simulateLockEvent(token.address);

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedMessages.length).toBeGreaterThan(0);
      const message = receivedMessages[0] as { tokenAddress: string };
      expect(message.tokenAddress).toBe(token.address);
    });

    it('should publish listing event on listing', async () => {
      const token = await createTradingToken();
      const poolAddress = '0x' + 'e'.repeat(40);
      const receivedMessages: unknown[] = [];

      // Subscribe to listing channel
      await pubsub.subscribe('listing', (message: unknown) => {
        receivedMessages.push(message);
      });

      // Wait a bit for subscription to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate lock and listing events
      await simulateLockEvent(token.address);
      await simulateListingEvent(token.address, poolAddress, BigInt(300));

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedMessages.length).toBeGreaterThan(0);
      const message = receivedMessages[0] as {
        tokenAddress: string;
        poolAddress: string;
      };
      expect(message.tokenAddress).toBe(token.address);
      expect(message.poolAddress).toBe(poolAddress.toLowerCase());
    });
  });

  // =========================================================================
  // Full Graduation Lifecycle
  // =========================================================================

  describe('Full Graduation Lifecycle', () => {
    it('should track complete lifecycle: TRADING → LOCKED → LISTED', async () => {
      const token = await createTradingToken();
      const poolAddress = '0x' + 'f'.repeat(40);

      // Stage 1: TRADING
      const stage1 = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(stage1.body.data.status).toBe('TRADING');
      expect(stage1.body.data.graduatedAt).toBeNull();
      expect(stage1.body.data.listedAt).toBeNull();
      expect(stage1.body.data.poolAddress).toBeNull();

      // Stage 2: LOCKED (Graduation)
      await simulateLockEvent(token.address);

      const stage2 = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(stage2.body.data.status).toBe('LOCKED');
      expect(stage2.body.data.graduatedAt).not.toBeNull();
      expect(stage2.body.data.listedAt).toBeNull();
      expect(stage2.body.data.poolAddress).toBeNull();

      // Stage 3: LISTED
      await simulateListingEvent(token.address, poolAddress, BigInt(400));

      const stage3 = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(stage3.body.data.status).toBe('LISTED');
      expect(stage3.body.data.graduatedAt).not.toBeNull();
      expect(stage3.body.data.listedAt).not.toBeNull();
      expect(stage3.body.data.poolAddress).toBe(poolAddress.toLowerCase());
    });

    it('should preserve graduation timestamp when listing occurs', async () => {
      const token = await createTradingToken();
      const poolAddress = '0x' + '1'.repeat(40);

      // Lock the token
      await simulateLockEvent(token.address);

      const afterLock = await prisma.token.findUnique({
        where: { address: token.address },
      });
      const graduatedAt = afterLock!.graduatedAt;

      // Wait a bit then list
      await new Promise((resolve) => setTimeout(resolve, 50));
      await simulateListingEvent(token.address, poolAddress, BigInt(500));

      const afterListing = await prisma.token.findUnique({
        where: { address: token.address },
      });

      // graduatedAt should remain unchanged
      expect(afterListing!.graduatedAt!.getTime()).toBe(graduatedAt!.getTime());
      // listedAt should be after graduatedAt
      expect(afterListing!.listedAt!.getTime()).toBeGreaterThan(
        graduatedAt!.getTime(),
      );
    });

    it('should handle multiple tokens graduating independently', async () => {
      const token1 = await createTradingToken();
      const token2 = await createTradingToken();
      const token3 = await createTradingToken();

      // Graduate token1 only
      await simulateLockEvent(token1.address);

      // Graduate and list token2
      await simulateLockEvent(token2.address);
      await simulateListingEvent(
        token2.address,
        '0x' + '2'.repeat(40),
        BigInt(600),
      );

      // Leave token3 in TRADING

      // Verify all statuses
      const response = await request(app.getHttpServer())
        .get('/api/v1/tokens')
        .expect(200);

      const tokens = response.body.data.data;
      const t1 = tokens.find(
        (t: { address: string }) => t.address === token1.address,
      );
      const t2 = tokens.find(
        (t: { address: string }) => t.address === token2.address,
      );
      const t3 = tokens.find(
        (t: { address: string }) => t.address === token3.address,
      );

      expect(t1.status).toBe('LOCKED');
      expect(t2.status).toBe('LISTED');
      expect(t3.status).toBe('TRADING');
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle pool address normalization', async () => {
      const token = await createTradingToken();
      const mixedCasePool = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

      await simulateLockEvent(token.address);
      await simulateListingEvent(token.address, mixedCasePool, BigInt(700));

      const response = await request(app.getHttpServer())
        .get(`/api/v1/tokens/${token.address}`)
        .expect(200);

      expect(response.body.data.poolAddress).toBe(
        mixedCasePool.toLowerCase(),
      );
    });

    it('should correctly track listing block number', async () => {
      const token = await createTradingToken();
      const listingBlock = BigInt(999999);

      await simulateLockEvent(token.address);
      await simulateListingEvent(
        token.address,
        '0x' + '3'.repeat(40),
        listingBlock,
      );

      const dbToken = await prisma.token.findUnique({
        where: { address: token.address },
      });

      expect(dbToken!.listingBlock).toBe(listingBlock);
    });

    it('should not affect holders when token graduates', async () => {
      const token = await createTradingToken();
      const holderAddress = TEST_ADDRESSES.user1.toLowerCase();

      // Create a holder
      await prisma.holder.create({
        data: {
          tokenAddress: token.address,
          holderAddress,
          balance: '1000000000000000000',
          firstBuyTimestamp: new Date(),
          lastActivityTimestamp: new Date(),
        },
      });

      // Graduate the token
      await simulateLockEvent(token.address);
      await simulateListingEvent(
        token.address,
        '0x' + '4'.repeat(40),
        BigInt(800),
      );

      // Verify holder still exists with same balance
      const holder = await prisma.holder.findUnique({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: token.address,
            holderAddress,
          },
        },
      });

      expect(holder).not.toBeNull();
      expect(holder!.balance).toBe('1000000000000000000');
    });
  });
});
