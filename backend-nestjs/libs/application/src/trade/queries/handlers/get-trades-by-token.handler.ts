import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { GetTradesByTokenQuery } from '../get-trades-by-token.query';
import { Trade, ITradeRepository, TRADE_REPOSITORY } from '@domain';

/**
 * Get Trades By Token Query Handler
 *
 * Retrieves trades for a specific token with pagination
 */
@Injectable()
@QueryHandler(GetTradesByTokenQuery)
export class GetTradesByTokenHandler
  implements IQueryHandler<GetTradesByTokenQuery>
{
  private readonly logger = new Logger(GetTradesByTokenHandler.name);

  constructor(
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: ITradeRepository,
  ) {}

  async execute(
    query: GetTradesByTokenQuery,
  ): Promise<{ items: Trade[]; total: number }> {
    try {
      const result = await this.tradeRepository.findByTokenId(query.tokenId, {
        limit: query.limit,
        offset: query.offset,
        orderBy:
          query.orderBy === 'totalValue' ? 'pricePerToken' : 'timestamp',
        orderDirection: query.orderDirection,
      });

      return {
        items: result.trades,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }
}
