import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { PubSubService } from './pubsub.service';
import { DlqService } from './dlq.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, CacheService, PubSubService, DlqService],
  exports: [RedisService, CacheService, PubSubService, DlqService],
})
export class RedisModule {}
