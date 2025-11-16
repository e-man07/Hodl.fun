// Cache warming utilities

import { cacheService } from '../config/redis';
import { marketService } from '../services/marketService';
import { tokenService } from '../services/tokenService';
import logger from './logger';

/**
 * Warm cache with frequently accessed data
 */
export async function warmCache(): Promise<void> {
  if (!cacheService.isAvailable()) {
    logger.warn('Redis not available, skipping cache warming');
    return;
  }

  logger.info('🔥 Starting cache warming...');
  const startTime = Date.now();

  try {
    // Warm cache in parallel for frequently accessed endpoints
    await Promise.allSettled([
      // Market statistics
      marketService.getMarketStats().catch((err) => {
        logger.error('Failed to warm market stats cache:', err);
      }),

      // Trending tokens
      marketService.getTrendingTokens(10).catch((err) => {
        logger.error('Failed to warm trending tokens cache:', err);
      }),

      // Top gainers/losers - DISABLED (TokenMetric table removed)

      // First page of tokens (most accessed)
      tokenService
        .getTokens({
          page: 1,
          limit: 24,
          sort: 'marketCap',
          order: 'desc',
        })
        .catch((err) => {
          logger.error('Failed to warm tokens list cache:', err);
        }),

      // New tokens
      tokenService
        .getTokens({
          page: 1,
          limit: 10,
          sort: 'created',
          order: 'desc',
        })
        .catch((err) => {
          logger.error('Failed to warm new tokens cache:', err);
        }),

      // Top volume tokens
      tokenService
        .getTokens({
          page: 1,
          limit: 10,
          sort: 'volume',
          order: 'desc',
        })
        .catch((err) => {
          logger.error('Failed to warm top volume cache:', err);
        }),
    ]);

    const duration = Date.now() - startTime;
    logger.info(`✅ Cache warming completed in ${duration}ms`);
  } catch (error) {
    logger.error('Cache warming failed:', error);
  }
}

/**
 * Schedule periodic cache warming
 * Call this to keep cache fresh
 */
export function scheduleCacheWarming(intervalMinutes: number = 5): NodeJS.Timeout {
  logger.info(`📅 Scheduling cache warming every ${intervalMinutes} minutes`);

  const interval = setInterval(async () => {
    logger.debug('Running scheduled cache warming...');
    await warmCache();
  }, intervalMinutes * 60 * 1000);

  return interval;
}
