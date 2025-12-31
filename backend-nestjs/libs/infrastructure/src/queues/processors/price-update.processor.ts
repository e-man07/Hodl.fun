import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QueueName } from '../config/queue-config';
import { PriceFeedService } from '../../services/external/price-feed.service';
import { CacheService } from '../../services/cache/cache.service';
import { PrismaService } from '@core';

/**
 * Interface for price update result
 */
interface PriceUpdateResult {
  success: boolean;
  message?: string;
  totalProcessed?: number;
  successCount?: number;
  results?: Array<{ address: string; price: number; success: boolean }>;
}

/**
 * Price Update Processor
 *
 * Fetches and updates token prices from external sources
 * Updates cache and database with latest market data
 * High-frequency job for real-time price feeds
 */
@Processor(QueueName.PRICE_UPDATE)
export class PriceUpdateProcessor {
  private readonly logger = new Logger(PriceUpdateProcessor.name);

  constructor(
    private readonly priceFeed: PriceFeedService,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process price update job for single or multiple tokens
   */
  @Process()
  async process(
    job: Job<{
      tokenAddresses?: string[];
      tokenId?: string;
      chainId?: string;
    }>,
  ): Promise<PriceUpdateResult> {
    try {
      const { tokenAddresses = [], tokenId, chainId = 'ethereum' } = job.data;

      if (tokenAddresses.length === 0 && !tokenId) {
        throw new Error('No tokens specified for price update');
      }

      // Fetch prices
      let priceMap: Map<string, number>;
      const addressesToProcess = tokenAddresses && tokenAddresses.length > 0
        ? tokenAddresses
        : tokenId ? [tokenId] : [];

      if (addressesToProcess.length === 0) {
        throw new Error('No valid token addresses for price update');
      }

      priceMap = await this.priceFeed.getTokenPrices(
        addressesToProcess,
        chainId,
      );

      if (priceMap.size === 0) {
        this.logger.warn('No prices returned from price feed');
        return { success: false, message: 'No prices available' };
      }

      // Update database and cache
      const updatePromises = Array.from(priceMap.entries()).map(
        async ([address, price]) => {
          const priceWei = BigInt(Math.floor(price * 1e18)); // Convert to wei

          // Update cache
          await this.cache.setPrice(address, priceWei);

          // Update database
          await this.prisma.token
            .update({
              where: { address },
              data: {
                currentPrice: priceWei.toString(),
                metricsUpdatedAt: new Date(),
              },
            })
            .catch((error) => {
              this.logger.warn(
                `Failed to update price for ${address}: ${error.message}`,
              );
            });

          return { address, price, success: true };
        },
      );

      const results = await Promise.all(updatePromises);
      const successCount = results.filter((r) => r.success).length;

      this.logger.log(
        `Price update completed: ${successCount}/${results.length} tokens updated`,
      );

      return {
        success: true,
        totalProcessed: results.length,
        successCount,
        results,
      };
    } catch (error) {
      this.logger.error(`Price update failed for job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}
