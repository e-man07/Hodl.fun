/**
 * Redis Mock Factory
 * Creates mocked Redis services for unit tests
 */

/**
 * Mock RedisService - extends ioredis Redis
 */
export class MockRedisService {
  get = jest.fn().mockResolvedValue(null);
  set = jest.fn().mockResolvedValue('OK');
  del = jest.fn().mockResolvedValue(1);
  keys = jest.fn().mockResolvedValue([]);
  incr = jest.fn().mockResolvedValue(1);
  decr = jest.fn().mockResolvedValue(0);
  expire = jest.fn().mockResolvedValue(1);
  ttl = jest.fn().mockResolvedValue(-1);
  exists = jest.fn().mockResolvedValue(0);
  hget = jest.fn().mockResolvedValue(null);
  hset = jest.fn().mockResolvedValue(1);
  hdel = jest.fn().mockResolvedValue(1);
  hgetall = jest.fn().mockResolvedValue({});
  lpush = jest.fn().mockResolvedValue(1);
  rpush = jest.fn().mockResolvedValue(1);
  lpop = jest.fn().mockResolvedValue(null);
  rpop = jest.fn().mockResolvedValue(null);
  lrange = jest.fn().mockResolvedValue([]);
  sadd = jest.fn().mockResolvedValue(1);
  srem = jest.fn().mockResolvedValue(1);
  smembers = jest.fn().mockResolvedValue([]);
  sismember = jest.fn().mockResolvedValue(0);
  publish = jest.fn().mockResolvedValue(1);
  subscribe = jest.fn().mockResolvedValue(undefined);
  unsubscribe = jest.fn().mockResolvedValue(undefined);
  quit = jest.fn().mockResolvedValue('OK');
  on = jest.fn();
  once = jest.fn();
  emit = jest.fn();
  removeListener = jest.fn();
  removeAllListeners = jest.fn();

  // Allow chaining for pipeline operations
  pipeline = jest.fn().mockReturnThis();
  exec = jest.fn().mockResolvedValue([]);
}

/**
 * Mock CacheService
 */
export class MockCacheService {
  private cache = new Map<string, unknown>();

  get = jest.fn().mockImplementation(async <T>(key: string): Promise<T | null> => {
    const value = this.cache.get(key);
    return value !== undefined ? (value as T) : null;
  });

  set = jest.fn().mockImplementation(async (key: string, value: unknown): Promise<void> => {
    this.cache.set(key, value);
  });

  getOrSet = jest.fn().mockImplementation(
    async <T>(key: string, _ttl: number, fetchFn: () => Promise<T>): Promise<T> => {
      const cached = this.cache.get(key);
      if (cached !== undefined) {
        return cached as T;
      }
      const data = await fetchFn();
      this.cache.set(key, data);
      return data;
    },
  );

  invalidate = jest.fn().mockImplementation(async (key: string): Promise<void> => {
    this.cache.delete(key);
  });

  invalidatePattern = jest.fn().mockImplementation(async (pattern: string): Promise<void> => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  });

  increment = jest.fn().mockResolvedValue(1);
  exists = jest.fn().mockResolvedValue(false);
  ttl = jest.fn().mockResolvedValue(-1);

  // Helper to clear the mock cache between tests
  clearCache = () => {
    this.cache.clear();
  };
}

/**
 * Mock PubSubService
 */
export class MockPubSubService {
  private handlers = new Map<string, (message: unknown) => void>();

  publish = jest.fn().mockResolvedValue(undefined);

  subscribe = jest.fn().mockImplementation(
    async (channel: string, handler: (message: unknown) => void): Promise<void> => {
      this.handlers.set(channel, handler);
    },
  );

  unsubscribe = jest.fn().mockImplementation(async (channel: string): Promise<void> => {
    this.handlers.delete(channel);
  });

  onModuleDestroy = jest.fn().mockResolvedValue(undefined);

  // Helper to simulate receiving a message (for testing)
  simulateMessage = (channel: string, message: unknown): void => {
    const handler = this.handlers.get(channel);
    if (handler) {
      handler(message);
    }
  };

  // Helper to check if a channel is subscribed
  isSubscribed = (channel: string): boolean => {
    return this.handlers.has(channel);
  };

  // Helper to clear all subscriptions between tests
  clearSubscriptions = (): void => {
    this.handlers.clear();
  };
}

/**
 * Factory function to create fresh mocks
 */
export function createMockRedisService(): MockRedisService {
  return new MockRedisService();
}

export function createMockCacheService(): MockCacheService {
  return new MockCacheService();
}

export function createMockPubSubService(): MockPubSubService {
  return new MockPubSubService();
}
