import { Module } from '@nestjs/common';
import { MetricsProcessor } from './metrics.processor';
import { MetricsScheduler } from './metrics.scheduler';

@Module({
  providers: [MetricsProcessor, MetricsScheduler],
})
export class MetricsProcessorModule {}
