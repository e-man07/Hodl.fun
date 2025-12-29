/**
 * Get User Portfolio Query
 *
 * CQRS Query: Retrieve user's complete portfolio
 *
 * Returns:
 * - All holdings (tokens owned)
 * - Portfolio summary (total value, PNL, etc.)
 * - Trade history
 */
export class GetUserPortfolioQuery {
  constructor(readonly userId: string) {}
}
