import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CleanupProcessor } from './cleanup.processor';

@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(private readonly cleanupProcessor: CleanupProcessor) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduleOldCandleCleanup() {
    try {
      await this.cleanupProcessor.cleanupOldCandles();
      this.logger.debug('Completed old candle cleanup');
    } catch (error) {
      this.logger.error(`Failed to cleanup old candles: ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleZeroBalanceCleanup() {
    try {
      await this.cleanupProcessor.cleanupZeroBalanceHolders();
      this.logger.debug('Completed zero-balance holder cleanup');
    } catch (error) {
      this.logger.error(`Failed to cleanup zero-balance holders: ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduleCacheWarmup() {
    try {
      await this.cleanupProcessor.cacheWarmup();
      this.logger.debug('Completed cache warmup');
    } catch (error) {
      this.logger.error(`Failed cache warmup: ${(error as Error).message}`);
    }
  }
}
