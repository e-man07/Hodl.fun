import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from '@core';
import { DomainModule } from '@domain';
import { ApplicationModule } from '@application';
import { InfrastructureModule } from '@infrastructure';
import { PresentationModule } from '@presentation';
import { SharedModule } from '@shared';

/**
 * App Module
 *
 * Root module for the API Server
 * Imports all other modules and configures global middleware
 */
@Module({
  imports: [
    // Configuration (must be first)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 900000,
        limit: 1000,
      },
    ]),

    // Task scheduling
    ScheduleModule.forRoot(),

    // Core infrastructure
    CoreModule,

    // Layers
    DomainModule,
    ApplicationModule,
    InfrastructureModule,
    PresentationModule,
    SharedModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
