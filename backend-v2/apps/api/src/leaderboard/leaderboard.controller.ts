import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaginationDto } from '@hodlfun/common';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('gainers')
  @ApiOperation({ summary: 'Get top price gainers (24h)' })
  @ApiResponse({ status: 200, description: 'List of top gaining tokens' })
  async getGainers(@Query() pagination: PaginationDto) {
    return this.leaderboardService.getLeaderboard('gainers', pagination);
  }

  @Get('losers')
  @ApiOperation({ summary: 'Get top price losers (24h)' })
  @ApiResponse({ status: 200, description: 'List of top losing tokens' })
  async getLosers(@Query() pagination: PaginationDto) {
    return this.leaderboardService.getLeaderboard('losers', pagination);
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get top tokens by trading volume (24h)' })
  @ApiResponse({ status: 200, description: 'List of highest volume tokens' })
  async getVolume(@Query() pagination: PaginationDto) {
    return this.leaderboardService.getLeaderboard('volume', pagination);
  }

  @Get('new')
  @ApiOperation({ summary: 'Get newest tokens' })
  @ApiResponse({ status: 200, description: 'List of newest tokens' })
  async getNew(@Query() pagination: PaginationDto) {
    return this.leaderboardService.getLeaderboard('new', pagination);
  }

  @Get('graduated')
  @ApiOperation({ summary: 'Get recently graduated tokens' })
  @ApiResponse({ status: 200, description: 'List of graduated tokens' })
  async getGraduated(@Query() pagination: PaginationDto) {
    return this.leaderboardService.getLeaderboard('graduated', pagination);
  }
}
