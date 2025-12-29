import { ValueObject } from '../../shared/value-object';

/**
 * Reserve Balance Value Object
 *
 * Represents reserves for bonding curve pricing
 * Includes both real and virtual reserves
 *
 * Bonding curve formula: x * y = k
 * Where x = totalNativeReserve, y = totalTokenReserve, k = constant product
 * Total = Real + Virtual
 */
export class ReserveBalance extends ValueObject {
  private constructor(
    readonly realNativeReserve: bigint,
    readonly realTokenReserve: bigint,
    readonly virtualNativeReserve: bigint,
    readonly virtualTokenReserve: bigint,
  ) {
    super();
  }

  /**
   * Create new ReserveBalance
   */
  static create(
    realNativeReserve: bigint,
    realTokenReserve: bigint,
    virtualNativeReserve: bigint,
    virtualTokenReserve: bigint,
  ): ReserveBalance {
    if (realNativeReserve < 0n || realTokenReserve < 0n) {
      throw new Error('Real reserves cannot be negative');
    }
    if (virtualNativeReserve < 0n || virtualTokenReserve < 0n) {
      throw new Error('Virtual reserves cannot be negative');
    }
    return new ReserveBalance(
      realNativeReserve,
      realTokenReserve,
      virtualNativeReserve,
      virtualTokenReserve,
    );
  }

  /**
   * Get total native reserve (real + virtual)
   */
  getTotalNativeReserve(): bigint {
    return this.realNativeReserve + this.virtualNativeReserve;
  }

  /**
   * Get total token reserve (real + virtual)
   */
  getTotalTokenReserve(): bigint {
    return this.realTokenReserve + this.virtualTokenReserve;
  }

  /**
   * Calculate constant product k = x * y
   */
  getK(): bigint {
    return this.getTotalNativeReserve() * this.getTotalTokenReserve();
  }

  /**
   * Add native reserve (for buy operation)
   */
  addNativeReserve(amount: bigint): ReserveBalance {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    return new ReserveBalance(
      this.realNativeReserve + amount,
      this.realTokenReserve,
      this.virtualNativeReserve,
      this.virtualTokenReserve,
    );
  }

  /**
   * Remove token reserve (for buy operation)
   */
  removeTokenReserve(amount: bigint): ReserveBalance {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    const newTokenReserve = this.realTokenReserve - amount;
    if (newTokenReserve < 0n) {
      throw new Error('Insufficient token reserve');
    }
    return new ReserveBalance(
      this.realNativeReserve,
      newTokenReserve,
      this.virtualNativeReserve,
      this.virtualTokenReserve,
    );
  }

  /**
   * Remove native reserve (for sell operation)
   */
  removeNativeReserve(amount: bigint): ReserveBalance {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    const newNativeReserve = this.realNativeReserve - amount;
    if (newNativeReserve < 0n) {
      throw new Error('Insufficient native reserve');
    }
    return new ReserveBalance(
      newNativeReserve,
      this.realTokenReserve,
      this.virtualNativeReserve,
      this.virtualTokenReserve,
    );
  }

  /**
   * Add token reserve (for sell operation)
   */
  addTokenReserve(amount: bigint): ReserveBalance {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    return new ReserveBalance(
      this.realNativeReserve,
      this.realTokenReserve + amount,
      this.virtualNativeReserve,
      this.virtualTokenReserve,
    );
  }

  /**
   * Check equality
   */
  equals(other: ReserveBalance): boolean {
    if (!(other instanceof ReserveBalance)) {
      return false;
    }
    return (
      this.realNativeReserve === other.realNativeReserve &&
      this.realTokenReserve === other.realTokenReserve &&
      this.virtualNativeReserve === other.virtualNativeReserve &&
      this.virtualTokenReserve === other.virtualTokenReserve
    );
  }
}
