/**
 * Cache Service Unit Tests
 * Tests for high-level caching operations
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../../cache.service';
import { RedisService } from '../../redis.service';

// Create mock RedisService
const createMockRedisService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
});

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: ReturnType<typeof createMockRedisService>;

  beforeEach(async () => {
    mockRedis = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed JSON from cache', async () => {
      const cachedData = { id: 1, name: 'Test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.get<typeof cachedData>('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return string as-is when not valid JSON', async () => {
      mockRedis.get.mockResolvedValue('plain-string-value');

      const result = await service.get<string>('string-key');

      expect(result).toBe('plain-string-value');
    });

    it('should return array from cache', async () => {
      const cachedArray = [1, 2, 3];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedArray));

      const result = await service.get<number[]>('array-key');

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', async () => {
      const nestedData = {
        user: { id: 1, profile: { name: 'Test' } },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(nestedData));

      const result = await service.get('nested-key');

      expect(result).toEqual(nestedData);
    });

    it('should handle empty object', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({}));

      const result = await service.get('empty-object-key');

      expect(result).toEqual({});
    });

    it('should handle empty array', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([]));

      const result = await service.get('empty-array-key');

      expect(result).toEqual([]);
    });
  });

  describe('set', () => {
    it('should set JSON stringified value without TTL', async () => {
      const data = { id: 1, name: 'Test' };
      mockRedis.set.mockResolvedValue('OK');

      await service.set('test-key', data);

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', JSON.stringify(data));
    });

    it('should set value with TTL', async () => {
      const data = { id: 1 };
      mockRedis.set.mockResolvedValue('OK');

      await service.set('test-key', data, 60);

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', JSON.stringify(data), 'EX', 60);
    });

    it('should set string value without JSON stringification', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('string-key', 'plain-string');

      expect(mockRedis.set).toHaveBeenCalledWith('string-key', 'plain-string');
    });

    it('should set number value with JSON stringification', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('number-key', 42);

      expect(mockRedis.set).toHaveBeenCalledWith('number-key', '42');
    });

    it('should set boolean value with JSON stringification', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('bool-key', true);

      expect(mockRedis.set).toHaveBeenCalledWith('bool-key', 'true');
    });

    it('should set null value', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('null-key', null);

      expect(mockRedis.set).toHaveBeenCalledWith('null-key', 'null');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { id: 1 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      const fetchFn = jest.fn().mockResolvedValue({ id: 2 });

      const result = await service.getOrSet('test-key', 60, fetchFn);

      expect(result).toEqual({ id: 1 });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should fetch and cache value if not exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const fetchedData = { id: 1, name: 'Fetched' };
      const fetchFn = jest.fn().mockResolvedValue(fetchedData);

      const result = await service.getOrSet('test-key', 60, fetchFn);

      expect(result).toEqual(fetchedData);
      expect(fetchFn).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(fetchedData),
        'EX',
        60,
      );
    });

    it('should use provided TTL', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const fetchFn = jest.fn().mockResolvedValue('data');

      await service.getOrSet('test-key', 300, fetchFn);

      // String values are stored as-is without JSON.stringify
      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'data', 'EX', 300);
    });

    it('should propagate fetch errors', async () => {
      mockRedis.get.mockResolvedValue(null);
      const fetchFn = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(service.getOrSet('test-key', 60, fetchFn)).rejects.toThrow('Fetch failed');
    });

    it('should handle async fetch function', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const fetchFn = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { delayed: true };
      });

      const result = await service.getOrSet('test-key', 60, fetchFn);

      expect(result).toEqual({ delayed: true });
    });
  });

  describe('invalidate', () => {
    it('should delete key from cache', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidate('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should not throw when key does not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(service.invalidate('non-existent-key')).resolves.not.toThrow();
    });
  });

  describe('invalidatePattern', () => {
    it('should delete all keys matching pattern', async () => {
      const matchingKeys = ['token:0x1', 'token:0x2', 'token:0x3'];
      mockRedis.keys.mockResolvedValue(matchingKeys);
      mockRedis.del.mockResolvedValue(3);

      await service.invalidatePattern('token:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('token:*');
      expect(mockRedis.del).toHaveBeenCalledWith('token:0x1', 'token:0x2', 'token:0x3');
    });

    it('should not call del when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.invalidatePattern('non-matching:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('non-matching:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle wildcard patterns', async () => {
      mockRedis.keys.mockResolvedValue(['prefix:middle:suffix']);
      mockRedis.del.mockResolvedValue(1);

      await service.invalidatePattern('prefix:*:suffix');

      expect(mockRedis.keys).toHaveBeenCalledWith('prefix:*:suffix');
    });
  });

  describe('increment', () => {
    it('should increment counter and return new value', async () => {
      mockRedis.incr.mockResolvedValue(5);

      const result = await service.increment('counter-key');

      expect(mockRedis.incr).toHaveBeenCalledWith('counter-key');
      expect(result).toBe(5);
    });

    it('should set expire on first increment (count = 1)', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.increment('counter-key', 60);

      expect(mockRedis.expire).toHaveBeenCalledWith('counter-key', 60);
    });

    it('should not set expire on subsequent increments', async () => {
      mockRedis.incr.mockResolvedValue(5);

      await service.increment('counter-key', 60);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should not set expire when TTL not provided', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await service.increment('counter-key');

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('existing-key');

      expect(mockRedis.exists).toHaveBeenCalledWith('existing-key');
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists('non-existent-key');

      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should return remaining TTL', async () => {
      mockRedis.ttl.mockResolvedValue(300);

      const result = await service.ttl('key-with-ttl');

      expect(mockRedis.ttl).toHaveBeenCalledWith('key-with-ttl');
      expect(result).toBe(300);
    });

    it('should return -1 when key has no TTL', async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const result = await service.ttl('key-without-ttl');

      expect(result).toBe(-1);
    });

    it('should return -2 when key does not exist', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const result = await service.ttl('non-existent-key');

      expect(result).toBe(-2);
    });
  });
});
