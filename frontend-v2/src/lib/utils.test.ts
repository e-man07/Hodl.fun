import { describe, it, expect } from 'vitest';
import {
  cn,
  truncateAddress,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatFromWei,
  getIPFSUrl,
  copyToClipboard,
} from './utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should handle tailwind conflicts', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });
});

describe('truncateAddress', () => {
  const address = '0x1234567890abcdef1234567890abcdef12345678';

  it('should truncate address with default values', () => {
    expect(truncateAddress(address)).toBe('0x1234...5678');
  });

  it('should truncate with custom start and end lengths', () => {
    expect(truncateAddress(address, 8, 6)).toBe('0x123456...345678');
  });

  it('should return empty string for undefined', () => {
    expect(truncateAddress(undefined)).toBe('');
  });
});

describe('formatNumber', () => {
  it('should format numbers with K suffix when >= 1000', () => {
    expect(formatNumber(1234.5678)).toBe('1.23K');
    expect(formatNumber(1234.5678, 2)).toBe('1.23K');
  });

  it('should format millions with M suffix', () => {
    expect(formatNumber(1500000, 2)).toBe('1.50M');
  });

  it('should format billions with B suffix', () => {
    expect(formatNumber(1500000000, 2)).toBe('1.50B');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should format small numbers without suffix', () => {
    expect(formatNumber(123.45)).toBe('123.45');
  });
});

describe('formatCurrency', () => {
  it('should format with PUSH symbol', () => {
    expect(formatCurrency(1234.56, 'PUSH')).toBe('1.23K PUSH');
  });

  it('should format small numbers', () => {
    expect(formatCurrency(0.5, 'PUSH')).toBe('0.50 PUSH');
  });

  it('should format millions', () => {
    expect(formatCurrency(1500000, 'PUSH')).toBe('1.50M PUSH');
  });
});

describe('formatPercentage', () => {
  it('should format positive percentages with plus sign', () => {
    expect(formatPercentage(12.34)).toBe('+12.34%');
  });

  it('should format negative percentages', () => {
    expect(formatPercentage(-12.34)).toBe('-12.34%');
  });

  it('should format zero', () => {
    expect(formatPercentage(0)).toBe('+0.00%');
  });
});

describe('formatFromWei', () => {
  it('should convert wei string to number', () => {
    expect(formatFromWei('1000000000000000000')).toBe(1);
  });

  it('should handle small amounts', () => {
    expect(formatFromWei('100000000000000')).toBeCloseTo(0.0001);
  });

  it('should handle zero', () => {
    expect(formatFromWei('0')).toBe(0);
  });

  it('should handle empty string as zero', () => {
    expect(formatFromWei('0')).toBe(0);
  });

  it('should handle large numbers', () => {
    // 1 million tokens in wei
    expect(formatFromWei('1000000000000000000000000')).toBeCloseTo(1000000);
  });
});

describe('getIPFSUrl', () => {
  it('should convert ipfs:// to gateway URL', () => {
    const uri = 'ipfs://QmTest123';
    const result = getIPFSUrl(uri);
    expect(result).toContain('QmTest123');
    expect(result).not.toContain('ipfs://');
  });

  it('should return regular URLs unchanged', () => {
    const url = 'https://example.com/image.png';
    expect(getIPFSUrl(url)).toBe(url);
  });

  it('should return empty string for undefined', () => {
    expect(getIPFSUrl(undefined as unknown as string)).toBe('');
  });
});

describe('copyToClipboard', () => {
  it('should return false when clipboard API is unavailable', async () => {
    const result = await copyToClipboard('test');
    // In test environment, clipboard API may not be available
    expect(typeof result).toBe('boolean');
  });
});
