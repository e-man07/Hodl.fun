// Metrics update processor

import { Job } from 'bull';
import { db } from '../../config/database';
import { tokenService } from '../../services/tokenService';
import logger from '../../utils/logger';

interface MetricsJobData {
  tokenAddress?: string;
  batchUpdate?: boolean;
}

/**
 * Process metrics update job
 */
export async function processMetricsUpdate(job: Job<MetricsJobData>): Promise<void> {
  const { tokenAddress, batchUpdate } = job.data;

  try {
    if (batchUpdate) {
      // Update metrics for all active tokens
      logger.info('Starting batch metrics update...');

      const tokens = await db.token.findMany({
        where: { tradingEnabled: true },
        select: { address: true },
        take: 100, // Process 100 tokens at a time
      });

      let updated = 0;
      for (const token of tokens) {
        try {
          await tokenService.updateTokenMetrics(token.address);
          updated++;

          // Update progress
          await job.progress((updated / tokens.length) * 100);
        } catch (error) {
          logger.error(`Failed to update metrics for ${token.address}:`, error);
        }
      }

      logger.info(`Batch metrics update completed: ${updated}/${tokens.length} tokens`);
    } else if (tokenAddress) {
      // Update metrics for specific token
      await tokenService.updateTokenMetrics(tokenAddress);
      logger.info(`Updated metrics for token ${tokenAddress}`);
    } else {
      throw new Error('Either tokenAddress or batchUpdate must be specified');
    }
  } catch (error) {
    logger.error('Metrics update job failed:', error);
    throw error;
  }
}
