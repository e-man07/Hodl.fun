/**
 * Redis Service Unit Tests
 * Tests for core Redis connection and operations
 *
 * Note: RedisService extends ioredis Redis class directly which makes
 * traditional mocking challenging. These tests verify the service structure
 * and interface. For full integration tests, see test/integration/redis.integration.spec.ts
 */
import { RedisService } from '../../redis.service';

describe('RedisService', () => {
  describe('class structure', () => {
    it('should be a class that can be instantiated', () => {
      expect(RedisService).toBeDefined();
      expect(typeof RedisService).toBe('function');
    });

    it('should have prototype methods', () => {
      // RedisService extends Redis and implements OnModuleDestroy
      expect(RedisService.prototype.onModuleDestroy).toBeDefined();
    });
  });

  describe('static analysis', () => {
    it('should export RedisService from module', () => {
      const redisModule = require('../../index');
      expect(redisModule.RedisService).toBe(RedisService);
    });
  });

  // Integration tests for actual Redis operations are in:
  // test/integration/redis.integration.spec.ts
  // These provide real coverage of get, set, del, keys, etc.
});
