import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from '@core';
import { DomainModule } from '@domain';
import { ApplicationModule } from '@application';
import { InfrastructureModule } from '@infrastructure';
import { SharedModule } from '@shared';

/**
 * Worker Module
 *
 * Background job processing with Bull queue
 * Handles metrics updates, cache warming, metadata enrichment
 */
@Module({
  imports: [
    CoreModule,
    DomainModule,
    ApplicationModule,
    InfrastructureModule,
    SharedModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
  ],
  providers: [],
  exports: [],
})
export class WorkerModule {}
