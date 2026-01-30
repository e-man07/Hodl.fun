import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in seconds */
  window?: number;
  /** Custom key prefix for Redis */
  keyPrefix?: string;
}

/**
 * Decorator to apply rate limiting to a route or controller
 *
 * @param limit - Maximum number of requests allowed
 * @param window - Time window in seconds (default: 60)
 * @param keyPrefix - Custom key prefix for Redis (default: 'rl')
 *
 * @example
 * // Limit to 10 requests per minute
 * @RateLimit(10, 60)
 *
 * @example
 * // Limit to 5 requests per 10 seconds
 * @RateLimit(5, 10)
 *
 * @example
 * // With custom key prefix
 * @RateLimit(100, 60, 'api')
 */
export const RateLimit = (limit: number, window: number = 60, keyPrefix?: string) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, window, keyPrefix });

/**
 * Preset rate limits for common use cases
 */
export const RateLimits = {
  /** Strict limit for auth endpoints: 5 requests per minute */
  Auth: () => RateLimit(5, 60, 'auth'),

  /** Standard limit for read endpoints: 100 requests per minute */
  Read: () => RateLimit(100, 60, 'read'),

  /** Moderate limit for write endpoints: 30 requests per minute */
  Write: () => RateLimit(30, 60, 'write'),

  /** Burst limit for high-frequency endpoints: 1000 requests per minute */
  Burst: () => RateLimit(1000, 60, 'burst'),

  /** Very strict limit for sensitive operations: 3 requests per minute */
  Strict: () => RateLimit(3, 60, 'strict'),
};
