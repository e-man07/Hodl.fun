import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsModule as CommonMetricsModule } from '@hodlfun/common';

@Module({
  imports: [CommonMetricsModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
