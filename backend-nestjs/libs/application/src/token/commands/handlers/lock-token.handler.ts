import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { LockTokenCommand } from '../lock-token.command';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';
import { BondingCurveContractService } from '@infrastructure/contracts/services/bonding-curve-contract.service';
import { FactoryContractService } from '@infrastructure/contracts/services/factory-contract.service';

/**
 * Lock Token Command Handler
 *
 * Locks a token from bonding curve trading:
 * 1. Load token aggregate
 * 2. Verify on-chain lock status from contract
 * 3. Sync local state with on-chain state
 * 4. Call token.lock() if not already locked
 * 5. Save updated token
 *
 * Note: With v2 architecture, the lock happens on-chain when graduation threshold is met.
 * This handler syncs the local database state with on-chain state.
 */
@Injectable()
@CommandHandler(LockTokenCommand)
export class LockTokenHandler implements ICommandHandler<LockTokenCommand> {
  private readonly logger = new Logger(LockTokenHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
    private readonly bondingCurveContract: BondingCurveContractService,
    private readonly factoryContract: FactoryContractService,
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

      const tokenAddress = token.getAddress().toString();

      // Get curve address for this token
      const curveAddress = await this.factoryContract.getCurve(tokenAddress);
      if (!curveAddress) {
        throw new BadRequestException(
          `No bonding curve found for token: ${tokenAddress}`,
        );
      }

      // Check on-chain lock status
      const isLockedOnChain =
        await this.bondingCurveContract.getLock(curveAddress);

      if (!isLockedOnChain) {
        // Token is not locked on-chain - verify graduation threshold
        if (!token.isReadyForGraduation()) {
          throw new BadRequestException(
            `Token market cap (${token.getMarketCap().toBigInt()}) is below graduation threshold (${token.getGraduationThreshold().toBigInt()})`,
          );
        }

        // Token meets threshold but not locked on-chain yet
        // This would need to be triggered by a user transaction
        throw new BadRequestException(
          'Token is ready for graduation but not yet locked on-chain. Lock transaction must be executed on the blockchain.',
        );
      }

      // Sync local state with on-chain state
      if (!token.getIsLocked()) {
        token.lock();
        await this.tokenRepository.update(token);
        this.logger.log(`Token lock synced from on-chain: ${command.tokenId}`);
      }

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
