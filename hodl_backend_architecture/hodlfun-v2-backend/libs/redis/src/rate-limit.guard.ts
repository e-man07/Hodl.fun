import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from './redis.service';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';

export interface RateLimitConfig {
  limit: number;
  window: number;
  keyPrefix?: string;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Get rate limit config from decorator (method first, then class)
    const rateLimit =
      this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, handler) ||
      this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, classRef);

    if (!rateLimit) {
      return true; // No rate limit configured
    }

    const { limit, window, keyPrefix = 'rl' } = rateLimit;

    // Get client identifier (prefer Cloudflare IP, then X-Forwarded-For, then req.ip)
    const clientIp =
      request.headers['cf-connecting-ip'] ||
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.ip ||
      'unknown';

    // Get user ID if authenticated
    const userId = request.user?.walletAddress || 'anonymous';

    // Build rate limit key
    const routePath = request.route?.path || request.url;
    const key = `${keyPrefix}:${clientIp}:${userId}:${routePath}`;

    // Increment counter
    const count = await this.redis.incr(key);

    // Set expiry on first request
    if (count === 1) {
      await this.redis.expire(key, window);
    }

    // Get TTL for headers
    const ttl = await this.redis.ttl(key);

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
    response.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);

    if (count > limit) {
      response.setHeader('Retry-After', ttl);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
