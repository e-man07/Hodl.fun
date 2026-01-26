import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CandleService } from './candle.service';
import { PriceInterval } from '@hodlfun/database';
import { MetricsService } from '@hodlfun/common';

interface AggregateIntervalData {
  interval: PriceInterval;
  startTime: string;
  endTime: string;
}

interface AggregateTokenData {
  tokenAddress: string;
  interval: PriceInterval;
  startTime: string;
  endTime: string;
}

@Processor('candle-aggregation')
export class CandleProcessor {
  private readonly logger = new Logger(CandleProcessor.name);

  constructor(
    private readonly candleService: CandleService,
    private readonly metrics: MetricsService,
  ) {}

  @Process('aggregate-interval')
  async handleAggregateInterval(job: Job<AggregateIntervalData>) {
    const { interval, startTime, endTime } = job.data;
    const start = Date.now();

    this.logger.log(`Processing ${interval} candle aggregation`);

    try {
      await this.candleService.aggregateAllTokens(
        interval,
        new Date(startTime),
        new Date(endTime),
      );

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

  @Process('aggregate-token')
  async handleAggregateToken(job: Job<AggregateTokenData>) {
    const { tokenAddress, interval, startTime, endTime } = job.data;

    await this.candleService.aggregateCandles(
      tokenAddress,
      interval,
      new Date(startTime),
      new Date(endTime),
    );
  }
}
