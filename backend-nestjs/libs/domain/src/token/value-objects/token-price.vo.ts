import { ValueObject } from '../../shared/value-object';

/**
 * Token Price Value Object
 *
 * Represents token price in native currency (PUSH)
 * Stored as BigInt to avoid floating point precision issues
 * Display value is scaled by 1e18 on-chain
 */
export class TokenPrice extends ValueObject {
  private constructor(readonly value: bigint) {
    super();
  }

  /**
   * Create from number (will be converted to BigInt scaled by 1e18)
   */
  static fromNumber(price: number): TokenPrice {
    if (price < 0) {
      throw new Error('Price cannot be negative');
    }
    const scaled = BigInt(Math.floor(price * 1e18));
    return new TokenPrice(scaled);
  }

  /**
   * Create from BigInt (assumed to be scaled by 1e18)
   */
  static fromBigInt(price: bigint): TokenPrice {
    if (price < 0n) {
      throw new Error('Price cannot be negative');
    }
    return new TokenPrice(price);
  }

  /**
   * Create from string (assumed to be scaled by 1e18)
   */
  static fromString(price: string): TokenPrice {
    try {
      const bigint = BigInt(price);
      if (bigint < 0n) {
        throw new Error('Price cannot be negative');
      }
      return new TokenPrice(bigint);
    } catch {
      throw new Error(`Invalid price format: ${price}`);
    }
  }

  /**
   * Get price as number (scaled down from 1e18)
   * May lose precision for very large or small numbers
   */
  toNumber(): number {
    return Number(this.value) / 1e18;
  }

  /**
   * Get price as string (in wei units, scaled by 1e18)
   */
  toString(): string {
    return this.value.toString();
  }

  /**
   * Get BigInt representation (raw on-chain value)
   */
  toBigInt(): bigint {
    return this.value;
  }

  /**
   * Check if price is zero
   */
  isZero(): boolean {
    return this.value === 0n;
  }

  /**
   * Check equality with another TokenPrice
   */
  equals(other: TokenPrice): boolean {
    if (!(other instanceof TokenPrice)) {
      return false;
    }
    return this.value === other.value;
  }

  /**
   * Check if this price is greater than another
   */
  isGreaterThan(other: TokenPrice): boolean {
    return this.value > other.value;
  }

  /**
   * Check if this price is less than another
   */
  isLessThan(other: TokenPrice): boolean {
    return this.value < other.value;
  }

  /**
   * Multiply price by a scalar
   */
  multiply(scalar: number): TokenPrice {
    const result = BigInt(Math.floor(Number(this.value) * scalar));
    return new TokenPrice(result);
  }

  /**
   * Divide price by a scalar
   */
  divide(scalar: number): TokenPrice {
    if (scalar === 0) {
      throw new Error('Cannot divide by zero');
    }
    const result = this.value / BigInt(Math.floor(scalar));
    return new TokenPrice(result);
  }
}
