import { IsString, IsNotEmpty, IsOptional, Length, MaxLength } from 'class-validator';

/**
 * Create Token Request DTO
 *
 * Validates token creation request from API
 */
export class CreateTokenDto {
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
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  metadataUri?: string;
}
