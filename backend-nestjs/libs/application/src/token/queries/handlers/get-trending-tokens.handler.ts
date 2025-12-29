import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { GetTrendingTokensQuery } from '../get-trending-tokens.query';
import { Token, ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * Get Trending Tokens Query Handler
 *
 * Retrieves trending tokens based on:
 * - Timeframe (1h, 24h, 7d)
 * - Metric (trading volume, price change, market cap growth)
 *
 * Note: Full implementation depends on:
 * - Trade history (volume calculations)
 * - Time-series data (price changes)
 * - Market snapshots (market cap tracking)
 *
 * For now, returns top tokens by current metric.
 */
@Injectable()
@QueryHandler(GetTrendingTokensQuery)
export class GetTrendingTokensHandler
  implements IQueryHandler<GetTrendingTokensQuery>
{
  private readonly logger = new Logger(GetTrendingTokensHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async execute(query: GetTrendingTokensQuery): Promise<Token[]> {
    try {
      // Fetch trending tokens from repository
      // Repository implementation will handle timeframe-based calculations
      const tokens = await this.tokenRepository.findTrending(
        query.timeframe,
        query.metric,
        query.limit,
      );

      return tokens;
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }
}
