import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { GetTokenQuery } from '../get-token.query';
import { Token, ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * Get Token Query Handler
 *
 * Retrieves a single token by ID or address:
 * 1. Validate at least one parameter is provided
 * 2. Load from repository (cached or fresh from database)
 * 3. Return token or null
 */
@Injectable()
@QueryHandler(GetTokenQuery)
export class GetTokenHandler implements IQueryHandler<GetTokenQuery> {
  private readonly logger = new Logger(GetTokenHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async execute(query: GetTokenQuery): Promise<Token | null> {
    if (!query.tokenId && !query.tokenAddress) {
      throw new BadRequestException(
        'Either tokenId or tokenAddress must be provided',
      );
    }

    try {
      let token: Token | null = null;

      if (query.tokenId) {
        token = await this.tokenRepository.findById(query.tokenId);
      } else if (query.tokenAddress) {
        token = await this.tokenRepository.findByAddressString(
          query.tokenAddress,
        );
      }

      return token;
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }
}
