import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaderboardService } from './leaderboard.service';

@Injectable()
export class LeaderboardScheduler implements OnModuleInit {
  private readonly logger = new Logger(LeaderboardScheduler.name);
  private isProcessing = false;

  constructor(private readonly leaderboardService: LeaderboardService) {}

  async onModuleInit(): Promise<void> {
    // Compute leaderboards on startup
    this.logger.log('Computing initial leaderboards...');
    try {
      await this.leaderboardService.updateAllLeaderboards();
      this.logger.log('Initial leaderboards computed successfully');
    } catch (error) {
      this.logger.error(`Failed to compute initial leaderboards: ${(error as Error).message}`);
    }
  }

  /**
   * Update leaderboards every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleLeaderboardUpdate(): Promise<void> {
    // Skip if already processing (prevents overlap)
    if (this.isProcessing) {
      this.logger.debug('Skipping leaderboard update - previous job still running');
      return;
    }

    this.isProcessing = true;
    try {
      await this.leaderboardService.updateAllLeaderboards();
    } catch (error) {
      this.logger.error(`Scheduled leaderboard update failed: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
