/**
 * WebSocket Service Integration Tests
 * Tests subscription service and gateway methods with real Redis
 * Note: Full socket.io client tests would require socket.io-client package
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@hodlfun/database';
import { RedisModule, RedisService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';
import { EventsGateway } from '../../gateways/events.gateway';
import { TradesGateway } from '../../gateways/trades.gateway';
import { SubscriptionService } from '../../services/subscription.service';
import { createMockToken, TokenStatus } from '../../../../../test/mocks/factories/token.factory';
import { createMockBuyTrade } from '../../../../../test/mocks/factories/trade.factory';
import { TEST_ADDRESSES } from '../../../../../test/mocks/ethers.mock';

// Mock MetricsService
const createMockMetricsService = () => ({
  activeWebsocketConnections: {
    inc: jest.fn(),
    dec: jest.fn(),
  },
  eventBroadcastTotal: {
    inc: jest.fn(),
  },
});

// Mock Socket.io Server
const createMockServer = () => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
});

describe('WebSocket Integration Tests', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let subscriptionService: SubscriptionService;
  let eventsGateway: EventsGateway;
  let tradesGateway: TradesGateway;
  let module: TestingModule;
  let mockServer: ReturnType<typeof createMockServer>;

  // Test data
  let testTokenAddress: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [RedisModule],
      providers: [
        PrismaService,
        EventsGateway,
        TradesGateway,
        SubscriptionService,
        { provide: MetricsService, useFactory: createMockMetricsService },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    eventsGateway = module.get<EventsGateway>(EventsGateway);
    tradesGateway = module.get<TradesGateway>(TradesGateway);

    // Inject mock server
    mockServer = createMockServer();
    (eventsGateway as any).server = mockServer;
    (tradesGateway as any).server = mockServer;

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await module.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.trade.deleteMany({});
    await prisma.holder.deleteMany({});
    await prisma.token.deleteMany({});

    // Clean up Redis subscriptions
    const keys = await redis.keys('ws:subs:*');
    for (const key of keys) {
      await redis.del(key);
    }

    // Reset mock
    mockServer = createMockServer();
    (eventsGateway as any).server = mockServer;
    (tradesGateway as any).server = mockServer;

    // Create test token
    const mockToken = createMockToken({ status: 'TRADING' as TokenStatus });
    testTokenAddress = mockToken.address;

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
  });

  describe('SubscriptionService', () => {
    it('should track subscriptions in Redis', async () => {
      const clientId = 'test-client-123';
      const room = 'token:0xtest';

      await subscriptionService.trackSubscription(clientId, room);

      const subscriptions = await subscriptionService.getSubscriptions(clientId);
      expect(subscriptions).toContain(room);
    });

    it('should remove subscriptions from Redis', async () => {
      const clientId = 'test-client-456';
      const room1 = 'token:0xtest1';
      const room2 = 'token:0xtest2';

      await subscriptionService.trackSubscription(clientId, room1);
      await subscriptionService.trackSubscription(clientId, room2);

      await subscriptionService.removeSubscription(clientId, room1);

      const subscriptions = await subscriptionService.getSubscriptions(clientId);
      expect(subscriptions).not.toContain(room1);
      expect(subscriptions).toContain(room2);
    });

    it('should cleanup all subscriptions for a client', async () => {
      const clientId = 'test-client-789';
      const rooms = ['token:0xtest1', 'token:0xtest2', 'wallet:0xwallet'];

      for (const room of rooms) {
        await subscriptionService.trackSubscription(clientId, room);
      }

      await subscriptionService.cleanupClient(clientId);

      const subscriptions = await subscriptionService.getSubscriptions(clientId);
      expect(subscriptions).toHaveLength(0);
    });

    it('should count active connections', async () => {
      const clients = ['client-1', 'client-2', 'client-3'];

      for (const clientId of clients) {
        await subscriptionService.trackSubscription(clientId, 'token:0xtest');
      }

      const count = await subscriptionService.getActiveConnectionCount();
      expect(count).toBe(3);
    });

    it('should handle multiple room subscriptions for same client', async () => {
      const clientId = 'multi-room-client';
      const rooms = [
        `token:${testTokenAddress}`,
        `wallet:${TEST_ADDRESSES.user1.toLowerCase()}`,
        'global',
      ];

      for (const room of rooms) {
        await subscriptionService.trackSubscription(clientId, room);
      }

      const subscriptions = await subscriptionService.getSubscriptions(clientId);
      expect(subscriptions.length).toBe(3);
      for (const room of rooms) {
        expect(subscriptions).toContain(room);
      }
    });

    it('should handle concurrent subscription tracking', async () => {
      const clientId = 'concurrent-client';
      const rooms = Array.from({ length: 10 }, (_, i) => `token:0xtest${i}`);

      // Track all subscriptions concurrently
      await Promise.all(
        rooms.map((room) => subscriptionService.trackSubscription(clientId, room)),
      );

      const subscriptions = await subscriptionService.getSubscriptions(clientId);
      expect(subscriptions.length).toBe(10);
    });

    it('should maintain subscriptions across multiple clients', async () => {
      const clients = ['client-a', 'client-b', 'client-c'];
      const room = `token:${testTokenAddress}`;

      // All clients subscribe to same room
      for (const clientId of clients) {
        await subscriptionService.trackSubscription(clientId, room);
      }

      // Each client should have the subscription
      for (const clientId of clients) {
        const subs = await subscriptionService.getSubscriptions(clientId);
        expect(subs).toContain(room);
      }

      // Cleanup one client shouldn't affect others
      await subscriptionService.cleanupClient(clients[0]);

      const remainingSubs = await subscriptionService.getSubscriptions(clients[1]);
      expect(remainingSubs).toContain(room);
    });

    it('should handle duplicate subscription tracking', async () => {
      const clientId = 'duplicate-client';
      const room = `token:${testTokenAddress}`;

      await subscriptionService.trackSubscription(clientId, room);
      await subscriptionService.trackSubscription(clientId, room);
      await subscriptionService.trackSubscription(clientId, room);

      const subscriptions = await subscriptionService.getSubscriptions(clientId);
      // Redis SET should deduplicate
      expect(subscriptions).toHaveLength(1);
    });
  });

  describe('EventsGateway', () => {
    it('should broadcast to token room', () => {
      const broadcastData = { type: 'trade', amount: '1000' };

      eventsGateway.broadcastToToken(testTokenAddress, 'new_trade', broadcastData);

      expect(mockServer.to).toHaveBeenCalledWith(`token:${testTokenAddress.toLowerCase()}`);
      expect(mockServer.emit).toHaveBeenCalledWith('new_trade', broadcastData);
    });

    it('should broadcast to wallet room', () => {
      const walletAddress = TEST_ADDRESSES.user1;
      const broadcastData = { type: 'balance_update', balance: '1000' };

      eventsGateway.broadcastToWallet(walletAddress, 'balance_update', broadcastData);

      expect(mockServer.to).toHaveBeenCalledWith(`wallet:${walletAddress.toLowerCase()}`);
      expect(mockServer.emit).toHaveBeenCalledWith('balance_update', broadcastData);
    });

    it('should broadcast globally', () => {
      const broadcastData = { type: 'new_token', address: testTokenAddress };

      eventsGateway.broadcastGlobal('token_created', broadcastData);

      expect(mockServer.to).toHaveBeenCalledWith('global');
      expect(mockServer.emit).toHaveBeenCalledWith('token_created', broadcastData);
    });

    it('should normalize token address to lowercase', () => {
      const upperCaseAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const broadcastData = { price: '100' };

      eventsGateway.broadcastToToken(upperCaseAddress, 'price_update', broadcastData);

      expect(mockServer.to).toHaveBeenCalledWith(`token:${upperCaseAddress.toLowerCase()}`);
    });

    it('should normalize wallet address to lowercase', () => {
      const upperCaseWallet = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const broadcastData = { balance: '1000' };

      eventsGateway.broadcastToWallet(upperCaseWallet, 'balance_update', broadcastData);

      expect(mockServer.to).toHaveBeenCalledWith(`wallet:${upperCaseWallet.toLowerCase()}`);
    });
  });

  describe('TradesGateway', () => {
    it('should broadcast trade to subscribed room', () => {
      const tradeData = createMockBuyTrade({ tokenAddress: testTokenAddress });

      tradesGateway.broadcastTrade(testTokenAddress, tradeData);

      expect(mockServer.to).toHaveBeenCalledWith(`trades:${testTokenAddress.toLowerCase()}`);
      expect(mockServer.emit).toHaveBeenCalledWith('new_trade', tradeData);
    });

    it('should normalize token address to lowercase for trade broadcast', () => {
      const upperCaseAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const tradeData = createMockBuyTrade({ tokenAddress: upperCaseAddress });

      tradesGateway.broadcastTrade(upperCaseAddress, tradeData);

      expect(mockServer.to).toHaveBeenCalledWith(`trades:${upperCaseAddress.toLowerCase()}`);
    });
  });

  describe('TradesGateway with Database', () => {
    it('should have access to trades in database', async () => {
      // Create trades in database
      const trades = [];
      for (let i = 0; i < 5; i++) {
        const trade = createMockBuyTrade({
          tokenAddress: testTokenAddress,
          timestamp: new Date(Date.now() - i * 60000),
        });
        trades.push(trade);
      }

      for (const trade of trades) {
        await prisma.trade.create({
          data: {
            tokenAddress: trade.tokenAddress,
            type: trade.type,
            traderAddress: trade.traderAddress,
            amountIn: trade.amountIn,
            amountOut: trade.amountOut,
            price: trade.price,
            feeAmount: trade.feeAmount,
            txHash: trade.txHash,
            blockNumber: trade.blockNumber,
            timestamp: trade.timestamp,
          },
        });
      }

      // Verify trades are in database
      const dbTrades = await prisma.trade.findMany({
        where: { tokenAddress: testTokenAddress },
        orderBy: { timestamp: 'desc' },
      });

      expect(dbTrades.length).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty subscription list', async () => {
      const clientId = 'empty-client';

      const subscriptions = await subscriptionService.getSubscriptions(clientId);
      expect(subscriptions).toHaveLength(0);
    });

    it('should handle removing non-existent subscription', async () => {
      const clientId = 'remove-nonexistent-client';
      const room = 'token:0xnonexistent';

      // Should not throw
      await expect(
        subscriptionService.removeSubscription(clientId, room),
      ).resolves.not.toThrow();
    });

    it('should handle cleanup for non-existent client', async () => {
      const clientId = 'nonexistent-client';

      // Should not throw
      await expect(subscriptionService.cleanupClient(clientId)).resolves.not.toThrow();
    });
  });
});
