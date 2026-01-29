import { Module } from '@nestjs/common';
import { CandleProcessor } from './candle.processor';
import { CandleScheduler } from './candle.scheduler';
import { CandleService } from './candle.service';

@Module({
  providers: [CandleProcessor, CandleScheduler, CandleService],
})
export class CandleModule {}
