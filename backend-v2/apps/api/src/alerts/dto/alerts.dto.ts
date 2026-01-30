import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { AlertType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAlertDto {
  @ApiProperty({ description: 'Token address to monitor' })
  @IsString()
  @IsNotEmpty()
  tokenAddress: string;

  @ApiProperty({ enum: AlertType, description: 'Type of alert' })
  @IsEnum(AlertType)
  alertType: AlertType;

  @ApiPropertyOptional({ description: 'Target price for price alerts (in wei)' })
  @IsString()
  @IsOptional()
  targetPrice?: string;
}

export class UpdateAlertDto {
  @ApiPropertyOptional({ description: 'New target price (in wei)' })
  @IsString()
  @IsOptional()
  targetPrice?: string;

  @ApiPropertyOptional({ enum: AlertType, description: 'New alert type' })
  @IsEnum(AlertType)
  @IsOptional()
  alertType?: AlertType;
}

export class AlertResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletAddress: string;

  @ApiProperty()
  tokenAddress: string;

  @ApiProperty({ enum: AlertType })
  alertType: AlertType;

  @ApiPropertyOptional()
  targetPrice: string | null;

  @ApiProperty()
  isTriggered: boolean;

  @ApiPropertyOptional()
  triggeredAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
