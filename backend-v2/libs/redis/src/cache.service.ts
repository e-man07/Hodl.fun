import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Recursively convert BigInt values to strings for JSON serialization
 * Inlined here to avoid circular dependency with @hodlfun/common
 */
function serializeBigInts<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts) as unknown as T;
  }

  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result as T;
  }

  return obj;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        return cached as unknown as T;
      }
    }
    return null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    // Serialize BigInts to strings before JSON.stringify to prevent serialization errors
    const serialized = typeof value === 'string' ? value : JSON.stringify(serializeBigInts(value));
    if (ttlSeconds) {
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, ttlSeconds);
    return data;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.debug(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1 && ttlSeconds) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }
}
