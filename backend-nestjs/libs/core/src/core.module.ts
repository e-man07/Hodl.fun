import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';

/**
 * Core Module
 *
 * Infrastructure layer providing:
 * - Configuration management
 * - Database connectivity (Prisma)
 * - Caching (Redis)
 * - Blockchain integration
 * - Message queues (Bull)
 *
 * This module is imported globally in the main AppModule
 */
@Module({
  imports: [
    // Configuration must be first
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig],
      cache: true,
    }),

    // Infrastructure modules
    DatabaseModule,
    CacheModule,
  ],
  exports: [DatabaseModule, CacheModule],
})
export class CoreModule {}
