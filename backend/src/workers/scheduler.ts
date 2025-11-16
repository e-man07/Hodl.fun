// Cron job scheduler

import cron from 'node-cron';
import { cacheWarmingQueue, holderUpdateQueue, ipfsCacheQueue, metricsQueue } from './queues';
import logger from '../utils/logger';

let scheduledJobs: cron.ScheduledTask[] = [];

/**
 * Start all scheduled jobs
 */
export function startScheduler(): void {
  logger.info('📅 Starting job scheduler...');

  // Tiered metrics update - runs every 30 seconds
  // Updates token price, marketCap, volume based on activity level
  const tieredMetricsJob = cron.schedule('*/30 * * * * *', async () => {
    logger.debug('Scheduling tiered metrics update...');
    await metricsQueue.add('tiered-update', {});
  });

  // Warm up cache every 10 minutes
  const cacheWarmingJob = cron.schedule('*/10 * * * *', async () => {
    logger.info('Scheduling cache warming...');
    await cacheWarmingQueue.add('warm-cache', { type: 'all' });
  });

  // Update holder balances hourly
  const holderUpdateJob = cron.schedule('0 * * * *', async () => {
    logger.info('Scheduling holder balance update...');
    await holderUpdateQueue.add('update-holders', { batchUpdate: true });
  });

  // Retry failed IPFS metadata fetches every hour
  // Only fetches tokens that don't have metadataCache yet
  const ipfsCacheJob = cron.schedule('0 * * * *', async () => {
    logger.info('Scheduling IPFS cache retry for failed fetches...');
    await ipfsCacheQueue.add('warm-ipfs', { type: 'all', limit: 100 });
  });

  scheduledJobs = [tieredMetricsJob, cacheWarmingJob, holderUpdateJob, ipfsCacheJob];

  logger.info('✅ Job scheduler started');
  logger.info('  - Tiered metrics: every 30 seconds (HOT/WARM/ACTIVE/COLD tokens)');
  logger.info('  - Cache warming: every 10 minutes');
  logger.info('  - Holder update: every hour');
  logger.info('  - IPFS retry: every hour (only failed fetches)');
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  logger.info('Stopping job scheduler...');
  scheduledJobs.forEach((job) => job.stop());
  scheduledJobs = [];
  logger.info('Job scheduler stopped');
}

// Start scheduler if running as main module
if (require.main === module) {
  startScheduler();

  logger.info('Scheduler is running. Press Ctrl+C to stop.');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    stopScheduler();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    stopScheduler();
    process.exit(0);
  });
}
