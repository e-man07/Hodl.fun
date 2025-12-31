import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { FactoryConfig } from '../types';
import BondingCurveFactoryAbi from '../abis/BondingCurveFactory.json';

/**
 * FactoryContractService
 *
 * Service for interacting with the BondingCurveFactory contract.
 * Provides read-only access to factory configuration and token mappings.
 */
@Injectable()
export class FactoryContractService implements OnModuleInit {
  private readonly logger = new Logger(FactoryContractService.name);
  private provider!: JsonRpcProvider;
  private contract!: Contract;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
    const factoryAddress = this.configService.get<string>(
      'smartContracts.factoryAddress',
    );

    if (!rpcUrl || !factoryAddress) {
      this.logger.warn('Missing RPC URL or Factory contract address');
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.contract = new Contract(
      factoryAddress,
      BondingCurveFactoryAbi,
      this.provider,
    );

    this.logger.log(`Initialized Factory contract at ${factoryAddress}`);
  }

  /**
   * Get bonding curve address for a token
   * @param tokenAddress Token address
   * @returns Bonding curve address
   */
  async getCurve(tokenAddress: string): Promise<string> {
    return this.contract.getCurve(tokenAddress);
  }

  /**
   * Get factory configuration
   * @returns Factory configuration
   */
  async getConfig(): Promise<FactoryConfig> {
    const config = await this.contract.getConfig();
    return {
      deployFee: config[0],
      listingFee: config[1],
      virtualNative: config[2],
      virtualToken: config[3],
      k: config[4],
      graduationMarketCap: config[5],
      feeDenominator: Number(config[6]),
      feeNumerator: Number(config[7]),
      dexFee: Number(config[8]),
      creatorFeeShare: Number(config[9]),
    };
  }

  /**
   * Get core contract address
   * @returns Core contract address
   */
  async getCore(): Promise<string> {
    return this.contract.getCore();
  }

  /**
   * Get DEX factory address
   * @returns DEX factory address
   */
  async getDexFactory(): Promise<string> {
    return this.contract.getDexFactory();
  }

  /**
   * Get deploy fee
   * @returns Deploy fee in native currency
   */
  async getDeployFee(): Promise<bigint> {
    return this.contract.getDeployFee();
  }

  /**
   * Get listing fee
   * @returns Listing fee in native currency
   */
  async getListingFee(): Promise<bigint> {
    return this.contract.getListingFee();
  }

  /**
   * Get DEX fee tier
   * @returns DEX fee tier (500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
   */
  async getDexFee(): Promise<number> {
    return Number(await this.contract.getDexFee());
  }

  /**
   * Get creator address for a token
   * @param tokenAddress Token address
   * @returns Creator address
   */
  async getCreator(tokenAddress: string): Promise<string> {
    return this.contract.getCreator(tokenAddress);
  }

  /**
   * Get creator fee share
   * @returns Creator fee share in basis points (1000 = 10%)
   */
  async getCreatorFeeShare(): Promise<number> {
    return Number(await this.contract.getCreatorFeeShare());
  }

  /**
   * Get accumulated creator fees for a creator address
   * @param creatorAddress Creator wallet address
   * @returns Accumulated fees in wei (native currency)
   */
  async getCreatorFees(creatorAddress: string): Promise<bigint> {
    return this.contract.creatorFees(creatorAddress);
  }

  /**
   * Get the factory contract address
   */
  get address(): string {
    return (
      this.configService.get<string>('smartContracts.factoryAddress') || ''
    );
  }

  /**
   * Get the provider
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }
}
