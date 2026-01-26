import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@hodlfun/database';
import { RedisService } from '@hodlfun/redis';

@Processor('cleanup')
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Process('cleanup-old-candles')
  async handleCleanupOldCandles(_job: Job) {
    // Keep 1-minute candles for 7 days
    const oneMinuteThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.priceHistory.deleteMany({
      where: {
        interval: 'ONE_MINUTE',
        timestamp: { lt: oneMinuteThreshold },
      },
    });

    this.logger.log(`Cleaned up ${deleted.count} old 1-minute candles`);
  }

  @Process('cleanup-zero-balance-holders')
  async handleCleanupZeroBalanceHolders(_job: Job) {
    const deleted = await this.prisma.holder.deleteMany({
      where: { balance: '0' },
    });

    this.logger.log(`Cleaned up ${deleted.count} zero-balance holders`);
  }

  @Process('cache-warmup')
  async handleCacheWarmup(_job: Job) {
    // Warm up leaderboard caches
    const types = ['gainers', 'volume', 'new'];
    for (const type of types) {
      await this.redis.del(`leaderboard:${type}`);
    }

    this.logger.log('Cache warmup completed');
  }
}
