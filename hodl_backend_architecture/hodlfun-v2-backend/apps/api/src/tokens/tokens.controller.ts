import { Controller, Get, Param, Query } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { PaginationDto } from '@hodlfun/common';
import { GetTokensDto, GetPriceHistoryDto } from './dto/tokens.dto';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  async findAll(@Query() query: GetTokensDto) {
    return this.tokensService.findAll(query);
  }

  @Get('trending')
  async getTrending(@Query() pagination: PaginationDto) {
    return this.tokensService.getTrending(pagination);
  }

  @Get('new')
  async getNew(@Query() pagination: PaginationDto) {
    return this.tokensService.getNew(pagination);
  }

  @Get(':address')
  async findOne(@Param('address') address: string) {
    return this.tokensService.findByAddress(address);
  }

  @Get(':address/trades')
  async getTrades(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.tokensService.getTrades(address, pagination);
  }

  @Get(':address/holders')
  async getHolders(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.tokensService.getHolders(address, pagination);
  }

  @Get(':address/price-history')
  async getPriceHistory(@Param('address') address: string, @Query() query: GetPriceHistoryDto) {
    return this.tokensService.getPriceHistory(address, query.interval);
  }
}
