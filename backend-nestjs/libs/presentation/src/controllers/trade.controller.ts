import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import {
  TradeListResponseDto,
  TradeStatsResponseDto,
  TradeExecutionResponseDto,
} from '../dtos/responses/trade.response';
import { BuyTokenDto, SellTokenDto } from '../dtos/requests/trade.dto';

/**
 * Trade Controller
 *
 * Handles all trade-related HTTP endpoints (buying, selling, trade history)
 */
@Controller('trades')
export class TradeController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  /**
   * Execute a buy trade
   *
   * @param address Token contract address
   * @param buyTokenDto Buy trade parameters
   * @returns Trade execution result
   */
  @Post(':address/buy')
  @HttpCode(HttpStatus.CREATED)
  async buy(
    @Body() buyTokenDto: BuyTokenDto,
  ): Promise<TradeExecutionResponseDto> {
    // Execute BuyTokenCommand via CQRS bus
    const result = await this.commandBus.execute({
      tokenId: buyTokenDto.tokenId,
      amountIn: buyTokenDto.amountIn,
      minAmountOut: buyTokenDto.minAmountOut,
    });

    return {
      success: true,
      transactionHash: result.transactionHash,
      amountIn: result.amountIn,
      amountOut: result.amountOut,
      pricePerToken: result.pricePerToken,
      timestamp: new Date(),
      message: 'Trade executed successfully',
    };
  }

  /**
   * Execute a sell trade
   *
   * @param address Token contract address
   * @param sellTokenDto Sell trade parameters
   * @returns Trade execution result
   */
  @Post(':address/sell')
  @HttpCode(HttpStatus.CREATED)
  async sell(
    @Body() sellTokenDto: SellTokenDto,
  ): Promise<TradeExecutionResponseDto> {
    // Execute SellTokenCommand via CQRS bus
    const result = await this.commandBus.execute({
      tokenId: sellTokenDto.tokenId,
      amountIn: sellTokenDto.amountIn,
      minAmountOut: sellTokenDto.minAmountOut,
    });

    return {
      success: true,
      transactionHash: result.transactionHash,
      amountIn: result.amountIn,
      amountOut: result.amountOut,
      pricePerToken: result.pricePerToken,
      timestamp: new Date(),
      message: 'Trade executed successfully',
    };
  }

  /**
   * Get trades for a specific token
   *
   * @param tokenId Token ID or address
   * @param limit Items per page
   * @param offset Pagination offset
   * @param orderBy Field to sort by
   * @param orderDirection Sort direction
   * @returns Paginated trades list
   */
  @Get('token/:tokenId')
  async getByToken(
    @Param('tokenId') tokenId: string,
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
    @Query('orderBy') orderBy: 'timestamp' | 'totalValue' = 'timestamp',
    @Query('orderDirection') orderDirection: 'asc' | 'desc' = 'desc',
  ): Promise<TradeListResponseDto> {
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = parseInt(offset) || 0;

    // Execute GetTradesByTokenQuery via CQRS bus
    const result = await this.queryBus.execute({
      tokenId,
      limit: limitNum,
      offset: offsetNum,
      orderBy,
      orderDirection,
    });

    return {
      items: result.items.map((trade: any) => ({
        id: trade.id.value,
        tokenId: trade.tokenId.value,
        type: trade.type as 'buy' | 'sell',
        user: trade.user.value,
        amountIn: trade.amountIn.toString(),
        amountOut: trade.amountOut.toString(),
        pricePerToken: trade.pricePerToken.toString(),
        totalValue: trade.totalValue.toString(),
        transactionHash: trade.transactionHash.value,
        blockNumber: trade.blockNumber,
        timestamp: trade.timestamp,
      })),
      total: result.total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < result.total,
    };
  }

  /**
   * Get trades for a specific user
   *
   * @param userAddress User wallet address
   * @param limit Items per page
   * @param offset Pagination offset
   * @param orderBy Field to sort by
   * @param orderDirection Sort direction
   * @returns Paginated trades list
   */
  @Get('user/:userAddress')
  async getByUser(
    @Param('userAddress') userAddress: string,
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
    @Query('orderBy') orderBy: 'timestamp' | 'totalValue' = 'timestamp',
    @Query('orderDirection') orderDirection: 'asc' | 'desc' = 'desc',
  ): Promise<TradeListResponseDto> {
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = parseInt(offset) || 0;

    // Execute GetTradesByUserQuery via CQRS bus
    const result = await this.queryBus.execute({
      user: userAddress,
      limit: limitNum,
      offset: offsetNum,
      orderBy,
      orderDirection,
    });

    return {
      items: result.items.map((trade: any) => ({
        id: trade.id.value,
        tokenId: trade.tokenId.value,
        type: trade.type as 'buy' | 'sell',
        user: trade.user.value,
        amountIn: trade.amountIn.toString(),
        amountOut: trade.amountOut.toString(),
        pricePerToken: trade.pricePerToken.toString(),
        totalValue: trade.totalValue.toString(),
        transactionHash: trade.transactionHash.value,
        blockNumber: trade.blockNumber,
        timestamp: trade.timestamp,
      })),
      total: result.total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < result.total,
    };
  }

  /**
   * Get trade statistics
   *
   * @param tokenId Optional: Filter by token ID
   * @param user Optional: Filter by user address
   * @returns Trade statistics
   */
  @Get('stats')
  async getStats(
    @Query('tokenId') tokenId?: string,
    @Query('user') user?: string,
  ): Promise<TradeStatsResponseDto> {
    // Execute GetTradeStatsQuery via CQRS bus
    const stats = await this.queryBus.execute({
      tokenId,
      user,
    });

    return {
      tokenId: stats.tokenId,
      user: stats.user,
      totalTrades: stats.totalTrades,
      totalBuyVolume: stats.totalBuyVolume.toString(),
      totalSellVolume: stats.totalSellVolume.toString(),
      totalTokensBought: stats.totalTokensBought?.toString(),
      totalTokensSold: stats.totalTokensSold?.toString(),
      uniqueTraders: stats.uniqueTraders,
      avgBuyPrice: stats.avgBuyPrice?.toString(),
      avgSellPrice: stats.avgSellPrice?.toString(),
      realizedPNL: stats.realizedPNL?.toString(),
    };
  }
}
