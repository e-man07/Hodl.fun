import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import FeeVaultAbi from '../abis/FeeVault.json';

/**
 * FeeVault stats interface
 */
export interface FeeVaultStats {
  totalAssets: bigint;
  totalSupply: bigint;
  asset: string;
  pricePerShare: bigint;
}

/**
 * FeeVaultContractService
 *
 * Service for interacting with the FeeVault ERC4626 contract.
 * Provides read-only access to vault state and share calculations.
 */
@Injectable()
export class FeeVaultContractService implements OnModuleInit {
  private readonly logger = new Logger(FeeVaultContractService.name);
  private provider!: JsonRpcProvider;
  private contract!: Contract;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
    const feeVaultAddress = this.configService.get<string>(
      'smartContracts.feeVaultAddress',
    );

    if (!rpcUrl || !feeVaultAddress) {
      this.logger.warn('Missing RPC URL or FeeVault contract address');
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.contract = new Contract(feeVaultAddress, FeeVaultAbi, this.provider);

    this.logger.log(`Initialized FeeVault contract at ${feeVaultAddress}`);
  }

  /**
   * Get total assets held by the vault
   * @returns Total assets in underlying token (WPUSH)
   */
  async totalAssets(): Promise<bigint> {
    return this.contract.totalAssets();
  }

  /**
   * Get total supply of vault shares
   * @returns Total supply of shares
   */
  async totalSupply(): Promise<bigint> {
    return this.contract.totalSupply();
  }

  /**
   * Get the underlying asset address (WPUSH)
   * @returns Asset address
   */
  async asset(): Promise<string> {
    return this.contract.asset();
  }

  /**
   * Convert assets to shares
   * @param assets Amount of assets
   * @returns Amount of shares
   */
  async convertToShares(assets: bigint): Promise<bigint> {
    return this.contract.convertToShares(assets);
  }

  /**
   * Convert shares to assets
   * @param shares Amount of shares
   * @returns Amount of assets
   */
  async convertToAssets(shares: bigint): Promise<bigint> {
    return this.contract.convertToAssets(shares);
  }

  /**
   * Preview deposit - get shares for deposit amount
   * @param assets Amount to deposit
   * @returns Shares that would be minted
   */
  async previewDeposit(assets: bigint): Promise<bigint> {
    return this.contract.previewDeposit(assets);
  }

  /**
   * Preview withdraw - get shares needed for withdrawal
   * @param assets Amount to withdraw
   * @returns Shares that would be burned
   */
  async previewWithdraw(assets: bigint): Promise<bigint> {
    return this.contract.previewWithdraw(assets);
  }

  /**
   * Preview redeem - get assets for share amount
   * @param shares Amount of shares to redeem
   * @returns Assets that would be received
   */
  async previewRedeem(shares: bigint): Promise<bigint> {
    return this.contract.previewRedeem(shares);
  }

  /**
   * Preview mint - get assets needed for share amount
   * @param shares Amount of shares to mint
   * @returns Assets that would be needed
   */
  async previewMint(shares: bigint): Promise<bigint> {
    return this.contract.previewMint(shares);
  }

  /**
   * Get balance of shares for an account
   * @param account Account address
   * @returns Share balance
   */
  async balanceOf(account: string): Promise<bigint> {
    return this.contract.balanceOf(account);
  }

  /**
   * Get max deposit amount for an account
   * @param receiver Receiver address
   * @returns Max deposit amount
   */
  async maxDeposit(receiver: string): Promise<bigint> {
    return this.contract.maxDeposit(receiver);
  }

  /**
   * Get max withdraw amount for an account
   * @param owner Owner address
   * @returns Max withdraw amount
   */
  async maxWithdraw(owner: string): Promise<bigint> {
    return this.contract.maxWithdraw(owner);
  }

  /**
   * Get max redeem amount for an account
   * @param owner Owner address
   * @returns Max redeem amount
   */
  async maxRedeem(owner: string): Promise<bigint> {
    return this.contract.maxRedeem(owner);
  }

  /**
   * Get comprehensive vault stats
   * @returns Vault statistics
   */
  async getVaultStats(): Promise<FeeVaultStats> {
    const [totalAssets, totalSupply, asset] = await Promise.all([
      this.totalAssets(),
      this.totalSupply(),
      this.asset(),
    ]);

    // Calculate price per share (scaled by 1e18)
    const pricePerShare =
      totalSupply > 0n
        ? (totalAssets * BigInt(10 ** 18)) / totalSupply
        : BigInt(10 ** 18);

    return {
      totalAssets,
      totalSupply,
      asset,
      pricePerShare,
    };
  }

  /**
   * Get the FeeVault contract address
   */
  get address(): string {
    return (
      this.configService.get<string>('smartContracts.feeVaultAddress') || ''
    );
  }

  /**
   * Get the provider
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }
}
