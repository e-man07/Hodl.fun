import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IndexerService } from '@infrastructure';
import { BlockchainService } from '@infrastructure';
import { PrismaService } from '@core';

/**
 * Reindex request DTO
 */
interface ReindexRequest {
  fromBlock?: number;
  toBlock?: number;
  tokenAddress?: string;
}

/**
 * Indexer status response
 */
interface IndexerStatusResponse {
  lastProcessedBlock: number;
  currentBlock: number;
  blocksBehind: number;
  isSynced: boolean;
  isRunning: boolean;
  chainId: number;
  rpcUrl: string;
}

/**
 * Admin Controller
 *
 * Provides administrative endpoints for system management.
 * These endpoints should be protected with admin authentication.
 */
@ApiTags('Admin')
@Controller('admin')
@ApiBearerAuth()
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly indexerService: IndexerService,
    private readonly blockchainService: BlockchainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get indexer status
   */
  @Get('indexer-status')
  @ApiOperation({ summary: 'Get indexer sync status' })
  @ApiResponse({ status: 200, description: 'Returns indexer status' })
  async getIndexerStatus(): Promise<IndexerStatusResponse> {
    try {
      const status = await this.indexerService.getIndexerStatus();
      const isHealthy = await this.blockchainService.healthCheck();

      // Get indexer state from database
      let dbState = await this.prisma.indexerState.findFirst({
        where: { id: 'main' },
      });

      return {
        lastProcessedBlock: status.lastProcessedBlock,
        currentBlock: status.currentBlock,
        blocksBehind: status.blocksBehind,
        isSynced: status.isSynced,
        isRunning: dbState?.isRunning ?? false,
        chainId: dbState?.chainId ?? 42101,
        rpcUrl: isHealthy ? 'https://evm.donut.rpc.push.org/' : 'unavailable',
      };
    } catch (error) {
      this.logger.error(`Failed to get indexer status: ${error.message}`);
      throw new HttpException(
        'Failed to get indexer status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Trigger re-indexing of events
   */
  @Post('reindex')
  @ApiOperation({ summary: 'Trigger re-indexing of blockchain events' })
  @ApiResponse({ status: 200, description: 'Re-indexing started' })
  @ApiResponse({ status: 400, description: 'Invalid block range' })
  async triggerReindex(@Body() request: ReindexRequest): Promise<{
    success: boolean;
    message: string;
    fromBlock?: number;
    toBlock?: number;
    eventsProcessed?: number;
  }> {
    try {
      const { fromBlock, toBlock, tokenAddress } = request;

      // If token address specified, reindex for that token
      if (tokenAddress) {
        const currentBlock = await this.blockchainService.getBlockNumber();
        const startBlock = fromBlock || 0;
        const endBlock = toBlock || currentBlock;

        this.logger.log(
          `Re-indexing events for token ${tokenAddress} from block ${startBlock} to ${endBlock}`,
        );

        const result = await this.indexerService.indexEventsForToken(
          tokenAddress,
          startBlock,
          endBlock,
        );

        return {
          success: true,
          message: `Re-indexed ${result.events.length} events for token ${tokenAddress}`,
          fromBlock: result.fromBlock,
          toBlock: result.toBlock,
          eventsProcessed: result.events.length,
        };
      }

      // General re-indexing
      if (fromBlock !== undefined && toBlock !== undefined) {
        if (fromBlock > toBlock) {
          throw new HttpException(
            'fromBlock must be less than or equal to toBlock',
            HttpStatus.BAD_REQUEST,
          );
        }

        this.logger.log(`Re-indexing blocks ${fromBlock} to ${toBlock}`);

        const result = await this.indexerService.indexBlocks(fromBlock, toBlock);

        return {
          success: true,
          message: `Re-indexed ${result.events.length} events`,
          fromBlock: result.fromBlock,
          toBlock: result.toBlock,
          eventsProcessed: result.events.length,
        };
      }

      // Index next batch if no specific range provided
      const result = await this.indexerService.indexNextBatch();

      if (!result) {
        return {
          success: true,
          message: 'No new blocks to process',
        };
      }

      return {
        success: true,
        message: `Indexed ${result.events.length} events`,
        fromBlock: result.fromBlock,
        toBlock: result.toBlock,
        eventsProcessed: result.events.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to trigger reindex: ${error.message}`);
      throw new HttpException(
        `Failed to trigger reindex: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get system statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({ status: 200, description: 'Returns system statistics' })
  async getSystemStats(): Promise<{
    tokens: {
      total: number;
      graduated: number;
      locked: number;
      active: number;
    };
    trades: {
      total: number;
      last24h: number;
    };
    portfolios: number;
    events: {
      total: number;
      unprocessed: number;
    };
  }> {
    try {
      const [
        totalTokens,
        graduatedTokens,
        lockedTokens,
        totalTrades,
        trades24h,
        portfolios,
        totalEvents,
      ] = await Promise.all([
        this.prisma.token.count(),
        this.prisma.token.count({ where: { isListed: true } }),
        this.prisma.token.count({ where: { isLocked: true, isListed: false } }),
        this.prisma.transaction.count(),
        this.prisma.transaction.count({
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),
        this.prisma.userPortfolio.count(),
        this.prisma.blockchainEvent.count(),
      ]);

      // BlockchainEvent doesn't have a processed field, so we use 0 for unprocessed
      const unprocessedEvents = 0;

      return {
        tokens: {
          total: totalTokens,
          graduated: graduatedTokens,
          locked: lockedTokens,
          active: totalTokens - graduatedTokens - lockedTokens,
        },
        trades: {
          total: totalTrades,
          last24h: trades24h,
        },
        portfolios,
        events: {
          total: totalEvents,
          unprocessed: unprocessedEvents,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get system stats: ${error.message}`);
      throw new HttpException(
        'Failed to get system stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get recent blockchain events
   */
  @Get('events')
  @ApiOperation({ summary: 'Get recent blockchain events' })
  @ApiResponse({ status: 200, description: 'Returns recent events' })
  async getRecentEvents(): Promise<{
    events: Array<{
      id: string;
      eventType: string;
      tokenAddress: string | null;
      blockNumber: number;
      transactionHash: string;
      timestamp: Date;
    }>;
    total: number;
  }> {
    try {
      const events = await this.prisma.blockchainEvent.findMany({
        take: 100,
        orderBy: { blockNumber: 'desc' },
        select: {
          id: true,
          eventType: true,
          tokenAddress: true,
          blockNumber: true,
          transactionHash: true,
          timestamp: true,
        },
      });

      const total = await this.prisma.blockchainEvent.count();

      return {
        events: events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          tokenAddress: e.tokenAddress,
          blockNumber: Number(e.blockNumber),
          transactionHash: e.transactionHash,
          timestamp: e.timestamp,
        })),
        total,
      };
    } catch (error) {
      this.logger.error(`Failed to get events: ${error.message}`);
      throw new HttpException(
        'Failed to get events',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
