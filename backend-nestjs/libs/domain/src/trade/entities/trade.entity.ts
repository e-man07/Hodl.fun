import { Entity } from '../../shared/entity';

/**
 * Trade Entity
 *
 * Represents a single buy or sell transaction on the bonding curve.
 * Immutable record of what happened - entities have identity but can't be changed.
 *
 * Properties:
 * - id: Unique transaction identifier (blockchain tx hash or UUID)
 * - tokenId: Reference to token aggregate
 * - type: 'buy' or 'sell' operation
 * - user: Address of user executing trade
 * - amountIn: Amount of input (PUSH for buy, tokens for sell)
 * - amountOut: Amount of output (tokens for buy, PUSH for sell)
 * - pricePerToken: Execution price
 * - totalValue: Total transaction value in PUSH
 * - transactionHash: Blockchain transaction hash
 * - blockNumber: Block where transaction occurred
 * - timestamp: When trade executed
 */
export class Trade extends Entity<{
  tokenId: string;
  type: 'buy' | 'sell';
  user: string;
  amountIn: bigint;
  amountOut: bigint;
  pricePerToken: bigint;
  totalValue: bigint;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
}> {
  private constructor(
    id: string,
    readonly tokenId: string,
    readonly type: 'buy' | 'sell',
    readonly user: string,
    readonly amountIn: bigint,
    readonly amountOut: bigint,
    readonly pricePerToken: bigint,
    readonly totalValue: bigint,
    readonly transactionHash: string,
    readonly blockNumber: number,
    readonly timestamp: Date,
  ) {
    super(
      {
        tokenId,
        type,
        user,
        amountIn,
        amountOut,
        pricePerToken,
        totalValue,
        transactionHash,
        blockNumber,
        timestamp,
      },
      id,
    );
  }

  /**
   * Create a new buy trade
   */
  static createBuy(
    id: string,
    tokenId: string,
    user: string,
    amountInPUSH: bigint, // amount of PUSH spent
    amountOutTokens: bigint, // amount of tokens received
    pricePerToken: bigint,
    transactionHash: string,
    blockNumber: number,
    timestamp: Date,
  ): Trade {
    if (amountInPUSH <= 0n || amountOutTokens <= 0n) {
      throw new Error('Trade amounts must be positive');
    }

    return new Trade(
      id,
      tokenId,
      'buy',
      user,
      amountInPUSH,
      amountOutTokens,
      pricePerToken,
      amountInPUSH, // totalValue = amount in for buy
      transactionHash,
      blockNumber,
      timestamp,
    );
  }

  /**
   * Create a new sell trade
   */
  static createSell(
    id: string,
    tokenId: string,
    user: string,
    amountInTokens: bigint, // amount of tokens sold
    amountOutPUSH: bigint, // amount of PUSH received
    pricePerToken: bigint,
    transactionHash: string,
    blockNumber: number,
    timestamp: Date,
  ): Trade {
    if (amountInTokens <= 0n || amountOutPUSH <= 0n) {
      throw new Error('Trade amounts must be positive');
    }

    return new Trade(
      id,
      tokenId,
      'sell',
      user,
      amountInTokens,
      amountOutPUSH,
      pricePerToken,
      amountOutPUSH, // totalValue = amount out for sell
      transactionHash,
      blockNumber,
      timestamp,
    );
  }

  /**
   * Calculate slippage percentage (0-100)
   * For buy: expected price vs actual price paid
   * For sell: expected price vs actual price received
   */
  getSlippage(expectedPrice: bigint): number {
    if (this.pricePerToken === 0n) {
      return 0;
    }

    const slippage = this.pricePerToken > expectedPrice
      ? ((Number(this.pricePerToken - expectedPrice) / Number(expectedPrice)) * 100)
      : ((Number(expectedPrice - this.pricePerToken) / Number(expectedPrice)) * 100);

    return Math.max(0, Math.min(100, slippage)); // Clamp to 0-100
  }

  /**
   * Check if trade is old (for archiving/cleanup purposes)
   */
  isOlderThan(days: number): boolean {
    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - days);
    return this.timestamp < cutoffTime;
  }

  /**
   * Get trade summary for display
   */
  getSummary(): {
    type: 'buy' | 'sell';
    amountIn: bigint;
    amountOut: bigint;
    pricePerToken: bigint;
    timestamp: Date;
  } {
    return {
      type: this.type,
      amountIn: this.amountIn,
      amountOut: this.amountOut,
      pricePerToken: this.pricePerToken,
      timestamp: this.timestamp,
    };
  }

  /**
   * Reconstruct trade from database
   */
  static reconstruct(data: {
    id: string;
    tokenId: string;
    type: 'buy' | 'sell';
    user: string;
    amountIn: bigint;
    amountOut: bigint;
    pricePerToken: bigint;
    totalValue: bigint;
    transactionHash: string;
    blockNumber: number;
    timestamp: Date;
  }): Trade {
    return new Trade(
      data.id,
      data.tokenId,
      data.type,
      data.user,
      data.amountIn,
      data.amountOut,
      data.pricePerToken,
      data.totalValue,
      data.transactionHash,
      data.blockNumber,
      data.timestamp,
    );
  }
}
