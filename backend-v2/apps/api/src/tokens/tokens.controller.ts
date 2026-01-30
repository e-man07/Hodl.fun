import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TokensService } from './tokens.service';
import { PaginationDto } from '@hodlfun/common';
import { GetTokensDto, GetPriceHistoryDto } from './dto/tokens.dto';

@ApiTags('tokens')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tokens with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'List of tokens' })
  async findAll(@Query() query: GetTokensDto) {
    return this.tokensService.findAll(query);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending tokens (by 24h activity)' })
  @ApiResponse({ status: 200, description: 'List of trending tokens' })
  async getTrending(@Query() pagination: PaginationDto) {
    return this.tokensService.getTrending(pagination);
  }

  @Get('new')
  @ApiOperation({ summary: 'Get newest tokens' })
  @ApiResponse({ status: 200, description: 'List of new tokens' })
  async getNew(@Query() pagination: PaginationDto) {
    return this.tokensService.getNew(pagination);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get token by address' })
  @ApiParam({ name: 'address', description: 'Token contract address' })
  @ApiResponse({ status: 200, description: 'Token details' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async findOne(@Param('address') address: string) {
    return this.tokensService.findByAddress(address);
  }

  @Get(':address/trades')
  @ApiOperation({ summary: 'Get token trade history' })
  @ApiParam({ name: 'address', description: 'Token contract address' })
  @ApiResponse({ status: 200, description: 'List of trades' })
  async getTrades(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.tokensService.getTrades(address, pagination);
  }

  @Get(':address/holders')
  @ApiOperation({ summary: 'Get token holders' })
  @ApiParam({ name: 'address', description: 'Token contract address' })
  @ApiResponse({ status: 200, description: 'List of holders' })
  async getHolders(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.tokensService.getHolders(address, pagination);
  }

  @Get(':address/price-history')
  @ApiOperation({ summary: 'Get token OHLC price history' })
  @ApiParam({ name: 'address', description: 'Token contract address' })
  @ApiResponse({ status: 200, description: 'OHLC candle data' })
  async getPriceHistory(@Param('address') address: string, @Query() query: GetPriceHistoryDto) {
    return this.tokensService.getPriceHistory(address, query.interval);
  }
}
