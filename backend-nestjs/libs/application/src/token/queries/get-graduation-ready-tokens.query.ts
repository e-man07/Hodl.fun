/**
 * Get Graduation Ready Tokens Query
 *
 * CQRS Query: Retrieve tokens ready for graduation to Uniswap
 *
 * Graduation criteria:
 * - Market cap >= 100 PUSH (graduation threshold)
 * - Not yet locked
 * - Ready for Uniswap V3 migration
 *
 * Parameters:
 * - limit: max number of results (default 10)
 */
export class GetGraduationReadyTokensQuery {
  constructor(readonly limit: number = 10) {}
}
