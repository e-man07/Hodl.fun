import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { GetUserPortfolioQuery } from '../get-user-portfolio.query';
import { Portfolio, IPortfolioRepository, PORTFOLIO_REPOSITORY } from '@domain';

/**
 * Get User Portfolio Query Handler
 *
 * Retrieves user's portfolio with all holdings and metadata:
 * 1. Load portfolio for user (create if doesn't exist)
 * 2. Return portfolio state
 *
 * Frontend uses this to display:
 * - Holdings table
 * - Portfolio value
 * - PNL calculations
 * - Asset allocation
 */
@Injectable()
@QueryHandler(GetUserPortfolioQuery)
export class GetUserPortfolioHandler
  implements IQueryHandler<GetUserPortfolioQuery>
{
  private readonly logger = new Logger(GetUserPortfolioHandler.name);

  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  async execute(query: GetUserPortfolioQuery): Promise<Portfolio> {
    try {
      // Get or create portfolio for user
      const portfolio =
        await this.portfolioRepository.findOrCreateByUserId(query.userId);

      return portfolio;
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }
}
