import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';
import { PaginatedResponse, PaginationDto } from '@hodlfun/common';

export type LeaderboardType = 'gainers' | 'losers' | 'volume' | 'new' | 'graduated';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Get leaderboard data from pre-computed cache
   * Falls back to on-demand computation if cache is empty
   */
  async getLeaderboard(
    type: LeaderboardType,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const cacheKey = `leaderboard:${type}`;

    // Try to read from pre-computed cache (populated by worker every 30s)
    const cachedData = await this.cache.get<unknown[]>(cacheKey);

    if (cachedData && cachedData.length > 0) {
      const paginatedData = cachedData.slice(skip, skip + limit);
      return PaginatedResponse.create(paginatedData, page, limit, cachedData.length);
    }

    // Fallback to on-demand computation if worker hasn't populated cache
    this.logger.warn(`Leaderboard cache miss for ${type}, computing on-demand`);
    return this.computeOnDemand(type, pagination);
  }

  /**
   * Fallback on-demand computation
   */
  private async computeOnDemand(
    type: LeaderboardType,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<unknown>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    switch (type) {
      case 'gainers':
      case 'losers':
        // For gainers/losers, fall back to market cap ordering
        const [tokens, total] = await Promise.all([
          this.prisma.token.findMany({
            where: { status: 'TRADING' },
            skip,
            take: limit,
            orderBy: { marketCap: type === 'gainers' ? 'desc' : 'asc' },
          }),
          this.prisma.token.count({ where: { status: 'TRADING' } }),
        ]);
        return PaginatedResponse.create(tokens, page, limit, total);

      case 'volume': {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [volumeTokens, volumeTotal] = await Promise.all([
          this.prisma.token.findMany({
            where: {
              status: 'TRADING',
              trades: { some: { timestamp: { gte: oneDayAgo } } },
            },
            skip,
            take: limit,
            orderBy: { marketCap: 'desc' },
          }),
          this.prisma.token.count({
            where: {
              status: 'TRADING',
              trades: { some: { timestamp: { gte: oneDayAgo } } },
            },
          }),
        ]);
        return PaginatedResponse.create(volumeTokens, page, limit, volumeTotal);
      }

      case 'new': {
        const [newTokens, newTotal] = await Promise.all([
          this.prisma.token.findMany({
            where: { status: 'TRADING' },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          this.prisma.token.count({ where: { status: 'TRADING' } }),
        ]);
        return PaginatedResponse.create(newTokens, page, limit, newTotal);
      }

      case 'graduated': {
        const [gradTokens, gradTotal] = await Promise.all([
          this.prisma.token.findMany({
            where: { status: 'LISTED' },
            skip,
            take: limit,
            orderBy: { graduatedAt: 'desc' },
          }),
          this.prisma.token.count({ where: { status: 'LISTED' } }),
        ]);
        return PaginatedResponse.create(gradTokens, page, limit, gradTotal);
      }

      default:
        throw new Error(`Unknown leaderboard type: ${type}`);
    }
  }
}
