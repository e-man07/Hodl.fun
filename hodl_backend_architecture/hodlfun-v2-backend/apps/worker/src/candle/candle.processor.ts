import { Injectable, Logger } from '@nestjs/common';
import { CandleService } from './candle.service';
import { PriceInterval } from '@hodlfun/database';
import { MetricsService } from '@hodlfun/common';

@Injectable()
export class CandleProcessor {
  private readonly logger = new Logger(CandleProcessor.name);

  constructor(
    private readonly candleService: CandleService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Aggregate candles for all tokens at the specified interval.
   * Called by scheduler at various cron intervals.
   */
  async aggregateInterval(interval: PriceInterval, startTime: Date, endTime: Date) {
    const start = Date.now();

    this.logger.log(`Processing ${interval} candle aggregation`);

    try {
      await this.candleService.aggregateAllTokens(interval, startTime, endTime);

      this.metrics.queueJobsProcessed.inc({ queue: 'candle-aggregation', status: 'success' });
      this.metrics.queueJobDuration.observe(
        { queue: 'candle-aggregation' },
        (Date.now() - start) / 1000,
      );

      this.logger.log(`Completed ${interval} candle aggregation`);
    } catch (error) {
      this.metrics.queueJobsProcessed.inc({ queue: 'candle-aggregation', status: 'failed' });
      throw error;
    }
  }

  /**
   * Aggregate candles for a specific token.
   */
  async aggregateToken(
    tokenAddress: string,
    interval: PriceInterval,
    startTime: Date,
    endTime: Date,
  ) {
    await this.candleService.aggregateCandles(tokenAddress, interval, startTime, endTime);
  }
}
