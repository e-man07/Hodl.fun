import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(@InjectQueue('cleanup') private readonly queue: Queue) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduleOldCandleCleanup() {
    await this.queue.add('cleanup-old-candles', {});
    this.logger.debug('Scheduled old candle cleanup');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleZeroBalanceCleanup() {
    await this.queue.add('cleanup-zero-balance-holders', {});
    this.logger.debug('Scheduled zero-balance holder cleanup');
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduleCacheWarmup() {
    await this.queue.add('cache-warmup', {});
    this.logger.debug('Scheduled cache warmup');
  }
}
