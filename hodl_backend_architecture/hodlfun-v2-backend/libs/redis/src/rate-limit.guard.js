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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const redis_service_1 = require("./redis.service");
const rate_limit_decorator_1 = require("./rate-limit.decorator");
let RateLimitGuard = class RateLimitGuard {
    constructor(redis, reflector) {
        this.redis = redis;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const handler = context.getHandler();
        const classRef = context.getClass();
        const rateLimit = this.reflector.get(rate_limit_decorator_1.RATE_LIMIT_KEY, handler) ||
            this.reflector.get(rate_limit_decorator_1.RATE_LIMIT_KEY, classRef);
        if (!rateLimit) {
            return true;
        }
        const { limit, window, keyPrefix = 'rl' } = rateLimit;
        const clientIp = request.headers['cf-connecting-ip'] ||
            request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            request.ip ||
            'unknown';
        const userId = request.user?.walletAddress || 'anonymous';
        const routePath = request.route?.path || request.url;
        const key = `${keyPrefix}:${clientIp}:${userId}:${routePath}`;
        const count = await this.redis.incr(key);
        if (count === 1) {
            await this.redis.expire(key, window);
        }
        const ttl = await this.redis.ttl(key);
        response.setHeader('X-RateLimit-Limit', limit);
        response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
        response.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);
        if (count > limit) {
            response.setHeader('Retry-After', ttl);
            throw new common_1.HttpException({
                statusCode: common_1.HttpStatus.TOO_MANY_REQUESTS,
                message: 'Too many requests. Please try again later.',
                retryAfter: ttl,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
};
exports.RateLimitGuard = RateLimitGuard;
exports.RateLimitGuard = RateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_service_1.RedisService)),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        core_1.Reflector])
], RateLimitGuard);
//# sourceMappingURL=rate-limit.guard.js.map