import { ValueObject } from '../../shared/value-object';

/**
 * Token Address Value Object
 *
 * Represents an Ethereum/blockchain address with validation
 * Immutable and comparable
 */
export class TokenAddress extends ValueObject {
  private constructor(readonly value: string) {
    super();
    this.validate(value);
  }

  /**
   * Create a new TokenAddress with validation
   */
  static create(address: string): TokenAddress {
    return new TokenAddress(address.toLowerCase());
  }

  /**
   * Validate address format (must be valid Ethereum address)
   */
  private validate(address: string): void {
    // Check if it's a valid Ethereum address format (0x followed by 40 hex characters)
    if (!address.match(/^0x[a-f0-9]{40}$/i)) {
      throw new Error(`Invalid token address: ${address}`);
    }
  }

  /**
   * Check equality with another TokenAddress
   */
  equals(other: TokenAddress): boolean {
    if (!(other instanceof TokenAddress)) {
      return false;
    }
    return this.value === other.value;
  }

  /**
   * Get address string representation
   */
  toString(): string {
    return this.value;
  }
}
