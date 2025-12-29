import { Portfolio } from '../entities/portfolio.entity';

/**
 * Portfolio Repository Interface (Port)
 *
 * Defines the contract for Portfolio aggregate persistence.
 * Portfolios track user token holdings and PNL metrics.
 */
export interface IPortfolioRepository {
  /**
   * Find portfolio by ID
   */
  findById(id: string): Promise<Portfolio | null>;

  /**
   * Find portfolio by user ID
   */
  findByUserId(userId: string): Promise<Portfolio | null>;

  /**
   * Get or create portfolio for user
   */
  findOrCreateByUserId(userId: string): Promise<Portfolio>;

  /**
   * Save a portfolio (create or update)
   */
  save(portfolio: Portfolio): Promise<Portfolio>;

  /**
   * Update an existing portfolio
   */
  update(portfolio: Portfolio): Promise<Portfolio>;

  /**
   * Delete a portfolio (rarely used)
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find portfolios holding a specific token
   */
  findPortfoliosHoldingToken(
    tokenAddress: string,
    options?: {
      limit?: number;
      offset?: number;
      minBalance?: bigint;
    },
  ): Promise<{
    portfolios: Portfolio[];
    total: number;
  }>;

  /**
   * Get top portfolios by total value
   */
  findTopByValue(
    tokenPrices: Map<string, bigint>,
    limit?: number,
  ): Promise<Portfolio[]>;

  /**
   * Get portfolios with most holdings
   */
  findMostDiversified(limit?: number): Promise<Portfolio[]>;

  /**
   * Count total portfolios
   */
  count(): Promise<number>;

  /**
   * Count portfolios holding a specific token
   */
  countHoldersOfToken(tokenAddress: string): Promise<number>;
}

/**
 * Portfolio Repository Symbol for DI
 */
export const PORTFOLIO_REPOSITORY = Symbol('IPortfolioRepository');
