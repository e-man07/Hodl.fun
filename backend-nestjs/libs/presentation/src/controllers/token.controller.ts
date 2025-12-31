import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  TokenListResponseDto,
  TokenResponseDto,
  TrendingTokenResponseDto,
} from '../dtos/responses/token.response';
import { CreateTokenDto } from '../dtos/requests/create-token.dto';
import {
  GetTokenQuery,
  GetTokensQuery,
  GetTrendingTokensQuery,
} from '@application/token/queries';
import { Token } from '@domain';
import { PrismaService } from '@core';

interface TokenListQueryResult {
  tokens: Token[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Aggregated token data for response enrichment
 */
interface TokenAggregatedData {
  holdersCount: number;
  volume24h: string;
  priceChange24h: number;
}

/**
 * Helper function to map Token entity to response DTO
 */
function mapTokenToResponse(
  token: Token,
  aggregatedData?: TokenAggregatedData,
): TokenResponseDto {
  return {
    id: token.getId(),
    address: token.getAddress().toString(),
    name: token.getName(),
    symbol: token.getSymbol(),
    creator: token.getCreator(),
    decimals: token.getDecimals(),
    totalSupply: token.getTotalSupply().toString(),
    currentPrice: token.getCurrentPrice().toString(),
    marketCap: token.getMarketCap().toString(),
    athPrice: token.getATHPrice().toString(),
    athMarketCap: token.getATHMarketCap().toString(),
    athPriceTimestamp: token.getATHPriceTimestamp(),
    athMarketCapTimestamp: token.getATHMarketCapTimestamp(),
    isLocked: token.getIsLocked(),
    isListed: token.getIsListed(),
    uniswapV3Pool: token.getUniswapV3Pool(),
    listingTimestamp: token.getListingTimestamp(),
    createdAt: token.getCreatedAt(),
    updatedAt: token.getUpdatedAt(),
    holdersCount: aggregatedData?.holdersCount ?? 0,
    volume24h: aggregatedData?.volume24h ?? '0',
    priceChange24h: aggregatedData?.priceChange24h ?? 0,
  };
}


/**
 * Token Controller
 *
 * Handles all token-related HTTP endpoints
 */
@ApiTags('Tokens')
@Controller('tokens')
export class TokenController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Fetch aggregated data for a token (holdersCount, volume24h, priceChange24h)
   * Note: volume24h and priceChange24h are already maintained by workers on the Token model
   */
  private async getTokenAggregatedData(
    tokenAddress: string,
  ): Promise<TokenAggregatedData> {
    const normalizedAddress = tokenAddress.toLowerCase();

    // Get token with pre-calculated metrics and count holders
    const [token, holdersCount] = await Promise.all([
      this.prisma.token.findUnique({
        where: { address: normalizedAddress },
        select: {
          volume24h: true,
          priceChange24h: true,
        },
      }),
      // Count holders with non-zero balance
      this.prisma.holder.count({
        where: {
          tokenAddress: normalizedAddress,
          balance: { not: '0' },
        },
      }),
    ]);

    return {
      holdersCount,
      volume24h: token?.volume24h || '0',
      priceChange24h: token?.priceChange24h || 0,
    };
  }

  /**
   * Fetch aggregated data for multiple tokens (batch operation)
   * Note: volume24h and priceChange24h are already maintained by workers on the Token model
   */
  private async getTokensAggregatedDataBatch(
    tokenAddresses: string[],
  ): Promise<Map<string, TokenAggregatedData>> {
    const normalizedAddresses = tokenAddresses.map((a) => a.toLowerCase());
    const result = new Map<string, TokenAggregatedData>();

    // Initialize with defaults
    for (const addr of normalizedAddresses) {
      result.set(addr, { holdersCount: 0, volume24h: '0', priceChange24h: 0 });
    }

    // Batch queries in parallel
    const [holdersResults, tokens] = await Promise.all([
      // Holders count per token
      this.prisma.holder.groupBy({
        by: ['tokenAddress'],
        where: {
          tokenAddress: { in: normalizedAddresses },
          balance: { not: '0' },
        },
        _count: { tokenAddress: true },
      }),
      // Get pre-calculated metrics from Token model
      this.prisma.token.findMany({
        where: { address: { in: normalizedAddresses } },
        select: {
          address: true,
          volume24h: true,
          priceChange24h: true,
        },
      }),
    ]);

    // Map holders count
    for (const h of holdersResults) {
      const data = result.get(h.tokenAddress);
      if (data) data.holdersCount = h._count.tokenAddress;
    }

    // Map token metrics (volume24h, priceChange24h)
    for (const token of tokens) {
      const data = result.get(token.address);
      if (data) {
        data.volume24h = token.volume24h;
        data.priceChange24h = token.priceChange24h;
      }
    }

    return result;
  }

  /**
   * Create a new token
   *
   * @param createTokenDto Token creation data
   * @returns Created token details
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTokenDto: CreateTokenDto,
  ): Promise<TokenResponseDto> {
    // Execute CreateTokenCommand via CQRS bus
    const token = (await this.commandBus.execute({
      name: createTokenDto.name,
      symbol: createTokenDto.symbol,
      description: createTokenDto.description,
      logoUrl: createTokenDto.logoUrl,
      metadataUri: createTokenDto.metadataUri,
    })) as Token;

    return mapTokenToResponse(token);
  }

  /**
   * Search tokens by name or symbol
   * NOTE: This route must be defined BEFORE the :address route
   */
  @Get('search')
  @ApiOperation({ summary: 'Search tokens by name or symbol' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchTokens(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ): Promise<{
    tokens: Array<{
      address: string;
      name: string;
      symbol: string;
      currentPrice: string;
      marketCap: string;
    }>;
    total: number;
  }> {
    const take = Math.min(parseInt(limit || '20'), 100);
    const searchQuery = query?.toLowerCase() || '';

    const tokens = await this.prisma.token.findMany({
      where: {
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { symbol: { contains: searchQuery, mode: 'insensitive' } },
        ],
      },
      take,
      orderBy: { marketCap: 'desc' },
      select: {
        address: true,
        name: true,
        symbol: true,
        currentPrice: true,
        marketCap: true,
      },
    });

    return {
      tokens,
      total: tokens.length,
    };
  }

  /**
   * Get newly created tokens
   * NOTE: This route must be defined BEFORE the :address route
   */
  @Get('new')
  @ApiOperation({ summary: 'Get recently created tokens' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getNewTokens(@Query('limit') limit?: string): Promise<{
    tokens: Array<{
      address: string;
      name: string;
      symbol: string;
      creator: string;
      currentPrice: string;
      marketCap: string;
      createdAt: Date;
    }>;
  }> {
    const take = Math.min(parseInt(limit || '20'), 100);

    const tokens = await this.prisma.token.findMany({
      where: { isListed: false },
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        address: true,
        name: true,
        symbol: true,
        creator: true,
        currentPrice: true,
        marketCap: true,
        createdAt: true,
      },
    });

    return {
      tokens: tokens.map((t) => ({
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        creator: t.creator,
        currentPrice: t.currentPrice,
        marketCap: t.marketCap,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Get tokens near graduation threshold
   * NOTE: This route must be defined BEFORE the :address route
   */
  @Get('graduating')
  @ApiOperation({ summary: 'Get tokens near graduation threshold' })
  @ApiQuery({ name: 'threshold', required: false, description: 'Minimum progress % (default: 80)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getGraduatingTokens(
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    tokens: Array<{
      address: string;
      name: string;
      symbol: string;
      currentPrice: string;
      marketCap: string;
      graduationProgress: number;
      isLocked: boolean;
    }>;
  }> {
    const take = Math.min(parseInt(limit || '20'), 100);
    const minProgress = parseInt(threshold || '80');

    // Get tokens that are not listed yet
    const tokens = await this.prisma.token.findMany({
      where: {
        isListed: false,
      },
      orderBy: { marketCap: 'desc' },
      take: take * 2, // Get more to filter by progress
      select: {
        address: true,
        name: true,
        symbol: true,
        currentPrice: true,
        marketCap: true,
        isLocked: true,
      },
    });

    // Calculate graduation progress (graduation threshold is typically 42069 ETH)
    const graduationThreshold = BigInt('42069000000000000000000'); // 42069 PUSH

    const tokensWithProgress = tokens
      .map((t) => {
        const marketCap = BigInt(t.marketCap);
        const progress = Number((marketCap * 100n) / graduationThreshold);
        return {
          ...t,
          graduationProgress: Math.min(progress, 100),
        };
      })
      .filter((t) => t.graduationProgress >= minProgress)
      .slice(0, take);

    return { tokens: tokensWithProgress };
  }

  /**
   * Get graduated tokens (listed on Uniswap)
   * NOTE: This route must be defined BEFORE the :address route
   */
  @Get('graduated')
  @ApiOperation({ summary: 'Get graduated tokens listed on Uniswap' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getGraduatedTokens(@Query('limit') limit?: string): Promise<{
    tokens: Array<{
      address: string;
      name: string;
      symbol: string;
      currentPrice: string;
      marketCap: string;
      uniswapV3Pool: string | null;
      listedAt: Date | null;
    }>;
  }> {
    const take = Math.min(parseInt(limit || '20'), 100);

    const tokens = await this.prisma.token.findMany({
      where: { isListed: true },
      orderBy: { listingTimestamp: 'desc' },
      take,
      select: {
        address: true,
        name: true,
        symbol: true,
        currentPrice: true,
        marketCap: true,
        uniswapV3Pool: true,
        listingTimestamp: true,
      },
    });

    return {
      tokens: tokens.map((t) => ({
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        currentPrice: t.currentPrice,
        marketCap: t.marketCap,
        uniswapV3Pool: t.uniswapV3Pool,
        listedAt: t.listingTimestamp,
      })),
    };
  }

  /**
   * Get token by address
   *
   * @param address Token contract address
   * @returns Token details with aggregated data
   * NOTE: This parameterized route must come AFTER all specific routes like /search, /new, etc.
   */
  @Get(':address')
  async getByAddress(@Param('address') address: string): Promise<TokenResponseDto> {
    // Execute GetTokenQuery via CQRS bus
    const token = (await this.queryBus.execute(
      new GetTokenQuery(undefined, address),
    )) as Token | null;

    if (!token) {
      throw new NotFoundException(`Token not found: ${address}`);
    }

    // Fetch aggregated data for the token
    const aggregatedData = await this.getTokenAggregatedData(address);

    return mapTokenToResponse(token, aggregatedData);
  }

  /**
   * Get paginated list of tokens with optional filtering
   *
   * @param limit Items per page (default: 20, max: 100)
   * @param offset Pagination offset (default: 0)
   * @param sortBy Field to sort by (default: createdAt)
   * @param sortOrder Sort direction (asc/desc, default: desc)
   * @param creator Filter by creator address
   * @param isListed Filter by listing status
   * @returns Paginated token list
   */
  @Get()
  async list(
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('creator') creator?: string,
    @Query('isListed') isListed?: string,
  ): Promise<TokenListResponseDto> {
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = parseInt(offset) || 0;

    // Execute GetTokensQuery via CQRS bus
    const filter = {
      creator,
      isListed: isListed === 'true' ? true : undefined,
    };
    const result = (await this.queryBus.execute(
      new GetTokensQuery(
        filter,
        limitNum,
        offsetNum,
        sortBy as 'createdAt' | 'marketCap' | 'currentPrice',
        sortOrder,
      ),
    )) as TokenListQueryResult;

    return {
      items: result.tokens.map((token: Token) => mapTokenToResponse(token)),
      total: result.total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < result.total,
    };
  }

  /**
   * Get trending tokens
   *
   * @param timeframe Time period for trending (1h, 24h, 7d)
   * @param metric Metric to sort by (price, marketCap, trades)
   * @returns Trending tokens with aggregated data
   */
  @Get('trending/:timeframe')
  @ApiOperation({ summary: 'Get trending tokens' })
  async getTrending(
    @Param('timeframe') timeframe: '1h' | '24h' | '7d',
    @Query('metric') metric: 'price' | 'marketCap' | 'trades' = 'price',
  ): Promise<TrendingTokenResponseDto> {
    // Execute GetTrendingTokensQuery via CQRS bus
    const tokens = (await this.queryBus.execute(
      new GetTrendingTokensQuery(timeframe, metric, 10),
    )) as Token[];

    // Batch fetch aggregated data for all trending tokens
    const tokenAddresses = tokens.map((t) => t.getAddress().toString());
    const aggregatedDataMap =
      await this.getTokensAggregatedDataBatch(tokenAddresses);

    return {
      tokens: tokens.map((token: Token) => {
        const addr = token.getAddress().toString().toLowerCase();
        return mapTokenToResponse(token, aggregatedDataMap.get(addr));
      }),
      timeframe,
      metric,
      timestamp: new Date(),
    };
  }

  /**
   * Get price history for a token
   */
  @Get(':address/price-history')
  @ApiOperation({ summary: 'Get price history for a token' })
  @ApiQuery({ name: 'interval', required: false, enum: ['1h', '4h', '1d', '1w'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPriceHistory(
    @Param('address') address: string,
    @Query('interval') interval: '1h' | '4h' | '1d' | '1w' = '1h',
    @Query('limit') limit?: string,
  ): Promise<{
    tokenAddress: string;
    interval: string;
    data: Array<{
      timestamp: Date;
      price: string;
      marketCap: string;
      volume: string;
    }>;
  }> {
    const take = Math.min(parseInt(limit || '100'), 500);

    const priceHistory = await this.prisma.priceHistory.findMany({
      where: { tokenAddress: address.toLowerCase() },
      orderBy: { timestamp: 'desc' },
      take,
      select: {
        timestamp: true,
        price: true,
        marketCap: true,
        volume: true,
      },
    });

    return {
      tokenAddress: address,
      interval,
      data: priceHistory.reverse(), // Oldest first
    };
  }

  /**
   * Get holders for a token
   */
  @Get(':address/holders')
  @ApiOperation({ summary: 'Get token holders' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getHolders(
    @Param('address') address: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{
    tokenAddress: string;
    holders: Array<{
      address: string;
      balance: string;
      percentage: string;
      lastUpdated: Date;
    }>;
    total: number;
  }> {
    const take = Math.min(parseInt(limit || '50'), 100);
    const skip = parseInt(offset || '0');

    const [holders, total, tokenSupply] = await Promise.all([
      this.prisma.holder.findMany({
        where: { tokenAddress: address.toLowerCase() },
        orderBy: { balance: 'desc' },
        take,
        skip,
      }),
      this.prisma.holder.count({
        where: { tokenAddress: address.toLowerCase() },
      }),
      this.prisma.token.findUnique({
        where: { address: address.toLowerCase() },
        select: { totalSupply: true },
      }),
    ]);

    const supply = BigInt(tokenSupply?.totalSupply || '1000000000000000000000000000');

    return {
      tokenAddress: address,
      holders: holders.map((h) => {
        const balance = BigInt(h.balance);
        const percentage = Number((balance * 10000n) / supply) / 100;
        return {
          address: h.holderAddress,
          balance: h.balance,
          percentage: percentage.toFixed(2),
          lastUpdated: h.lastUpdated,
        };
      }),
      total,
    };
  }

  /**
   * Get top tokens by volume
   */
  @Get('top/volume')
  @ApiOperation({ summary: 'Get top tokens by trading volume' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', '7d', 'all'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopByVolume(
    @Query('period') period: '24h' | '7d' | 'all' = '24h',
    @Query('limit') limit?: string,
  ): Promise<{
    tokens: Array<{
      address: string;
      name: string;
      symbol: string;
      volume: string;
      currentPrice: string;
      marketCap: string;
    }>;
  }> {
    const take = Math.min(parseInt(limit || '20'), 100);

    const volumeField =
      period === '24h' ? 'volume24h' : period === '7d' ? 'volume7d' : 'volumeTotal';

    const tokens = await this.prisma.token.findMany({
      orderBy: { [volumeField]: 'desc' },
      take,
      select: {
        address: true,
        name: true,
        symbol: true,
        volume24h: true,
        volume7d: true,
        volumeTotal: true,
        currentPrice: true,
        marketCap: true,
      },
    });

    return {
      tokens: tokens.map((t) => ({
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        volume:
          volumeField === 'volume24h'
            ? t.volume24h
            : volumeField === 'volume7d'
              ? t.volume7d
              : t.volumeTotal,
        currentPrice: t.currentPrice,
        marketCap: t.marketCap,
      })),
    };
  }

}
