import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { CurveData, QuoteResult } from '../types';
import CoreAbi from '../abis/Core.json';

/**
 * CoreContractService
 *
 * Service for interacting with the Core orchestrator contract.
 * Provides read-only access to contract state and quote calculations.
 */
@Injectable()
export class CoreContractService implements OnModuleInit {
  private readonly logger = new Logger(CoreContractService.name);
  private provider!: JsonRpcProvider;
  private contract!: Contract;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
    const coreAddress = this.configService.get<string>('smartContracts.coreAddress');

    if (!rpcUrl || !coreAddress) {
      this.logger.warn('Missing RPC URL or Core contract address');
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.contract = new Contract(coreAddress, CoreAbi, this.provider);

    this.logger.log(`Initialized Core contract at ${coreAddress}`);
  }

  /**
   * Get curve data for a bonding curve
   * @param curveAddress Bonding curve address
   * @returns Virtual reserves and k value
   */
  async getCurveData(curveAddress: string): Promise<CurveData> {
    const [virtualNative, virtualToken, k] =
      await this.contract.getCurveData(curveAddress);
    return {
      virtualNative,
      virtualToken,
      k,
    };
  }

  /**
   * Get current token price
   * @param tokenAddress Token address
   * @returns Price per token in native currency (scaled by 1e18)
   */
  async getCurrentPrice(tokenAddress: string): Promise<bigint> {
    return this.contract.getCurrentPrice(tokenAddress);
  }

  /**
   * Calculate market cap for a token
   * @param tokenAddress Token address
   * @returns Market cap in native currency
   */
  async calculateMarketCap(tokenAddress: string): Promise<bigint> {
    return this.contract.calculateMarketCap(tokenAddress);
  }

  /**
   * Calculate amount out for given input
   * @param amountIn Input amount
   * @param k Constant product
   * @param reserveIn Input reserve
   * @param reserveOut Output reserve
   * @returns Output amount
   */
  async getAmountOut(
    amountIn: bigint,
    k: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
  ): Promise<bigint> {
    return this.contract.getAmountOut(amountIn, k, reserveIn, reserveOut);
  }

  /**
   * Calculate amount in for given output
   * @param amountOut Output amount
   * @param k Constant product
   * @param reserveIn Input reserve
   * @param reserveOut Output reserve
   * @returns Input amount
   */
  async getAmountIn(
    amountOut: bigint,
    k: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
  ): Promise<bigint> {
    return this.contract.getAmountIn(amountOut, k, reserveIn, reserveOut);
  }

  /**
   * Get fee vault address
   * @returns Fee vault address
   */
  async getFeeVault(): Promise<string> {
    return this.contract.getFeeVault();
  }

  /**
   * Get factory address
   * @returns Factory address
   */
  async getFactory(): Promise<string> {
    return this.contract.factory();
  }

  /**
   * Quote exact input buy
   * @param tokenAddress Token address
   * @param amountIn Amount of native to spend
   * @returns Quote result with amount out and price impact
   */
  async quoteExactInBuy(
    tokenAddress: string,
    amountIn: bigint,
  ): Promise<QuoteResult> {
    const curveData = await this.getCurveData(tokenAddress);
    const { virtualNative, virtualToken, k } = curveData;

    const amountOut = await this.getAmountOut(
      amountIn,
      k,
      virtualNative,
      virtualToken,
    );

    // Calculate price impact
    const spotPrice = (virtualToken * 10n ** 18n) / virtualNative;
    const executionPrice = (amountOut * 10n ** 18n) / amountIn;
    const priceImpact =
      ((spotPrice - executionPrice) * 10000n) / spotPrice;

    // Calculate fee (1% default)
    const fee = amountIn / 100n;

    return {
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      priceImpact: priceImpact.toString(),
      fee: fee.toString(),
    };
  }

  /**
   * Quote exact input sell
   * @param tokenAddress Token address
   * @param amountIn Amount of tokens to sell
   * @returns Quote result with amount out and price impact
   */
  async quoteExactInSell(
    tokenAddress: string,
    amountIn: bigint,
  ): Promise<QuoteResult> {
    const curveData = await this.getCurveData(tokenAddress);
    const { virtualNative, virtualToken, k } = curveData;

    const amountOut = await this.getAmountOut(
      amountIn,
      k,
      virtualToken,
      virtualNative,
    );

    // Calculate price impact
    const spotPrice = (virtualNative * 10n ** 18n) / virtualToken;
    const executionPrice = (amountOut * 10n ** 18n) / amountIn;
    const priceImpact =
      ((spotPrice - executionPrice) * 10000n) / spotPrice;

    // Calculate fee (1% default)
    const fee = amountOut / 100n;

    return {
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      priceImpact: priceImpact.toString(),
      fee: fee.toString(),
    };
  }

  /**
   * Quote exact output buy
   * @param tokenAddress Token address
   * @param amountOut Exact amount of tokens to receive
   * @returns Quote result with amount in and price impact
   */
  async quoteExactOutBuy(
    tokenAddress: string,
    amountOut: bigint,
  ): Promise<QuoteResult> {
    const curveData = await this.getCurveData(tokenAddress);
    const { virtualNative, virtualToken, k } = curveData;

    const amountIn = await this.getAmountIn(
      amountOut,
      k,
      virtualNative,
      virtualToken,
    );

    // Calculate price impact
    const spotPrice = (virtualToken * 10n ** 18n) / virtualNative;
    const executionPrice = (amountOut * 10n ** 18n) / amountIn;
    const priceImpact =
      ((spotPrice - executionPrice) * 10000n) / spotPrice;

    // Calculate fee (1% default)
    const fee = amountIn / 100n;

    return {
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      priceImpact: priceImpact.toString(),
      fee: fee.toString(),
    };
  }

  /**
   * Quote exact output sell
   * @param tokenAddress Token address
   * @param amountOut Exact amount of native to receive
   * @returns Quote result with amount in and price impact
   */
  async quoteExactOutSell(
    tokenAddress: string,
    amountOut: bigint,
  ): Promise<QuoteResult> {
    const curveData = await this.getCurveData(tokenAddress);
    const { virtualNative, virtualToken, k } = curveData;

    const amountIn = await this.getAmountIn(
      amountOut,
      k,
      virtualToken,
      virtualNative,
    );

    // Calculate price impact
    const spotPrice = (virtualNative * 10n ** 18n) / virtualToken;
    const executionPrice = (amountOut * 10n ** 18n) / amountIn;
    const priceImpact =
      ((spotPrice - executionPrice) * 10000n) / spotPrice;

    // Calculate fee (1% default)
    const fee = amountOut / 100n;

    return {
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      priceImpact: priceImpact.toString(),
      fee: fee.toString(),
    };
  }

  /**
   * Get the core contract address
   */
  get address(): string {
    return this.configService.get<string>('smartContracts.coreAddress') || '';
  }

  /**
   * Get the provider
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }
}
