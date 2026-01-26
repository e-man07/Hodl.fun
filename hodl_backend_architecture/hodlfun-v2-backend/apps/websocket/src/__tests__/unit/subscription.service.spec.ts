/**
 * Subscription Service Unit Tests
 * Tests for Redis-backed WebSocket subscription tracking
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../../services/subscription.service';
import { RedisService } from '@hodlfun/redis';

// Mock factory
const createMockRedisService = () => ({
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
});

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockRedis: ReturnType<typeof createMockRedisService>;

  beforeEach(async () => {
    mockRedis = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackSubscription', () => {
    it('should add room to client subscription set', async () => {
      mockRedis.sadd.mockResolvedValue(1);

      await service.trackSubscription('client-123', 'token:0xtoken');

      expect(mockRedis.sadd).toHaveBeenCalledWith('ws:subs:client-123', 'token:0xtoken');
    });

    it('should use correct prefix for subscription key', async () => {
      mockRedis.sadd.mockResolvedValue(1);

      await service.trackSubscription('my-client', 'wallet:0xwallet');

      expect(mockRedis.sadd).toHaveBeenCalledWith('ws:subs:my-client', 'wallet:0xwallet');
    });

    it('should handle multiple subscriptions for same client', async () => {
      mockRedis.sadd.mockResolvedValue(1);

      await service.trackSubscription('client-1', 'token:0xa');
      await service.trackSubscription('client-1', 'token:0xb');
      await service.trackSubscription('client-1', 'wallet:0xc');

      expect(mockRedis.sadd).toHaveBeenCalledTimes(3);
      expect(mockRedis.sadd).toHaveBeenNthCalledWith(1, 'ws:subs:client-1', 'token:0xa');
      expect(mockRedis.sadd).toHaveBeenNthCalledWith(2, 'ws:subs:client-1', 'token:0xb');
      expect(mockRedis.sadd).toHaveBeenNthCalledWith(3, 'ws:subs:client-1', 'wallet:0xc');
    });

    it('should handle Redis errors', async () => {
      mockRedis.sadd.mockRejectedValue(new Error('Redis unavailable'));

      await expect(service.trackSubscription('client', 'room')).rejects.toThrow('Redis unavailable');
    });
  });

  describe('removeSubscription', () => {
    it('should remove room from client subscription set', async () => {
      mockRedis.srem.mockResolvedValue(1);

      await service.removeSubscription('client-123', 'token:0xtoken');

      expect(mockRedis.srem).toHaveBeenCalledWith('ws:subs:client-123', 'token:0xtoken');
    });

    it('should use correct prefix for subscription key', async () => {
      mockRedis.srem.mockResolvedValue(1);

      await service.removeSubscription('my-client', 'wallet:0xwallet');

      expect(mockRedis.srem).toHaveBeenCalledWith('ws:subs:my-client', 'wallet:0xwallet');
    });

    it('should handle removing non-existent subscription', async () => {
      mockRedis.srem.mockResolvedValue(0); // No member removed

      await expect(service.removeSubscription('client', 'non-existent-room')).resolves.not.toThrow();
    });

    it('should handle Redis errors', async () => {
      mockRedis.srem.mockRejectedValue(new Error('Connection lost'));

      await expect(service.removeSubscription('client', 'room')).rejects.toThrow('Connection lost');
    });
  });

  describe('getSubscriptions', () => {
    it('should return all subscriptions for a client', async () => {
      const subscriptions = ['token:0xa', 'token:0xb', 'wallet:0xc'];
      mockRedis.smembers.mockResolvedValue(subscriptions);

      const result = await service.getSubscriptions('client-123');

      expect(result).toEqual(subscriptions);
      expect(mockRedis.smembers).toHaveBeenCalledWith('ws:subs:client-123');
    });

    it('should return empty array for client with no subscriptions', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await service.getSubscriptions('new-client');

      expect(result).toEqual([]);
    });

    it('should use correct prefix for subscription key', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      await service.getSubscriptions('test-client');

      expect(mockRedis.smembers).toHaveBeenCalledWith('ws:subs:test-client');
    });

    it('should handle Redis errors', async () => {
      mockRedis.smembers.mockRejectedValue(new Error('Redis timeout'));

      await expect(service.getSubscriptions('client')).rejects.toThrow('Redis timeout');
    });
  });

  describe('cleanupClient', () => {
    it('should delete client subscription key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.cleanupClient('client-123');

      expect(mockRedis.del).toHaveBeenCalledWith('ws:subs:client-123');
    });

    it('should use correct prefix for subscription key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.cleanupClient('disconnected-client');

      expect(mockRedis.del).toHaveBeenCalledWith('ws:subs:disconnected-client');
    });

    it('should handle cleanup of non-existent client', async () => {
      mockRedis.del.mockResolvedValue(0); // Key didn't exist

      await expect(service.cleanupClient('unknown-client')).resolves.not.toThrow();
    });

    it('should handle Redis errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis unavailable'));

      await expect(service.cleanupClient('client')).rejects.toThrow('Redis unavailable');
    });
  });

  describe('getActiveConnectionCount', () => {
    it('should return count of active connections', async () => {
      mockRedis.keys.mockResolvedValue([
        'ws:subs:client-1',
        'ws:subs:client-2',
        'ws:subs:client-3',
      ]);

      const count = await service.getActiveConnectionCount();

      expect(count).toBe(3);
    });

    it('should return zero when no connections', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const count = await service.getActiveConnectionCount();

      expect(count).toBe(0);
    });

    it('should use correct pattern for keys query', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.getActiveConnectionCount();

      expect(mockRedis.keys).toHaveBeenCalledWith('ws:subs:*');
    });

    it('should handle large number of connections', async () => {
      const keys = Array.from({ length: 10000 }, (_, i) => `ws:subs:client-${i}`);
      mockRedis.keys.mockResolvedValue(keys);

      const count = await service.getActiveConnectionCount();

      expect(count).toBe(10000);
    });

    it('should handle Redis errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Command failed'));

      await expect(service.getActiveConnectionCount()).rejects.toThrow('Command failed');
    });
  });
});
