import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { RealReserves, VirtualReserves, FeeConfig, ATHData } from '../types';
import BondingCurveAbi from '../abis/BondingCurve.json';

/**
 * BondingCurveContractService
 *
 * Service for interacting with individual BondingCurve contracts.
 * Provides read-only access to curve state and metrics.
 */
@Injectable()
export class BondingCurveContractService implements OnModuleInit {
  private readonly logger = new Logger(BondingCurveContractService.name);
  private provider!: JsonRpcProvider;
  private contractCache: Map<string, Contract> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');

    if (!rpcUrl) {
      this.logger.warn('Missing RPC URL');
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.logger.log('Initialized BondingCurve contract service');
  }

  /**
   * Get or create a contract instance for a curve address
   * @param curveAddress Bonding curve address
   * @returns Contract instance
   */
  private getContract(curveAddress: string): Contract {
    let contract = this.contractCache.get(curveAddress);
    if (!contract) {
      contract = new Contract(curveAddress, BondingCurveAbi, this.provider);
      this.contractCache.set(curveAddress, contract);
    }
    return contract;
  }

  /**
   * Get real reserves for a curve
   * @param curveAddress Bonding curve address
   * @returns Real native and token reserves
   */
  async getReserves(curveAddress: string): Promise<RealReserves> {
    const contract = this.getContract(curveAddress);
    const [nativeReserves, tokenReserves] = await contract.getReserves();
    return {
      nativeReserves,
      tokenReserves,
    };
  }

  /**
   * Get virtual reserves for a curve
   * @param curveAddress Bonding curve address
   * @returns Virtual native and token reserves
   */
  async getVirtualReserves(curveAddress: string): Promise<VirtualReserves> {
    const contract = this.getContract(curveAddress);
    const [virtualNativeReserve, virtualTokenReserve] =
      await contract.getVirtualReserves();
    return {
      virtualNativeReserve,
      virtualTokenReserve,
    };
  }

  /**
   * Get constant product k
   * @param curveAddress Bonding curve address
   * @returns Constant product value
   */
  async getK(curveAddress: string): Promise<bigint> {
    const contract = this.getContract(curveAddress);
    return contract.getK();
  }

  /**
   * Get graduation market cap threshold
   * @param curveAddress Bonding curve address
   * @returns Graduation market cap in native currency
   */
  async getGraduationMarketCap(curveAddress: string): Promise<bigint> {
    const contract = this.getContract(curveAddress);
    return contract.getGraduationMarketCap();
  }

  /**
   * Get lock status
   * @param curveAddress Bonding curve address
   * @returns True if curve is locked (trading disabled)
   */
  async getLock(curveAddress: string): Promise<boolean> {
    const contract = this.getContract(curveAddress);
    return contract.getLock();
  }

  /**
   * Get listing status
   * @param curveAddress Bonding curve address
   * @returns True if token is listed on DEX
   */
  async getIsListing(curveAddress: string): Promise<boolean> {
    const contract = this.getContract(curveAddress);
    return contract.getIsListing();
  }

  /**
   * Get fee configuration
   * @param curveAddress Bonding curve address
   * @returns Fee denominator and numerator
   */
  async getFeeConfig(curveAddress: string): Promise<FeeConfig> {
    const contract = this.getContract(curveAddress);
    const [denominator, numerator] = await contract.getFeeConfig();
    return {
      denominator: Number(denominator),
      numerator: Number(numerator),
    };
  }

  /**
   * Get current token price
   * @param curveAddress Bonding curve address
   * @returns Price per token in native currency (scaled by 1e18)
   */
  async getCurrentPrice(curveAddress: string): Promise<bigint> {
    const contract = this.getContract(curveAddress);
    return contract.getCurrentPrice();
  }

  /**
   * Calculate current market cap
   * @param curveAddress Bonding curve address
   * @returns Market cap in native currency
   */
  async calculateMarketCap(curveAddress: string): Promise<bigint> {
    const contract = this.getContract(curveAddress);
    return contract.calculateMarketCap();
  }

  /**
   * Get all-time high price
   * @param curveAddress Bonding curve address
   * @returns ATH price and timestamp
   */
  async getATHPrice(curveAddress: string): Promise<ATHData> {
    const contract = this.getContract(curveAddress);
    const [value, timestamp] = await contract.getATHPrice();
    return {
      value,
      timestamp,
    };
  }

  /**
   * Get all-time high market cap
   * @param curveAddress Bonding curve address
   * @returns ATH market cap and timestamp
   */
  async getATHMarketCap(curveAddress: string): Promise<ATHData> {
    const contract = this.getContract(curveAddress);
    const [value, timestamp] = await contract.getATHMarketCap();
    return {
      value,
      timestamp,
    };
  }

  /**
   * Check if curve is ready for graduation to DEX
   * @param curveAddress Bonding curve address
   * @returns True if market cap exceeds threshold and not already locked/listed
   */
  async isReadyForGraduation(curveAddress: string): Promise<boolean> {
    const [marketCap, graduationMarketCap, isLocked, isListed] =
      await Promise.all([
        this.calculateMarketCap(curveAddress),
        this.getGraduationMarketCap(curveAddress),
        this.getLock(curveAddress),
        this.getIsListing(curveAddress),
      ]);

    // Ready for graduation if market cap exceeds threshold and not already locked/listed
    return marketCap >= graduationMarketCap && !isLocked && !isListed;
  }

  /**
   * Get full curve state
   * @param curveAddress Bonding curve address
   * @returns Complete curve state
   */
  async getCurveState(curveAddress: string): Promise<{
    reserves: RealReserves;
    virtualReserves: VirtualReserves;
    k: bigint;
    price: bigint;
    marketCap: bigint;
    graduationMarketCap: bigint;
    isLocked: boolean;
    isListed: boolean;
    feeConfig: FeeConfig;
  }> {
    const [
      reserves,
      virtualReserves,
      k,
      price,
      marketCap,
      graduationMarketCap,
      isLocked,
      isListed,
      feeConfig,
    ] = await Promise.all([
      this.getReserves(curveAddress),
      this.getVirtualReserves(curveAddress),
      this.getK(curveAddress),
      this.getCurrentPrice(curveAddress),
      this.calculateMarketCap(curveAddress),
      this.getGraduationMarketCap(curveAddress),
      this.getLock(curveAddress),
      this.getIsListing(curveAddress),
      this.getFeeConfig(curveAddress),
    ]);

    return {
      reserves,
      virtualReserves,
      k,
      price,
      marketCap,
      graduationMarketCap,
      isLocked,
      isListed,
      feeConfig,
    };
  }

  /**
   * Get the provider
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }

  /**
   * Clear contract cache
   */
  clearCache(): void {
    this.contractCache.clear();
  }
}
