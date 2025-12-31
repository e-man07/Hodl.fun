import {
  Controller,
  Get,
  Post,
  Param,
  Logger,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrismaService } from '@core';
import {
  FactoryContractService,
  TransactionBuilderService,
} from '@infrastructure';

/**
 * Creator stats response
 */
interface CreatorStats {
  address: string;
  totalTokensCreated: number;
  graduatedTokens: number;
  activeTokens: number;
  totalVolume: string;
  totalFees: {
    accumulated: string;
    claimed: string;
    pending: string;
  };
}

/**
 * Creator token response
 */
interface CreatorToken {
  address: string;
  name: string;
  symbol: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  marketCap: string;
  isLocked: boolean;
  isListed: boolean;
  createdAt: Date;
  tradeCount: number;
}

/**
 * Creators Controller
 *
 * Provides endpoints for creator-specific data and operations.
 */
@ApiTags('Creators')
@Controller('creators')
export class CreatorsController {
  private readonly logger = new Logger(CreatorsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factoryService: FactoryContractService,
    private readonly transactionBuilder: TransactionBuilderService,
  ) {}

  /**
   * Get tokens created by a specific address
   */
  @Get(':address/tokens')
  @ApiOperation({ summary: 'Get tokens created by address' })
  @ApiParam({ name: 'address', description: 'Creator wallet address' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns creator tokens' })
  async getCreatorTokens(
    @Param('address') address: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<{
    tokens: CreatorToken[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const normalizedAddress = address.toLowerCase();
      const take = Math.min(limit || 20, 100);
      const skip = offset || 0;

      const [tokens, total] = await Promise.all([
        this.prisma.token.findMany({
          where: { creator: normalizedAddress },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
          select: {
            address: true,
            name: true,
            symbol: true,
            description: true,
            logoURL: true,
            currentPrice: true,
            marketCap: true,
            isLocked: true,
            isListed: true,
            createdAt: true,
            tradeCount: true,
          },
        }),
        this.prisma.token.count({
          where: { creator: normalizedAddress },
        }),
      ]);

      return {
        tokens: tokens.map((token) => ({
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          description: token.description,
          imageUrl: token.logoURL,
          currentPrice: token.currentPrice,
          marketCap: token.marketCap,
          isLocked: token.isLocked,
          isListed: token.isListed,
          createdAt: token.createdAt,
          tradeCount: token.tradeCount,
        })),
        total,
        hasMore: skip + take < total,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get creator tokens for ${address}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to get creator tokens',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get accumulated fees for a creator
   */
  @Get(':address/fees')
  @ApiOperation({ summary: 'Get accumulated creator fees' })
  @ApiParam({ name: 'address', description: 'Creator wallet address' })
  @ApiResponse({ status: 200, description: 'Returns accumulated fees' })
  async getCreatorFees(@Param('address') address: string): Promise<{
    totalAccumulated: string;
    totalClaimed: string;
    totalPending: string;
    byToken: Array<{
      tokenAddress: string;
      tokenSymbol: string;
      accumulated: string;
      claimed: string;
      pending: string;
    }>;
  }> {
    try {
      const normalizedAddress = address.toLowerCase();

      // Get fees from database
      const fees = await this.prisma.creatorFee.findMany({
        where: { creatorAddress: normalizedAddress },
      });

      // Get token info for each fee entry
      const tokenAddresses = fees.map((f) => f.tokenAddress);
      const tokens = await this.prisma.token.findMany({
        where: { address: { in: tokenAddresses } },
        select: { address: true, symbol: true },
      });

      const tokenMap = new Map(tokens.map((t) => [t.address, t.symbol]));

      // Aggregate totals
      let totalAccumulated = BigInt(0);
      let totalClaimed = BigInt(0);
      let totalPending = BigInt(0);

      const byToken = fees.map((fee) => {
        const accumulated = BigInt(fee.accumulatedAmount);
        const claimed = BigInt(fee.claimedAmount);
        const pending = BigInt(fee.pendingAmount);

        totalAccumulated += accumulated;
        totalClaimed += claimed;
        totalPending += pending;

        return {
          tokenAddress: fee.tokenAddress,
          tokenSymbol: tokenMap.get(fee.tokenAddress) || 'UNKNOWN',
          accumulated: fee.accumulatedAmount,
          claimed: fee.claimedAmount,
          pending: fee.pendingAmount,
        };
      });

      return {
        totalAccumulated: totalAccumulated.toString(),
        totalClaimed: totalClaimed.toString(),
        totalPending: totalPending.toString(),
        byToken,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get creator fees for ${address}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to get creator fees',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get claim fees transaction data
   */
  @Post(':address/claim-fees/:tokenAddress')
  @ApiOperation({ summary: 'Get transaction data to claim creator fees' })
  @ApiParam({ name: 'address', description: 'Creator wallet address' })
  @ApiParam({ name: 'tokenAddress', description: 'Token address' })
  @ApiResponse({ status: 200, description: 'Returns transaction data' })
  async getClaimFeesTransaction(
    @Param('address') address: string,
    @Param('tokenAddress') tokenAddress: string,
  ): Promise<{
    to: string;
    data: string;
    value: string;
    pendingAmount: string;
  }> {
    try {
      // Get the bonding curve address for this token
      const curveAddress = await this.factoryService.getCurve(tokenAddress);

      if (
        !curveAddress ||
        curveAddress === '0x0000000000000000000000000000000000000000'
      ) {
        throw new HttpException(
          'Token bonding curve not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Get pending fees from database
      const feeRecord = await this.prisma.creatorFee.findFirst({
        where: {
          creatorAddress: address.toLowerCase(),
          tokenAddress: tokenAddress.toLowerCase(),
        },
      });

      // Build claim transaction
      const tx = this.transactionBuilder.encodeClaimCreatorFees(curveAddress);

      return {
        ...tx,
        pendingAmount: feeRecord?.pendingAmount || '0',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Failed to build claim fees tx for ${address}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to build claim transaction',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get creator statistics
   */
  @Get(':address/stats')
  @ApiOperation({ summary: 'Get creator statistics' })
  @ApiParam({ name: 'address', description: 'Creator wallet address' })
  @ApiResponse({ status: 200, description: 'Returns creator statistics' })
  async getCreatorStats(@Param('address') address: string): Promise<CreatorStats> {
    try {
      const normalizedAddress = address.toLowerCase();

      // Get token counts
      const [totalTokens, graduatedTokens, tokens, fees] = await Promise.all([
        this.prisma.token.count({
          where: { creator: normalizedAddress },
        }),
        this.prisma.token.count({
          where: { creator: normalizedAddress, isListed: true },
        }),
        this.prisma.token.findMany({
          where: { creator: normalizedAddress },
          select: { address: true, volumeTotal: true },
        }),
        this.prisma.creatorFee.findMany({
          where: { creatorAddress: normalizedAddress },
        }),
      ]);

      // Calculate total volume
      const totalVolume = tokens.reduce(
        (acc: bigint, t: { volumeTotal: string }) =>
          acc + BigInt(t.volumeTotal || '0'),
        BigInt(0),
      );

      // Calculate total fees
      let accumulated = BigInt(0);
      let claimed = BigInt(0);
      let pending = BigInt(0);

      for (const fee of fees) {
        accumulated += BigInt(fee.accumulatedAmount);
        claimed += BigInt(fee.claimedAmount);
        pending += BigInt(fee.pendingAmount);
      }

      return {
        address: normalizedAddress,
        totalTokensCreated: totalTokens,
        graduatedTokens,
        activeTokens: totalTokens - graduatedTokens,
        totalVolume: totalVolume.toString(),
        totalFees: {
          accumulated: accumulated.toString(),
          claimed: claimed.toString(),
          pending: pending.toString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get creator stats for ${address}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to get creator stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get top creators by token count or volume
   */
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get top creators leaderboard' })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['tokens', 'volume', 'graduated'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Returns creator leaderboard' })
  async getCreatorLeaderboard(
    @Query('sortBy') sortBy?: 'tokens' | 'volume' | 'graduated',
    @Query('limit') limit?: number,
  ): Promise<{
    creators: Array<{
      address: string;
      tokenCount: number;
      graduatedCount: number;
      totalVolume: string;
    }>;
  }> {
    try {
      const take = Math.min(limit || 20, 100);

      // Get all unique creators with their token counts
      const creators = await this.prisma.token.groupBy({
        by: ['creator'],
        _count: {
          address: true,
        },
        orderBy: {
          _count: {
            address: 'desc',
          },
        },
        take,
      });

      // Enrich with additional stats
      const enriched = await Promise.all(
        creators.map(async (creatorGroup) => {
          const [graduatedCount, tokens] = await Promise.all([
            this.prisma.token.count({
              where: {
                creator: creatorGroup.creator,
                isListed: true,
              },
            }),
            this.prisma.token.findMany({
              where: { creator: creatorGroup.creator },
              select: { volumeTotal: true },
            }),
          ]);

          const totalVolume = tokens.reduce(
            (acc: bigint, t: { volumeTotal: string }) =>
              acc + BigInt(t.volumeTotal || '0'),
            BigInt(0),
          );

          return {
            address: creatorGroup.creator,
            tokenCount: creatorGroup._count.address,
            graduatedCount,
            totalVolume: totalVolume.toString(),
          };
        }),
      );

      // Sort based on sortBy parameter
      if (sortBy === 'volume') {
        enriched.sort((a, b) =>
          BigInt(b.totalVolume) > BigInt(a.totalVolume) ? 1 : -1,
        );
      } else if (sortBy === 'graduated') {
        enriched.sort((a, b) => b.graduatedCount - a.graduatedCount);
      }

      return { creators: enriched };
    } catch (error) {
      this.logger.error(`Failed to get creator leaderboard: ${error.message}`);
      throw new HttpException(
        'Failed to get leaderboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
