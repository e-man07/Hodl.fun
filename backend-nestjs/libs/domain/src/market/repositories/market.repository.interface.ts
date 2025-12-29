import { MarketStats } from '../entities/market-stats.entity';

/**
 * Market Repository Interface (Port)
 *
 * Defines the contract for MarketStats persistence.
 * Market stats are calculated aggregates updated periodically.
 */
export interface IMarketRepository {
  /**
   * Get latest market stats
   */
  getLatest(): Promise<MarketStats | null>;

  /**
   * Get market stats at a specific timestamp
   */
  getByTimestamp(timestamp: Date): Promise<MarketStats | null>;

  /**
   * Get market stats history (last N records)
   */
  getHistory(limit?: number): Promise<MarketStats[]>;

  /**
   * Save market stats snapshot
   */
  save(stats: MarketStats): Promise<MarketStats>;

  /**
   * Get market stats for a specific timeframe
   */
  getForTimeframe(
    timeframe: '1h' | '24h' | '7d' | '30d',
  ): Promise<MarketStats | null>;

  /**
   * Get trending tokens (by volume or price change)
   */
  getTrendingTokens(
    metric: 'volume' | 'price' | 'marketCap',
    timeframe: '1h' | '24h' | '7d',
    limit?: number,
  ): Promise<Array<{
    tokenAddress: string;
    tokenSymbol: string;
    value: bigint;
    change: number; // percentage
  }>>;

  /**
   * Get top tokens by market cap
   */
  getTopTokensByMarketCap(limit?: number): Promise<Array<{
    tokenAddress: string;
    tokenSymbol: string;
    marketCap: bigint;
  }>>;

  /**
   * Delete stats older than a date (archiving)
   */
  deleteOlderThan(timestamp: Date): Promise<number>;
}

/**
 * Market Repository Symbol for DI
 */
export const MARKET_REPOSITORY = Symbol('IMarketRepository');
