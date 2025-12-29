import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

/**
 * Redis Service
 *
 * Provides Redis client for caching and pub/sub operations
 * Supports connection pooling and fallback
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private subscriber!: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const db = this.configService.get<number>('REDIS_DB', 0);

    // Main client for operations
    this.client = new Redis({
      host,
      port,
      db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    // Subscriber for pub/sub
    this.subscriber = new Redis({
      host,
      port,
      db,
    });

    // Error handling
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.subscriber.on('error', (err) => {
      this.logger.error(`Redis subscriber error: ${err.message}`);
    });

    this.logger.log(`✅ Redis connected on ${host}:${port}`);
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
    this.logger.log('❌ Redis disconnected');
  }

  /**
   * Get Redis client for operations
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get Redis subscriber for pub/sub
   */
  getSubscriber(): Redis {
    return this.subscriber;
  }

  /**
   * Get value from Redis
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Error getting key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Set value in Redis with optional TTL (in seconds)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Error setting key ${key}: ${error}`);
    }
  }

  /**
   * Delete key from Redis
   */
  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}: ${error}`);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) === 1;
    } catch (error) {
      this.logger.error(`Error checking key existence ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Invalidate keys matching pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Error invalidating pattern ${pattern}: ${error}`);
      return 0;
    }
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: string | object): Promise<number> {
    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.client.publish(channel, payload);
    } catch (error) {
      this.logger.error(`Error publishing to channel ${channel}: ${error}`);
      return 0;
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          callback(message);
        }
      });
    } catch (error) {
      this.logger.error(`Error subscribing to channel ${channel}: ${error}`);
    }
  }
}
