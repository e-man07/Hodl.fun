import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTokens,
  getTrendingTokens,
  getNewTokens,
  getToken,
  getTokenTrades,
  getTokenHolders,
  getTokenPriceHistory,
  searchTokens,
} from './tokens';
import { apiClient } from './client';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('Token API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTokens', () => {
    it('should fetch tokens with default filters', async () => {
      const mockResponse = { data: [], pagination: { page: 1, total: 0 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getTokens();

      expect(apiClient.get).toHaveBeenCalledWith('tokens?');
      expect(result).toEqual(mockResponse);
    });

    it('should include filter params in request', async () => {
      const mockResponse = { data: [], pagination: { page: 1, total: 0 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      await getTokens({
        page: 2,
        limit: 10,
        status: 'TRADING',
        sortBy: 'marketCap',
        sortOrder: 'desc',
        search: 'test',
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('status=TRADING')
      );
    });
  });

  describe('getTrendingTokens', () => {
    it('should fetch trending tokens', async () => {
      const mockTokens = [{ address: '0x123', name: 'Test' }];
      vi.mocked(apiClient.get).mockResolvedValue(mockTokens);

      const result = await getTrendingTokens();

      expect(apiClient.get).toHaveBeenCalledWith('tokens/trending');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('getNewTokens', () => {
    it('should fetch new tokens with default limit', async () => {
      const mockTokens = [{ address: '0x123', name: 'Test' }];
      vi.mocked(apiClient.get).mockResolvedValue(mockTokens);

      const result = await getNewTokens();

      expect(apiClient.get).toHaveBeenCalledWith('tokens/new?limit=10');
      expect(result).toEqual(mockTokens);
    });

    it('should fetch new tokens with custom limit', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getNewTokens(20);

      expect(apiClient.get).toHaveBeenCalledWith('tokens/new?limit=20');
    });
  });

  describe('getToken', () => {
    it('should fetch single token by address', async () => {
      const mockToken = { address: '0x123', name: 'Test Token' };
      vi.mocked(apiClient.get).mockResolvedValue(mockToken);

      const result = await getToken('0x123');

      expect(apiClient.get).toHaveBeenCalledWith('tokens/0x123');
      expect(result).toEqual(mockToken);
    });
  });

  describe('getTokenTrades', () => {
    it('should fetch token trades with pagination', async () => {
      const mockResponse = { data: [], pagination: { page: 1, total: 0 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getTokenTrades('0x123', 2, 25);

      expect(apiClient.get).toHaveBeenCalledWith(
        'tokens/0x123/trades?page=2&limit=25'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use default pagination values', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await getTokenTrades('0x123');

      expect(apiClient.get).toHaveBeenCalledWith(
        'tokens/0x123/trades?page=1&limit=50'
      );
    });
  });

  describe('getTokenHolders', () => {
    it('should fetch token holders with pagination', async () => {
      const mockResponse = { data: [], pagination: { page: 1, total: 0 } };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getTokenHolders('0x123', 1, 20);

      expect(apiClient.get).toHaveBeenCalledWith(
        'tokens/0x123/holders?page=1&limit=20'
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTokenPriceHistory', () => {
    it('should fetch price history with interval', async () => {
      const mockCandles = [{ open: '1', close: '2' }];
      vi.mocked(apiClient.get).mockResolvedValue(mockCandles);

      const result = await getTokenPriceHistory('0x123', 'ONE_MINUTE');

      expect(apiClient.get).toHaveBeenCalledWith(
        'tokens/0x123/price-history?interval=ONE_MINUTE'
      );
      expect(result).toEqual(mockCandles);
    });

    it('should use default interval', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await getTokenPriceHistory('0x123');

      expect(apiClient.get).toHaveBeenCalledWith(
        'tokens/0x123/price-history?interval=ONE_HOUR'
      );
    });
  });

  describe('searchTokens', () => {
    it('should search tokens by query', async () => {
      const mockResponse = { data: [{ name: 'Test' }] };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await searchTokens('test', 5);

      expect(apiClient.get).toHaveBeenCalledWith(
        'tokens?search=test&limit=5'
      );
      expect(result).toEqual([{ name: 'Test' }]);
    });

    it('should encode special characters in query', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      await searchTokens('test token');

      expect(apiClient.get).toHaveBeenCalledWith(
        'tokens?search=test%20token&limit=10'
      );
    });
  });
});
