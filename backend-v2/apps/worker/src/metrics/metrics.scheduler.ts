import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsProcessor } from './metrics.processor';

@Injectable()
export class MetricsScheduler {
  private readonly logger = new Logger(MetricsScheduler.name);

  constructor(private readonly metricsProcessor: MetricsProcessor) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduleLeaderboardUpdate() {
    const types = ['gainers', 'volume', 'new'];

    for (const type of types) {
      try {
        await this.metricsProcessor.calculateLeaderboard(type);
      } catch (error) {
        this.logger.error(`Failed to calculate ${type} leaderboard: ${(error as Error).message}`);
      }
    }

    this.logger.debug('Completed leaderboard calculations');
  }
}
