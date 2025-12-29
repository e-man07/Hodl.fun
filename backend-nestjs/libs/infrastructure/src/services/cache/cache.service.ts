import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, RedisOptions } from 'ioredis';

/**
 * Cache Service
 *
 * Manages distributed caching with Redis
 * Provides TTL-based expiration and cache invalidation
 * Supports atomic operations and batch operations
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis!: Redis;
  private isConnected = false;

  // Cache key prefixes
  private readonly PREFIX = {
    TOKEN: 'token:',
    TRADE: 'trade:',
    PORTFOLIO: 'portfolio:',
    PRICE: 'price:',
    MARKET: 'market:',
  };

  // Default TTL values (in seconds)
  private readonly DEFAULT_TTL = {
    TOKEN_LIST: 60, // 1 minute
    TOKEN_DETAIL: 300, // 5 minutes
    PORTFOLIO: 120, // 2 minutes
    PRICE: 30, // 30 seconds
    MARKET_STATS: 300, // 5 minutes
  };

  constructor(private readonly config: ConfigService) {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    const redisUrl = this.config.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not configured - caching will be disabled (in-memory fallback)',
      );
      return;
    }

    const options: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.redis = new Redis(redisUrl, options);

    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Disconnected from Redis');
    });

    this.redis
      .connect()
      .then(() => {
        this.logger.log('Redis connection established');
      })
      .catch((error) => {
        this.logger.error(`Failed to connect to Redis: ${error.message}`);
      });
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redis) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T = any>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return;
    }

    try {
      const ttl = ttlSeconds || this.DEFAULT_TTL.TOKEN_LIST;
      const serialized = JSON.stringify(value);

      if (ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete cache key
   */
  async delete(key: string): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete multiple cache keys
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (!this.isConnected || !this.redis || keys.length === 0) {
      return;
    }

    try {
      await this.redis.del(...keys);
    } catch (error) {
      this.logger.error(`Error deleting cache keys: ${error.message}`);
    }
  }

  /**
   * Clear all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Error deleting pattern ${pattern}: ${error.message}`);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking cache key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get TTL of key
   */
  async getTtl(key: string): Promise<number> {
    if (!this.isConnected || !this.redis) {
      return -2; // Key does not exist
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for ${key}: ${error.message}`);
      return -2;
    }
  }

  /**
   * Cache token list
   */
  async setTokenList(tokens: any[], limit: number, offset: number): Promise<void> {
    const key = `${this.PREFIX.TOKEN}list:${limit}:${offset}`;
    await this.set(key, tokens, this.DEFAULT_TTL.TOKEN_LIST);
  }

  /**
   * Get cached token list
   */
  async getTokenList(limit: number, offset: number): Promise<any[] | null> {
    const key = `${this.PREFIX.TOKEN}list:${limit}:${offset}`;
    return this.get<any[]>(key);
  }

  /**
   * Invalidate all token list caches
   */
  async invalidateTokenLists(): Promise<void> {
    await this.deletePattern(`${this.PREFIX.TOKEN}list:*`);
    this.logger.log('Invalidated all token list caches');
  }

  /**
   * Cache token detail
   */
  async setToken(tokenId: string, token: any): Promise<void> {
    const key = `${this.PREFIX.TOKEN}${tokenId}`;
    await this.set(key, token, this.DEFAULT_TTL.TOKEN_DETAIL);
  }

  /**
   * Get cached token detail
   */
  async getToken(tokenId: string): Promise<any | null> {
    const key = `${this.PREFIX.TOKEN}${tokenId}`;
    return this.get<any>(key);
  }

  /**
   * Invalidate token cache
   */
  async invalidateToken(tokenId: string): Promise<void> {
    const key = `${this.PREFIX.TOKEN}${tokenId}`;
    await this.delete(key);
  }

  /**
   * Cache portfolio
   */
  async setPortfolio(userId: string, portfolio: any): Promise<void> {
    const key = `${this.PREFIX.PORTFOLIO}${userId}`;
    await this.set(key, portfolio, this.DEFAULT_TTL.PORTFOLIO);
  }

  /**
   * Get cached portfolio
   */
  async getPortfolio(userId: string): Promise<any | null> {
    const key = `${this.PREFIX.PORTFOLIO}${userId}`;
    return this.get<any>(key);
  }

  /**
   * Invalidate portfolio cache
   */
  async invalidatePortfolio(userId: string): Promise<void> {
    const key = `${this.PREFIX.PORTFOLIO}${userId}`;
    await this.delete(key);
  }

  /**
   * Cache token price
   */
  async setPrice(tokenId: string, price: bigint): Promise<void> {
    const key = `${this.PREFIX.PRICE}${tokenId}`;
    await this.set(key, price.toString(), this.DEFAULT_TTL.PRICE);
  }

  /**
   * Get cached price
   */
  async getPrice(tokenId: string): Promise<bigint | null> {
    const key = `${this.PREFIX.PRICE}${tokenId}`;
    const price = await this.get<string>(key);
    return price ? BigInt(price) : null;
  }

  /**
   * Cache market statistics
   */
  async setMarketStats(stats: any): Promise<void> {
    const key = `${this.PREFIX.MARKET}stats`;
    await this.set(key, stats, this.DEFAULT_TTL.MARKET_STATS);
  }

  /**
   * Get cached market statistics
   */
  async getMarketStats(): Promise<any | null> {
    const key = `${this.PREFIX.MARKET}stats`;
    return this.get<any>(key);
  }

  /**
   * Invalidate market statistics cache
   */
  async invalidateMarketStats(): Promise<void> {
    const key = `${this.PREFIX.MARKET}stats`;
    await this.delete(key);
  }

  /**
   * Health check - verify Redis connectivity
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected || !this.redis) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.error(`Cache health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Close Redis connection (graceful shutdown)
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }
}
