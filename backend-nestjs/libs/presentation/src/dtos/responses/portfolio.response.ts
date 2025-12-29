/**
 * Portfolio Holding Response
 *
 * Individual token holding in a portfolio
 */
export class PortfolioHoldingResponseDto {
  tokenAddress!: string;
  tokenSymbol!: string;
  balance!: string;
  avgBuyPrice!: string;
  totalSpent!: string;
  totalSold!: string;
  realizedPNL!: string;
  unrealizedPNL?: string;
}

/**
 * Portfolio Response DTO
 *
 * Complete user portfolio structure
 */
export class PortfolioResponseDto {
  id!: string;
  userId!: string;
  holdings!: PortfolioHoldingResponseDto[];
  totalInvestedPUSH!: string;
  portfolioValue?: string;
  totalPNL?: string;
  realizedPNL?: string;
  unrealizedPNL?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

/**
 * Portfolio Summary Response
 *
 * Lightweight portfolio overview
 */
export class PortfolioSummaryResponseDto {
  userId!: string;
  holdingsCount!: number;
  totalInvestedPUSH!: string;
  portfolioValue!: string;
  totalPNL!: string;
  realizedPNL!: string;
  unrealizedPNL!: string;
  topHolding?: {
    tokenSymbol: string;
    value: string;
    percentage: number;
  };
}

/**
 * Top Portfolios Response
 *
 * Leaderboard-style portfolio data
 */
export class TopPortfoliosResponseDto {
  portfolios!: Array<{
    rank: number;
    userId: string;
    portfolioValue: string;
    holdingsCount: number;
    totalPNL: string;
  }>;
  timestamp!: Date;
}
