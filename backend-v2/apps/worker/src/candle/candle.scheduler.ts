import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PriceInterval } from '@hodlfun/database';
import { CandleProcessor } from './candle.processor';

@Injectable()
export class CandleScheduler {
  private readonly logger = new Logger(CandleScheduler.name);

  constructor(private readonly candleProcessor: CandleProcessor) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleOneMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60000);
    startTime.setSeconds(0, 0);

    try {
      await this.candleProcessor.aggregateInterval(PriceInterval.ONE_MINUTE, startTime, now);
      this.logger.debug('Completed 1-minute candle aggregation');
    } catch (error) {
      this.logger.error(`Failed 1-minute candle aggregation: ${(error as Error).message}`);
    }
  }

  @Cron('*/5 * * * *') // Every 5 minutes
  async scheduleFiveMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60000);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / 5) * 5, 0, 0);

    try {
      await this.candleProcessor.aggregateInterval(PriceInterval.FIVE_MINUTES, startTime, now);
    } catch (error) {
      this.logger.error(`Failed 5-minute candle aggregation: ${(error as Error).message}`);
    }
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async scheduleFifteenMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 15 * 60000);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / 15) * 15, 0, 0);

    try {
      await this.candleProcessor.aggregateInterval(PriceInterval.FIFTEEN_MINUTES, startTime, now);
    } catch (error) {
      this.logger.error(`Failed 15-minute candle aggregation: ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleOneHourCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60000);
    startTime.setMinutes(0, 0, 0);

    try {
      await this.candleProcessor.aggregateInterval(PriceInterval.ONE_HOUR, startTime, now);
    } catch (error) {
      this.logger.error(`Failed 1-hour candle aggregation: ${(error as Error).message}`);
    }
  }

  @Cron('0 */4 * * *') // Every 4 hours
  async scheduleFourHourCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 4 * 60 * 60000);
    startTime.setHours(Math.floor(startTime.getHours() / 4) * 4, 0, 0, 0);

    try {
      await this.candleProcessor.aggregateInterval(PriceInterval.FOUR_HOURS, startTime, now);
    } catch (error) {
      this.logger.error(`Failed 4-hour candle aggregation: ${(error as Error).message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleOneDayCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 60 * 60000);
    startTime.setHours(0, 0, 0, 0);

    try {
      await this.candleProcessor.aggregateInterval(PriceInterval.ONE_DAY, startTime, now);
    } catch (error) {
      this.logger.error(`Failed 1-day candle aggregation: ${(error as Error).message}`);
    }
  }
}
