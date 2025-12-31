import { BullModule } from '@nestjs/bull';

/**
 * Queue Configuration
 *
 * Defines all job queues used in the application
 * Connects to Redis for distributed job processing
 */

export enum QueueName {
  METADATA_ENRICHMENT = 'metadata-enrichment',
  TOKEN_GRADUATION = 'token-graduation',
  PRICE_UPDATE = 'price-update',
  PORTFOLIO_SYNC = 'portfolio-sync',
  TRADE_INDEXING = 'trade-indexing',
  FEE_VAULT_TRACKING = 'fee-vault-tracking',
}

/**
 * Register all application queues
 */
export const getQueueConfigs = () => {
  return BullModule.registerQueue(
    {
      name: QueueName.METADATA_ENRICHMENT,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    },
    {
      name: QueueName.TOKEN_GRADUATION,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: false, // Keep for audit trail
      },
    },
    {
      name: QueueName.PRICE_UPDATE,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    },
    {
      name: QueueName.PORTFOLIO_SYNC,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    },
    {
      name: QueueName.TRADE_INDEXING,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: false, // Keep for audit trail
      },
    },
    {
      name: QueueName.FEE_VAULT_TRACKING,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
      },
    },
  );
};
