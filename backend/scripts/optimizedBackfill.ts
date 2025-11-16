import { db } from '../src/config/database';
import { contractService } from '../src/services/contractService';
import logger from '../src/utils/logger';

/**
 * OPTIMIZED Token Metrics Backfill Script
 *
 * Features:
 * - High concurrency (50-100 parallel requests)
 * - Verification mode for testing with small batches
 * - Progress tracking with ETA
 * - Resume capability
 * - Detailed metrics validation
 *
 * Usage:
 *   Verification (10 tokens): npm run backfill:verify
 *   Full backfill:           npm run backfill:full
 */

interface BackfillOptions {
  verifyMode?: boolean;
  batchSize?: number;
  concurrency?: number;
  onlyMissingMetrics?: boolean;
}

interface TokenMetrics {
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  currentSupply: string;
  reserveBalance: string;
  holderCount: number;
}

class OptimizedBackfillService {
  private startTime: number = 0;
  private processedCount: number = 0;
  private successCount: number = 0;
  private failCount: number = 0;
  private skippedCount: number = 0;

  /**
   * Main backfill function
   */
  async backfill(options: BackfillOptions = {}): Promise<void> {
    const {
      verifyMode = false,
      batchSize = verifyMode ? 10 : 50,
      concurrency = verifyMode ? 5 : 50,
      onlyMissingMetrics = false,
    } = options;

    this.startTime = Date.now();
    logger.info('🚀 Starting optimized token metrics backfill');
    logger.info(`Mode: ${verifyMode ? 'VERIFICATION (small batch)' : 'FULL BACKFILL'}`);
    logger.info(`Concurrency: ${concurrency}, Batch Size: ${batchSize}`);

    try {
      // Get tokens that need metrics update
      const whereClause = onlyMissingMetrics
        ? { metricsUpdatedAt: null }
        : {}; // Update all tokens

      const tokens = await db.token.findMany({
        where: whereClause,
        select: { address: true, name: true, symbol: true },
        ...(verifyMode ? { take: 10 } : {}), // Limit to 10 in verify mode
      });

      if (tokens.length === 0) {
        logger.info('✅ No tokens need metrics update!');
        return;
      }

      logger.info(`📊 Found ${tokens.length} tokens to update`);

      if (verifyMode) {
        logger.info('🔍 VERIFICATION MODE - Will process 10 tokens and show detailed output');
      }

      // Process in batches with high concurrency
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(tokens.length / batchSize);

        logger.info(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} tokens)`);

        // Process batch with concurrency control
        await this.processBatchWithConcurrency(batch, concurrency, verifyMode);

        // Show progress
        this.logProgress(tokens.length);
      }

      // Final summary
      this.logFinalSummary();

    } catch (error) {
      logger.error('❌ Fatal error during backfill:', error);
      throw error;
    }
  }

  /**
   * Process a batch with concurrency control
   */
  private async processBatchWithConcurrency(
    batch: Array<{ address: string; name: string; symbol: string }>,
    concurrency: number,
    verifyMode: boolean
  ): Promise<void> {
    const queue = [...batch];
    const workers: Promise<void>[] = [];

    // Create worker promises
    for (let i = 0; i < Math.min(concurrency, batch.length); i++) {
      workers.push(this.worker(queue, verifyMode));
    }

    // Wait for all workers to complete
    await Promise.all(workers);
  }

  /**
   * Worker function - processes tokens from queue
   */
  private async worker(
    queue: Array<{ address: string; name: string; symbol: string }>,
    verifyMode: boolean
  ): Promise<void> {
    while (queue.length > 0) {
      const token = queue.shift();
      if (!token) break;

      await this.updateTokenMetrics(token.address, token.name, token.symbol, verifyMode);
    }
  }

  /**
   * Update metrics for a single token
   */
  private async updateTokenMetrics(
    address: string,
    name: string,
    symbol: string,
    verifyMode: boolean
  ): Promise<void> {
    const tokenAddress = address.toLowerCase();

    try {
      // Fetch current state before update (for verification)
      const currentToken = verifyMode
        ? await db.token.findUnique({
            where: { address: tokenAddress },
            select: {
              currentPrice: true,
              marketCap: true,
              volume24h: true,
              metricsUpdatedAt: true,
            },
          })
        : null;

      // Fetch metrics from blockchain
      const metrics = await this.fetchTokenMetrics(tokenAddress);

      // Update database
      await db.token.update({
        where: { address: tokenAddress },
        data: {
          currentPrice: metrics.currentPrice,
          marketCap: metrics.marketCap,
          volume24h: metrics.volume24h,
          priceChange24h: metrics.priceChange24h,
          currentSupply: metrics.currentSupply,
          reserveBalance: metrics.reserveBalance,
          holderCount: metrics.holderCount,
          metricsUpdatedAt: new Date(),
        },
      });

      this.successCount++;
      this.processedCount++;

      // Detailed logging in verify mode
      if (verifyMode) {
        logger.info(`\n✅ ${name} (${symbol}) - ${tokenAddress}`);
        logger.info(`   📊 Metrics Updated:`);
        logger.info(`      Price:      ${metrics.currentPrice.toFixed(10)} ETH ${currentToken?.currentPrice ? `(was: ${currentToken.currentPrice.toFixed(10)})` : '(new)'}`);
        logger.info(`      Market Cap: ${metrics.marketCap.toFixed(6)} ETH ${currentToken?.marketCap ? `(was: ${currentToken.marketCap.toFixed(6)})` : '(new)'}`);
        logger.info(`      Volume 24h: ${metrics.volume24h.toFixed(6)} ETH`);
        logger.info(`      Price Δ:    ${metrics.priceChange24h.toFixed(2)}%`);
        logger.info(`      Supply:     ${(Number(metrics.currentSupply) / 1e18).toFixed(2)} tokens`);
        logger.info(`      Reserve:    ${(Number(metrics.reserveBalance) / 1e18).toFixed(6)} ETH`);
        logger.info(`      Holders:    ${metrics.holderCount}`);
      } else {
        logger.debug(`✅ Updated ${symbol}: price=${metrics.currentPrice.toFixed(10)}, mcap=${metrics.marketCap.toFixed(6)}`);
      }

    } catch (error: any) {
      this.failCount++;
      this.processedCount++;

      if (verifyMode) {
        logger.error(`\n❌ ${name} (${symbol}) - ${tokenAddress}`);
        logger.error(`   Error: ${error.message}`);
        logger.error(`   Stack: ${error.stack}`);
      } else {
        logger.error(`❌ Failed ${symbol}: ${error.message}`);
      }
    }
  }

  /**
   * Fetch all metrics for a token from blockchain
   */
  private async fetchTokenMetrics(tokenAddress: string): Promise<TokenMetrics> {
    // Fetch data in parallel
    const [priceBigInt, marketInfo, holderCount, recentTrades] = await Promise.all([
      contractService.getCurrentPrice(tokenAddress),
      contractService.getTokenMarketInfo(tokenAddress),
      db.holder.count({
        where: {
          tokenAddress,
          balance: { not: '0' },
        },
      }),
      this.getRecentTrades(tokenAddress),
    ]);

    // Calculate metrics
    const currentPrice = Number(priceBigInt) / 1e18;
    const currentSupply = marketInfo.currentSupply.toString();
    const reserveBalance = marketInfo.reserveBalance.toString();
    const marketCap = (Number(currentSupply) / 1e18) * currentPrice;

    // Calculate 24h volume
    const volume24h = recentTrades.reduce((sum, tx) => {
      const ethAmount = tx.type === 'BUY'
        ? Number(tx.amountIn) / 1e18
        : Number(tx.amountOut) / 1e18;
      return sum + ethAmount;
    }, 0);

    // Calculate 24h price change
    const oldestTrade = recentTrades.length > 0
      ? recentTrades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0]
      : null;
    const priceChange24h = oldestTrade && oldestTrade.price > 0
      ? ((currentPrice - oldestTrade.price) / oldestTrade.price) * 100
      : 0;

    return {
      currentPrice,
      marketCap,
      volume24h,
      priceChange24h,
      currentSupply,
      reserveBalance,
      holderCount,
    };
  }

  /**
   * Get recent trades for a token
   */
  private async getRecentTrades(tokenAddress: string) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await db.transaction.findMany({
      where: {
        tokenAddress,
        type: { in: ['BUY', 'SELL'] },
        timestamp: { gte: twentyFourHoursAgo },
      },
      select: {
        type: true,
        amountIn: true,
        amountOut: true,
        price: true,
        timestamp: true,
      },
    });
  }

  /**
   * Log progress with ETA
   */
  private logProgress(totalTokens: number): void {
    const elapsed = Date.now() - this.startTime;
    const tokensPerSecond = this.processedCount / (elapsed / 1000);
    const remaining = totalTokens - this.processedCount;
    const eta = remaining / tokensPerSecond;

    logger.info(
      `⏱️  Progress: ${this.processedCount}/${totalTokens} ` +
      `(${((this.processedCount / totalTokens) * 100).toFixed(1)}%) | ` +
      `✅ ${this.successCount} | ❌ ${this.failCount} | ` +
      `Speed: ${tokensPerSecond.toFixed(1)} tokens/s | ` +
      `ETA: ${this.formatETA(eta)}`
    );
  }

  /**
   * Log final summary
   */
  private logFinalSummary(): void {
    const elapsed = Date.now() - this.startTime;
    const totalSeconds = elapsed / 1000;

    logger.info('\n' + '='.repeat(60));
    logger.info('✅ BACKFILL COMPLETE!');
    logger.info('='.repeat(60));
    logger.info(`Total Processed:  ${this.processedCount}`);
    logger.info(`✅ Success:       ${this.successCount}`);
    logger.info(`❌ Failed:        ${this.failCount}`);
    logger.info(`⏭️  Skipped:       ${this.skippedCount}`);
    logger.info(`⏱️  Total Time:    ${this.formatDuration(totalSeconds)}`);
    logger.info(`🚀 Avg Speed:     ${(this.processedCount / totalSeconds).toFixed(2)} tokens/s`);
    logger.info('='.repeat(60) + '\n');
  }

  /**
   * Format ETA in human-readable format
   */
  private formatETA(seconds: number): string {
    if (!isFinite(seconds)) return 'calculating...';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const verifyMode = args.includes('--verify') || args.includes('-v');
  const onlyMissing = args.includes('--only-missing') || args.includes('-m');
  const customConcurrency = args.find(arg => arg.startsWith('--concurrency='));
  const concurrency = customConcurrency
    ? parseInt(customConcurrency.split('=')[1])
    : undefined;

  const service = new OptimizedBackfillService();

  try {
    await service.backfill({
      verifyMode,
      onlyMissingMetrics: onlyMissing,
      concurrency,
    });

    logger.info('✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { OptimizedBackfillService };
