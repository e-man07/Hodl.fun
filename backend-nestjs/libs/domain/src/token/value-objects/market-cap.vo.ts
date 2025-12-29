import { ValueObject } from '../../shared/value-object';

/**
 * Market Cap Value Object
 *
 * Represents market cap in native currency (PUSH)
 * Calculated as: (tokenSupply / 1e18) * pricePerToken
 * Stored as BigInt for precision
 */
export class MarketCap extends ValueObject {
  private constructor(readonly value: bigint) {
    super();
  }

  /**
   * Create from number
   */
  static fromNumber(marketCap: number): MarketCap {
    if (marketCap < 0) {
      throw new Error('Market cap cannot be negative');
    }
    const scaled = BigInt(Math.floor(marketCap * 1e18));
    return new MarketCap(scaled);
  }

  /**
   * Create from BigInt (assumed to be scaled by 1e18)
   */
  static fromBigInt(marketCap: bigint): MarketCap {
    if (marketCap < 0n) {
      throw new Error('Market cap cannot be negative');
    }
    return new MarketCap(marketCap);
  }

  /**
   * Create from string
   */
  static fromString(marketCap: string): MarketCap {
    try {
      const bigint = BigInt(marketCap);
      if (bigint < 0n) {
        throw new Error('Market cap cannot be negative');
      }
      return new MarketCap(bigint);
    } catch (error) {
      throw new Error(`Invalid market cap format: ${marketCap}`);
    }
  }

  /**
   * Get market cap as number (scaled down from 1e18)
   */
  toNumber(): number {
    return Number(this.value) / 1e18;
  }

  /**
   * Get market cap as string
   */
  toString(): string {
    return this.value.toString();
  }

  /**
   * Get BigInt representation
   */
  toBigInt(): bigint {
    return this.value;
  }

  /**
   * Check if market cap is zero
   */
  isZero(): boolean {
    return this.value === 0n;
  }

  /**
   * Check equality
   */
  equals(other: MarketCap): boolean {
    if (!(other instanceof MarketCap)) {
      return false;
    }
    return this.value === other.value;
  }

  /**
   * Check if this market cap is greater than another
   */
  isGreaterThan(other: MarketCap): boolean {
    return this.value > other.value;
  }

  /**
   * Check if this market cap is greater than or equal to another
   */
  isGreaterThanOrEqual(other: MarketCap): boolean {
    return this.value >= other.value;
  }

  /**
   * Check if this market cap is less than another
   */
  isLessThan(other: MarketCap): boolean {
    return this.value < other.value;
  }

  /**
   * Check if market cap exceeds a threshold (e.g., 100 ETH for graduation)
   */
  exceedsThreshold(threshold: number): boolean {
    const thresholdBigInt = BigInt(Math.floor(threshold * 1e18));
    return this.value >= thresholdBigInt;
  }
}
