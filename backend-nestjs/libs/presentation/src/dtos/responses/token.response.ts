/**
 * Token Response DTO
 *
 * Structure returned to clients for token queries
 */
export class TokenResponseDto {
  id!: string;
  address!: string;
  name!: string;
  symbol!: string;
  creator!: string;
  decimals!: number;
  totalSupply!: string;
  currentPrice!: string;
  marketCap!: string;
  athPrice!: string;
  athMarketCap!: string;
  athPriceTimestamp!: Date;
  athMarketCapTimestamp!: Date;
  isLocked!: boolean;
  isListed!: boolean;
  uniswapV3Pool!: string | null;
  listingTimestamp!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  holdersCount!: number;
  volume24h!: string;
  priceChange24h!: number;
}

/**
 * Paginated Token List Response
 */
export class TokenListResponseDto {
  items!: TokenResponseDto[];
  total!: number;
  limit!: number;
  offset!: number;
  hasMore!: boolean;
}

/**
 * Token Trending Response
 */
export class TrendingTokenResponseDto {
  tokens!: TokenResponseDto[];
  timeframe!: '1h' | '24h' | '7d';
  metric!: 'price' | 'marketCap' | 'trades';
  timestamp!: Date;
}
