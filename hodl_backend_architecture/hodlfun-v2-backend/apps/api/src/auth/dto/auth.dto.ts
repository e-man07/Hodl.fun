import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEthAddress } from '@hodlfun/common';

export class GetNonceDto {
  @ApiProperty({
    description: 'Ethereum wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f4fE31',
  })
  @IsString()
  @IsNotEmpty()
  @IsEthAddress()
  wallet!: string;
}

export class VerifySignatureDto {
  @ApiProperty({
    description: 'Ethereum wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f4fE31',
  })
  @IsString()
  @IsNotEmpty()
  @IsEthAddress()
  wallet!: string;

  @ApiProperty({
    description: 'Signed message from wallet',
    example: '0x1234567890abcdef...',
  })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token from previous authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
