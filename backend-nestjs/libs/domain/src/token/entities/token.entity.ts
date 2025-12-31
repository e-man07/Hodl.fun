import { AggregateRoot } from '@nestjs/cqrs';
import { TokenAddress } from '../value-objects/token-address.vo';
import { TokenPrice } from '../value-objects/token-price.vo';
import { MarketCap } from '../value-objects/market-cap.vo';
import { ReserveBalance } from '../value-objects/reserve-balance.vo';
import { TokenCreatedEvent } from '../events/token-created.event';
import { TokenMetricsUpdatedEvent } from '../events/token-metrics-updated.event';
import { TokenLockedEvent } from '../events/token-locked.event';
import { TokenListedEvent } from '../events/token-listed.event';
import { NewATHPriceEvent } from '../events/new-ath-price.event';
import { NewATHMarketCapEvent } from '../events/new-ath-market-cap.event';

/**
 * Token Aggregate Root
 *
 * Represents a token in the bonding curve marketplace.
 * Enforces business rules and publishes domain events.
 *
 * Bonding Curve Formula: x * y = k
 * Where x = totalNativeReserve, y = totalTokenReserve, k = constant product
 * Virtual reserves are used for initial price discovery
 * Real reserves accumulate as users buy/sell tokens
 */
export class Token extends AggregateRoot {
  private id: string;
  private address: TokenAddress;
  private curveAddress: string | null; // Bonding curve contract address
  private name: string;
  private symbol: string;
  private creator: string;
  private decimals: number;
  private totalSupply: bigint;
  private reserveBalance: ReserveBalance;
  private currentPrice: TokenPrice;
  private marketCap: MarketCap;
  private athPrice: TokenPrice;
  private athMarketCap: MarketCap;
  private athPriceTimestamp: Date;
  private athMarketCapTimestamp: Date;
  private isLocked: boolean;
  private isListed: boolean;
  private uniswapV3Pool: string | null;
  private listingTimestamp: Date | null;
  private createdAt: Date;
  private updatedAt: Date;
  private graduationThreshold: MarketCap;

  private constructor(
    id: string,
    address: TokenAddress,
    curveAddress: string | null,
    name: string,
    symbol: string,
    creator: string,
    decimals: number,
    totalSupply: bigint,
    reserveBalance: ReserveBalance,
    currentPrice: TokenPrice,
    marketCap: MarketCap,
    athPrice: TokenPrice,
    athMarketCap: MarketCap,
    athPriceTimestamp: Date,
    athMarketCapTimestamp: Date,
    isLocked: boolean,
    isListed: boolean,
    uniswapV3Pool: string | null,
    listingTimestamp: Date | null,
    createdAt: Date,
    updatedAt: Date,
    graduationThreshold: MarketCap,
  ) {
    super();
    this.id = id;
    this.address = address;
    this.curveAddress = curveAddress;
    this.name = name;
    this.symbol = symbol;
    this.creator = creator;
    this.decimals = decimals;
    this.totalSupply = totalSupply;
    this.reserveBalance = reserveBalance;
    this.currentPrice = currentPrice;
    this.marketCap = marketCap;
    this.athPrice = athPrice;
    this.athMarketCap = athMarketCap;
    this.athPriceTimestamp = athPriceTimestamp;
    this.athMarketCapTimestamp = athMarketCapTimestamp;
    this.isLocked = isLocked;
    this.isListed = isListed;
    this.uniswapV3Pool = uniswapV3Pool;
    this.listingTimestamp = listingTimestamp;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.graduationThreshold = graduationThreshold;
  }

  /**
   * Create a new token when first created (from blockchain event)
   *
   * Initial state:
   * - Virtual reserves set for price discovery
   * - Real reserves are zero
   * - Price calculated from virtual reserves: price = virtualNative / virtualToken
   * - Not locked, not listed on Uniswap
   */
  static create(
    id: string,
    address: TokenAddress,
    curveAddress: string,
    name: string,
    symbol: string,
    creator: string,
    decimals: number,
    totalSupply: bigint,
    virtualNativeReserve: bigint,
    virtualTokenReserve: bigint,
  ): Token {
    const reserveBalance = ReserveBalance.create(
      0n, // realNativeReserve
      0n, // realTokenReserve
      virtualNativeReserve,
      virtualTokenReserve,
    );

    // Initial price from virtual reserves
    const initialPrice = TokenPrice.fromBigInt(
      virtualNativeReserve / virtualTokenReserve,
    );

    // Initial market cap from virtual state
    const initialMarketCap = MarketCap.fromBigInt(
      (totalSupply / BigInt(10 ** decimals)) * (virtualNativeReserve / virtualTokenReserve),
    );

    // Graduation threshold: 1,000,000 PUSH (1M PUSH for Uniswap graduation)
    const graduationThreshold = MarketCap.fromNumber(1_000_000);

    const now = new Date();

    const token = new Token(
      id,
      address,
      curveAddress,
      name,
      symbol,
      creator,
      decimals,
      totalSupply,
      reserveBalance,
      initialPrice,
      initialMarketCap,
      initialPrice, // athPrice starts as initial price
      initialMarketCap, // athMarketCap starts as initial market cap
      now, // athPriceTimestamp
      now, // athMarketCapTimestamp
      false, // not locked
      false, // not listed
      null, // no Uniswap V3 pool
      null, // no listing timestamp
      now,
      now,
      graduationThreshold,
    );

    token.apply(
      new TokenCreatedEvent(
        id,
        address.toString(),
        name,
        symbol,
        creator,
        initialPrice.toBigInt(),
        initialMarketCap.toBigInt(),
        now,
      ),
    );

    return token;
  }

  /**
   * Execute a buy operation using bonding curve formula
   *
   * Input: amount of native token (PUSH) to spend
   * Output: amount of tokens received (calculated from x*y=k)
   * Effect: real native reserves increase, real token reserves decrease
   */
  executeBuy(
    amountIn: bigint,
  ): {
    amountOut: bigint;
    newPrice: TokenPrice;
    newReserveBalance: ReserveBalance;
  } {
    if (this.isLocked) {
      throw new Error('Token is locked and cannot be traded');
    }

    if (amountIn <= 0n) {
      throw new Error('Amount must be positive');
    }

    const currentReserves = this.reserveBalance;
    const k = currentReserves.getK();

    // Bonding curve: x * y = k
    // (x + dx) * (y - dy) = k
    // dy = y - k / (x + dx)
    const newNativeReserve = currentReserves.getTotalNativeReserve() + amountIn;
    const newTokenReserve = k / newNativeReserve;
    const amountOut = currentReserves.getTotalTokenReserve() - newTokenReserve;

    if (amountOut <= 0n) {
      throw new Error('Invalid buy amount: would result in zero or negative output');
    }

    // Create new reserve state
    let newReserveBalance = this.reserveBalance.addNativeReserve(amountIn);
    newReserveBalance = newReserveBalance.removeTokenReserve(amountOut);

    // Calculate new price
    const newPrice = TokenPrice.fromBigInt(newNativeReserve / newTokenReserve);

    return {
      amountOut,
      newPrice,
      newReserveBalance,
    };
  }

  /**
   * Execute a sell operation using bonding curve formula
   *
   * Input: amount of tokens to sell
   * Output: amount of native tokens (PUSH) received
   * Effect: real token reserves increase, real native reserves decrease
   */
  executeSell(
    amountIn: bigint,
  ): {
    amountOut: bigint;
    newPrice: TokenPrice;
    newReserveBalance: ReserveBalance;
  } {
    if (this.isLocked) {
      throw new Error('Token is locked and cannot be traded');
    }

    if (amountIn <= 0n) {
      throw new Error('Amount must be positive');
    }

    const currentReserves = this.reserveBalance;
    const k = currentReserves.getK();

    // Bonding curve: x * y = k
    // (x - dx) * (y + dy) = k
    // dx = x - k / (y + dy)
    const newTokenReserve = currentReserves.getTotalTokenReserve() + amountIn;
    const newNativeReserve = k / newTokenReserve;
    const amountOut = currentReserves.getTotalNativeReserve() - newNativeReserve;

    if (amountOut <= 0n) {
      throw new Error('Invalid sell amount: would result in zero or negative output');
    }

    // Create new reserve state
    let newReserveBalance = this.reserveBalance.addTokenReserve(amountIn);
    newReserveBalance = newReserveBalance.removeNativeReserve(amountOut);

    // Calculate new price
    const newPrice = TokenPrice.fromBigInt(newNativeReserve / newTokenReserve);

    return {
      amountOut,
      newPrice,
      newReserveBalance,
    };
  }

  /**
   * Update token metrics after a trade or blockchain sync
   *
   * Effects:
   * - Update current price and market cap
   * - Track all-time high (ATH) price and market cap
   * - Publish metric update event
   */
  updateMetrics(
    newPrice: TokenPrice,
    newMarketCap: MarketCap,
    newReserveBalance: ReserveBalance,
  ): void {
    const now = new Date();
    let athPriceUpdated = false;
    let athMarketCapUpdated = false;

    // Update current values
    this.currentPrice = newPrice;
    this.marketCap = newMarketCap;
    this.reserveBalance = newReserveBalance;
    this.updatedAt = now;

    // Track ATH price
    if (newPrice.isGreaterThan(this.athPrice)) {
      this.athPrice = newPrice;
      this.athPriceTimestamp = now;
      athPriceUpdated = true;
      this.apply(
        new NewATHPriceEvent(
          this.id,
          this.address.toString(),
          newPrice.toBigInt(),
          now,
        ),
      );
    }

    // Track ATH market cap
    if (newMarketCap.isGreaterThan(this.athMarketCap)) {
      this.athMarketCap = newMarketCap;
      this.athMarketCapTimestamp = now;
      athMarketCapUpdated = true;
      this.apply(
        new NewATHMarketCapEvent(
          this.id,
          this.address.toString(),
          newMarketCap.toBigInt(),
          now,
        ),
      );
    }

    // Always publish metric update event
    this.apply(
      new TokenMetricsUpdatedEvent(
        this.id,
        this.address.toString(),
        newPrice.toBigInt(),
        newMarketCap.toBigInt(),
        newReserveBalance.getTotalNativeReserve(),
        newReserveBalance.getTotalTokenReserve(),
        athPriceUpdated,
        athMarketCapUpdated,
        now,
      ),
    );
  }

  /**
   * Lock the token (transition to Uniswap graduation)
   *
   * Once locked, token cannot be traded on bonding curve anymore.
   * Typically called when market cap reaches graduation threshold.
   */
  lock(): void {
    if (this.isLocked) {
      throw new Error('Token is already locked');
    }

    this.isLocked = true;
    this.updatedAt = new Date();

    this.apply(
      new TokenLockedEvent(
        this.id,
        this.address.toString(),
        new Date(),
      ),
    );
  }

  /**
   * List token on Uniswap V3 after graduation
   *
   * Records the Uniswap V3 pool address and listing timestamp.
   * Token can no longer be traded on bonding curve.
   */
  listOnUniswapV3(poolAddress: string): void {
    if (!this.isLocked) {
      throw new Error('Token must be locked before listing on Uniswap');
    }

    if (this.isListed) {
      throw new Error('Token is already listed');
    }

    const now = new Date();
    this.uniswapV3Pool = poolAddress.toLowerCase();
    this.isListed = true;
    this.listingTimestamp = now;
    this.updatedAt = now;

    this.apply(
      new TokenListedEvent(
        this.id,
        this.address.toString(),
        poolAddress,
        now,
      ),
    );
  }

  /**
   * Get graduation progress (0-100)
   *
   * Returns percentage of graduation threshold reached.
   * When >= 100, token is eligible for Uniswap graduation.
   */
  getGraduationProgress(): number {
    if (this.graduationThreshold.toBigInt() === 0n) {
      return 100;
    }

    const currentBigInt = this.marketCap.toBigInt();
    const thresholdBigInt = this.graduationThreshold.toBigInt();

    if (currentBigInt >= thresholdBigInt) {
      return 100;
    }

    const progress = (Number(currentBigInt) / Number(thresholdBigInt)) * 100;
    return Math.floor(progress);
  }

  /**
   * Check if token is ready for Uniswap graduation
   */
  isReadyForGraduation(): boolean {
    return !this.isLocked && this.marketCap.isGreaterThanOrEqual(this.graduationThreshold);
  }

  // === Getters ===

  getId(): string {
    return this.id;
  }

  getAddress(): TokenAddress {
    return this.address;
  }

  getCurveAddress(): string | null {
    return this.curveAddress;
  }

  setCurveAddress(curveAddress: string): void {
    this.curveAddress = curveAddress.toLowerCase();
    this.updatedAt = new Date();
  }

  getName(): string {
    return this.name;
  }

  getSymbol(): string {
    return this.symbol;
  }

  getCreator(): string {
    return this.creator;
  }

  getDecimals(): number {
    return this.decimals;
  }

  getTotalSupply(): bigint {
    return this.totalSupply;
  }

  getReserveBalance(): ReserveBalance {
    return this.reserveBalance;
  }

  getCurrentPrice(): TokenPrice {
    return this.currentPrice;
  }

  getMarketCap(): MarketCap {
    return this.marketCap;
  }

  getATHPrice(): TokenPrice {
    return this.athPrice;
  }

  getATHMarketCap(): MarketCap {
    return this.athMarketCap;
  }

  getATHPriceTimestamp(): Date {
    return this.athPriceTimestamp;
  }

  getATHMarketCapTimestamp(): Date {
    return this.athMarketCapTimestamp;
  }

  getIsLocked(): boolean {
    return this.isLocked;
  }

  getIsListed(): boolean {
    return this.isListed;
  }

  getUniswapV3Pool(): string | null {
    return this.uniswapV3Pool;
  }

  getListingTimestamp(): Date | null {
    return this.listingTimestamp;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  getGraduationThreshold(): MarketCap {
    return this.graduationThreshold;
  }

  /**
   * Reconstruct token from database (hydration)
   *
   * Used by repository when loading from persistence.
   */
  static reconstruct(data: {
    id: string;
    address: string;
    curveAddress: string | null;
    name: string;
    symbol: string;
    creator: string;
    decimals: number;
    totalSupply: bigint;
    realNativeReserve: bigint;
    realTokenReserve: bigint;
    virtualNativeReserve: bigint;
    virtualTokenReserve: bigint;
    currentPrice: bigint;
    marketCap: bigint;
    athPrice: bigint;
    athMarketCap: bigint;
    athPriceTimestamp: Date;
    athMarketCapTimestamp: Date;
    isLocked: boolean;
    isListed: boolean;
    uniswapV3Pool: string | null;
    listingTimestamp: Date | null;
    createdAt: Date;
    updatedAt: Date;
    graduationThresholdValue: bigint;
  }): Token {
    const reserveBalance = ReserveBalance.create(
      data.realNativeReserve,
      data.realTokenReserve,
      data.virtualNativeReserve,
      data.virtualTokenReserve,
    );

    return new Token(
      data.id,
      TokenAddress.create(data.address),
      data.curveAddress,
      data.name,
      data.symbol,
      data.creator,
      data.decimals,
      data.totalSupply,
      reserveBalance,
      TokenPrice.fromBigInt(data.currentPrice),
      MarketCap.fromBigInt(data.marketCap),
      TokenPrice.fromBigInt(data.athPrice),
      MarketCap.fromBigInt(data.athMarketCap),
      data.athPriceTimestamp,
      data.athMarketCapTimestamp,
      data.isLocked,
      data.isListed,
      data.uniswapV3Pool,
      data.listingTimestamp,
      data.createdAt,
      data.updatedAt,
      MarketCap.fromBigInt(data.graduationThresholdValue),
    );
  }
}
