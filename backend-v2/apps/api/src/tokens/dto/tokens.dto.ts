import { IsOptional, IsIn, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@hodlfun/common';
import { PriceInterval, TokenStatus } from '@hodlfun/database';

export class GetTokensDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by token status',
    enum: TokenStatus,
    example: 'TRADING',
  })
  @IsOptional()
  @IsEnum(TokenStatus)
  status?: TokenStatus;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'marketCap', 'currentPrice', 'name'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'marketCap', 'currentPrice', 'name'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class GetPriceHistoryDto {
  @ApiProperty({
    description: 'Price history interval',
    enum: PriceInterval,
    example: 'ONE_HOUR',
  })
  @IsEnum(PriceInterval)
  interval!: PriceInterval;
}
