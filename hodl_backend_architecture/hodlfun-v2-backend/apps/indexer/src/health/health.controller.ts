import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { RedisService } from '@hodlfun/redis';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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
    const checks = await Promise.allSettled([this.checkDatabase(), this.checkRedis()]);

    const results = {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      redis: checks[1].status === 'fulfilled' ? 'up' : 'down',
    };

    const healthy = Object.values(results).every((v) => v === 'up');

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis(): Promise<void> {
    await this.redis.ping();
  }
}
