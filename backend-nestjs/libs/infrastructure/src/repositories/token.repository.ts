import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core';
import {
  Token,
  TokenAddress,
  ITokenRepository,
} from '@domain';

/**
 * Token Repository (Adapter)
 *
 * Implements ITokenRepository interface using Prisma ORM
 * Handles all database operations for Token aggregate
 *
 * This is the "adapter" in hexagonal architecture:
 * - Domain defines the "port" (ITokenRepository interface)
 * - Infrastructure implements the "adapter" (this class)
 * - Swappable: could be replaced with MongoDB, Firebase, etc.
 */
@Injectable()
export class TokenRepository implements ITokenRepository {
  private readonly logger = new Logger(TokenRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Token | null> {
    try {
      const tokenData = await this.prisma.token.findUnique({
        where: { id },
      });

      if (!tokenData) {
        return null;
      }

      return this.mapPrismaToToken(tokenData);
    } catch (error) {
      this.logger.error(`Error finding token by ID ${id}: ${error.message}`);
      throw error;
    }
  }

  async findByAddress(address: TokenAddress): Promise<Token | null> {
    return this.findByAddressString(address.toString());
  }

  async findByAddressString(address: string): Promise<Token | null> {
    try {
      const normalizedAddress = address.toLowerCase();
      const tokenData = await this.prisma.token.findUnique({
        where: { address: normalizedAddress },
      });

      if (!tokenData) {
        return null;
      }

      return this.mapPrismaToToken(tokenData);
    } catch (error) {
      this.logger.error(
        `Error finding token by address ${address}: ${error.message}`,
      );
      throw error;
    }
  }

  async findAll(
    filter?: {
      creator?: string;
      isLocked?: boolean;
      isListed?: boolean;
    },
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'marketCap' | 'currentPrice';
      orderDirection?: 'asc' | 'desc';
    },
  ): Promise<{
    tokens: Token[];
    total: number;
  }> {
    try {
      const where: any = {};

      if (filter?.creator) {
        where.creator = filter.creator;
      }
      if (filter?.isLocked !== undefined) {
        where.isLocked = filter.isLocked;
      }
      if (filter?.isListed !== undefined) {
        where.isListed = filter.isListed;
      }

      const sortBy = options?.orderBy || 'createdAt';
      const sortDirection = options?.orderDirection || 'desc';
      const orderBy = {
        [sortBy]: sortDirection === 'asc' ? 'asc' : 'desc',
      };

      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const [tokenDataList, total] = await Promise.all([
        this.prisma.token.findMany({
          where,
          orderBy,
          take: limit,
          skip: offset,
        }),
        this.prisma.token.count({ where }),
      ]);

      const tokens = tokenDataList.map((data) => this.mapPrismaToToken(data));

      return {
        tokens,
        total,
      };
    } catch (error) {
      this.logger.error(`Error finding all tokens: ${error.message}`);
      throw error;
    }
  }

  async findByCreator(
    creator: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    tokens: Token[];
    total: number;
  }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const [tokenDataList, total] = await Promise.all([
        this.prisma.token.findMany({
          where: { creator },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.token.count({ where: { creator } }),
      ]);

      const tokens = tokenDataList.map((data) => this.mapPrismaToToken(data));

      return {
        tokens,
        total,
      };
    } catch (error) {
      this.logger.error(
        `Error finding tokens by creator ${creator}: ${error.message}`,
      );
      throw error;
    }
  }

  async save(token: Token): Promise<Token> {
    try {
      const reserveBalance = token.getReserveBalance();
      const tokenData = await this.prisma.token.create({
        data: {
          id: token.getId(),
          address: token.getAddress().toString(),
          name: token.getName(),
          symbol: token.getSymbol(),
          creator: token.getCreator(),
          decimals: token.getDecimals(),
          totalSupply: token.getTotalSupply().toString(),
          reserveRatio: 50, // Default reserve ratio, can be parameterized
          realNativeReserve: reserveBalance.realNativeReserve.toString(),
          realTokenReserve: reserveBalance.realTokenReserve.toString(),
          virtualNativeReserve: reserveBalance.virtualNativeReserve.toString(),
          virtualTokenReserve: reserveBalance.virtualTokenReserve.toString(),
          currentPrice: token.getCurrentPrice().toBigInt().toString(),
          marketCap: token.getMarketCap().toBigInt().toString(),
          athPrice: token.getATHPrice().toBigInt().toString(),
          athMarketCap: token.getATHMarketCap().toBigInt().toString(),
          athPriceTimestamp: token.getATHPriceTimestamp(),
          athMarketCapTimestamp: token.getATHMarketCapTimestamp(),
          isLocked: token.getIsLocked(),
          isListed: token.getIsListed(),
          uniswapV3Pool: token.getUniswapV3Pool(),
          listingTimestamp: token.getListingTimestamp(),
          graduationThreshold: token.getGraduationThreshold().toString(),
          blockNumber: 0n, // Placeholder, should be from blockchain event
          transactionHash: '', // Placeholder, should be from blockchain event
          createdAt: token.getCreatedAt(),
          updatedAt: token.getUpdatedAt(),
        },
      });

      return this.mapPrismaToToken(tokenData);
    } catch (error) {
      this.logger.error(
        `Error saving token ${token.getId()}: ${error.message}`,
      );
      throw error;
    }
  }

  async update(token: Token): Promise<Token> {
    try {
      const reserveBalance = token.getReserveBalance();
      const tokenData = await this.prisma.token.update({
        where: { id: token.getId() },
        data: {
          realNativeReserve: reserveBalance.realNativeReserve.toString(),
          realTokenReserve: reserveBalance.realTokenReserve.toString(),
          virtualNativeReserve: reserveBalance.virtualNativeReserve.toString(),
          virtualTokenReserve: reserveBalance.virtualTokenReserve.toString(),
          currentPrice: token.getCurrentPrice().toBigInt().toString(),
          marketCap: token.getMarketCap().toBigInt().toString(),
          athPrice: token.getATHPrice().toBigInt().toString(),
          athMarketCap: token.getATHMarketCap().toBigInt().toString(),
          athPriceTimestamp: token.getATHPriceTimestamp(),
          athMarketCapTimestamp: token.getATHMarketCapTimestamp(),
          isLocked: token.getIsLocked(),
          isListed: token.getIsListed(),
          uniswapV3Pool: token.getUniswapV3Pool(),
          listingTimestamp: token.getListingTimestamp(),
          graduationThreshold: token.getGraduationThreshold().toString(),
          updatedAt: token.getUpdatedAt(),
        },
      });

      return this.mapPrismaToToken(tokenData);
    } catch (error) {
      this.logger.error(
        `Error updating token ${token.getId()}: ${error.message}`,
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.prisma.token.delete({
        where: { id },
      });

      return !!result;
    } catch (error) {
      this.logger.error(`Error deleting token ${id}: ${error.message}`);
      return false;
    }
  }

  async count(): Promise<number> {
    try {
      return await this.prisma.token.count();
    } catch (error) {
      this.logger.error(`Error counting tokens: ${error.message}`);
      throw error;
    }
  }

  async findReadyForGraduation(limit?: number): Promise<Token[]> {
    try {
      // Market cap >= 100 PUSH (1e20 in wei), not yet locked
      const graduationThreshold = BigInt(100) * BigInt(10 ** 18);

      const tokenDataList = await this.prisma.token.findMany({
        where: {
          isLocked: false,
          marketCap: {
            gte: graduationThreshold.toString(),
          },
        },
        orderBy: { marketCap: 'desc' },
        take: limit || 10,
      });

      return tokenDataList.map((data) => this.mapPrismaToToken(data));
    } catch (error) {
      this.logger.error(`Error finding graduation-ready tokens: ${error.message}`);
      throw error;
    }
  }

  async findLockedNotListed(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    tokens: Token[];
    total: number;
  }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const [tokenDataList, total] = await Promise.all([
        this.prisma.token.findMany({
          where: {
            isLocked: true,
            isListed: false,
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.token.count({
          where: {
            isLocked: true,
            isListed: false,
          },
        }),
      ]);

      const tokens = tokenDataList.map((data) => this.mapPrismaToToken(data));

      return {
        tokens,
        total,
      };
    } catch (error) {
      this.logger.error(
        `Error finding locked-not-listed tokens: ${error.message}`,
      );
      throw error;
    }
  }

  async findListed(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    tokens: Token[];
    total: number;
  }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const [tokenDataList, total] = await Promise.all([
        this.prisma.token.findMany({
          where: { isListed: true },
          orderBy: { listingTimestamp: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.token.count({ where: { isListed: true } }),
      ]);

      const tokens = tokenDataList.map((data) => this.mapPrismaToToken(data));

      return {
        tokens,
        total,
      };
    } catch (error) {
      this.logger.error(`Error finding listed tokens: ${error.message}`);
      throw error;
    }
  }

  async findByAddresses(addresses: string[]): Promise<Map<string, Token>> {
    try {
      const normalizedAddresses = addresses.map((addr) => addr.toLowerCase());

      const tokenDataList = await this.prisma.token.findMany({
        where: {
          address: {
            in: normalizedAddresses,
          },
        },
      });

      const map = new Map<string, Token>();
      tokenDataList.forEach((data) => {
        map.set(data.address.toLowerCase(), this.mapPrismaToToken(data));
      });

      return map;
    } catch (error) {
      this.logger.error(
        `Error finding tokens by addresses: ${error.message}`,
      );
      throw error;
    }
  }

  async findTrending(
    timeframe: '1h' | '24h' | '7d',
    metric: 'price' | 'marketCap' | 'trades',
    limit?: number,
  ): Promise<Token[]> {
    try {
      // For now, return top tokens by current metric
      // Full implementation would require time-series data
      let orderBy: any;
      if (metric === 'price') {
        orderBy = { currentPrice: 'desc' as const };
      } else if (metric === 'marketCap') {
        orderBy = { marketCap: 'desc' as const };
      } else {
        orderBy = { updatedAt: 'desc' as const }; // 'trades' - would need trade count
      }

      const tokenDataList = await this.prisma.token.findMany({
        where: { isLocked: false }, // Active on bonding curve
        orderBy,
        take: limit || 10,
      });

      return tokenDataList.map((data) => this.mapPrismaToToken(data));
    } catch (error) {
      this.logger.error(
        `Error finding trending tokens (${metric}/${timeframe}): ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Map Prisma token data to Token domain entity
   * This is where we hydrate the domain object from the database
   */
  private mapPrismaToToken(prismaToken: any): Token {
    return Token.reconstruct({
      id: prismaToken.id,
      address: prismaToken.address,
      name: prismaToken.name,
      symbol: prismaToken.symbol,
      creator: prismaToken.creator,
      decimals: prismaToken.decimals,
      totalSupply: BigInt(prismaToken.totalSupply),
      realNativeReserve: BigInt(prismaToken.realNativeReserve || 0),
      realTokenReserve: BigInt(prismaToken.realTokenReserve || 0),
      virtualNativeReserve: BigInt(prismaToken.virtualNativeReserve || 0),
      virtualTokenReserve: BigInt(prismaToken.virtualTokenReserve || 0),
      currentPrice: BigInt(prismaToken.currentPrice),
      marketCap: BigInt(prismaToken.marketCap),
      athPrice: BigInt(prismaToken.athPrice),
      athMarketCap: BigInt(prismaToken.athMarketCap),
      athPriceTimestamp: prismaToken.athPriceTimestamp,
      athMarketCapTimestamp: prismaToken.athMarketCapTimestamp,
      isLocked: prismaToken.isLocked,
      isListed: prismaToken.isListed,
      uniswapV3Pool: prismaToken.uniswapV3Pool,
      listingTimestamp: prismaToken.listingTimestamp,
      createdAt: prismaToken.createdAt,
      updatedAt: prismaToken.updatedAt,
      graduationThresholdValue: BigInt(
        prismaToken.graduationThreshold || 100 * 10 ** 18,
      ),
    });
  }
}
