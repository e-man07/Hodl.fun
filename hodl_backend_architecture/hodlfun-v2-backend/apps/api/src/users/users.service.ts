import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';
import { PaginationDto, PaginatedResponse } from '@hodlfun/common';
import { AuthType, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ============================================================================
  // NEW USER MODEL METHODS (Extended from UserPortfolio)
  // ============================================================================

  /**
   * Find a user by wallet address
   */
  async findByWallet(walletAddress: string): Promise<User | null> {
    const normalizedAddress = walletAddress.toLowerCase();
    return this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });
  }

  /**
   * Find a user by Push DID (for social login)
   */
  async findByPushDid(pushDid: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { pushDid },
    });
  }

  /**
   * Create a new user with wallet authentication
   */
  async createWalletUser(walletAddress: string): Promise<User> {
    const normalizedAddress = walletAddress.toLowerCase();
    return this.prisma.user.create({
      data: {
        walletAddress: normalizedAddress,
        authType: AuthType.WALLET,
      },
    });
  }

  /**
   * Create a new user with social (Push DID) authentication
   */
  async createSocialUser(params: { pushDid: string; email?: string }): Promise<User> {
    return this.prisma.user.create({
      data: {
        pushDid: params.pushDid,
        email: params.email,
        authType: AuthType.SOCIAL,
      },
    });
  }

  /**
   * Get or create a wallet user (upsert pattern)
   */
  async getOrCreateWalletUser(walletAddress: string): Promise<User> {
    const normalizedAddress = walletAddress.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        walletAddress: normalizedAddress,
        authType: AuthType.WALLET,
      },
    });
  }

  /**
   * Update the last login timestamp for a user
   */
  async updateLastLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Link a wallet address to an existing social user
   */
  async linkWalletToSocialUser(userId: string, walletAddress: string): Promise<User> {
    const normalizedAddress = walletAddress.toLowerCase();
    return this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: normalizedAddress },
    });
  }

  /**
   * Update user email
   */
  async updateEmail(userId: string, email: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { email },
    });
  }

  /**
   * Set admin status for a user
   */
  async setAdminStatus(userId: string, isAdmin: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isAdmin },
    });
  }

  /**
   * Find all admin users
   */
  async findAdmins(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { isAdmin: true },
    });
  }

  // ============================================================================
  // LEGACY METHODS (Using UserPortfolio for backward compatibility)
  // ============================================================================

  async getUser(address: string) {
    const normalizedAddress = address.toLowerCase();

    const portfolio = await this.prisma.userPortfolio.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    const holdingsCount = await this.prisma.holder.count({
      where: {
        holderAddress: normalizedAddress,
        balance: { not: '0' },
      },
    });

    const createdTokensCount = await this.prisma.token.count({
      where: { creatorAddress: normalizedAddress },
    });

    return {
      address: normalizedAddress,
      portfolio,
      holdingsCount,
      createdTokensCount,
    };
  }

  async getPortfolio(address: string) {
    const normalizedAddress = address.toLowerCase();

    return this.cache.getOrSet(`portfolio:${normalizedAddress}`, 30, async () => {
      const portfolio = await this.prisma.userPortfolio.findUnique({
        where: { walletAddress: normalizedAddress },
      });

      if (!portfolio) {
        return {
          walletAddress: normalizedAddress,
          totalInvested: '0',
          totalReturned: '0',
          totalTrades: 0,
          realizedPnl: '0',
        };
      }

      const realizedPnl =
        BigInt(portfolio.totalReturned) - BigInt(portfolio.totalInvested);

      return {
        ...portfolio,
        realizedPnl: realizedPnl.toString(),
      };
    });
  }

  async getHoldings(address: string, pagination: PaginationDto): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const normalizedAddress = address.toLowerCase();

    const [holdings, total] = await Promise.all([
      this.prisma.holder.findMany({
        where: {
          holderAddress: normalizedAddress,
          balance: { not: '0' },
        },
        skip,
        take: limit,
        include: {
          token: {
            select: {
              address: true,
              name: true,
              symbol: true,
              currentPrice: true,
              marketCap: true,
            },
          },
        },
        orderBy: { lastActivityTimestamp: 'desc' },
      }),
      this.prisma.holder.count({
        where: {
          holderAddress: normalizedAddress,
          balance: { not: '0' },
        },
      }),
    ]);

    return PaginatedResponse.create(holdings, page, limit, total);
  }

  async getTrades(address: string, pagination: PaginationDto): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const normalizedAddress = address.toLowerCase();

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where: { traderAddress: normalizedAddress },
        skip,
        take: limit,
        include: {
          token: {
            select: {
              address: true,
              name: true,
              symbol: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.trade.count({
        where: { traderAddress: normalizedAddress },
      }),
    ]);

    return PaginatedResponse.create(trades, page, limit, total);
  }

  async getCreatedTokens(address: string, pagination: PaginationDto): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const normalizedAddress = address.toLowerCase();

    const [tokens, total] = await Promise.all([
      this.prisma.token.findMany({
        where: { creatorAddress: normalizedAddress },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.token.count({
        where: { creatorAddress: normalizedAddress },
      }),
    ]);

    return PaginatedResponse.create(tokens, page, limit, total);
  }
}
