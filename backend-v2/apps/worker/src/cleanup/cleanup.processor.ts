import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { RedisService } from '@hodlfun/redis';

@Injectable()
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Clean up old 1-minute candles (keep 7 days).
   * Called by scheduler at 3 AM daily.
   */
  async cleanupOldCandles() {
    const oneMinuteThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.priceHistory.deleteMany({
      where: {
        interval: 'ONE_MINUTE',
        timestamp: { lt: oneMinuteThreshold },
      },
    });

    this.logger.log(`Cleaned up ${deleted.count} old 1-minute candles`);
  }

  /**
   * Clean up holders with zero balance.
   * Called by scheduler every hour.
   */
  async cleanupZeroBalanceHolders() {
    const deleted = await this.prisma.holder.deleteMany({
      where: { balance: '0' },
    });

    this.logger.log(`Cleaned up ${deleted.count} zero-balance holders`);
  }

  /**
   * Warm up caches by invalidating stale leaderboard data.
   * Called by scheduler every 10 minutes.
   */
  async cacheWarmup() {
    const types = ['gainers', 'volume', 'new'];
    for (const type of types) {
      await this.redis.del(`leaderboard:${type}`);
    }

    this.logger.log('Cache warmup completed');
  }
}
