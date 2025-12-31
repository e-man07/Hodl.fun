/**
 * Get Trades By Token Query
 *
 * CQRS Query: Retrieve trades for a specific token
 */
export class GetTradesByTokenQuery {
  constructor(
    readonly tokenId: string,
    readonly limit: number = 20,
    readonly offset: number = 0,
    readonly orderBy: 'timestamp' | 'totalValue' = 'timestamp',
    readonly orderDirection: 'asc' | 'desc' = 'desc',
  ) {}
}
