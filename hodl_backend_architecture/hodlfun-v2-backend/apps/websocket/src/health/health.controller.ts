import { Controller, Get } from '@nestjs/common';
import { RedisService } from '@hodlfun/redis';

@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisService) {}

  @Get('startup')
  async startup() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('live')
  async live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        checks: { redis: 'up' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'unhealthy',
        checks: { redis: 'down' },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
