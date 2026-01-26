import { IsString, IsNotEmpty } from 'class-validator';
import { IsEthAddress } from '@hodlfun/common';

export class GetNonceDto {
  @IsString()
  @IsNotEmpty()
  @IsEthAddress()
  wallet: string;
}

export class VerifySignatureDto {
  @IsString()
  @IsNotEmpty()
  @IsEthAddress()
  wallet: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
