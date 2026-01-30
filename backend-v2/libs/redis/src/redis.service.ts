import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    super(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.on('ready', () => {
      this.logger.log('Redis ready');
    });
  }

  async onModuleDestroy() {
    await this.quit();
    this.logger.log('Redis connection closed');
  }
}
