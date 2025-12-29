import {
  IsString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
} from 'class-validator';

/**
 * Buy Token Request DTO
 */
export class BuyTokenDto {
  @IsString()
  @IsNotEmpty()
  tokenId!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string; // Amount of ETH in wei as string

  @IsNumberString()
  @IsOptional()
  minAmountOut?: string; // Minimum tokens out in wei (slippage protection)
}

/**
 * Sell Token Request DTO
 */
export class SellTokenDto {
  @IsString()
  @IsNotEmpty()
  tokenId!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string; // Amount of tokens to sell in wei as string

  @IsNumberString()
  @IsOptional()
  minAmountOut?: string; // Minimum ETH out in wei (slippage protection)
}

/**
 * Trade Query Parameters DTO
 */
export class TradeQueryDto {
  @IsString()
  @IsOptional()
  tokenId?: string;

  @IsString()
  @IsOptional()
  user?: string;

  @IsNumberString()
  @IsOptional()
  limit: string = '20';

  @IsNumberString()
  @IsOptional()
  offset: string = '0';

  @IsString()
  @IsOptional()
  orderBy?: 'timestamp' | 'totalValue';

  @IsString()
  @IsOptional()
  orderDirection?: 'asc' | 'desc';
}
