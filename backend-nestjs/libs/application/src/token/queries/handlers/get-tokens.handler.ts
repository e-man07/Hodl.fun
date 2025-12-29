import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { GetTokensQuery } from '../get-tokens.query';
import { Token, ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * Get Tokens Query Handler
 *
 * Retrieves a paginated list of tokens with optional filters:
 * 1. Apply filters (creator, locked status, listed status)
 * 2. Apply sorting (by creation date, market cap, or price)
 * 3. Apply pagination (limit, offset)
 * 4. Return tokens and total count
 */
@Injectable()
@QueryHandler(GetTokensQuery)
export class GetTokensHandler implements IQueryHandler<GetTokensQuery> {
  private readonly logger = new Logger(GetTokensHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async execute(
    query: GetTokensQuery,
  ): Promise<{
    tokens: Token[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const result = await this.tokenRepository.findAll(
        {
          creator: query.filter?.creator,
          isLocked: query.filter?.isLocked,
          isListed: query.filter?.isListed,
        },
        {
          limit: query.limit || 20,
          offset: query.offset || 0,
          orderBy: query.orderBy || 'createdAt',
          orderDirection: query.orderDirection || 'desc',
        },
      );

      return {
        tokens: result.tokens,
        total: result.total,
        limit: query.limit || 20,
        offset: query.offset || 0,
      };
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }
}
