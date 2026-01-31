import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMyPortfolio,
  getUserPortfolio,
  getUserHoldings,
  getUserTrades,
  getUserCreatedTokens,
} from './users';
import { apiClient } from './client';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('User API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyPortfolio', () => {
    it('should fetch current user portfolio', async () => {
      const mockPortfolio = {
        userAddress: '0x123',
        totalValueNative: '1000000000000000000',
        holdings: [],
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockPortfolio);

      const result = await getMyPortfolio();

      expect(apiClient.get).toHaveBeenCalledWith('users/me/portfolio');
      expect(result).toEqual(mockPortfolio);
    });
  });

  describe('getUserPortfolio', () => {
    it('should fetch user portfolio by address', async () => {
      const mockPortfolio = {
        userAddress: '0x123',
        totalValueNative: '1000000000000000000',
        holdings: [],
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockPortfolio);

      const result = await getUserPortfolio('0x123');

      expect(apiClient.get).toHaveBeenCalledWith('users/0x123/portfolio');
      expect(result).toEqual(mockPortfolio);
    });
  });

  describe('getUserHoldings', () => {
    it('should fetch user holdings with pagination', async () => {
      const mockResponse = { data: [], pagination: { page: 1, total: 0 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getUserHoldings('0x123', 2, 25);

      expect(apiClient.get).toHaveBeenCalledWith(
        'users/0x123/holdings?page=2&limit=25'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use default pagination values', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await getUserHoldings('0x123');

      expect(apiClient.get).toHaveBeenCalledWith(
        'users/0x123/holdings?page=1&limit=50'
      );
    });
  });

  describe('getUserTrades', () => {
    it('should fetch user trades with pagination', async () => {
      const mockResponse = { data: [], pagination: { page: 1, total: 0 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getUserTrades('0x123', 1, 20);

      expect(apiClient.get).toHaveBeenCalledWith(
        'users/0x123/trades?page=1&limit=20'
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUserCreatedTokens', () => {
    it('should fetch tokens created by user', async () => {
      const mockResponse = {
        data: [{ address: '0x456', name: 'Test Token' }],
        pagination: { page: 1, total: 1 },
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getUserCreatedTokens('0x123', 1, 10);

      expect(apiClient.get).toHaveBeenCalledWith(
        'users/0x123/created-tokens?page=1&limit=10'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use default pagination values', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await getUserCreatedTokens('0x123');

      expect(apiClient.get).toHaveBeenCalledWith(
        'users/0x123/created-tokens?page=1&limit=20'
      );
    });
  });
});
