/**
 * Get Trades By User Query
 *
 * CQRS Query: Retrieve trades for a specific user
 */
export class GetTradesByUserQuery {
  constructor(
    readonly user: string,
    readonly limit: number = 20,
    readonly offset: number = 0,
    readonly orderBy: 'timestamp' | 'totalValue' = 'timestamp',
    readonly orderDirection: 'asc' | 'desc' = 'desc',
  ) {}
}
