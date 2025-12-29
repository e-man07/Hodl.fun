import { PrismaService } from '@core/database/prisma.service';

/**
 * Test Data Factories
 *
 * Factory functions for creating test tokens, trades, and portfolios
 */
export class TestDataFactory {
  private tokenCounter = 0;
  private userCounter = 0;
  private tradeCounter = 0;

  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique Ethereum address
   */
  generateAddress(): string {
    return '0x' + Math.random().toString(16).slice(2).padEnd(40, '0').substring(0, 40);
  }

  /**
   * Generate unique token address
   */
  generateTokenAddress(): string {
    return '0x' + this.tokenCounter.toString().padStart(40, '0');
  }

  /**
   * Generate unique user address
   */
  generateUserAddress(): string {
    this.userCounter++;
    return '0x' + (1000000 + this.userCounter).toString().padStart(40, '0');
  }

  /**
   * Generate unique transaction hash
   */
  generateTxHash(): string {
    this.tradeCounter++;
    return '0x' + this.tradeCounter.toString().padStart(64, '0');
  }

  /**
   * Create a test token
   */
  async createToken(overrides?: any) {
    this.tokenCounter++;
    const address = overrides?.address || this.generateTokenAddress();
    const creator = overrides?.creator || this.generateUserAddress();

    const token = await this.prisma.token.create({
      data: {
        address,
        name: overrides?.name || `Test Token ${this.tokenCounter}`,
        symbol: overrides?.symbol || `TT${this.tokenCounter}`,
        creator,
        decimals: overrides?.decimals || 18,
        reserveRatio: overrides?.reserveRatio || 50,
        totalSupply: (overrides?.totalSupply || '1000000000000000000000000').toString(),
        virtualNativeReserve: (overrides?.virtualNativeReserve || '100000000000000000').toString(),
        virtualTokenReserve: (overrides?.virtualTokenReserve || '1000000000000000000000000').toString(),
        currentPrice: (overrides?.currentPrice || '1000000000000000').toString(),
        marketCap: (overrides?.marketCap || '1000000000000000000000').toString(),
        athPrice: (overrides?.athPrice || '1000000000000000').toString(),
        athMarketCap: (overrides?.athMarketCap || '1000000000000000000000').toString(),
        athPriceTimestamp: overrides?.athPriceTimestamp || new Date(),
        athMarketCapTimestamp: overrides?.athMarketCapTimestamp || new Date(),
        isLocked: overrides?.isLocked || false,
        isListed: overrides?.isListed || false,
        uniswapV3Pool: overrides?.uniswapV3Pool || null,
        listingTimestamp: overrides?.listingTimestamp || null,
        holderCount: overrides?.holderCount || 0,
        volume24h: (overrides?.volume24h || '0').toString(),
        priceChange24h: overrides?.priceChange24h || 0,
        blockNumber: overrides?.blockNumber || 0,
        transactionHash: overrides?.transactionHash || '0x' + '0'.repeat(64),
        createdAt: overrides?.createdAt || new Date(),
        updatedAt: overrides?.updatedAt || new Date(),
      },
    });

    return token;
  }

  /**
   * Create multiple tokens
   */
  async createTokens(count: number, overrides?: any) {
    const tokens = [];
    for (let i = 0; i < count; i++) {
      const token = await this.createToken(overrides);
      tokens.push(token);
    }
    return tokens;
  }

  /**
   * Create a transaction (trade)
   */
  async createTransaction(overrides?: any) {
    const tokenAddress = overrides?.tokenAddress || (await this.createToken()).address;
    const userAddress = overrides?.userAddress || this.generateUserAddress();

    const transaction = await this.prisma.transaction.create({
      data: {
        hash: overrides?.hash || this.generateTxHash(),
        userAddress,
        tokenAddress,
        type: overrides?.type || 'BUY',
        amountIn: (overrides?.amountIn || '1000000000000000000').toString(),
        amountOut: (overrides?.amountOut || '50000000000000000000000').toString(),
        price: (overrides?.price || '20000000000000000').toString(),
        timestamp: overrides?.timestamp || new Date(),
        blockNumber: overrides?.blockNumber || 12345,
        status: overrides?.status || 'CONFIRMED',
      },
    });

    return transaction;
  }

  /**
   * Create buy transaction
   */
  async createBuyTransaction(tokenAddress?: string, userAddress?: string) {
    return this.createTransaction({
      tokenAddress: tokenAddress || (await this.createToken()).address,
      userAddress: userAddress || this.generateUserAddress(),
      type: 'BUY',
    });
  }

  /**
   * Create sell transaction
   */
  async createSellTransaction(tokenAddress?: string, userAddress?: string) {
    return this.createTransaction({
      tokenAddress: tokenAddress || (await this.createToken()).address,
      userAddress: userAddress || this.generateUserAddress(),
      type: 'SELL',
    });
  }

  /**
   * Create multiple transactions
   */
  async createTransactions(count: number, overrides?: any) {
    const transactions = [];
    for (let i = 0; i < count; i++) {
      const tx = await this.createTransaction(overrides);
      transactions.push(tx);
    }
    return transactions;
  }

  /**
   * Create a user portfolio
   */
  async createPortfolio(overrides?: any) {
    const userId = overrides?.userId || this.generateUserAddress();

    const portfolio = await this.prisma.userPortfolio.create({
      data: {
        userId,
        holdings: overrides?.holdings || '{}',
        totalInvestedPUSH: (overrides?.totalInvestedPUSH || '0').toString(),
        createdAt: overrides?.createdAt || new Date(),
        updatedAt: overrides?.updatedAt || new Date(),
      },
    });

    return portfolio;
  }

  /**
   * Create user position (holding) in token
   */
  async createPosition(overrides?: any) {
    const userAddress = overrides?.userAddress || this.generateUserAddress();
    const tokenAddress = overrides?.tokenAddress || (await this.createToken()).address;

    const position = await this.prisma.userPosition.create({
      data: {
        userAddress,
        tokenAddress,
        balance: (overrides?.balance || '1000000000000000000000000').toString(),
        averagePrice: (overrides?.averagePrice || '1000000000000000').toString(),
        totalInvested: (overrides?.totalInvested || '1000000000000000000').toString(),
        totalSold: (overrides?.totalSold || '0').toString(),
        realizedPnL: (overrides?.realizedPnL || '0').toString(),
        unrealizedPnL: (overrides?.unrealizedPnL || '0').toString(),
      },
    });

    return position;
  }

  /**
   * Create multiple positions
   */
  async createPositions(count: number, userAddress?: string) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const position = await this.createPosition({
        userAddress: userAddress || this.generateUserAddress(),
      });
      positions.push(position);
    }
    return positions;
  }

  /**
   * Create a complete trading scenario
   */
  async createTradingScenario() {
    // Create token
    const token = await this.createToken();

    // Create multiple users
    const users = [
      this.generateUserAddress(),
      this.generateUserAddress(),
      this.generateUserAddress(),
    ];

    // Create buy transactions from each user
    const transactions = [];
    for (const user of users) {
      const tx = await this.createBuyTransaction(token.address, user);
      transactions.push(tx);
    }

    // Create positions for each user
    const positions = [];
    for (const user of users) {
      const position = await this.createPosition({
        userAddress: user,
        tokenAddress: token.address,
      });
      positions.push(position);
    }

    return {
      token,
      users,
      transactions,
      positions,
    };
  }

  /**
   * Create a graduated token scenario
   */
  async createGraduatedTokenScenario() {
    const token = await this.createToken({
      isLocked: true,
      isListed: true,
      uniswapV3Pool: this.generateAddress(),
      listingTimestamp: new Date(),
    });

    const users = [
      this.generateUserAddress(),
      this.generateUserAddress(),
    ];

    const transactions = [];
    for (const user of users) {
      const tx = await this.createTransaction({
        tokenAddress: token.address,
        userAddress: user,
      });
      transactions.push(tx);
    }

    return {
      token,
      users,
      transactions,
    };
  }

  /**
   * Create token with ATH tracking scenario
   */
  async createAthTrackingScenario() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const token = await this.createToken({
      currentPrice: BigInt('2000000000000000'),
      marketCap: BigInt('2000000000000000000000'),
      athPrice: BigInt('3000000000000000'),
      athMarketCap: BigInt('3000000000000000000000'),
      athPriceTimestamp: oneHourAgo,
      athMarketCapTimestamp: oneHourAgo,
    });

    return token;
  }
}
