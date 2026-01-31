import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isIPFSConfigured, uploadTokenMetadata } from './upload';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IPFS Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isIPFSConfigured', () => {
    it('should return false when PINATA_JWT is not set', () => {
      // By default in test env, PINATA_JWT won't be set
      expect(isIPFSConfigured()).toBe(false);
    });
  });

  describe('uploadTokenMetadata', () => {
    it('should return data URI when IPFS not configured', async () => {
      const metadata = {
        name: 'Test Token',
        symbol: 'TEST',
        description: 'A test token',
      };

      const result = await uploadTokenMetadata(metadata);

      expect(result).toContain('data:application/json;base64,');

      // Decode and verify
      const base64 = result.replace('data:application/json;base64,', '');
      const decoded = JSON.parse(atob(base64));
      expect(decoded.name).toBe('Test Token');
      expect(decoded.symbol).toBe('TEST');
      expect(decoded.description).toBe('A test token');
      expect(decoded.image).toBe('');
    });

    it('should handle metadata without description', async () => {
      const metadata = {
        name: 'Test',
        symbol: 'T',
      };

      const result = await uploadTokenMetadata(metadata);
      expect(result).toContain('data:application/json;base64,');
    });
  });
});
