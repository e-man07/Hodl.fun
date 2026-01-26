import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CandleProcessor } from './candle.processor';
import { CandleScheduler } from './candle.scheduler';
import { CandleService } from './candle.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'candle-aggregation' })],
  providers: [CandleProcessor, CandleScheduler, CandleService],
})
export class CandleModule {}
