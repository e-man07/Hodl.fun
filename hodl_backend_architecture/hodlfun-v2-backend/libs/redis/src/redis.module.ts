import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { PubSubService } from './pubsub.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, CacheService, PubSubService],
  exports: [RedisService, CacheService, PubSubService],
})
export class RedisModule {}
