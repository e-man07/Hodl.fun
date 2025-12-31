import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { GetTradesByUserQuery } from '../get-trades-by-user.query';
import { Trade, ITradeRepository, TRADE_REPOSITORY } from '@domain';

/**
 * Get Trades By User Query Handler
 *
 * Retrieves trades for a specific user with pagination
 */
@Injectable()
@QueryHandler(GetTradesByUserQuery)
export class GetTradesByUserHandler
  implements IQueryHandler<GetTradesByUserQuery>
{
  private readonly logger = new Logger(GetTradesByUserHandler.name);

  constructor(
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: ITradeRepository,
  ) {}

  async execute(
    query: GetTradesByUserQuery,
  ): Promise<{ items: Trade[]; total: number }> {
    try {
      const result = await this.tradeRepository.findByUser(query.user, {
        limit: query.limit,
        offset: query.offset,
        orderBy: query.orderBy,
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
