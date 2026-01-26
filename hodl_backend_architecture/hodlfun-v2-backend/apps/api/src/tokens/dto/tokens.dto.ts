import { IsOptional, IsIn, IsEnum } from 'class-validator';
import { PaginationDto } from '@hodlfun/common';
import { PriceInterval, TokenStatus } from '@hodlfun/database';

export class GetTokensDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TokenStatus)
  status?: TokenStatus;

  @IsOptional()
  @IsIn(['createdAt', 'marketCap', 'currentPrice', 'name'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class GetPriceHistoryDto {
  @IsEnum(PriceInterval)
  interval: PriceInterval;
}
