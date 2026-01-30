import { RedisService } from './redis.service';
export declare class CacheService {
    private readonly redis;
    private readonly logger;
    constructor(redis: RedisService);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
    getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T>;
    invalidate(key: string): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
    increment(key: string, ttlSeconds?: number): Promise<number>;
    exists(key: string): Promise<boolean>;
    ttl(key: string): Promise<number>;
}
