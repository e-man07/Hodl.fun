import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, PriceInterval } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';
import { PaginationDto, PaginatedResponse } from '@hodlfun/common';
import { GetTokensDto } from './dto/tokens.dto';

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll(query: GetTokensDto): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [tokens, total] = await Promise.all([
      this.prisma.token.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.token.count({ where }),
    ]);

    return PaginatedResponse.create(tokens, page, limit, total);
  }

  async findByAddress(address: string) {
    const normalizedAddress = address.toLowerCase();

    return this.cache.getOrSet(`token:${normalizedAddress}`, 10, async () => {
      const token = await this.prisma.token.findUnique({
        where: { address: normalizedAddress },
      });

      if (!token) {
        throw new NotFoundException('Token not found');
      }

      return token;
    });
  }

  async getTrades(address: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const normalizedAddress = address.toLowerCase();

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where: { tokenAddress: normalizedAddress },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.trade.count({
        where: { tokenAddress: normalizedAddress },
      }),
    ]);

    return PaginatedResponse.create(trades, page, limit, total);
  }

  async getHolders(address: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const normalizedAddress = address.toLowerCase();

    const [holders, total] = await Promise.all([
      this.prisma.holder.findMany({
        where: { tokenAddress: normalizedAddress },
        skip,
        take: limit,
        orderBy: { balance: 'desc' },
      }),
      this.prisma.holder.count({
        where: { tokenAddress: normalizedAddress },
      }),
    ]);

    return PaginatedResponse.create(holders, page, limit, total);
  }

  async getPriceHistory(address: string, interval: PriceInterval) {
    const normalizedAddress = address.toLowerCase();

    return this.cache.getOrSet(`candles:${normalizedAddress}:${interval}`, 5, async () => {
      return this.prisma.priceHistory.findMany({
        where: {
          tokenAddress: normalizedAddress,
          interval,
        },
        orderBy: { timestamp: 'desc' },
        take: 500,
      });
    });
  }

  async getTrending(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    return this.cache.getOrSet(`trending:${page}:${limit}`, 30, async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const tokens = await this.prisma.token.findMany({
        where: {
          status: 'TRADING',
          trades: {
            some: {
              timestamp: { gte: oneDayAgo },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { marketCap: 'desc' },
      });

      const total = await this.prisma.token.count({
        where: {
          status: 'TRADING',
          trades: {
            some: {
              timestamp: { gte: oneDayAgo },
            },
          },
        },
      });

      return PaginatedResponse.create(tokens, page, limit, total);
    });
  }

  async getNew(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      this.prisma.token.findMany({
        where: { status: 'TRADING' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.token.count({ where: { status: 'TRADING' } }),
    ]);

    return PaginatedResponse.create(tokens, page, limit, total);
  }
}
