import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
  IsNumberString,
} from 'class-validator';

/**
 * Build Create Token Transaction DTO
 *
 * Request body for building token creation transaction calldata
 */
export class BuildCreateTokenTxDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'creator must be a valid Ethereum address',
  })
  creator!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  symbol!: string;

  @IsString()
  @IsOptional()
  tokenURI?: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string;

  @IsNumberString()
  @IsOptional()
  fee?: string;
}

/**
 * Build Buy Transaction DTO
 *
 * Request body for building buy transaction calldata
 */
export class BuildBuyTxDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'token must be a valid Ethereum address',
  })
  token!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'to must be a valid Ethereum address',
  })
  to!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string;

  @IsNumberString()
  @IsOptional()
  amountOutMin?: string;

  @IsNumberString()
  @IsOptional()
  deadline?: string;
}

/**
 * Build Sell Transaction DTO
 *
 * Request body for building sell transaction calldata
 */
export class BuildSellTxDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'token must be a valid Ethereum address',
  })
  token!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'from must be a valid Ethereum address',
  })
  from!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'to must be a valid Ethereum address',
  })
  to!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string;

  @IsNumberString()
  @IsOptional()
  amountOutMin?: string;

  @IsNumberString()
  @IsOptional()
  deadline?: string;
}

/**
 * Quote Buy Request Query DTO
 */
export class QuoteBuyQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'token must be a valid Ethereum address',
  })
  token!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string;
}

/**
 * Quote Sell Request Query DTO
 */
export class QuoteSellQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'token must be a valid Ethereum address',
  })
  token!: string;

  @IsNumberString()
  @IsNotEmpty()
  amountIn!: string;
}
