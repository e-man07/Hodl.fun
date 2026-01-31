import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNonce, verifySignature, logout, createSignMessage } from './auth';
import { apiClient, setAuthTokens, clearAuthTokens } from './client';

// Mock the API client and token functions
vi.mock('./client', () => ({
  apiClient: {
    post: vi.fn(),
  },
  setAuthTokens: vi.fn(),
  clearAuthTokens: vi.fn(),
}));

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNonce', () => {
    it('should request nonce for wallet address', async () => {
      const mockResponse = {
        nonce: 'abc123',
        walletAddress: '0x123',
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await getNonce('0x123');

      expect(apiClient.post).toHaveBeenCalledWith('auth/nonce', {
        json: { wallet: '0x123' },
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle lowercase addresses', async () => {
      const mockResponse = {
        nonce: 'def456',
        walletAddress: '0xabc',
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await getNonce('0xabc');

      expect(apiClient.post).toHaveBeenCalledWith('auth/nonce', {
        json: { wallet: '0xabc' },
      });
      expect(result.nonce).toBe('def456');
    });
  });

  describe('verifySignature', () => {
    it('should verify signature and store tokens', async () => {
      const mockTokens = {
        accessToken: 'access123',
        refreshToken: 'refresh123',
        expiresIn: 3600,
      };
      vi.mocked(apiClient.post).mockResolvedValue(mockTokens);

      const result = await verifySignature({
        wallet: '0x123',
        signature: '0xsig123',
      });

      expect(apiClient.post).toHaveBeenCalledWith('auth/verify', {
        json: {
          wallet: '0x123',
          signature: '0xsig123',
        },
      });
      expect(setAuthTokens).toHaveBeenCalledWith(mockTokens);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('logout', () => {
    it('should clear tokens and dispatch event', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      logout();

      expect(clearAuthTokens).toHaveBeenCalled();
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth:logout',
        })
      );

      dispatchEventSpy.mockRestore();
    });
  });

  describe('createSignMessage', () => {
    it('should create sign message with nonce', () => {
      const nonce = 'abc123';
      const message = createSignMessage(nonce);

      expect(message).toBe('Sign to login: abc123');
    });

    it('should handle different nonce formats', () => {
      expect(createSignMessage('123')).toBe('Sign to login: 123');
      expect(createSignMessage('nonce-with-dashes')).toBe('Sign to login: nonce-with-dashes');
      expect(createSignMessage('')).toBe('Sign to login: ');
    });
  });
});
