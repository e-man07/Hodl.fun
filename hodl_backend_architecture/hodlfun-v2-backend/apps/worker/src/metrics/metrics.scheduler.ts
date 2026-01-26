import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class MetricsScheduler {
  private readonly logger = new Logger(MetricsScheduler.name);

  constructor(@InjectQueue('metrics') private readonly queue: Queue) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scheduleLeaderboardUpdate() {
    const types = ['gainers', 'volume', 'new'];

    for (const type of types) {
      await this.queue.add('calculate-leaderboard', { type });
    }

    this.logger.debug('Scheduled leaderboard calculations');
  }
}
