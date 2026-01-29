"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("./redis.service");
function serializeBigInts(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeBigInts);
    }
    if (typeof obj === 'object') {
        if (obj instanceof Date) {
            return obj;
        }
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = serializeBigInts(value);
        }
        return result;
    }
    return obj;
}
let CacheService = CacheService_1 = class CacheService {
    constructor(redis) {
        this.redis = redis;
        this.logger = new common_1.Logger(CacheService_1.name);
    }
    async get(key) {
        const cached = await this.redis.get(key);
        if (cached) {
            try {
                return JSON.parse(cached);
            }
            catch {
                return cached;
            }
        }
        return null;
    }
    async set(key, value, ttlSeconds) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(serializeBigInts(value));
        if (ttlSeconds) {
            await this.redis.set(key, serialized, 'EX', ttlSeconds);
        }
        else {
            await this.redis.set(key, serialized);
        }
    }
    async getOrSet(key, ttlSeconds, fetchFn) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const data = await fetchFn();
        await this.set(key, data, ttlSeconds);
        return data;
    }
    async invalidate(key) {
        await this.redis.del(key);
    }
    async invalidatePattern(pattern) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(...keys);
            this.logger.debug(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
        }
    }
    async increment(key, ttlSeconds) {
        const count = await this.redis.incr(key);
        if (count === 1 && ttlSeconds) {
            await this.redis.expire(key, ttlSeconds);
        }
        return count;
    }
    async exists(key) {
        const result = await this.redis.exists(key);
        return result === 1;
    }
    async ttl(key) {
        return this.redis.ttl(key);
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], CacheService);
//# sourceMappingURL=cache.service.js.map