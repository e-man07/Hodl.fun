import { Module } from '@nestjs/common';
import { PrismaModule } from '@hodlfun/database';
import { RedisModule } from '@hodlfun/redis';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
