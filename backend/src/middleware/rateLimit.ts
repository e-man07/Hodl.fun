// Rate limiting middleware

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { appConfig } from '../config';
import { getRedisClient } from '../config/redis';
import logger from '../utils/logger';

/**
 * Create Redis store if available, otherwise use memory store
 */
function createRateLimitStore() {
  const redisClient = getRedisClient();

  if (redisClient && redisClient.status === 'ready') {
    logger.info('Using Redis for rate limiting');
    return new RedisStore({
      // @ts-expect-error - Redis type compatibility
      sendCommand: (...args: string[]) => redisClient.call(...args),
      prefix: 'rl:',
    });
  }

  logger.warn('Redis not available, using in-memory rate limiting');
  return undefined; // Will use default memory store
}

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: appConfig.rateLimit.windowMs,
  max: appConfig.rateLimit.maxRequests,
  store: createRateLimitStore(),
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for trusted IPs
    const trustedIPs = process.env.TRUSTED_IPS?.split(',').map((ip) => ip.trim()) || [];
    return trustedIPs.includes(req.ip || '');
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy
    return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
  },
});

/**
 * Strict rate limiter for upload endpoints
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per 15 minutes
  store: createRateLimitStore(),
  message: {
    success: false,
    error: 'Too many upload requests, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
  },
});

/**
 * Lenient rate limiter for read-only endpoints
 */
export const readRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  store: createRateLimitStore(),
  message: {
    success: false,
    error: 'Too many requests, please slow down.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
  },
});

/**
 * Strict rate limiter for admin endpoints
 */
export const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  store: createRateLimitStore(),
  message: {
    success: false,
    error: 'Too many admin requests, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
  },
});
