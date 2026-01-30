/**
 * Redis Integration Tests
 * Real tests against Redis - no mocks
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CacheService, PubSubService, RedisService } from '../../libs/redis/src';

describe('Redis Integration Tests', () => {
  let cacheService: CacheService;
  let pubSubService: PubSubService;
  let redisService: RedisService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
      ],
      providers: [RedisService, CacheService, PubSubService],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
    cacheService = module.get<CacheService>(CacheService);
    pubSubService = module.get<PubSubService>(PubSubService);
  });

  afterAll(async () => {
    // Clean up test keys
    const keys = await redisService.keys('test:*');
    if (keys.length > 0) {
      await redisService.del(...keys);
    }
    await pubSubService.onModuleDestroy();
    await redisService.quit();
  });

  describe('CacheService', () => {
    const testKey = 'test:cache:item';

    afterEach(async () => {
      await cacheService.invalidate(testKey);
    });

    it('should set and get a value', async () => {
      const testData = { id: 1, name: 'Test' };
      await cacheService.set(testKey, testData, 60);

      const result = await cacheService.get(testKey);
      expect(result).toEqual(testData);
    });

    it('should return null for missing key', async () => {
      const result = await cacheService.get('test:nonexistent');
      expect(result).toBeNull();
    });

    it('should invalidate a key', async () => {
      await cacheService.set(testKey, 'value', 60);
      await cacheService.invalidate(testKey);

      const result = await cacheService.get(testKey);
      expect(result).toBeNull();
    });

    it('should use getOrSet to cache on miss', async () => {
      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { data: 'fetched' };
      };

      // First call - should fetch
      const result1 = await cacheService.getOrSet(testKey, 60, fetcher);
      expect(result1).toEqual({ data: 'fetched' });
      expect(fetchCount).toBe(1);

      // Second call - should use cache
      const result2 = await cacheService.getOrSet(testKey, 60, fetcher);
      expect(result2).toEqual({ data: 'fetched' });
      expect(fetchCount).toBe(1); // Still 1, used cache
    });

    it('should invalidate by pattern', async () => {
      await cacheService.set('test:pattern:1', 'value1', 60);
      await cacheService.set('test:pattern:2', 'value2', 60);
      await cacheService.set('test:other:1', 'other', 60);

      await cacheService.invalidatePattern('test:pattern:*');

      expect(await cacheService.get('test:pattern:1')).toBeNull();
      expect(await cacheService.get('test:pattern:2')).toBeNull();
      expect(await cacheService.get('test:other:1')).toEqual('other');

      // Cleanup
      await cacheService.invalidate('test:other:1');
    });

    it('should handle complex objects', async () => {
      const complexData = {
        tokens: [
          { address: '0x1', name: 'Token1' },
          { address: '0x2', name: 'Token2' },
        ],
        pagination: { page: 1, total: 100 },
        timestamp: new Date().toISOString(),
      };

      await cacheService.set(testKey, complexData, 60);
      const result = await cacheService.get(testKey);

      expect(result).toEqual(complexData);
    });

    it('should handle bigint values as strings', async () => {
      const dataWithBigInt = {
        amount: '1000000000000000000',
        price: '20000000000000000',
      };

      await cacheService.set(testKey, dataWithBigInt, 60);
      const result = await cacheService.get(testKey);

      expect(result).toEqual(dataWithBigInt);
    });
  });

  describe('PubSubService', () => {
    it('should publish and receive messages', async () => {
      const channel = 'test:pubsub:channel';
      const testMessage = { event: 'test', data: 'hello' };
      let receivedMessage: unknown = null;

      // Subscribe first
      await pubSubService.subscribe(channel, (message: unknown) => {
        receivedMessage = message;
      });

      // Wait a bit for subscription to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Publish
      await pubSubService.publish(channel, testMessage);

      // Wait for message to be received
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedMessage).toEqual(testMessage);

      // Cleanup
      await pubSubService.unsubscribe(channel);
    });

    it('should replace handler when subscribing to same channel', async () => {
      // Note: PubSubService uses a Map which replaces handlers on same channel
      // This test verifies that behavior - only the last handler receives messages
      const channel = 'test:pubsub:multi';
      const messages1: unknown[] = [];
      const messages2: unknown[] = [];

      await pubSubService.subscribe(channel, (msg: unknown) => messages1.push(msg));
      await pubSubService.subscribe(channel, (msg: unknown) => messages2.push(msg));

      await new Promise((resolve) => setTimeout(resolve, 100));

      await pubSubService.publish(channel, { id: 1 });
      await pubSubService.publish(channel, { id: 2 });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Only the second handler should receive messages (replaced first)
      expect(messages1.length).toBe(0);
      expect(messages2.length).toBe(2);

      await pubSubService.unsubscribe(channel);
    });

    it('should unsubscribe correctly', async () => {
      const channel = 'test:pubsub:unsub';
      let messageCount = 0;

      await pubSubService.subscribe(channel, () => {
        messageCount++;
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await pubSubService.publish(channel, { id: 1 });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messageCount).toBe(1);

      await pubSubService.unsubscribe(channel);

      await pubSubService.publish(channel, { id: 2 });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be 1 after unsubscribe
      expect(messageCount).toBe(1);
    });
  });

  describe('RedisService', () => {
    it('should execute raw Redis commands', async () => {
      await redisService.set('test:raw:key', 'value');
      const result = await redisService.get('test:raw:key');

      expect(result).toBe('value');

      await redisService.del('test:raw:key');
    });

    it('should support increment operations', async () => {
      const key = 'test:counter';
      await redisService.del(key);

      const val1 = await redisService.incr(key);
      expect(val1).toBe(1);

      const val2 = await redisService.incr(key);
      expect(val2).toBe(2);

      await redisService.del(key);
    });

    it('should support expire and ttl', async () => {
      const key = 'test:expire';
      await redisService.set(key, 'value');
      await redisService.expire(key, 60);

      const ttl = await redisService.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);

      await redisService.del(key);
    });

    it('should check key existence', async () => {
      const key = 'test:exists';

      await redisService.del(key);
      let exists = await redisService.exists(key);
      expect(exists).toBe(0);

      await redisService.set(key, 'value');
      exists = await redisService.exists(key);
      expect(exists).toBe(1);

      await redisService.del(key);
    });
  });
});
