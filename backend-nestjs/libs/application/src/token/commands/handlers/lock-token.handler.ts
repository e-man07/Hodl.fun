import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { LockTokenCommand } from '../lock-token.command';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * Lock Token Command Handler
 *
 * Locks a token from bonding curve trading:
 * 1. Load token aggregate
 * 2. Verify graduation threshold is met
 * 3. Call token.lock() (enforces invariants, publishes TokenLockedEvent)
 * 4. Save updated token
 *
 * Result: { success: boolean, message: string }
 */
@Injectable()
@CommandHandler(LockTokenCommand)
export class LockTokenHandler implements ICommandHandler<LockTokenCommand> {
  private readonly logger = new Logger(LockTokenHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async execute(
    command: LockTokenCommand,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Locking token: ${command.tokenId}`);

    try {
      // Load token
      const token = await this.tokenRepository.findById(command.tokenId);
      if (!token) {
        throw new BadRequestException(`Token not found: ${command.tokenId}`);
      }

      // Verify graduation threshold is met
      if (!token.isReadyForGraduation()) {
        throw new BadRequestException(
          `Token market cap (${token.getMarketCap().toBigInt()}) is below graduation threshold (${token.getGraduationThreshold().toBigInt()})`,
        );
      }

      // Lock token (will publish TokenLockedEvent)
      token.lock();

      // Save updated state
      await this.tokenRepository.update(token);

      this.logger.log(`Token locked successfully: ${command.tokenId}`);

      return {
        success: true,
        message: `Token ${command.tokenId} locked and ready for Uniswap graduation`,
      };
    } catch (error) {
      this.logger.error(`Lock failed: ${error.message}`);
      throw error;
    }
  }
}
