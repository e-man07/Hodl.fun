import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@hodlfun/database';
import { RedisModule } from '@hodlfun/redis';
import { MetricsModule } from '@hodlfun/common';
import { HealthModule } from './health/health.module';
import { CandleModule } from './candle/candle.module';
import { MetricsProcessorModule } from './metrics/metrics.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { AlertsModule } from './alerts/alerts.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '../../.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MetricsModule,
    HealthModule,
    CandleModule,
    MetricsProcessorModule,
    CleanupModule,
    AlertsModule,
    LeaderboardModule,
  ],
})
export class WorkerModule {}
