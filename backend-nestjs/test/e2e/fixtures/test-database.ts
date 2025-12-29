import { PrismaService } from '@core/database/prisma.service';

/**
 * Test Database Utilities
 *
 * Provides database setup, teardown, and reset utilities for E2E tests
 */
export class TestDatabase {
  constructor(private prisma: PrismaService) {}

  /**
   * Reset all tables to clean state
   */
  async reset(): Promise<void> {
    // Delete in reverse dependency order to avoid foreign key constraints
    await this.prisma.userPosition.deleteMany({});
    await this.prisma.userPortfolio.deleteMany({});
    await this.prisma.transaction.deleteMany({});
    await this.prisma.token.deleteMany({});
  }

  /**
   * Delete all data and reset sequences
   */
  async clean(): Promise<void> {
    await this.reset();
  }

  /**
   * Verify database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get count of records in a table
   */
  async getTokenCount(): Promise<number> {
    return this.prisma.token.count();
  }

  async getTransactionCount(): Promise<number> {
    return this.prisma.transaction.count();
  }

  async getPortfolioCount(): Promise<number> {
    return this.prisma.userPortfolio.count();
  }

  async getPositionCount(): Promise<number> {
    return this.prisma.userPosition.count();
  }

  /**
   * Verify token exists in database
   */
  async tokenExists(address: string): Promise<boolean> {
    const token = await this.prisma.token.findUnique({
      where: { address },
    });
    return !!token;
  }

  /**
   * Verify transaction exists
   */
  async transactionExists(hash: string): Promise<boolean> {
    const tx = await this.prisma.transaction.findUnique({
      where: { hash },
    });
    return !!tx;
  }

  /**
   * Verify portfolio exists for user
   */
  async portfolioExists(userId: string): Promise<boolean> {
    const portfolio = await this.prisma.userPortfolio.findUnique({
      where: { userId },
    });
    return !!portfolio;
  }

  /**
   * Get token by address
   */
  async getToken(address: string) {
    return this.prisma.token.findUnique({
      where: { address },
    });
  }

  /**
   * Get portfolio by user ID
   */
  async getPortfolio(userId: string) {
    return this.prisma.userPortfolio.findUnique({
      where: { userId },
    });
  }

  /**
   * Get all transactions for a token
   */
  async getTokenTransactions(tokenAddress: string) {
    return this.prisma.transaction.findMany({
      where: { tokenAddress },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(userAddress: string) {
    return this.prisma.transaction.findMany({
      where: { userAddress },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Get total supply of token
   */
  async getTokenTotalSupply(tokenAddress: string): Promise<bigint | null> {
    const token = await this.getToken(tokenAddress);
    return token?.totalSupply ? BigInt(token.totalSupply) : null;
  }

  /**
   * Get current price of token
   */
  async getTokenPrice(tokenAddress: string): Promise<bigint | null> {
    const token = await this.getToken(tokenAddress);
    return token?.currentPrice ? BigInt(token.currentPrice) : null;
  }

  /**
   * Get market cap of token
   */
  async getTokenMarketCap(tokenAddress: string): Promise<bigint | null> {
    const token = await this.getToken(tokenAddress);
    return token?.marketCap ? BigInt(token.marketCap) : null;
  }

  /**
   * Check if token is locked
   */
  async isTokenLocked(tokenAddress: string): Promise<boolean> {
    const token = await this.getToken(tokenAddress);
    return token?.isLocked ?? false;
  }

  /**
   * Check if token is listed on Uniswap
   */
  async isTokenListed(tokenAddress: string): Promise<boolean> {
    const token = await this.getToken(tokenAddress);
    return token?.isListed ?? false;
  }

  /**
   * Get user's position in token
   */
  async getUserPosition(userAddress: string, tokenAddress: string) {
    return this.prisma.userPosition.findUnique({
      where: {
        userAddress_tokenAddress: {
          userAddress,
          tokenAddress,
        },
      },
    });
  }

  /**
   * Get user's balance in token
   */
  async getUserBalance(userAddress: string, tokenAddress: string): Promise<bigint | null> {
    const position = await this.getUserPosition(userAddress, tokenAddress);
    return position?.balance ? BigInt(position.balance) : null;
  }

  /**
   * Get user's portfolio value
   */
  async getUserPortfolioValue(userId: string): Promise<bigint | null> {
    const portfolio = await this.getPortfolio(userId);
    if (!portfolio) return null;

    // Parse holdings JSON and calculate total value
    const holdings = JSON.parse(portfolio.holdings || '{}');
    let totalValue = BigInt(0);

    for (const [tokenAddress, balance] of Object.entries(holdings)) {
      const price = await this.getTokenPrice(tokenAddress);
      if (price) {
        totalValue += BigInt(balance as string) * price;
      }
    }

    return totalValue;
  }
}
