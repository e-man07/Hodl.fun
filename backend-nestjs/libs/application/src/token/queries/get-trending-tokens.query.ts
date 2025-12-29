/**
 * Get Trending Tokens Query
 *
 * CQRS Query: Retrieve trending tokens based on recent activity
 *
 * Parameters:
 * - timeframe: '1h' | '24h' | '7d' (time window for trending)
 * - metric: 'price' | 'marketCap' | 'trades' (what makes it trending)
 * - limit: max number of results
 */
export class GetTrendingTokensQuery {
  constructor(
    readonly timeframe: '1h' | '24h' | '7d' = '24h',
    readonly metric: 'price' | 'marketCap' | 'trades' = 'trades',
    readonly limit: number = 10,
  ) {}
}
