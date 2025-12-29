/**
 * Get Token Query
 *
 * CQRS Query: Retrieve a single token by ID or address
 *
 * Read-optimized query - fetches from cache/read model if available
 */
export class GetTokenQuery {
  constructor(
    readonly tokenId?: string,
    readonly tokenAddress?: string,
  ) {}
}
