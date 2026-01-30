/**
 * BigInt Utils Unit Tests
 * Tests for BigInt operations used throughout the application
 */
import {
  safeParseBigInt,
  formatBigInt,
  parseToBigInt,
  calculatePercentageChange,
  compareBigIntStrings,
} from '../../utils/bigint.utils';

describe('BigInt Utils', () => {
  describe('safeParseBigInt', () => {
    it('should parse a valid string to BigInt', () => {
      expect(safeParseBigInt('123456789')).toBe(123456789n);
    });

    it('should parse a large number string', () => {
      expect(safeParseBigInt('1000000000000000000')).toBe(1000000000000000000n);
    });

    it('should return the BigInt as-is if already BigInt', () => {
      expect(safeParseBigInt(123n)).toBe(123n);
    });

    it('should parse a number to BigInt', () => {
      expect(safeParseBigInt(123)).toBe(123n);
    });

    it('should return 0n for null', () => {
      expect(safeParseBigInt(null)).toBe(0n);
    });

    it('should return 0n for undefined', () => {
      expect(safeParseBigInt(undefined)).toBe(0n);
    });

    it('should return 0n for empty string', () => {
      expect(safeParseBigInt('')).toBe(0n);
    });

    it('should return 0n for invalid string', () => {
      expect(safeParseBigInt('invalid')).toBe(0n);
    });

    it('should return 0n for floating point string', () => {
      expect(safeParseBigInt('123.456')).toBe(0n);
    });

    it('should handle negative numbers', () => {
      expect(safeParseBigInt('-123')).toBe(-123n);
    });

    it('should handle string with leading zeros', () => {
      expect(safeParseBigInt('000123')).toBe(123n);
    });
  });

  describe('formatBigInt', () => {
    it('should format 1 ether (18 decimals) correctly', () => {
      expect(formatBigInt(1000000000000000000n, 18)).toBe('1');
    });

    it('should format 0.5 ether correctly', () => {
      expect(formatBigInt(500000000000000000n, 18)).toBe('0.5');
    });

    it('should format small amounts correctly', () => {
      expect(formatBigInt(1000000000000000n, 18)).toBe('0.001');
    });

    it('should format zero correctly', () => {
      expect(formatBigInt(0n, 18)).toBe('0');
    });

    it('should handle different decimal places', () => {
      expect(formatBigInt(1000000n, 6)).toBe('1');
    });

    it('should format large amounts correctly', () => {
      expect(formatBigInt(1234567890123456789012345n, 18)).toBe('1234567.890123456789012345');
    });

    it('should trim trailing zeros', () => {
      expect(formatBigInt(1000000000000000000n, 18)).toBe('1');
      expect(formatBigInt(1100000000000000000n, 18)).toBe('1.1');
    });

    it('should handle amounts smaller than 1 unit', () => {
      expect(formatBigInt(123456789n, 18)).toBe('0.000000000123456789');
    });

    it('should use 18 decimals by default', () => {
      expect(formatBigInt(1000000000000000000n)).toBe('1');
    });
  });

  describe('parseToBigInt', () => {
    it('should parse 1 ether correctly', () => {
      expect(parseToBigInt('1', 18)).toBe(1000000000000000000n);
    });

    it('should parse decimal amounts correctly', () => {
      expect(parseToBigInt('0.5', 18)).toBe(500000000000000000n);
    });

    it('should parse small decimal amounts', () => {
      expect(parseToBigInt('0.001', 18)).toBe(1000000000000000n);
    });

    it('should handle no decimal part', () => {
      expect(parseToBigInt('100', 18)).toBe(100000000000000000000n);
    });

    it('should handle different decimal places', () => {
      expect(parseToBigInt('1', 6)).toBe(1000000n);
    });

    it('should truncate extra decimal places', () => {
      expect(parseToBigInt('1.1234567890123456789999', 18)).toBe(1123456789012345678n);
    });

    it('should pad insufficient decimal places', () => {
      expect(parseToBigInt('1.5', 18)).toBe(1500000000000000000n);
    });

    it('should use 18 decimals by default', () => {
      expect(parseToBigInt('1')).toBe(1000000000000000000n);
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate positive percentage change', () => {
      expect(calculatePercentageChange(100n, 150n)).toBe(50);
    });

    it('should calculate negative percentage change', () => {
      expect(calculatePercentageChange(100n, 50n)).toBe(-50);
    });

    it('should calculate zero percentage change', () => {
      expect(calculatePercentageChange(100n, 100n)).toBe(0);
    });

    it('should return 100 when old value is 0 and new value is positive', () => {
      expect(calculatePercentageChange(0n, 100n)).toBe(100);
    });

    it('should return 0 when both values are 0', () => {
      expect(calculatePercentageChange(0n, 0n)).toBe(0);
    });

    it('should handle large values accurately', () => {
      const old = 1000000000000000000n;
      const newVal = 1100000000000000000n;
      expect(calculatePercentageChange(old, newVal)).toBe(10);
    });

    it('should handle small percentage changes', () => {
      expect(calculatePercentageChange(10000n, 10001n)).toBe(0.01);
    });

    it('should handle 100% loss (from non-zero to zero)', () => {
      expect(calculatePercentageChange(100n, 0n)).toBe(-100);
    });

    it('should handle large gains', () => {
      expect(calculatePercentageChange(100n, 1000n)).toBe(900);
    });
  });

  describe('compareBigIntStrings', () => {
    it('should return -1 when a < b', () => {
      expect(compareBigIntStrings('100', '200')).toBe(-1);
    });

    it('should return 1 when a > b', () => {
      expect(compareBigIntStrings('200', '100')).toBe(1);
    });

    it('should return 0 when a equals b', () => {
      expect(compareBigIntStrings('100', '100')).toBe(0);
    });

    it('should handle large numbers', () => {
      expect(compareBigIntStrings('1000000000000000000', '999999999999999999')).toBe(1);
    });

    it('should handle null/undefined values (treating as 0)', () => {
      expect(compareBigIntStrings(null as unknown as string, '100')).toBe(-1);
      expect(compareBigIntStrings('100', null as unknown as string)).toBe(1);
    });

    it('should handle empty strings (treating as 0)', () => {
      expect(compareBigIntStrings('', '100')).toBe(-1);
      expect(compareBigIntStrings('100', '')).toBe(1);
      expect(compareBigIntStrings('', '')).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(compareBigIntStrings('-100', '100')).toBe(-1);
      expect(compareBigIntStrings('-100', '-200')).toBe(1);
    });
  });
});
