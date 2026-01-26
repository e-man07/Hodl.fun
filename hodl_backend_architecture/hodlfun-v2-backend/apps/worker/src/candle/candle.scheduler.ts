import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PriceInterval } from '@hodlfun/database';

@Injectable()
export class CandleScheduler {
  private readonly logger = new Logger(CandleScheduler.name);

  constructor(@InjectQueue('candle-aggregation') private readonly queue: Queue) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleOneMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60000);
    startTime.setSeconds(0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.ONE_MINUTE,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });

    this.logger.debug('Scheduled 1-minute candle aggregation');
  }

  @Cron('*/5 * * * *') // Every 5 minutes
  async scheduleFiveMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60000);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / 5) * 5, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.FIVE_MINUTES,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async scheduleFifteenMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 15 * 60000);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / 15) * 15, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.FIFTEEN_MINUTES,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleOneHourCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60000);
    startTime.setMinutes(0, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.ONE_HOUR,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron('0 */4 * * *') // Every 4 hours
  async scheduleFourHourCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 4 * 60 * 60000);
    startTime.setHours(Math.floor(startTime.getHours() / 4) * 4, 0, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.FOUR_HOURS,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleOneDayCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 60 * 60000);
    startTime.setHours(0, 0, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.ONE_DAY,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }
}
