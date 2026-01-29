import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PaginationDto, CurrentUser, CurrentUserPayload } from '@hodlfun/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Static routes must come before parameterized routes to avoid
  // 'me' being treated as an :address parameter
  @Get('me/portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user portfolio (requires JWT)' })
  @ApiResponse({ status: 200, description: 'User portfolio data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyPortfolio(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getPortfolio(user.wallet);
  }

  @Get(':address')
  @ApiOperation({ summary: 'Get user profile by wallet address' })
  @ApiParam({ name: 'address', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'User profile data' })
  async getUser(@Param('address') address: string) {
    return this.usersService.getUser(address);
  }

  @Get(':address/portfolio')
  @ApiOperation({ summary: 'Get user portfolio by wallet address' })
  @ApiParam({ name: 'address', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'User portfolio data' })
  async getPortfolio(@Param('address') address: string) {
    return this.usersService.getPortfolio(address);
  }

  @Get(':address/holdings')
  @ApiOperation({ summary: 'Get user token holdings' })
  @ApiParam({ name: 'address', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'List of token holdings' })
  async getHoldings(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.usersService.getHoldings(address, pagination);
  }

  @Get(':address/trades')
  @ApiOperation({ summary: 'Get user trade history' })
  @ApiParam({ name: 'address', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'List of trades' })
  async getTrades(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.usersService.getTrades(address, pagination);
  }

  @Get(':address/created-tokens')
  @ApiOperation({ summary: 'Get tokens created by user' })
  @ApiParam({ name: 'address', description: 'User wallet address' })
  @ApiResponse({ status: 200, description: 'List of created tokens' })
  async getCreatedTokens(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.usersService.getCreatedTokens(address, pagination);
  }
}
