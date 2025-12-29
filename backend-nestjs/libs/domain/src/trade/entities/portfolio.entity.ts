import { AggregateRoot } from '@nestjs/cqrs';
import { PortfolioBalanceUpdatedEvent } from '../events/portfolio-balance-updated.event';

/**
 * Portfolio Aggregate Root
 *
 * Represents a user's token holdings across all tokens.
 * Aggregates buy/sell operations into current balances.
 *
 * Portfolio = sum of all token holdings per user
 * Tracks:
 * - Total tokens held per token address
 * - Total spent (PUSH) per token
 * - Average buy price per token
 * - Realized gains/losses from sells
 * - Unrealized gains/losses based on current price
 */
export class Portfolio extends AggregateRoot {
  private id: string;
  private userId: string;
  private holdings: Map<string, {
    tokenAddress: string;
    tokenSymbol: string;
    balance: bigint;
    avgBuyPrice: bigint;
    totalSpent: bigint;
    totalSold: bigint;
    realizedPNL: bigint;
  }>;
  private totalInvestedPUSH: bigint;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(
    id: string,
    userId: string,
    holdings: Map<string, {
      tokenAddress: string;
      tokenSymbol: string;
      balance: bigint;
      avgBuyPrice: bigint;
      totalSpent: bigint;
      totalSold: bigint;
      realizedPNL: bigint;
    }>,
    totalInvestedPUSH: bigint,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super();
    this.id = id;
    this.userId = userId;
    this.holdings = holdings;
    this.totalInvestedPUSH = totalInvestedPUSH;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Create empty portfolio for new user
   */
  static create(userId: string): Portfolio {
    const now = new Date();
    return new Portfolio(
      `${userId}-portfolio`,
      userId,
      new Map(),
      0n,
      now,
      now,
    );
  }

  /**
   * Record a buy transaction
   *
   * Updates:
   * - Balance increased by amountOut
   * - Average buy price updated (FIFO/LIFO logic)
   * - Total spent increased by amountIn
   */
  recordBuy(
    tokenAddress: string,
    tokenSymbol: string,
    amountOutTokens: bigint,
    amountInPUSH: bigint,
    pricePerToken: bigint,
  ): void {
    const holding = this.holdings.get(tokenAddress);

    if (!holding) {
      // First buy of this token
      this.holdings.set(tokenAddress, {
        tokenAddress,
        tokenSymbol,
        balance: amountOutTokens,
        avgBuyPrice: pricePerToken,
        totalSpent: amountInPUSH,
        totalSold: 0n,
        realizedPNL: 0n,
      });
    } else {
      // Update existing holding (weighted average price)
      const newBalance = holding.balance + amountOutTokens;
      const newAvgPrice =
        (holding.avgBuyPrice * holding.balance + pricePerToken * amountOutTokens) /
        newBalance;

      holding.balance = newBalance;
      holding.avgBuyPrice = newAvgPrice;
      holding.totalSpent += amountInPUSH;
    }

    this.totalInvestedPUSH += amountInPUSH;
    this.updatedAt = new Date();

    (this as any).addDomainEvent(
      new PortfolioBalanceUpdatedEvent(
        this.id,
        this.userId,
        tokenAddress,
        'buy',
        amountOutTokens,
        amountInPUSH,
        this.updatedAt,
      ),
    );
  }

  /**
   * Record a sell transaction
   *
   * Updates:
   * - Balance decreased by amountInTokens
   * - Realized PNL updated (proceed - cost basis)
   * - Total sold increased by amountOutPUSH
   */
  recordSell(
    tokenAddress: string,
    amountInTokens: bigint,
    amountOutPUSH: bigint,
  ): void {
    const holding = this.holdings.get(tokenAddress);

    if (!holding || holding.balance < amountInTokens) {
      throw new Error('Insufficient balance for sell');
    }

    const costBasis = holding.avgBuyPrice * amountInTokens;
    const pnl = amountOutPUSH - costBasis;

    holding.balance -= amountInTokens;
    holding.totalSold += amountOutPUSH;
    holding.realizedPNL += pnl;

    // Remove holding if balance is zero
    if (holding.balance === 0n) {
      this.holdings.delete(tokenAddress);
    }

    this.updatedAt = new Date();

    (this as any).addDomainEvent(
      new PortfolioBalanceUpdatedEvent(
        this.id,
        this.userId,
        tokenAddress,
        'sell',
        amountInTokens,
        amountOutPUSH,
        this.updatedAt,
      ),
    );
  }

  /**
   * Get balance of specific token
   */
  getBalance(tokenAddress: string): bigint {
    return this.holdings.get(tokenAddress)?.balance ?? 0n;
  }

  /**
   * Get all holdings
   */
  getHoldings(): Array<{
    tokenAddress: string;
    tokenSymbol: string;
    balance: bigint;
    avgBuyPrice: bigint;
    totalSpent: bigint;
    totalSold: bigint;
    realizedPNL: bigint;
  }> {
    return Array.from(this.holdings.values());
  }

  /**
   * Check if user holds any of this token
   */
  hasBalance(tokenAddress: string): boolean {
    const balance = this.holdings.get(tokenAddress)?.balance ?? 0n;
    return balance > 0n;
  }

  /**
   * Get unrealized PNL for a token at current price
   */
  getUnrealizedPNL(tokenAddress: string, currentPrice: bigint): bigint {
    const holding = this.holdings.get(tokenAddress);
    if (!holding || holding.balance === 0n) {
      return 0n;
    }

    const currentValue = holding.balance * currentPrice;
    const costBasis = holding.balance * holding.avgBuyPrice;
    return currentValue - costBasis;
  }

  /**
   * Get portfolio value at current prices
   */
  getPortfolioValue(tokenPrices: Map<string, bigint>): bigint {
    let totalValue = 0n;

    for (const holding of this.holdings.values()) {
      const currentPrice = tokenPrices.get(holding.tokenAddress) ?? 0n;
      totalValue += holding.balance * currentPrice;
    }

    return totalValue;
  }

  /**
   * Get portfolio summary
   */
  getSummary(tokenPrices: Map<string, bigint>): {
    totalInvested: bigint;
    currentValue: bigint;
    unrealizedPNL: bigint;
    realizedPNL: bigint;
    holdingCount: number;
  } {
    let totalValue = 0n;
    let totalUnrealizedPNL = 0n;
    let totalRealizedPNL = 0n;

    for (const holding of this.holdings.values()) {
      const currentPrice = tokenPrices.get(holding.tokenAddress) ?? 0n;
      totalValue += holding.balance * currentPrice;
      totalUnrealizedPNL += this.getUnrealizedPNL(holding.tokenAddress, currentPrice);
      totalRealizedPNL += holding.realizedPNL;
    }

    return {
      totalInvested: this.totalInvestedPUSH,
      currentValue: totalValue,
      unrealizedPNL: totalUnrealizedPNL,
      realizedPNL: totalRealizedPNL,
      holdingCount: this.holdings.size,
    };
  }

  // === Getters ===

  getId(): string {
    return this.id;
  }

  getUserId(): string {
    return this.userId;
  }

  getTotalInvestedPUSH(): bigint {
    return this.totalInvestedPUSH;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  /**
   * Reconstruct portfolio from database
   */
  static reconstruct(data: {
    id: string;
    userId: string;
    holdings: Array<{
      tokenAddress: string;
      tokenSymbol: string;
      balance: bigint;
      avgBuyPrice: bigint;
      totalSpent: bigint;
      totalSold: bigint;
      realizedPNL: bigint;
    }>;
    totalInvestedPUSH: bigint;
    createdAt: Date;
    updatedAt: Date;
  }): Portfolio {
    const holdingsMap = new Map(
      data.holdings.map((h) => [h.tokenAddress, h]),
    );

    return new Portfolio(
      data.id,
      data.userId,
      holdingsMap,
      data.totalInvestedPUSH,
      data.createdAt,
      data.updatedAt,
    );
  }
}
