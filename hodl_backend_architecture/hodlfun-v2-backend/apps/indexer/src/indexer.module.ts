import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@hodlfun/database';
import { RedisModule } from '@hodlfun/redis';
import { MetricsModule, ResilienceModule } from '@hodlfun/common';
import { HealthModule } from './health/health.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { EventProcessorModule } from './event-processor/event-processor.module';

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
    ResilienceModule,
    HealthModule,
    BlockchainModule,
    EventProcessorModule,
  ],
})
export class IndexerModule {}
