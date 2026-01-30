import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { WalletAuthService } from './services/wallet-auth.service';
import { JwtAuthService } from './services/jwt-auth.service';
import { GetNonceDto, VerifySignatureDto, RefreshTokenDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly walletAuth: WalletAuthService,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  @Post('nonce')
  @ApiOperation({ summary: 'Get nonce for wallet signature' })
  @ApiBody({ type: GetNonceDto })
  @ApiResponse({ status: 200, description: 'Nonce generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid wallet address' })
  async getNonce(@Body() dto: GetNonceDto) {
    return this.walletAuth.generateNonce(dto.wallet);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify wallet signature and get JWT tokens' })
  @ApiBody({ type: VerifySignatureDto })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async verify(@Body() dto: VerifySignatureDto) {
    const isValid = await this.walletAuth.verifySignature(dto.wallet, dto.signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }
    return this.jwtAuth.generateTokenPair(dto.wallet);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.jwtAuth.refreshTokens(dto.refreshToken);
  }
}
