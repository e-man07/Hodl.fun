// Redis client configuration

import Redis from 'ioredis';
import { redisConfig } from './index';
import logger from '../utils/logger';

let redisClient: Redis | null = null;

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis | null {
  if (!redisClient && redisConfig.url) {
    try {
      // Build Redis options with password support
      const redisPassword = process.env.REDIS_PASSWORD;
      const redisOptions: any = {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        lazyConnect: false,
        maxLoadingRetryTime: 10000,
        retryStrategy(times) {
          if (times > 10) {
            logger.error('Redis max retries exceeded, giving up');
            return null; // Stop retrying after 10 attempts
          }
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError(err) {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      };

      // Add password if provided and not in URL
      if (redisPassword && !redisConfig.url.includes('@')) {
        redisOptions.password = redisPassword;
        logger.info('🔒 Redis password authentication enabled');
      }

      redisClient = new Redis(redisConfig.url, redisOptions);

      redisClient.on('connect', () => {
        logger.info('✅ Redis connected successfully');
      });

      redisClient.on('error', (error) => {
        logger.error('❌ Redis connection error:', error);
      });

      redisClient.on('close', () => {
        logger.warn('⚠️  Redis connection closed');
      });

    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      redisClient = null;
    }
  }

  return redisClient;
}

/**
 * Cache helper functions
 */
export class CacheService {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const data = await this.redis.get(key);

      // Track cache hit/miss
      if (data) {
        logger.debug(`Cache HIT: ${key}`);
        // Import dynamically to avoid circular dependency
        import('../middleware/monitoring').then(({ trackCacheHit }) => trackCacheHit());
      } else {
        logger.debug(`Cache MISS: ${key}`);
        import('../middleware/monitoring').then(({ trackCacheMiss }) => trackCacheMiss());
      }

      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      // Track cache set
      import('../middleware/monitoring').then(({ trackCacheSet }) => trackCacheSet());

      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return false;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }

  /**
   * Get cache info
   */
  async getInfo(): Promise<any> {
    if (!this.redis) return { available: false };

    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();

      return {
        available: true,
        keys: dbSize,
        memory: info,
      };
    } catch (error) {
      logger.error('Failed to get Redis info:', error);
      return { available: false };
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.flushdb();
      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}
