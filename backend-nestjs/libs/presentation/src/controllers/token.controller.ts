import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import {
  TokenListResponseDto,
  TokenResponseDto,
  TrendingTokenResponseDto,
} from '../dtos/responses/token.response';
import { CreateTokenDto } from '../dtos/requests/create-token.dto';

/**
 * Token Controller
 *
 * Handles all token-related HTTP endpoints
 */
@Controller('tokens')
export class TokenController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

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
    const token = await this.commandBus.execute({
      name: createTokenDto.name,
      symbol: createTokenDto.symbol,
      description: createTokenDto.description,
      logoUrl: createTokenDto.logoUrl,
      metadataUri: createTokenDto.metadataUri,
    });

    return {
      id: token.id.value,
      address: token.address.value,
      name: token.name,
      symbol: token.symbol,
      creator: token.creator.value,
      decimals: token.decimals,
      totalSupply: token.totalSupply.toString(),
      currentPrice: token.currentPrice.toString(),
      marketCap: token.marketCap.toString(),
      athPrice: token.athPrice.toString(),
      athMarketCap: token.athMarketCap.toString(),
      athPriceTimestamp: token.athPriceTimestamp,
      athMarketCapTimestamp: token.athMarketCapTimestamp,
      isLocked: token.isLocked,
      isListed: token.isListed,
      uniswapV3Pool: token.uniswapV3Pool,
      listingTimestamp: token.listingTimestamp,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      holdersCount: token.holdersCount,
      volume24h: token.volume24h.toString(),
      priceChange24h: token.priceChange24h,
    };
  }

  /**
   * Get token by address
   *
   * @param address Token contract address
   * @returns Token details
   */
  @Get(':address')
  async getByAddress(@Param('address') address: string): Promise<TokenResponseDto> {
    // Execute GetTokenByAddressQuery via CQRS bus
    const token = await this.queryBus.execute({
      address,
    });

    if (!token) {
      throw new Error(`Token not found: ${address}`);
    }

    return {
      id: token.id.value,
      address: token.address.value,
      name: token.name,
      symbol: token.symbol,
      creator: token.creator.value,
      decimals: token.decimals,
      totalSupply: token.totalSupply.toString(),
      currentPrice: token.currentPrice.toString(),
      marketCap: token.marketCap.toString(),
      athPrice: token.athPrice.toString(),
      athMarketCap: token.athMarketCap.toString(),
      athPriceTimestamp: token.athPriceTimestamp,
      athMarketCapTimestamp: token.athMarketCapTimestamp,
      isLocked: token.isLocked,
      isListed: token.isListed,
      uniswapV3Pool: token.uniswapV3Pool,
      listingTimestamp: token.listingTimestamp,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      holdersCount: token.holdersCount,
      volume24h: token.volume24h.toString(),
      priceChange24h: token.priceChange24h,
    };
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
    const result = await this.queryBus.execute({
      limit: limitNum,
      offset: offsetNum,
      sortBy: sortBy as any,
      sortOrder,
      creator,
      isListed: isListed === 'true',
    });

    return {
      items: result.items.map((token: any) => ({
        id: token.id.value,
        address: token.address.value,
        name: token.name,
        symbol: token.symbol,
        creator: token.creator.value,
        decimals: token.decimals,
        totalSupply: token.totalSupply.toString(),
        currentPrice: token.currentPrice.toString(),
        marketCap: token.marketCap.toString(),
        athPrice: token.athPrice.toString(),
        athMarketCap: token.athMarketCap.toString(),
        athPriceTimestamp: token.athPriceTimestamp,
        athMarketCapTimestamp: token.athMarketCapTimestamp,
        isLocked: token.isLocked,
        isListed: token.isListed,
        uniswapV3Pool: token.uniswapV3Pool,
        listingTimestamp: token.listingTimestamp,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        holdersCount: token.holdersCount,
        volume24h: token.volume24h.toString(),
        priceChange24h: token.priceChange24h,
      })),
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
   * @returns Trending tokens
   */
  @Get('trending/:timeframe')
  async getTrending(
    @Param('timeframe') timeframe: '1h' | '24h' | '7d',
    @Query('metric') metric: 'price' | 'marketCap' | 'trades' = 'price',
  ): Promise<TrendingTokenResponseDto> {
    // Execute GetTrendingTokensQuery via CQRS bus
    const tokens = await this.queryBus.execute({
      timeframe,
      metric,
    });

    return {
      tokens: tokens.map((token: any) => ({
        id: token.id.value,
        address: token.address.value,
        name: token.name,
        symbol: token.symbol,
        creator: token.creator.value,
        decimals: token.decimals,
        totalSupply: token.totalSupply.toString(),
        currentPrice: token.currentPrice.toString(),
        marketCap: token.marketCap.toString(),
        athPrice: token.athPrice.toString(),
        athMarketCap: token.athMarketCap.toString(),
        athPriceTimestamp: token.athPriceTimestamp,
        athMarketCapTimestamp: token.athMarketCapTimestamp,
        isLocked: token.isLocked,
        isListed: token.isListed,
        uniswapV3Pool: token.uniswapV3Pool,
        listingTimestamp: token.listingTimestamp,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        holdersCount: token.holdersCount,
        volume24h: token.volume24h.toString(),
        priceChange24h: token.priceChange24h,
      })),
      timeframe,
      metric,
      timestamp: new Date(),
    };
  }
}
