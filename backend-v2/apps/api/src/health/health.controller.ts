import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '@hodlfun/database';
import { RedisService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metricsService: MetricsService,
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

  @Get('metrics')
  async metrics(@Res() res: Response) {
    const metricsData = await this.metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metricsData);
  }

  private async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis(): Promise<void> {
    await this.redis.ping();
  }
}
