import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { WalletAuthService } from './services/wallet-auth.service';
import { JwtAuthService } from './services/jwt-auth.service';
import { GetNonceDto, VerifySignatureDto, RefreshTokenDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly walletAuth: WalletAuthService,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  @Post('nonce')
  async getNonce(@Body() dto: GetNonceDto) {
    return this.walletAuth.generateNonce(dto.wallet);
  }

  @Post('verify')
  async verify(@Body() dto: VerifySignatureDto) {
    const isValid = await this.walletAuth.verifySignature(dto.wallet, dto.signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }
    return this.jwtAuth.generateTokenPair(dto.wallet);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.jwtAuth.refreshTokens(dto.refreshToken);
  }
}
