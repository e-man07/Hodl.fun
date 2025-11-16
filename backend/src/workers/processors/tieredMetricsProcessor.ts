import { Job } from 'bull';
import { db } from '../../config/database';
import { tokenService } from '../../services/tokenService';
import logger from '../../utils/logger';

/**
 * Tiered Metrics Update Processor
 *
 * Updates tokens based on activity level (prioritized for active trading):
 * - HOT: Traded in last 10 minutes → Update every 30 seconds
 * - WARM: Traded in last hour → Update every 5 minutes
 * - ACTIVE: Traded in last 24 hours → Update every 30 minutes
 * - COLD: No recent trades → Update every 12 hours (low priority, small batches)
 */

interface ProcessorState {
  lastHotUpdate: number;
  lastWarmUpdate: number;
  lastActiveUpdate: number;
  lastColdUpdate: number;
  coldBatchOffset: number;
  isRunning: boolean;
}

const state: ProcessorState = {
  lastHotUpdate: 0,
  lastWarmUpdate: 0,
  lastActiveUpdate: 0,
  lastColdUpdate: 0,
  coldBatchOffset: 0,
  isRunning: false,
};

export async function processTieredMetricsUpdate(_job: Job): Promise<void> {
  // Skip if already running to prevent queue backlog
  if (state.isRunning) {
    logger.warn('⏭️  Skipping tiered metrics update - previous job still running');
    return;
  }

  state.isRunning = true;
  const now = Date.now();

  try {
    // HOT TOKENS: Update every 30 seconds (highest priority for active trading)
    if (now - state.lastHotUpdate >= 30 * 1000) {
      await updateHotTokens();
      state.lastHotUpdate = now;
    }

    // WARM TOKENS: Update every 5 minutes
    if (now - state.lastWarmUpdate >= 5 * 60 * 1000) {
      await updateWarmTokens();
      state.lastWarmUpdate = now;
    }

    // ACTIVE TOKENS: Update every 30 minutes
    if (now - state.lastActiveUpdate >= 30 * 60 * 1000) {
      await updateActiveTokens();
      state.lastActiveUpdate = now;
    }

    // COLD TOKENS: Update every 12 hours (lowest priority to prevent blocking)
    if (now - state.lastColdUpdate >= 12 * 60 * 60 * 1000) {
      await updateColdTokens();
      state.lastColdUpdate = now;
    }

    logger.info('✅ Tiered metrics update completed');
  } catch (error) {
    logger.error('Error in tiered metrics update:', error);
    throw error;
  } finally {
    // Always release the lock, even if there's an error
    state.isRunning = false;
  }
}

/**
 * Update HOT tokens (traded in last 10 minutes)
 * These need the freshest data for active traders - highest priority
 */
async function updateHotTokens(): Promise<void> {
  const startTime = Date.now();

  const hotTokens = await db.token.findMany({
    where: {
      tradingEnabled: true,
      transactions: {
        some: {
          timestamp: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
          },
        },
      },
    },
    select: { address: true },
    take: 100,
  });

  if (hotTokens.length === 0) {
    logger.info('No hot tokens to update');
    return;
  }

  // Parallel update for speed
  const results = await Promise.allSettled(
    hotTokens.map((token) => tokenService.updateTokenMetrics(token.address))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info(
    `HOT tokens updated: ${successful} successful, ${failed} failed (${Date.now() - startTime}ms)`
  );
}

/**
 * Update WARM tokens (traded in last hour, excluding hot)
 * These are still active but not as urgent
 */
async function updateWarmTokens(): Promise<void> {
  const startTime = Date.now();

  const warmTokens = await db.token.findMany({
    where: {
      tradingEnabled: true,
      AND: [
        {
          // Traded in last hour
          transactions: {
            some: {
              timestamp: {
                gte: new Date(Date.now() - 60 * 60 * 1000),
              },
            },
          },
        },
        {
          // But NOT in last 10 minutes (those are hot)
          NOT: {
            transactions: {
              some: {
                timestamp: {
                  gte: new Date(Date.now() - 10 * 60 * 1000),
                },
              },
            },
          },
        },
      ],
    },
    select: { address: true },
    take: 200,
  });

  if (warmTokens.length === 0) {
    logger.info('No warm tokens to update');
    return;
  }

  const results = await Promise.allSettled(
    warmTokens.map((token) => tokenService.updateTokenMetrics(token.address))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info(
    `WARM tokens updated: ${successful} successful, ${failed} failed (${Date.now() - startTime}ms)`
  );
}

/**
 * Update ACTIVE tokens (traded in last 24 hours, excluding hot/warm)
 * These have recent activity but not urgent
 */
async function updateActiveTokens(): Promise<void> {
  const startTime = Date.now();

  const activeTokens = await db.token.findMany({
    where: {
      tradingEnabled: true,
      AND: [
        {
          // Traded in last 24 hours
          transactions: {
            some: {
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          },
        },
        {
          // But NOT in last hour (those are hot/warm)
          NOT: {
            transactions: {
              some: {
                timestamp: {
                  gte: new Date(Date.now() - 60 * 60 * 1000),
                },
              },
            },
          },
        },
      ],
    },
    select: { address: true },
    take: 500,
  });

  if (activeTokens.length === 0) {
    logger.info('No active tokens to update');
    return;
  }

  const results = await Promise.allSettled(
    activeTokens.map((token) => tokenService.updateTokenMetrics(token.address))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info(
    `ACTIVE tokens updated: ${successful} successful, ${failed} failed (${Date.now() - startTime}ms)`
  );
}

/**
 * Update COLD tokens (no recent trades)
 * Rotate through batches to cover all tokens over time
 * Using very small batches (50) and long intervals (12h) to minimize impact
 */
async function updateColdTokens(): Promise<void> {
  const startTime = Date.now();

  const coldTokens = await db.token.findMany({
    where: {
      OR: [
        // Tokens with no transactions at all
        {
          transactions: {
            none: {},
          },
        },
        // Tokens with no transactions in last 24 hours
        {
          transactions: {
            every: {
              timestamp: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      ],
    },
    select: { address: true },
    skip: state.coldBatchOffset,
    take: 50, // Small batch to complete quickly and not block other jobs
  });

  if (coldTokens.length === 0) {
    // Reset offset and try again
    state.coldBatchOffset = 0;
    logger.info('All cold tokens updated, resetting batch offset');
    return;
  }

  const results = await Promise.allSettled(
    coldTokens.map((token) => tokenService.updateTokenMetrics(token.address))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  // Rotate offset for next run
  state.coldBatchOffset += coldTokens.length;

  logger.info(
    `COLD tokens updated: ${successful} successful, ${failed} failed, offset now at ${state.coldBatchOffset} (${Date.now() - startTime}ms)`
  );
}
