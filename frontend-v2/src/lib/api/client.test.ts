import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAccessToken,
  setAuthTokens,
  clearAuthTokens,
  isAuthenticated,
} from './client';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('API Client Auth', () => {
  beforeEach(() => {
    // Reset token cache and localStorage between tests
    clearAuthTokens();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('getAccessToken', () => {
    it('should return null when no token exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(getAccessToken()).toBeNull();
    });

    it('should return token when it exists', () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      expect(getAccessToken()).toBe('test-token');
    });
  });

  describe('setAuthTokens', () => {
    it('should store access and refresh tokens', () => {
      setAuthTokens({ accessToken: 'access-123', refreshToken: 'refresh-456', expiresIn: 3600 });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('hodl_access_token', 'access-123');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('hodl_refresh_token', 'refresh-456');
    });
  });

  describe('clearAuthTokens', () => {
    it('should remove all tokens', () => {
      clearAuthTokens();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hodl_access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hodl_refresh_token');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(isAuthenticated()).toBe(false);
    });

    it('should return true when token exists', () => {
      localStorageMock.getItem.mockReturnValue('some-token');
      expect(isAuthenticated()).toBe(true);
    });
  });
});
