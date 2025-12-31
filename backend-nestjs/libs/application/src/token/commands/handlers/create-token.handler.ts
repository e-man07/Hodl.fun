import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { CreateTokenCommand } from '../create-token.command';
import {
  Token,
  TokenAddress,
  ITokenRepository,
  TOKEN_REPOSITORY,
} from '@domain';

/**
 * Create Token Command Handler
 *
 * Executes the logic for creating a new token:
 * 1. Create Token aggregate with initial bonding curve state
 * 2. Save to repository (triggers persistence)
 * 3. Publish domain events (TokenCreatedEvent)
 * 4. Return created token
 *
 * Handlers are pure functions - they take commands and return results.
 * Side effects are delegated to repositories and event handlers.
 */
@Injectable()
@CommandHandler(CreateTokenCommand)
export class CreateTokenHandler implements ICommandHandler<CreateTokenCommand> {
  private readonly logger = new Logger(CreateTokenHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async execute(command: CreateTokenCommand): Promise<Token> {
    this.logger.log(
      `Creating token: ${command.symbol} (${command.tokenAddress})`,
    );

    try {
      // Create token aggregate with domain logic
      const token = Token.create(
        command.tokenId,
        TokenAddress.create(command.tokenAddress),
        command.curveAddress,
        command.name,
        command.symbol,
        command.creator,
        command.decimals,
        command.totalSupply,
        command.virtualNativeReserve,
        command.virtualTokenReserve,
      );

      // Save to repository
      // This persists the token and triggers domain event handlers
      const savedToken = await this.tokenRepository.save(token);

      this.logger.log(`Token created successfully: ${command.symbol}`);
      return savedToken;
    } catch (error) {
      this.logger.error(`Failed to create token: ${error.message}`);
      throw error;
    }
  }
}
