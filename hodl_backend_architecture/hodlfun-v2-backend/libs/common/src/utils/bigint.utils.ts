/**
 * Utility functions for BigInt operations
 */

/**
 * Safely parse a string to BigInt, returning 0n if invalid
 */
export function safeParseBigInt(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined || value === '') {
    return 0n;
  }

  if (typeof value === 'bigint') {
    return value;
  }

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/**
 * Format BigInt to a readable string with decimals
 */
export function formatBigInt(value: bigint, decimals: number = 18): string {
  const str = value.toString().padStart(decimals + 1, '0');
  const integerPart = str.slice(0, -decimals) || '0';
  const fractionalPart = str.slice(-decimals);
  return `${integerPart}.${fractionalPart}`.replace(/\.?0+$/, '');
}

/**
 * Parse a decimal string to BigInt with specified decimals
 */
export function parseToBigInt(value: string, decimals: number = 18): bigint {
  const [integer, fraction = ''] = value.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integer + paddedFraction);
}

/**
 * Calculate percentage change between two BigInt values
 */
export function calculatePercentageChange(oldValue: bigint, newValue: bigint): number {
  if (oldValue === 0n) {
    return newValue > 0n ? 100 : 0;
  }

  const change = ((newValue - oldValue) * 10000n) / oldValue;
  return Number(change) / 100;
}

/**
 * Compare two BigInt values stored as strings
 */
export function compareBigIntStrings(a: string, b: string): number {
  const bigA = safeParseBigInt(a);
  const bigB = safeParseBigInt(b);

  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}
