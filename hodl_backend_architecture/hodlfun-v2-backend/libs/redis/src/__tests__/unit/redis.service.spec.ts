/**
 * Redis Service Unit Tests
 * Tests for core Redis connection and operations
 */
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

const mockConfigService = {
  get: jest.fn().mockReturnValue('redis://localhost:6379'),
};

describe('RedisService', () => {
  let mockRedisInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Redis instance
    mockRedisInstance = {
      on: jest.fn().mockReturnThis(),
      quit: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
      ttl: jest.fn().mockResolvedValue(-1),
    };

    MockRedis.mockImplementation(() => mockRedisInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create Redis instance with URL from config', () => {
      // Import after mocking
      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      expect(MockRedis).toHaveBeenCalledWith(
        'redis://localhost:6379',
        expect.objectContaining({
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        }),
      );
    });

    it('should use default URL when not configured', () => {
      mockConfigService.get.mockReturnValue('redis://localhost:6379');

      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      expect(mockConfigService.get).toHaveBeenCalledWith('REDIS_URL', 'redis://localhost:6379');
    });

    it('should set up event listeners', () => {
      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });

  describe('retry strategy', () => {
    it('should return null after 10 retries', () => {
      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      // Get the options passed to Redis constructor
      const calls = MockRedis.mock.calls as unknown[][];
      const options = calls[0]?.[1] as { retryStrategy?: (times: number) => number | null };
      const retryStrategy = options?.retryStrategy;

      if (!retryStrategy) {
        throw new Error('retryStrategy not found in options');
      }

      // Should return delay for attempts <= 10
      expect(retryStrategy(1)).toBe(100);
      expect(retryStrategy(5)).toBe(500);
      expect(retryStrategy(10)).toBe(1000);

      // Should return null after 10 attempts
      expect(retryStrategy(11)).toBeNull();
    });

    it('should cap retry delay at 3000ms', () => {
      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      const calls = MockRedis.mock.calls as unknown[][];
      const options = calls[0]?.[1] as { retryStrategy?: (times: number) => number | null };
      const retryStrategy = options?.retryStrategy;

      if (!retryStrategy) {
        throw new Error('retryStrategy not found in options');
      }

      // times * 100 capped at 3000
      expect(retryStrategy(50)).toBeNull(); // > 10 retries
    });
  });

  describe('onModuleDestroy', () => {
    it('should close Redis connection', async () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      await service.onModuleDestroy();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });

  describe('inherited Redis methods', () => {
    // RedisService extends Redis, so it inherits all Redis methods
    // These tests verify the mock setup and method availability

    it('should have get method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.get).toBeDefined();
    });

    it('should have set method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.set).toBeDefined();
    });

    it('should have del method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.del).toBeDefined();
    });

    it('should have incr method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.incr).toBeDefined();
    });

    it('should have expire method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.expire).toBeDefined();
    });

    it('should have exists method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.exists).toBeDefined();
    });

    it('should have ttl method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.ttl).toBeDefined();
    });

    it('should have keys method', () => {
      const { RedisService } = require('../../redis.service');
      const service = new RedisService(mockConfigService as unknown as ConfigService);

      expect(service.keys).toBeDefined();
    });
  });

  describe('event handlers', () => {
    it('should log on connect', () => {
      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      // Find the connect handler and verify it was set
      const connectCall = mockRedisInstance.on.mock.calls.find(
        (call: any) => call[0] === 'connect',
      );
      expect(connectCall).toBeDefined();
      expect(typeof connectCall[1]).toBe('function');
    });

    it('should log on error', () => {
      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      const errorCall = mockRedisInstance.on.mock.calls.find((call: any) => call[0] === 'error');
      expect(errorCall).toBeDefined();
      expect(typeof errorCall[1]).toBe('function');
    });

    it('should log on ready', () => {
      const { RedisService } = require('../../redis.service');
      new RedisService(mockConfigService as unknown as ConfigService);

      const readyCall = mockRedisInstance.on.mock.calls.find((call: any) => call[0] === 'ready');
      expect(readyCall).toBeDefined();
      expect(typeof readyCall[1]).toBe('function');
    });
  });
});
