import { Entity } from '../../shared/entity';

/**
 * Market Stats Entity
 *
 * Represents aggregated marketplace statistics.
 * Calculated from all token and trade data.
 *
 * Statistics tracked:
 * - Total tokens created
 * - Total trading volume
 * - Unique traders
 * - Trending tokens
 * - Market cap rankings
 */
export class MarketStats extends Entity<{
  totalTokens: number;
  activeTokens: number;
  lockedTokens: number;
  listedTokens: number;
  totalVolumeNative: bigint;
  totalVolumePUSH: bigint;
  uniqueTraders: number;
  totalTrades: number;
  averageTradeSize: bigint;
  averageTokenPrice: bigint;
  totalMarketCap: bigint;
  timestamp: Date;
}> {
  private constructor(
    id: string,
    readonly totalTokens: number,
    readonly activeTokens: number,
    readonly lockedTokens: number,
    readonly listedTokens: number,
    readonly totalVolumeNative: bigint,
    readonly totalVolumePUSH: bigint,
    readonly uniqueTraders: number,
    readonly totalTrades: number,
    readonly averageTradeSize: bigint,
    readonly averageTokenPrice: bigint,
    readonly totalMarketCap: bigint,
    readonly timestamp: Date,
  ) {
    super(
      {
        totalTokens,
        activeTokens,
        lockedTokens,
        listedTokens,
        totalVolumeNative,
        totalVolumePUSH,
        uniqueTraders,
        totalTrades,
        averageTradeSize,
        averageTokenPrice,
        totalMarketCap,
        timestamp,
      },
      id,
    );
  }

  /**
   * Create market stats from calculated data
   */
  static create(data: {
    totalTokens: number;
    activeTokens: number;
    lockedTokens: number;
    listedTokens: number;
    totalVolumeNative: bigint;
    totalVolumePUSH: bigint;
    uniqueTraders: number;
    totalTrades: number;
    averageTradeSize: bigint;
    averageTokenPrice: bigint;
    totalMarketCap: bigint;
    timestamp: Date;
  }): MarketStats {
    return new MarketStats(
      `market-stats-${data.timestamp.getTime()}`,
      data.totalTokens,
      data.activeTokens,
      data.lockedTokens,
      data.listedTokens,
      data.totalVolumeNative,
      data.totalVolumePUSH,
      data.uniqueTraders,
      data.totalTrades,
      data.averageTradeSize,
      data.averageTokenPrice,
      data.totalMarketCap,
      data.timestamp,
    );
  }

  /**
   * Get market cap per token (average)
   */
  getAverageMarketCap(): bigint {
    if (this.activeTokens === 0) {
      return 0n;
    }
    return this.totalMarketCap / BigInt(this.activeTokens);
  }

  /**
   * Get percentage of tokens locked
   */
  getLockedPercentage(): number {
    if (this.totalTokens === 0) {
      return 0;
    }
    return Math.floor((this.lockedTokens / this.totalTokens) * 100);
  }

  /**
   * Get percentage of tokens listed
   */
  getListedPercentage(): number {
    if (this.totalTokens === 0) {
      return 0;
    }
    return Math.floor((this.listedTokens / this.totalTokens) * 100);
  }

  /**
   * Get market momentum (volume-based)
   */
  getMarketMomentum(): 'bullish' | 'neutral' | 'bearish' {
    // Simple heuristic: if volume/market cap ratio is high, momentum is positive
    if (this.totalMarketCap === 0n) {
      return 'neutral';
    }

    const volumeRatio = Number(this.totalVolumePUSH) / Number(this.totalMarketCap);

    if (volumeRatio > 0.1) {
      return 'bullish';
    } else if (volumeRatio < 0.01) {
      return 'bearish';
    }

    return 'neutral';
  }

  /**
   * Get summary for display
   */
  getSummary(): {
    totalTokens: number;
    activeTokens: number;
    totalMarketCap: bigint;
    totalVolume: bigint;
    uniqueTraders: number;
    totalTrades: number;
    momentum: 'bullish' | 'neutral' | 'bearish';
  } {
    return {
      totalTokens: this.totalTokens,
      activeTokens: this.activeTokens,
      totalMarketCap: this.totalMarketCap,
      totalVolume: this.totalVolumePUSH,
      uniqueTraders: this.uniqueTraders,
      totalTrades: this.totalTrades,
      momentum: this.getMarketMomentum(),
    };
  }

  /**
   * Reconstruct from database
   */
  static reconstruct(data: {
    id: string;
    totalTokens: number;
    activeTokens: number;
    lockedTokens: number;
    listedTokens: number;
    totalVolumeNative: bigint;
    totalVolumePUSH: bigint;
    uniqueTraders: number;
    totalTrades: number;
    averageTradeSize: bigint;
    averageTokenPrice: bigint;
    totalMarketCap: bigint;
    timestamp: Date;
  }): MarketStats {
    return new MarketStats(
      data.id,
      data.totalTokens,
      data.activeTokens,
      data.lockedTokens,
      data.listedTokens,
      data.totalVolumeNative,
      data.totalVolumePUSH,
      data.uniqueTraders,
      data.totalTrades,
      data.averageTradeSize,
      data.averageTokenPrice,
      data.totalMarketCap,
      data.timestamp,
    );
  }
}
