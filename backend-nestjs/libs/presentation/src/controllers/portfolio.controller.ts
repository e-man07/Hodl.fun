import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  PortfolioResponseDto,
  PortfolioSummaryResponseDto,
  TopPortfoliosResponseDto,
} from '../dtos/responses/portfolio.response';

/**
 * Portfolio Controller
 *
 * Handles all portfolio-related HTTP endpoints
 */
@Controller('portfolios')
export class PortfolioController {
  constructor(private readonly queryBus: QueryBus) {}

  /**
   * Get user's complete portfolio with all holdings
   *
   * @param userId User wallet address
   * @returns Full portfolio details including all holdings
   */
  @Get(':userId')
  async getPortfolio(@Param('userId') userId: string): Promise<PortfolioResponseDto> {
    // Execute GetUserPortfolioQuery via CQRS bus
    const portfolio = await this.queryBus.execute({
      userId,
    });

    if (!portfolio) {
      throw new Error(`Portfolio not found for user: ${userId}`);
    }

    return {
      id: portfolio.id.value,
      userId: portfolio.userId.value,
      holdings: portfolio.holdings.map((holding: any) => ({
        tokenAddress: holding.tokenAddress.value,
        tokenSymbol: holding.tokenSymbol,
        balance: holding.balance.toString(),
        avgBuyPrice: holding.avgBuyPrice.toString(),
        totalSpent: holding.totalSpent.toString(),
        totalSold: holding.totalSold.toString(),
        realizedPNL: holding.realizedPNL.toString(),
        unrealizedPNL: holding.unrealizedPNL?.toString(),
      })),
      totalInvestedPUSH: portfolio.totalInvestedPUSH.toString(),
      portfolioValue: portfolio.portfolioValue?.toString(),
      totalPNL: portfolio.totalPNL?.toString(),
      realizedPNL: portfolio.realizedPNL?.toString(),
      unrealizedPNL: portfolio.unrealizedPNL?.toString(),
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
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
    // Execute GetPortfolioSummaryQuery via CQRS bus
    const summary = await this.queryBus.execute({
      userId,
    });

    if (!summary) {
      throw new Error(`Portfolio summary not found for user: ${userId}`);
    }

    return {
      userId: summary.userId.value,
      holdingsCount: summary.holdingsCount,
      totalInvestedPUSH: summary.totalInvestedPUSH.toString(),
      portfolioValue: summary.portfolioValue.toString(),
      totalPNL: summary.totalPNL.toString(),
      realizedPNL: summary.realizedPNL.toString(),
      unrealizedPNL: summary.unrealizedPNL.toString(),
      topHolding: summary.topHolding
        ? {
            tokenSymbol: summary.topHolding.tokenSymbol,
            value: summary.topHolding.value.toString(),
            percentage: summary.topHolding.percentage,
          }
        : undefined,
    };
  }

  /**
   * Get leaderboard of top portfolios
   *
   * @param limit Number of top portfolios to return (default: 100, max: 1000)
   * @param metric Sorting metric (default: portfolioValue)
   * @returns Top portfolios with ranking
   */
  @Get('leaderboard/top')
  async getTopPortfolios(
    @Query('limit') limit: string = '100',
    @Query('metric') metric: 'portfolioValue' | 'totalPNL' = 'portfolioValue',
  ): Promise<TopPortfoliosResponseDto> {
    const limitNum = Math.min(parseInt(limit) || 100, 1000);

    // Execute GetTopPortfoliosQuery via CQRS bus
    const portfolios = await this.queryBus.execute({
      limit: limitNum,
      metric,
    });

    return {
      portfolios: portfolios.map((portfolio: any, index: number) => ({
        rank: index + 1,
        userId: portfolio.userId.value,
        portfolioValue: portfolio.portfolioValue.toString(),
        holdingsCount: portfolio.holdingsCount,
        totalPNL: portfolio.totalPNL.toString(),
      })),
      timestamp: new Date(),
    };
  }
}
