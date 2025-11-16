// Background workers entry point

import { cacheWarmingQueue, holderUpdateQueue, ipfsCacheQueue, metricsQueue, closeQueues } from './queues';
import { processCacheWarming } from './processors/cacheWarmingProcessor';
import { processHolderUpdate } from './processors/holderUpdateProcessor';
import { processIPFSCacheWarming } from './processors/ipfsCacheProcessor';
import { processTieredMetricsUpdate } from './processors/tieredMetricsProcessor';
import { startScheduler, stopScheduler } from './scheduler';
import { workerConfig } from '../config';
import logger from '../utils/logger';

/**
 * Start all worker processors
 */
export async function startWorkers(): Promise<void> {
  if (!workerConfig.enabled) {
    logger.info('Workers are disabled in config');
    return;
  }

  logger.info('🔧 Starting background workers...');

  // Process tiered metrics updates (updates Token table with price/marketCap/volume)
  metricsQueue.process('tiered-update', 1, processTieredMetricsUpdate);

  // Process cache warming queue
  cacheWarmingQueue.process('warm-cache', 2, processCacheWarming);

  // Process holder update queue
  holderUpdateQueue.process('update-holders', 1, processHolderUpdate);

  // Process IPFS cache warming queue
  ipfsCacheQueue.process('warm-ipfs', 2, processIPFSCacheWarming);

  logger.info('✅ Background workers started');
  logger.info('  - Tiered metrics worker (concurrency: 1) - Updates Token price/marketCap/volume');
  logger.info('  - Cache warming worker (concurrency: 2)');
  logger.info('  - Holder update worker (concurrency: 1)');
  logger.info('  - IPFS cache worker (concurrency: 2)');
  logger.info('');

  // Start the scheduler to trigger jobs
  startScheduler();
}

/**
 * Stop all workers
 */
export async function stopWorkers(): Promise<void> {
  logger.info('Stopping background workers...');
  stopScheduler();
  await closeQueues();
  logger.info('Background workers stopped');
}

// Start workers if running as main module
if (require.main === module) {
  startWorkers()
    .then(() => {
      logger.info('Workers are running. Press Ctrl+C to stop.');
    })
    .catch((error) => {
      logger.error('Failed to start workers:', error);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await stopWorkers();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await stopWorkers();
    process.exit(0);
  });
}
