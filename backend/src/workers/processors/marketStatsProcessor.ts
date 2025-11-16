// Market statistics processor

import { Job } from 'bull';
import { marketService } from '../../services/marketService';
import logger from '../../utils/logger';

/**
 * Process market stats calculation job
 */
export async function processMarketStats(_job: Job): Promise<void> {
  try {
    logger.info('Market stats calculation skipped - TokenMetric table removed');
    // DEPRECATED: TokenMetric table removed, marketService methods return empty data
    const stats = await marketService.getMarketStats();
    logger.debug('Market stats (empty):', stats);
  } catch (error) {
    logger.error('Market stats job failed:', error);
    throw error;
  }
}
