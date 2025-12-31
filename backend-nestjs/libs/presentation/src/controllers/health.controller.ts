import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BlockchainService, IndexerService, QueueName } from '@infrastructure';

/**
 * Health Check Response
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  details?: Record<string, unknown>;
}

/**
 * Health Controller
 *
 * Provides health check endpoints for monitoring system status.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly indexerService: IndexerService,
    @InjectQueue(QueueName.TRADE_INDEXING)
    private readonly tradeIndexingQueue: Queue,
    @InjectQueue(QueueName.TOKEN_GRADUATION)
    private readonly tokenGraduationQueue: Queue,
    @InjectQueue(QueueName.PRICE_UPDATE)
    private readonly priceUpdateQueue: Queue,
  ) {}

  /**
   * Basic health check
   */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async getHealth(): Promise<HealthCheckResponse> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Blockchain connectivity health check
   */
  @Get('blockchain')
  @ApiOperation({ summary: 'Check blockchain RPC connectivity' })
  @ApiResponse({ status: 200, description: 'Blockchain connection status' })
  async getBlockchainHealth(): Promise<HealthCheckResponse> {
    try {
      const isHealthy = await this.blockchainService.healthCheck();
      const blockNumber = await this.blockchainService.getBlockNumber();

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        details: {
          connected: isHealthy,
          currentBlock: blockNumber,
          chainId: 42101,
          rpcUrl: 'https://evm.donut.rpc.push.org/',
        },
      };
    } catch (error) {
      this.logger.error(`Blockchain health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        details: {
          connected: false,
          error: error.message,
        },
      };
    }
  }

  /**
   * Indexer status health check
   */
  @Get('indexer')
  @ApiOperation({ summary: 'Check indexer sync status' })
  @ApiResponse({ status: 200, description: 'Indexer status' })
  async getIndexerHealth(): Promise<HealthCheckResponse> {
    try {
      const status = await this.indexerService.getIndexerStatus();

      // Consider healthy if less than 100 blocks behind
      const isHealthy = status.blocksBehind < 100;
      const isDegraded = status.blocksBehind >= 100 && status.blocksBehind < 1000;

      return {
        status: isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        details: {
          lastProcessedBlock: status.lastProcessedBlock,
          currentBlock: status.currentBlock,
          blocksBehind: status.blocksBehind,
          isSynced: status.isSynced,
        },
      };
    } catch (error) {
      this.logger.error(`Indexer health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        details: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Queue status health check
   */
  @Get('queue')
  @ApiOperation({ summary: 'Check Bull queue status' })
  @ApiResponse({ status: 200, description: 'Queue status' })
  async getQueueHealth(): Promise<HealthCheckResponse> {
    try {
      const [tradeIndexingCounts, tokenGraduationCounts, priceUpdateCounts] =
        await Promise.all([
          this.tradeIndexingQueue.getJobCounts(),
          this.tokenGraduationQueue.getJobCounts(),
          this.priceUpdateQueue.getJobCounts(),
        ]);

      // Calculate total failed jobs
      const totalFailed =
        tradeIndexingCounts.failed +
        tokenGraduationCounts.failed +
        priceUpdateCounts.failed;

      // Consider degraded if there are failed jobs
      const isHealthy = totalFailed === 0;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        details: {
          queues: {
            tradeIndexing: tradeIndexingCounts,
            tokenGraduation: tokenGraduationCounts,
            priceUpdate: priceUpdateCounts,
          },
          totalFailed,
          totalWaiting:
            tradeIndexingCounts.waiting +
            tokenGraduationCounts.waiting +
            priceUpdateCounts.waiting,
          totalActive:
            tradeIndexingCounts.active +
            tokenGraduationCounts.active +
            priceUpdateCounts.active,
        },
      };
    } catch (error) {
      this.logger.error(`Queue health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        details: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Comprehensive health check
   */
  @Get('all')
  @ApiOperation({ summary: 'Comprehensive health check' })
  @ApiResponse({ status: 200, description: 'All health checks' })
  async getAllHealth(): Promise<{
    overall: HealthCheckResponse;
    services: {
      blockchain: HealthCheckResponse;
      indexer: HealthCheckResponse;
      queue: HealthCheckResponse;
    };
  }> {
    const [blockchain, indexer, queue] = await Promise.all([
      this.getBlockchainHealth(),
      this.getIndexerHealth(),
      this.getQueueHealth(),
    ]);

    // Determine overall status
    const statuses = [blockchain.status, indexer.status, queue.status];
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (statuses.includes('unhealthy')) {
      overall = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overall = 'degraded';
    }

    return {
      overall: {
        status: overall,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      },
      services: {
        blockchain,
        indexer,
        queue,
      },
    };
  }
}
