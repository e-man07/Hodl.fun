// Bull queue configuration

import Queue from 'bull';
import { redisConfig } from '../config';
import logger from '../utils/logger';

// Queue options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 500, // Keep last 500 failed jobs for debugging
};

// Create queues
export const metricsQueue = new Queue('metrics-update', redisConfig.url, {
  defaultJobOptions,
  settings: {
    stalledInterval: 30000, // Check for stalled jobs every 30s
    maxStalledCount: 3,
  },
});

export const marketStatsQueue = new Queue('market-stats', redisConfig.url, {
  defaultJobOptions,
  settings: {
    stalledInterval: 60000,
    maxStalledCount: 2,
  },
});

export const cacheWarmingQueue = new Queue('cache-warming', redisConfig.url, {
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
});

export const holderUpdateQueue = new Queue('holder-update', redisConfig.url, {
  defaultJobOptions,
  settings: {
    stalledInterval: 60000,
    maxStalledCount: 2,
  },
});

export const ipfsCacheQueue = new Queue('ipfs-cache', redisConfig.url, {
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
});

// Queue event listeners
metricsQueue.on('error', (error) => {
  logger.error('Metrics queue error:', error);
});

metricsQueue.on('failed', (job, error) => {
  logger.error(`Metrics job ${job.id} failed:`, error);
});

metricsQueue.on('completed', (job) => {
  logger.debug(`Metrics job ${job.id} completed`);
});

marketStatsQueue.on('error', (error) => {
  logger.error('Market stats queue error:', error);
});

marketStatsQueue.on('failed', (job, error) => {
  logger.error(`Market stats job ${job.id} failed:`, error);
});

marketStatsQueue.on('completed', (job) => {
  logger.debug(`Market stats job ${job.id} completed`);
});

cacheWarmingQueue.on('error', (error) => {
  logger.error('Cache warming queue error:', error);
});

holderUpdateQueue.on('error', (error) => {
  logger.error('Holder update queue error:', error);
});

holderUpdateQueue.on('failed', (job, error) => {
  logger.error(`Holder update job ${job.id} failed:`, error);
});

holderUpdateQueue.on('completed', (job) => {
  logger.debug(`Holder update job ${job.id} completed`);
});

ipfsCacheQueue.on('error', (error) => {
  logger.error('IPFS cache queue error:', error);
});

ipfsCacheQueue.on('failed', (job, error) => {
  logger.error(`IPFS cache job ${job.id} failed:`, error);
});

ipfsCacheQueue.on('completed', (job) => {
  logger.debug(`IPFS cache job ${job.id} completed`);
});

logger.info('✅ Bull queues initialized');

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all([
    metricsQueue.close(),
    marketStatsQueue.close(),
    cacheWarmingQueue.close(),
    holderUpdateQueue.close(),
    ipfsCacheQueue.close(),
  ]);
  logger.info('Bull queues closed');
}
