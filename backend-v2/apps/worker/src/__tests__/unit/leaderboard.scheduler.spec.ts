import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardScheduler } from '../../leaderboard/leaderboard.scheduler';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';

describe('LeaderboardScheduler', () => {
  let scheduler: LeaderboardScheduler;
  let mockLeaderboardService: jest.Mocked<LeaderboardService>;

  beforeEach(async () => {
    mockLeaderboardService = {
      updateAllLeaderboards: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LeaderboardService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardScheduler,
        { provide: LeaderboardService, useValue: mockLeaderboardService },
      ],
    }).compile();

    scheduler = module.get<LeaderboardScheduler>(LeaderboardScheduler);
  });

  describe('onModuleInit', () => {
    it('should compute initial leaderboards on startup', async () => {
      await scheduler.onModuleInit();

      expect(mockLeaderboardService.updateAllLeaderboards).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during initial computation', async () => {
      mockLeaderboardService.updateAllLeaderboards.mockRejectedValueOnce(
        new Error('Init error'),
      );

      // Should not throw
      await expect(scheduler.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('handleLeaderboardUpdate', () => {
    it('should call updateAllLeaderboards', async () => {
      await scheduler.handleLeaderboardUpdate();

      expect(mockLeaderboardService.updateAllLeaderboards).toHaveBeenCalled();
    });

    it('should skip if already processing', async () => {
      // Simulate a long-running update
      mockLeaderboardService.updateAllLeaderboards.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      // Start first update
      const firstCall = scheduler.handleLeaderboardUpdate();

      // Immediately try second update - should skip
      await scheduler.handleLeaderboardUpdate();

      await firstCall;

      // Should only have been called once
      expect(mockLeaderboardService.updateAllLeaderboards).toHaveBeenCalledTimes(1);
    });

    it('should reset processing flag after completion', async () => {
      await scheduler.handleLeaderboardUpdate();

      // Should be able to run again
      await scheduler.handleLeaderboardUpdate();

      expect(mockLeaderboardService.updateAllLeaderboards).toHaveBeenCalledTimes(2);
    });

    it('should reset processing flag even on error', async () => {
      mockLeaderboardService.updateAllLeaderboards.mockRejectedValueOnce(
        new Error('Update error'),
      );

      await scheduler.handleLeaderboardUpdate();

      // Reset mock and try again
      mockLeaderboardService.updateAllLeaderboards.mockResolvedValueOnce(undefined);
      await scheduler.handleLeaderboardUpdate();

      expect(mockLeaderboardService.updateAllLeaderboards).toHaveBeenCalledTimes(2);
    });
  });
});
