// Smart contract interaction service

import { Contract } from 'ethers';
import { rpcService } from './rpcService';
import { blockchainConfig } from '../config';
import { TOKEN_FACTORY_ABI, MARKETPLACE_ABI, ERC20_ABI } from '../contracts/abis';
import logger from '../utils/logger';

export class ContractService {
  private tokenFactory: Contract;
  private marketplace: Contract;

  constructor() {
    const provider = rpcService.getProvider();

    this.tokenFactory = new Contract(
      blockchainConfig.tokenFactory,
      TOKEN_FACTORY_ABI,
      provider
    );

    this.marketplace = new Contract(
      blockchainConfig.marketplace,
      MARKETPLACE_ABI,
      provider
    );

    logger.info('✅ Contract service initialized');
  }

  /**
   * Get all token addresses from factory
   */
  async getAllTokens(): Promise<string[]> {
    return rpcService.executeCall(async () => {
      return await this.tokenFactory.getAllTokens();
    });
  }

  /**
   * Get token info from factory
   */
  async getTokenFactoryInfo(tokenAddress: string) {
    return rpcService.executeCall(async () => {
      const info = await this.tokenFactory.getTokenInfo(tokenAddress);
      return {
        creator: info[0],
        totalSupply: info[1],
        reserveRatio: info[2],
        metadataURI: info[3],
      };
    });
  }

  /**
   * Get token info from marketplace
   */
  async getTokenMarketInfo(tokenAddress: string) {
    return rpcService.executeCall(async () => {
      const info = await this.marketplace.getTokenInfo(tokenAddress);
      return {
        currentSupply: info[0],
        reserveBalance: info[1],
        reserveRatio: info[2],
        tradingEnabled: info[3],
      };
    });
  }

  /**
   * Get current token price from marketplace
   */
  async getCurrentPrice(tokenAddress: string): Promise<bigint> {
    return rpcService.executeCall(async () => {
      return await this.marketplace.getCurrentPrice(tokenAddress);
    });
  }

  /**
   * Calculate purchase return
   */
  async calculatePurchaseReturn(
    tokenAddress: string,
    ethAmount: bigint
  ): Promise<bigint> {
    return rpcService.executeCall(async () => {
      return await this.marketplace.calculatePurchaseReturn(tokenAddress, ethAmount);
    });
  }

  /**
   * Calculate sale return
   */
  async calculateSaleReturn(
    tokenAddress: string,
    tokenAmount: bigint
  ): Promise<bigint> {
    return rpcService.executeCall(async () => {
      return await this.marketplace.calculateSaleReturn(tokenAddress, tokenAmount);
    });
  }

  /**
   * Get ERC20 token contract
   */
  getTokenContract(tokenAddress: string): Contract {
    const provider = rpcService.getProvider();
    return new Contract(tokenAddress, ERC20_ABI, provider);
  }

  /**
   * Get token details (name, symbol, etc.)
   */
  async getTokenDetails(tokenAddress: string) {
    return rpcService.executeCall(async () => {
      const tokenContract = this.getTokenContract(tokenAddress);

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply(),
      ]);

      return { name, symbol, decimals, totalSupply };
    });
  }

  /**
   * Get token balance for address
   */
  async getTokenBalance(tokenAddress: string, holderAddress: string): Promise<bigint> {
    return rpcService.executeCall(async () => {
      const tokenContract = this.getTokenContract(tokenAddress);
      return await tokenContract.balanceOf(holderAddress);
    });
  }

  /**
   * Query token Transfer events to get holders
   */
  async getTransferEvents(
    tokenAddress: string,
    fromBlock: number = 0,
    toBlock: number | 'latest' = 'latest'
  ) {
    return rpcService.executeCall(async () => {
      const tokenContract = this.getTokenContract(tokenAddress);
      const filter = tokenContract.filters.Transfer();
      return await tokenContract.queryFilter(filter, fromBlock, toBlock);
    });
  }

  /**
   * Get TokenCreated events from factory
   */
  async getTokenCreatedEvents(
    fromBlock: number = 0,
    toBlock: number | 'latest' = 'latest'
  ) {
    return rpcService.executeCall(async () => {
      const filter = this.tokenFactory.filters.TokenCreated();
      return await this.tokenFactory.queryFilter(filter, fromBlock, toBlock);
    });
  }

  /**
   * Get TokensBought events from marketplace
   */
  async getTokensBoughtEvents(
    fromBlock: number = 0,
    toBlock: number | 'latest' = 'latest',
    tokenAddress?: string
  ) {
    return rpcService.executeCall(async () => {
      const filter = tokenAddress
        ? this.marketplace.filters.TokensBought(null, tokenAddress)
        : this.marketplace.filters.TokensBought();
      return await this.marketplace.queryFilter(filter, fromBlock, toBlock);
    });
  }

  /**
   * Get TokensSold events from marketplace
   */
  async getTokensSoldEvents(
    fromBlock: number = 0,
    toBlock: number | 'latest' = 'latest',
    tokenAddress?: string
  ) {
    return rpcService.executeCall(async () => {
      const filter = tokenAddress
        ? this.marketplace.filters.TokensSold(null, tokenAddress)
        : this.marketplace.filters.TokensSold();
      return await this.marketplace.queryFilter(filter, fromBlock, toBlock);
    });
  }

  /**
   * Get TokenListed events from marketplace
   */
  async getTokenListedEvents(
    fromBlock: number = 0,
    toBlock: number | 'latest' = 'latest'
  ) {
    return rpcService.executeCall(async () => {
      const filter = this.marketplace.filters.TokenListed();
      return await this.marketplace.queryFilter(filter, fromBlock, toBlock);
    });
  }

  /**
   * Calculate market cap
   */
  async calculateMarketCap(tokenAddress: string): Promise<number> {
    const marketInfo = await this.getTokenMarketInfo(tokenAddress);
    const price = await this.getCurrentPrice(tokenAddress);

    const currentSupply = Number(marketInfo.currentSupply);
    const priceInEth = Number(price) / 1e18;

    return (currentSupply / 1e18) * priceInEth;
  }
}

// Export singleton instance
export const contractService = new ContractService();
