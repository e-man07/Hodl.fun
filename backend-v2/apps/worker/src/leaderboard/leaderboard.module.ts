import { Module } from '@nestjs/common';
import { PrismaModule } from '@hodlfun/database';
import { RedisModule } from '@hodlfun/redis';
import { MetricsModule } from '@hodlfun/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardScheduler } from './leaderboard.scheduler';

@Module({
  imports: [PrismaModule, RedisModule, MetricsModule],
  providers: [LeaderboardService, LeaderboardScheduler],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
