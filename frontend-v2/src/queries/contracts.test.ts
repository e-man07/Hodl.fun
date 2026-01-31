import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ethers
vi.mock('ethers', () => ({
  Contract: vi.fn().mockImplementation(() => ({
    getCreatorFees: vi.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 PUSH
  })),
  JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
}));

describe('contracts queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export useCreatorFees hook', async () => {
    const { useCreatorFees } = await import('./contracts');
    expect(useCreatorFees).toBeDefined();
    expect(typeof useCreatorFees).toBe('function');
  });
});
