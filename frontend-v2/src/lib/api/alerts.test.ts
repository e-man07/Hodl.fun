import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAlert,
  getAlerts,
  getAlert,
  updateAlert,
  deleteAlert,
} from './alerts';
import { apiClient } from './client';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Alerts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAlert', () => {
    it('should create a price above alert', async () => {
      const mockAlert = {
        id: '1',
        tokenAddress: '0x123',
        alertType: 'PRICE_ABOVE' as const,
        targetPrice: '1000000000000000000',
        isActive: true,
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockAlert);

      const result = await createAlert({
        tokenAddress: '0x123',
        alertType: 'PRICE_ABOVE',
        targetPrice: '1000000000000000000',
      });

      expect(apiClient.post).toHaveBeenCalledWith('alerts', {
        json: {
          tokenAddress: '0x123',
          alertType: 'PRICE_ABOVE',
          targetPrice: '1000000000000000000',
        },
      });
      expect(result).toEqual(mockAlert);
    });

    it('should create a graduation alert without target price', async () => {
      const mockAlert = {
        id: '2',
        tokenAddress: '0x123',
        alertType: 'GRADUATION' as const,
        isActive: true,
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockAlert);

      const result = await createAlert({
        tokenAddress: '0x123',
        alertType: 'GRADUATION',
      });

      expect(apiClient.post).toHaveBeenCalledWith('alerts', {
        json: {
          tokenAddress: '0x123',
          alertType: 'GRADUATION',
        },
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe('getAlerts', () => {
    it('should fetch all user alerts', async () => {
      const mockAlerts = [
        { id: '1', tokenAddress: '0x123', alertType: 'PRICE_ABOVE' },
        { id: '2', tokenAddress: '0x456', alertType: 'GRADUATION' },
      ];
      vi.mocked(apiClient.get).mockResolvedValue(mockAlerts);

      const result = await getAlerts();

      expect(apiClient.get).toHaveBeenCalledWith('alerts');
      expect(result).toEqual(mockAlerts);
    });

    it('should return empty array when no alerts exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const result = await getAlerts();

      expect(result).toEqual([]);
    });
  });

  describe('getAlert', () => {
    it('should fetch single alert by id', async () => {
      const mockAlert = { id: '1', tokenAddress: '0x123', alertType: 'PRICE_ABOVE' };
      vi.mocked(apiClient.get).mockResolvedValue(mockAlert);

      const result = await getAlert('1');

      expect(apiClient.get).toHaveBeenCalledWith('alerts/1');
      expect(result).toEqual(mockAlert);
    });
  });

  describe('updateAlert', () => {
    it('should update alert target price', async () => {
      const mockAlert = {
        id: '1',
        tokenAddress: '0x123',
        alertType: 'PRICE_ABOVE' as const,
        targetPrice: '2000000000000000000',
      };
      vi.mocked(apiClient.put).mockResolvedValue(mockAlert);

      const result = await updateAlert('1', {
        targetPrice: '2000000000000000000',
      });

      expect(apiClient.put).toHaveBeenCalledWith('alerts/1', {
        json: { targetPrice: '2000000000000000000' },
      });
      expect(result).toEqual(mockAlert);
    });

    it('should update alert active status', async () => {
      const mockAlert = {
        id: '1',
        isActive: false,
      };
      vi.mocked(apiClient.put).mockResolvedValue(mockAlert);

      const result = await updateAlert('1', { isActive: false });

      expect(apiClient.put).toHaveBeenCalledWith('alerts/1', {
        json: { isActive: false },
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe('deleteAlert', () => {
    it('should delete an alert', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteAlert('1');

      expect(apiClient.delete).toHaveBeenCalledWith('alerts/1');
    });
  });
});
