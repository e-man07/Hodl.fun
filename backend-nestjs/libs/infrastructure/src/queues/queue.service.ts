import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from './config/queue-config';

/**
 * Queue Service
 *
 * Provides methods to enqueue and manage background jobs
 * Centralizes job scheduling logic
 * Enables retries and job monitoring
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueName.METADATA_ENRICHMENT)
    private metadataQueue: Queue,
    @InjectQueue(QueueName.TOKEN_GRADUATION)
    private graduationQueue: Queue,
    @InjectQueue(QueueName.PRICE_UPDATE)
    private priceQueue: Queue,
    @InjectQueue(QueueName.PORTFOLIO_SYNC)
    private portfolioQueue: Queue,
    @InjectQueue(QueueName.TRADE_INDEXING)
    private tradeQueue: Queue,
  ) {}

  /**
   * Enqueue metadata enrichment job
   */
  async enqueueMetadataEnrichment(data: {
    tokenId: string;
    tokenAddress: string;
    ipfsHash: string;
  }): Promise<string> {
    try {
      const job = await this.metadataQueue.add(data, {
        jobId: `metadata:${data.tokenAddress}`,
        priority: 2,
      });
      this.logger.log(`Enqueued metadata enrichment job ${job.id}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(
        `Failed to enqueue metadata enrichment: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Enqueue token graduation job
   */
  async enqueueTokenGraduation(data: {
    tokenId: string;
    tokenAddress: string;
    marketCap: string;
  }): Promise<string> {
    try {
      const job = await this.graduationQueue.add(data, {
        jobId: `graduation:${data.tokenAddress}`,
        priority: 5, // High priority
      });
      this.logger.log(`Enqueued token graduation job ${job.id}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(`Failed to enqueue token graduation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enqueue price update job
   */
  async enqueuePriceUpdate(data: {
    tokenAddresses?: string[];
    tokenId?: string;
    chainId?: string;
  }): Promise<string> {
    try {
      const jobId = data.tokenAddresses
        ? `price:${data.tokenAddresses.join(',')}`
        : `price:${data.tokenId}`;

      const job = await this.priceQueue.add(data, {
        jobId,
        priority: 3,
        repeat: {
          every: 30000, // Every 30 seconds
        },
      });
      this.logger.log(`Enqueued price update job ${job.id}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(`Failed to enqueue price update: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enqueue portfolio sync job
   */
  async enqueuePortfolioSync(data: {
    userId: string;
    force?: boolean;
  }): Promise<string> {
    try {
      const job = await this.portfolioQueue.add(data, {
        jobId: `portfolio:${data.userId}`,
        priority: 1,
      });
      this.logger.log(`Enqueued portfolio sync job ${job.id}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(`Failed to enqueue portfolio sync: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enqueue trade indexing job
   */
  async enqueueTradeIndexing(data: {
    startBlock: number;
    endBlock: number;
    tokenAddress?: string;
  }): Promise<string> {
    try {
      const jobId = `trades:${data.startBlock}-${data.endBlock}`;

      const job = await this.tradeQueue.add(data, {
        jobId,
        priority: 4,
      });
      this.logger.log(`Enqueued trade indexing job ${job.id}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(`Failed to enqueue trade indexing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<Record<string, any>> {
    const stats = {
      metadata: await this.metadataQueue.getJobCounts(),
      graduation: await this.graduationQueue.getJobCounts(),
      price: await this.priceQueue.getJobCounts(),
      portfolio: await this.portfolioQueue.getJobCounts(),
      trades: await this.tradeQueue.getJobCounts(),
    };

    return stats;
  }

  /**
   * Clear all jobs from all queues (use with caution)
   */
  async clearAllQueues(): Promise<void> {
    this.logger.warn('Clearing all queues');
    await Promise.all([
      this.metadataQueue.clean(0, 'completed'),
      this.graduationQueue.clean(0, 'completed'),
      this.priceQueue.clean(0, 'completed'),
      this.portfolioQueue.clean(0, 'completed'),
      this.tradeQueue.clean(0, 'completed'),
    ]);
  }

  /**
   * Pause all queues
   */
  async pauseAllQueues(): Promise<void> {
    this.logger.warn('Pausing all queues');
    await Promise.all([
      this.metadataQueue.pause(),
      this.graduationQueue.pause(),
      this.priceQueue.pause(),
      this.portfolioQueue.pause(),
      this.tradeQueue.pause(),
    ]);
  }

  /**
   * Resume all queues
   */
  async resumeAllQueues(): Promise<void> {
    this.logger.log('Resuming all queues');
    await Promise.all([
      this.metadataQueue.resume(),
      this.graduationQueue.resume(),
      this.priceQueue.resume(),
      this.portfolioQueue.resume(),
      this.tradeQueue.resume(),
    ]);
  }
}
