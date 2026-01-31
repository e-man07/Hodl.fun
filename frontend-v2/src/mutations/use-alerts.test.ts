import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useCreateAlert, useUpdateAlert, useDeleteAlert } from './use-alerts';

// Mock the API functions
const mockCreateAlert = vi.fn();
const mockUpdateAlert = vi.fn();
const mockDeleteAlert = vi.fn();

vi.mock('@/lib/api/alerts', () => ({
  createAlert: (...args: unknown[]) => mockCreateAlert(...args),
  updateAlert: (...args: unknown[]) => mockUpdateAlert(...args),
  deleteAlert: (...args: unknown[]) => mockDeleteAlert(...args),
}));

// Mock query keys
vi.mock('@/queries/keys', () => ({
  queryKeys: {
    alerts: {
      all: ['alerts'],
      detail: (id: string) => ['alerts', id],
    },
  },
}));

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('Alert Mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCreateAlert', () => {
    it('should create an alert', async () => {
      const mockAlert = {
        id: '1',
        tokenAddress: '0x123',
        alertType: 'PRICE_ABOVE',
        targetPrice: '1000000000000000000',
      };
      mockCreateAlert.mockResolvedValue(mockAlert);

      const { result } = renderHook(() => useCreateAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate({
        tokenAddress: '0x123',
        alertType: 'PRICE_ABOVE',
        targetPrice: '1000000000000000000',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockCreateAlert).toHaveBeenCalledWith({
        tokenAddress: '0x123',
        alertType: 'PRICE_ABOVE',
        targetPrice: '1000000000000000000',
      });
    });

    it('should handle graduation alert without target price', async () => {
      const mockAlert = {
        id: '2',
        tokenAddress: '0x456',
        alertType: 'GRADUATION',
      };
      mockCreateAlert.mockResolvedValue(mockAlert);

      const { result } = renderHook(() => useCreateAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate({
        tokenAddress: '0x456',
        alertType: 'GRADUATION',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockCreateAlert).toHaveBeenCalledWith({
        tokenAddress: '0x456',
        alertType: 'GRADUATION',
      });
    });

    it('should handle creation errors', async () => {
      mockCreateAlert.mockRejectedValue(new Error('Failed to create alert'));

      const { result } = renderHook(() => useCreateAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate({
        tokenAddress: '0x123',
        alertType: 'PRICE_ABOVE',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed to create alert');
    });
  });

  describe('useUpdateAlert', () => {
    it('should update an alert', async () => {
      const mockAlert = {
        id: '1',
        targetPrice: '2000000000000000000',
      };
      mockUpdateAlert.mockResolvedValue(mockAlert);

      const { result } = renderHook(() => useUpdateAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate({
        id: '1',
        data: { targetPrice: '2000000000000000000' },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockUpdateAlert).toHaveBeenCalledWith('1', {
        targetPrice: '2000000000000000000',
      });
    });

    it('should update alert active status', async () => {
      mockUpdateAlert.mockResolvedValue({ id: '1', isActive: false });

      const { result } = renderHook(() => useUpdateAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate({
        id: '1',
        data: { isActive: false },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockUpdateAlert).toHaveBeenCalledWith('1', { isActive: false });
    });

    it('should handle update errors', async () => {
      mockUpdateAlert.mockRejectedValue(new Error('Failed to update'));

      const { result } = renderHook(() => useUpdateAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate({
        id: '1',
        data: { isActive: false },
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('useDeleteAlert', () => {
    it('should delete an alert', async () => {
      mockDeleteAlert.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate('1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockDeleteAlert).toHaveBeenCalledWith('1');
    });

    it('should handle delete errors', async () => {
      mockDeleteAlert.mockRejectedValue(new Error('Alert not found'));

      const { result } = renderHook(() => useDeleteAlert(), {
        wrapper: createTestWrapper(),
      });

      result.current.mutate('999');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Alert not found');
    });
  });
});
