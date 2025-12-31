/**
 * Get Trade Stats Query
 *
 * CQRS Query: Retrieve trade statistics optionally filtered by token or user
 */
export class GetTradeStatsQuery {
  constructor(
    readonly tokenId?: string,
    readonly user?: string,
  ) {}
}
