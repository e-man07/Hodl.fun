import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLeaderboard,
  getTopGainers,
  getTopLosers,
  getTopVolume,
  getNewest,
  getGraduated,
} from './leaderboard';
import { apiClient } from './client';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('Leaderboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLeaderboard', () => {
    it('should fetch leaderboard with type and default limit', async () => {
      const mockEntries = [
        { address: '0x123', name: 'Token A', change24h: 50 },
        { address: '0x456', name: 'Token B', change24h: 30 },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(mockEntries);

      const result = await getLeaderboard('gainers');

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/gainers?limit=20');
      expect(result).toEqual(mockEntries);
    });

    it('should fetch leaderboard with custom limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getLeaderboard('losers', 50);

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/losers?limit=50');
    });

    it('should handle all leaderboard types', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getLeaderboard('volume', 10);
      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/volume?limit=10');

      await getLeaderboard('new', 10);
      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/new?limit=10');

      await getLeaderboard('graduated', 10);
      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/graduated?limit=10');
    });
  });

  describe('getTopGainers', () => {
    it('should fetch top gainers with default limit', async () => {
      const mockGainers = [{ address: '0x123', change24h: 100 }];
      vi.mocked(apiClient.get).mockResolvedValue(mockGainers);

      const result = await getTopGainers();

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/gainers?limit=20');
      expect(result).toEqual(mockGainers);
    });

    it('should fetch top gainers with custom limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getTopGainers(5);

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/gainers?limit=5');
    });
  });

  describe('getTopLosers', () => {
    it('should fetch top losers with default limit', async () => {
      const mockLosers = [{ address: '0x123', change24h: -50 }];
      vi.mocked(apiClient.get).mockResolvedValue(mockLosers);

      const result = await getTopLosers();

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/losers?limit=20');
      expect(result).toEqual(mockLosers);
    });

    it('should fetch top losers with custom limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getTopLosers(10);

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/losers?limit=10');
    });
  });

  describe('getTopVolume', () => {
    it('should fetch top volume with default limit', async () => {
      const mockVolume = [{ address: '0x123', volume24h: '1000000' }];
      vi.mocked(apiClient.get).mockResolvedValue(mockVolume);

      const result = await getTopVolume();

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/volume?limit=20');
      expect(result).toEqual(mockVolume);
    });

    it('should fetch top volume with custom limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getTopVolume(15);

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/volume?limit=15');
    });
  });

  describe('getNewest', () => {
    it('should fetch newest tokens with default limit', async () => {
      const mockNew = [{ address: '0x123', createdAt: '2024-01-01' }];
      vi.mocked(apiClient.get).mockResolvedValue(mockNew);

      const result = await getNewest();

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/new?limit=20');
      expect(result).toEqual(mockNew);
    });

    it('should fetch newest tokens with custom limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getNewest(25);

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/new?limit=25');
    });
  });

  describe('getGraduated', () => {
    it('should fetch graduated tokens with default limit', async () => {
      const mockGraduated = [{ address: '0x123', graduatedAt: '2024-01-01' }];
      vi.mocked(apiClient.get).mockResolvedValue(mockGraduated);

      const result = await getGraduated();

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/graduated?limit=20');
      expect(result).toEqual(mockGraduated);
    });

    it('should fetch graduated tokens with custom limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getGraduated(30);

      expect(apiClient.get).toHaveBeenCalledWith('leaderboard/graduated?limit=30');
    });
  });
});
