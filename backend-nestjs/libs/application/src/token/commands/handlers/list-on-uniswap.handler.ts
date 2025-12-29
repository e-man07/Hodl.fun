import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { ListOnUniswapCommand } from '../list-on-uniswap.command';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * List On Uniswap Command Handler
 *
 * Lists a locked token on Uniswap V3:
 * 1. Load token aggregate
 * 2. Verify token is locked
 * 3. Call token.listOnUniswapV3() (enforces invariants, publishes TokenListedEvent)
 * 4. Save updated token
 *
 * Result: { success: boolean, poolAddress: string }
 */
@Injectable()
@CommandHandler(ListOnUniswapCommand)
export class ListOnUniswapHandler
  implements ICommandHandler<ListOnUniswapCommand>
{
  private readonly logger = new Logger(ListOnUniswapHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  async execute(
    command: ListOnUniswapCommand,
  ): Promise<{ success: boolean; poolAddress: string }> {
    this.logger.log(
      `Listing token on Uniswap: ${command.tokenId} → ${command.uniswapV3PoolAddress}`,
    );

    try {
      // Load token
      const token = await this.tokenRepository.findById(command.tokenId);
      if (!token) {
        throw new BadRequestException(`Token not found: ${command.tokenId}`);
      }

      // Verify token is locked
      if (!token.getIsLocked()) {
        throw new BadRequestException(
          `Token must be locked before listing on Uniswap. Current state: locked=${token.getIsLocked()}`,
        );
      }

      // List on Uniswap (will publish TokenListedEvent)
      token.listOnUniswapV3(command.uniswapV3PoolAddress);

      // Save updated state
      await this.tokenRepository.update(token);

      this.logger.log(`Token listed on Uniswap: ${command.tokenId}`);

      return {
        success: true,
        poolAddress: command.uniswapV3PoolAddress,
      };
    } catch (error) {
      this.logger.error(`List on Uniswap failed: ${error.message}`);
      throw error;
    }
  }
}
