/**
 * Get Tokens Query
 *
 * CQRS Query: Retrieve a list of tokens with optional filters
 *
 * Parameters:
 * - filter: creator, isLocked, isListed
 * - limit: pagination limit (default 20)
 * - offset: pagination offset (default 0)
 * - orderBy: 'createdAt' | 'marketCap' | 'currentPrice'
 * - orderDirection: 'asc' | 'desc'
 */
export class GetTokensQuery {
  constructor(
    readonly filter?: {
      creator?: string;
      isLocked?: boolean;
      isListed?: boolean;
    },
    readonly limit?: number,
    readonly offset?: number,
    readonly orderBy?: 'createdAt' | 'marketCap' | 'currentPrice',
    readonly orderDirection?: 'asc' | 'desc',
  ) {}
}
