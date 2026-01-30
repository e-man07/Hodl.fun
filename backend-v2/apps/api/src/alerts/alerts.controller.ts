import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '@hodlfun/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto, UpdateAlertDto, AlertResponseDto } from './dto/alerts.dto';

interface JwtUser {
  wallet: string;
}

@ApiTags('Alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new price alert' })
  @ApiResponse({ status: 201, type: AlertResponseDto })
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAlertDto,
  ): Promise<AlertResponseDto> {
    return this.alertsService.create({
      walletAddress: user.wallet,
      tokenAddress: dto.tokenAddress,
      alertType: dto.alertType,
      targetPrice: dto.targetPrice,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all alerts for the authenticated user' })
  @ApiResponse({ status: 200, type: [AlertResponseDto] })
  async findAll(@CurrentUser() user: JwtUser): Promise<AlertResponseDto[]> {
    return this.alertsService.findByWallet(user.wallet);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific alert by ID' })
  @ApiResponse({ status: 200, type: AlertResponseDto })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<AlertResponseDto | null> {
    const alert = await this.alertsService.findById(id);
    // Only return if user owns the alert
    if (alert && alert.walletAddress === user.wallet.toLowerCase()) {
      return alert;
    }
    return null;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an alert' })
  @ApiResponse({ status: 200, type: AlertResponseDto })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateAlertDto,
  ): Promise<AlertResponseDto> {
    return this.alertsService.update(id, user.wallet, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an alert' })
  @ApiResponse({ status: 204, description: 'Alert deleted successfully' })
  async delete(@Param('id') id: string, @CurrentUser() user: JwtUser): Promise<void> {
    await this.alertsService.delete(id, user.wallet);
  }
}
