import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';
import { PaginationDto, PaginatedResponse } from '@hodlfun/common';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

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

  async getHoldings(address: string, pagination: PaginationDto) {
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

  async getTrades(address: string, pagination: PaginationDto) {
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

  async getCreatedTokens(address: string, pagination: PaginationDto) {
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
