import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  PortfolioResponseDto,
  PortfolioSummaryResponseDto,
  TopPortfoliosResponseDto,
} from '../dtos/responses/portfolio.response';
import { GetUserPortfolioQuery } from '@application/portfolio/queries';
import { Portfolio } from '@domain';

/**
 * Portfolio Controller
 *
 * Handles all portfolio-related HTTP endpoints
 */
@Controller('portfolios')
export class PortfolioController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * Get leaderboard of top portfolios
   * NOTE: This route must be defined BEFORE the :userId route
   *
   * @param limit Number of top portfolios to return (default: 100, max: 1000)
   * @param metric Sorting metric (default: portfolioValue)
   * @returns Top portfolios with ranking
   */
  @Get('leaderboard/top')
  async getTopPortfolios(
    @Query('limit') _limit: string = '100',
    @Query('metric') _metric: 'portfolioValue' | 'totalPNL' = 'portfolioValue',
  ): Promise<TopPortfoliosResponseDto> {
    // TODO: Implement GetTopPortfoliosQuery handler
    // For now, return empty leaderboard
    return {
      portfolios: [],
      timestamp: new Date(),
    };
  }

  /**
   * Get user's complete portfolio with all holdings
   *
   * @param userId User wallet address
   * @returns Full portfolio details including all holdings
   */
  @Get(':userId')
  async getPortfolio(@Param('userId') userId: string): Promise<PortfolioResponseDto> {
    // Execute GetUserPortfolioQuery via CQRS bus
    const portfolio = (await this.queryBus.execute(
      new GetUserPortfolioQuery(userId),
    )) as Portfolio | null;

    if (!portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${userId}`);
    }

    const holdings = portfolio.getHoldings();

    return {
      id: portfolio.getId(),
      userId: portfolio.getUserId(),
      holdings: holdings.map((holding) => ({
        tokenAddress: holding.tokenAddress,
        tokenSymbol: holding.tokenSymbol,
        balance: holding.balance.toString(),
        avgBuyPrice: holding.avgBuyPrice.toString(),
        totalSpent: holding.totalSpent.toString(),
        totalSold: holding.totalSold.toString(),
        realizedPNL: holding.realizedPNL.toString(),
        unrealizedPNL: undefined, // Computed field needs current prices
      })),
      totalInvestedPUSH: portfolio.getTotalInvestedPUSH().toString(),
      portfolioValue: undefined, // Computed field needs current prices
      totalPNL: undefined,
      realizedPNL: undefined,
      unrealizedPNL: undefined,
      createdAt: portfolio.getCreatedAt(),
      updatedAt: portfolio.getUpdatedAt(),
    };
  }

  /**
   * Get portfolio summary (lightweight overview)
   *
   * @param userId User wallet address
   * @returns Portfolio summary with key metrics
   */
  @Get(':userId/summary')
  async getPortfolioSummary(
    @Param('userId') userId: string,
  ): Promise<PortfolioSummaryResponseDto> {
    // Reuse the portfolio query
    const portfolio = (await this.queryBus.execute(
      new GetUserPortfolioQuery(userId),
    )) as Portfolio | null;

    if (!portfolio) {
      throw new NotFoundException(`Portfolio not found for user: ${userId}`);
    }

    const holdings = portfolio.getHoldings();
    const totalRealizedPNL = holdings.reduce((sum, h) => sum + h.realizedPNL, 0n);

    return {
      userId: portfolio.getUserId(),
      holdingsCount: holdings.length,
      totalInvestedPUSH: portfolio.getTotalInvestedPUSH().toString(),
      portfolioValue: '0', // Would need current prices
      totalPNL: totalRealizedPNL.toString(), // Only realized, need prices for unrealized
      realizedPNL: totalRealizedPNL.toString(),
      unrealizedPNL: '0', // Would need current prices
      topHolding: holdings.length > 0
        ? {
            tokenSymbol: holdings[0].tokenSymbol,
            value: holdings[0].balance.toString(),
            percentage: 100 / holdings.length,
          }
        : undefined,
    };
  }
}
