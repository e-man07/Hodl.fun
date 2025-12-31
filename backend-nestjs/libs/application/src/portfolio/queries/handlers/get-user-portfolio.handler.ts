import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetUserPortfolioQuery } from '../get-user-portfolio.query';
import { Portfolio, IPortfolioRepository, PORTFOLIO_REPOSITORY } from '@domain';

/**
 * Handler for GetUserPortfolioQuery
 * Retrieves user's complete portfolio from the repository
 */
@QueryHandler(GetUserPortfolioQuery)
export class GetUserPortfolioHandler
  implements IQueryHandler<GetUserPortfolioQuery>
{
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  async execute(query: GetUserPortfolioQuery): Promise<Portfolio | null> {
    const { userId } = query;
    const normalizedUserId = userId.toLowerCase();

    // Get portfolio from repository
    const portfolio = await this.portfolioRepository.findByUserId(normalizedUserId);

    return portfolio;
  }
}
