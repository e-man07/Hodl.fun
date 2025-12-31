import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { ListOnUniswapCommand } from '../list-on-uniswap.command';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';
import { BondingCurveContractService } from '@infrastructure/contracts/services/bonding-curve-contract.service';
import { FactoryContractService } from '@infrastructure/contracts/services/factory-contract.service';

/**
 * List On Uniswap Command Handler
 *
 * Lists a locked token on Uniswap V3:
 * 1. Load token aggregate
 * 2. Verify on-chain lock and listing status
 * 3. Sync local state with on-chain state
 * 4. Call token.listOnUniswapV3() if not already listed
 * 5. Save updated token
 *
 * Note: With v2 architecture, the listing happens on-chain when lock conditions are met.
 * This handler syncs the local database state with on-chain state.
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
    private readonly bondingCurveContract: BondingCurveContractService,
    private readonly factoryContract: FactoryContractService,
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

      const tokenAddress = token.getAddress().toString();

      // Get curve address for this token
      const curveAddress = await this.factoryContract.getCurve(tokenAddress);
      if (!curveAddress) {
        throw new BadRequestException(
          `No bonding curve found for token: ${tokenAddress}`,
        );
      }

      // Check on-chain status
      const isLockedOnChain =
        await this.bondingCurveContract.getLock(curveAddress);
      const isListedOnChain =
        await this.bondingCurveContract.getIsListing(curveAddress);

      // Verify token is locked on-chain
      if (!isLockedOnChain) {
        throw new BadRequestException(
          `Token must be locked before listing on Uniswap. On-chain lock status: ${isLockedOnChain}`,
        );
      }

      // Check if already listed on-chain
      if (!isListedOnChain) {
        throw new BadRequestException(
          'Token is locked but not yet listed on-chain. Listing transaction must be executed on the blockchain.',
        );
      }

      // Sync local lock state if needed
      if (!token.getIsLocked()) {
        token.lock();
        this.logger.log(`Token lock synced from on-chain: ${command.tokenId}`);
      }

      // Sync local listing state with on-chain
      if (!token.getIsListed()) {
        token.listOnUniswapV3(command.uniswapV3PoolAddress);
        await this.tokenRepository.update(token);
        this.logger.log(
          `Token listing synced from on-chain: ${command.tokenId}`,
        );
      }

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
