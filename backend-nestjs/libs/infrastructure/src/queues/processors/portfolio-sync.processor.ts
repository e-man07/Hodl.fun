import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QueueName } from '../config/queue-config';
import { CacheService } from '../../services/cache/cache.service';
import { PrismaService } from '@core';

/**
 * Interface for portfolio holding data
 */
interface PortfolioHolding {
  tokenAddress: string;
  balance: string;
  unrealizedPnL?: string;
}

/**
 * Interface for portfolio sync result
 */
interface PortfolioSyncResult {
  userId: string;
  success: boolean;
  message?: string;
  holdingsCount?: number;
}

/**
 * Portfolio Sync Processor
 *
 * Synchronizes user portfolios with latest token prices
 * Recalculates P&L and portfolio values
 * Invalidates cache for updated portfolios
 */
@Processor(QueueName.PORTFOLIO_SYNC)
export class PortfolioSyncProcessor {
  private readonly logger = new Logger(PortfolioSyncProcessor.name);

  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process portfolio sync job
   */
  @Process()
  async process(
    job: Job<{
      userId: string;
      force?: boolean;
    }>,
  ): Promise<PortfolioSyncResult> {
    try {
      const { userId } = job.data;

      this.logger.log(`Processing portfolio sync for user ${userId}`);

      // Fetch portfolio from database
      const portfolio = await this.prisma.userPortfolio.findUnique({
        where: { userId },
      });

      if (!portfolio) {
        this.logger.warn(`Portfolio not found for user ${userId}`);
        return { userId, success: false, message: 'Portfolio not found' };
      }

      // Parse holdings
      let holdings: PortfolioHolding[] = [];
      try {
        holdings = JSON.parse(portfolio.holdings || '[]') as PortfolioHolding[];
      } catch {
        this.logger.error(`Failed to parse holdings for user ${userId}`);
        return { userId, success: false, message: 'Invalid holdings format' };
      }

      // Recalculate portfolio metrics
      const updatedHoldings = await Promise.all(
        holdings.map(async (holding) => {
          // Fetch current price from cache or database
          const currentToken = await this.prisma.token.findUnique({
            where: { address: holding.tokenAddress },
          });

          if (!currentToken) {
            return holding;
          }

          const currentPrice = BigInt(currentToken.currentPrice || '0');
          const balance = BigInt(holding.balance);
          const unrealizedPnL = (currentPrice * balance) / BigInt(10 ** 18);

          return {
            ...holding,
            unrealizedPnL: unrealizedPnL.toString(),
          };
        }),
      );

      // Update portfolio in database
      await this.prisma.userPortfolio.update({
        where: { userId },
        data: {
          holdings: JSON.stringify(updatedHoldings),
          updatedAt: new Date(),
        },
      });

      // Invalidate cache
      await this.cache.invalidatePortfolio(userId);

      this.logger.log(`Portfolio sync completed for user ${userId}`);

      return {
        userId,
        success: true,
        holdingsCount: updatedHoldings.length,
      };
    } catch (error) {
      this.logger.error(`Portfolio sync failed for job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}
