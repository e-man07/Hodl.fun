import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { GetGraduationReadyTokensQuery } from '../get-graduation-ready-tokens.query';
import { Token, ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * Get Graduation Ready Tokens Query Handler
 *
 * Retrieves tokens that are ready for graduation to Uniswap:
 * 1. Find tokens with market cap >= graduation threshold (100 PUSH)
 * 2. Filter out tokens that are already locked
 * 3. Return sorted by market cap (descending)
 *
 * Used by:
 * - Indexer service to detect graduation opportunities
 * - Frontend to highlight tokens approaching graduation
 * - Admin dashboard for monitoring
 */
@Injectable()
@QueryHandler(GetGraduationReadyTokensQuery)
export class GetGraduationReadyTokensHandler
  implements IQueryHandler<GetGraduationReadyTokensQuery>
{
  private readonly logger = new Logger(GetGraduationReadyTokensHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async execute(query: GetGraduationReadyTokensQuery): Promise<Token[]> {
    try {
      const tokens = await this.tokenRepository.findReadyForGraduation(
        query.limit,
      );

      this.logger.log(
        `Found ${tokens.length} tokens ready for graduation`,
      );

      return tokens;
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }
}
