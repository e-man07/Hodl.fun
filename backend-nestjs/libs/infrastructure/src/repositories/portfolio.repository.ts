import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core';
import { Portfolio, IPortfolioRepository } from '@domain';
import { UserPortfolio } from '@prisma/client';

/**
 * Interface for parsed holding JSON data
 */
interface ParsedHolding {
  tokenAddress: string;
  tokenSymbol: string;
  balance: string;
  avgBuyPrice: string;
  totalSpent: string;
  totalSold: string;
  realizedPNL: string;
}

/**
 * Portfolio Repository (Adapter)
 *
 * Implements IPortfolioRepository interface using Prisma ORM
 * Handles all database operations for Portfolio aggregates
 *
 * Portfolios track user token holdings and P&L
 */
@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  private readonly logger = new Logger(PortfolioRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Portfolio | null> {
    try {
      const portfolioData = await this.prisma.userPortfolio.findUnique({
        where: { id },
      });

      if (!portfolioData) {
        return null;
      }

      return this.mapPrismaToPortfolio(portfolioData);
    } catch (error) {
      this.logger.error(
        `Error finding portfolio by ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Portfolio | null> {
    try {
      const portfolioData = await this.prisma.userPortfolio.findUnique({
        where: { userId },
      });

      if (!portfolioData) {
        return null;
      }

      return this.mapPrismaToPortfolio(portfolioData);
    } catch (error) {
      this.logger.error(
        `Error finding portfolio for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  async findOrCreateByUserId(userId: string): Promise<Portfolio> {
    try {
      let portfolioData = await this.prisma.userPortfolio.findUnique({
        where: { userId },
      });

      // Create if doesn't exist
      if (!portfolioData) {
        const portfolio = Portfolio.create(userId);
        portfolioData = await this.prisma.userPortfolio.create({
          data: {
            id: portfolio.getId(),
            userId,
            holdings: JSON.stringify([]), // Empty holdings initially
            totalInvestedPUSH: '0',
            createdAt: portfolio.getCreatedAt(),
            updatedAt: portfolio.getUpdatedAt(),
          },
        });
      }

      return this.mapPrismaToPortfolio(portfolioData);
    } catch (error) {
      this.logger.error(
        `Error finding or creating portfolio for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  async save(portfolio: Portfolio): Promise<Portfolio> {
    try {
      const holdingsArray = portfolio.getHoldings();
      const portfolioData = await this.prisma.userPortfolio.upsert({
        where: { userId: portfolio.getUserId() },
        create: {
          id: portfolio.getId(),
          userId: portfolio.getUserId(),
          holdings: JSON.stringify(holdingsArray),
          totalInvestedPUSH: portfolio.getTotalInvestedPUSH().toString(),
          createdAt: portfolio.getCreatedAt(),
          updatedAt: portfolio.getUpdatedAt(),
        },
        update: {
          holdings: JSON.stringify(holdingsArray),
          totalInvestedPUSH: portfolio.getTotalInvestedPUSH().toString(),
          updatedAt: portfolio.getUpdatedAt(),
        },
      });

      return this.mapPrismaToPortfolio(portfolioData);
    } catch (error) {
      this.logger.error(
        `Error saving portfolio for user ${portfolio.getUserId()}: ${error.message}`,
      );
      throw error;
    }
  }

  async update(portfolio: Portfolio): Promise<Portfolio> {
    try {
      const holdings = portfolio.getHoldings();
      const portfolioData = await this.prisma.userPortfolio.update({
        where: { id: portfolio.getId() },
        data: {
          holdings: JSON.stringify(holdings),
          totalInvestedPUSH: portfolio.getTotalInvestedPUSH().toString(),
          updatedAt: portfolio.getUpdatedAt(),
        },
      });

      return this.mapPrismaToPortfolio(portfolioData);
    } catch (error) {
      this.logger.error(
        `Error updating portfolio ${portfolio.getId()}: ${error.message}`,
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.prisma.userPortfolio.delete({
        where: { id },
      });

      return !!result;
    } catch (error) {
      this.logger.error(`Error deleting portfolio ${id}: ${error.message}`);
      return false;
    }
  }

  async findPortfoliosHoldingToken(
    tokenAddress: string,
    options?: {
      limit?: number;
      offset?: number;
      minBalance?: bigint;
    },
  ): Promise<{
    portfolios: Portfolio[];
    total: number;
  }> {
    try {
      // Query all portfolios and filter by token holdings
      const allPortfolios = await this.prisma.userPortfolio.findMany();

      const normalizedAddress = tokenAddress.toLowerCase();
      const filtered = allPortfolios
        .map((p) => this.mapPrismaToPortfolio(p))
        .filter((p) => {
          const holdings = p.getHoldings();
          const holding = Array.from(holdings.values()).find(
            (h) => h.tokenAddress.toLowerCase() === normalizedAddress,
          );
          const minBalance = options?.minBalance || 0n;
          return holding && holding.balance > minBalance;
        });

      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const result = filtered.slice(offset, offset + limit);

      return {
        portfolios: result,
        total: filtered.length,
      };
    } catch (error) {
      this.logger.error(
        `Error finding portfolios holding token ${tokenAddress}: ${error.message}`,
      );
      throw error;
    }
  }

  async findTopByValue(
    tokenPrices: Map<string, bigint>,
    limit?: number,
  ): Promise<Portfolio[]> {
    try {
      const allPortfolios = await this.prisma.userPortfolio.findMany();

      const portfolios = allPortfolios
        .map((p) => this.mapPrismaToPortfolio(p))
        .sort((a, b) => {
          const valueA = a.getPortfolioValue(tokenPrices);
          const valueB = b.getPortfolioValue(tokenPrices);
          return Number(valueB - valueA);
        })
        .slice(0, limit || 10);

      return portfolios;
    } catch (error) {
      this.logger.error(
        `Error finding top portfolios by value: ${error.message}`,
      );
      throw error;
    }
  }

  async findMostDiversified(limit?: number): Promise<Portfolio[]> {
    try {
      const allPortfolios = await this.prisma.userPortfolio.findMany();

      const portfolios = allPortfolios
        .map((p) => this.mapPrismaToPortfolio(p))
        .sort((a, b) => b.getHoldings().length - a.getHoldings().length)
        .slice(0, limit || 10);

      return portfolios;
    } catch (error) {
      this.logger.error(
        `Error finding most diversified portfolios: ${error.message}`,
      );
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      return await this.prisma.userPortfolio.count();
    } catch (error) {
      this.logger.error(`Error counting portfolios: ${error.message}`);
      throw error;
    }
  }

  async countHoldersOfToken(tokenAddress: string): Promise<number> {
    try {
      const allPortfolios = await this.prisma.userPortfolio.findMany();

      const normalizedAddress = tokenAddress.toLowerCase();
      const holders = allPortfolios.filter((p) => {
        try {
          const holdings = JSON.parse(p.holdings || '[]') as ParsedHolding[];
          return holdings.some(
            (h: ParsedHolding) =>
              h.tokenAddress.toLowerCase() === normalizedAddress &&
              BigInt(h.balance) > 0n,
          );
        } catch {
          return false;
        }
      });

      return holders.length;
    } catch (error) {
      this.logger.error(
        `Error counting holders of token ${tokenAddress}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Map Prisma portfolio data to Portfolio domain aggregate
   */
  private mapPrismaToPortfolio(prismaPortfolioData: UserPortfolio): Portfolio {
    let holdings: Array<{
      tokenAddress: string;
      tokenSymbol: string;
      balance: bigint;
      avgBuyPrice: bigint;
      totalSpent: bigint;
      totalSold: bigint;
      realizedPNL: bigint;
    }> = [];

    try {
      const parsed = JSON.parse(prismaPortfolioData.holdings || '[]') as ParsedHolding[];
      holdings = parsed.map((h: ParsedHolding) => ({
        tokenAddress: h.tokenAddress,
        tokenSymbol: h.tokenSymbol,
        balance: BigInt(h.balance),
        avgBuyPrice: BigInt(h.avgBuyPrice),
        totalSpent: BigInt(h.totalSpent),
        totalSold: BigInt(h.totalSold),
        realizedPNL: BigInt(h.realizedPNL),
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(
        `Failed to parse holdings for portfolio ${prismaPortfolioData.id}: ${errorMessage}`,
      );
    }

    return Portfolio.reconstruct({
      id: prismaPortfolioData.id,
      userId: prismaPortfolioData.userId,
      holdings,
      totalInvestedPUSH: BigInt(prismaPortfolioData.totalInvestedPUSH),
      createdAt: prismaPortfolioData.createdAt,
      updatedAt: prismaPortfolioData.updatedAt,
    });
  }
}
