import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MetricsProcessor } from './metrics.processor';
import { MetricsScheduler } from './metrics.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: 'metrics' })],
  providers: [MetricsProcessor, MetricsScheduler],
})
export class MetricsProcessorModule {}
