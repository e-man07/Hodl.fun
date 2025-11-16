// Cache warming processor

import { Job } from 'bull';
import { db } from '../../config/database';
import { tokenService } from '../../services/tokenService';
import { cacheService } from '../../config/redis';
import logger from '../../utils/logger';

interface CacheWarmingJobData {
  type: 'tokens' | 'trending' | 'all';
}

/**
 * Process cache warming job
 */
export async function processCacheWarming(job: Job<CacheWarmingJobData>): Promise<void> {
  const { type } = job.data;

  try {
    if (!cacheService.isAvailable()) {
      logger.warn('Redis not available, skipping cache warming');
      return;
    }

    logger.info(`Starting cache warming: ${type}`);

    if (type === 'tokens' || type === 'all') {
      // Warm up token list cache
      await tokenService.getTokens({ page: 1, limit: 24, sort: 'marketCap', order: 'desc' });
      logger.debug('Warmed up token list cache');

      // Warm up top tokens
      const topTokens = await db.token.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { address: true },
      });

      for (const token of topTokens) {
        await tokenService.getTokenByAddress(token.address);
      }
      logger.debug('Warmed up top 10 tokens cache');
    }

    if (type === 'trending' || type === 'all') {
      // Warm up trending cache
      await tokenService.getTokens({ page: 1, limit: 10, sort: 'volume', order: 'desc' });
      logger.debug('Warmed up trending cache');
    }

    logger.info(`Cache warming completed: ${type}`);
  } catch (error) {
    logger.error('Cache warming job failed:', error);
    throw error;
  }
}
