import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Cache Module
 *
 * Provides Redis caching layer for the application
 * Supports pub/sub for real-time updates
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class CacheModule {}
