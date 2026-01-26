import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { PaginationDto, CurrentUser, CurrentUserPayload } from '@hodlfun/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':address')
  async getUser(@Param('address') address: string) {
    return this.usersService.getUser(address);
  }

  @Get(':address/portfolio')
  async getPortfolio(@Param('address') address: string) {
    return this.usersService.getPortfolio(address);
  }

  @Get(':address/holdings')
  async getHoldings(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.usersService.getHoldings(address, pagination);
  }

  @Get(':address/trades')
  async getTrades(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.usersService.getTrades(address, pagination);
  }

  @Get(':address/created-tokens')
  async getCreatedTokens(@Param('address') address: string, @Query() pagination: PaginationDto) {
    return this.usersService.getCreatedTokens(address, pagination);
  }

  @Get('me/portfolio')
  @UseGuards(JwtAuthGuard)
  async getMyPortfolio(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getPortfolio(user.wallet);
  }
}
