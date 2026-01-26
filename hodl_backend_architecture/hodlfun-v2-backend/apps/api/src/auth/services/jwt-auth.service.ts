import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@hodlfun/redis';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload {
  wallet: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtAuthService {
  private readonly refreshTokenPrefix = 'auth:refresh:';
  private readonly refreshTokenTtl: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    // Parse refresh token TTL from config (default 7 days)
    const ttlString = this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d');
    this.refreshTokenTtl = this.parseTtl(ttlString);
  }

  async generateTokenPair(wallet: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const normalizedWallet = wallet.toLowerCase();

    const accessToken = this.jwtService.sign(
      { wallet: normalizedWallet, type: 'access' },
      { expiresIn: this.configService.get('JWT_EXPIRES_IN', '1h') },
    );

    const refreshTokenId = uuidv4();
    const refreshToken = this.jwtService.sign(
      { wallet: normalizedWallet, type: 'refresh', jti: refreshTokenId },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    // Store refresh token in Redis
    await this.redis.set(
      `${this.refreshTokenPrefix}${normalizedWallet}:${refreshTokenId}`,
      '1',
      'EX',
      this.refreshTokenTtl,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const payload = this.jwtService.verify<TokenPayload & { jti: string }>(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if refresh token exists in Redis
      const key = `${this.refreshTokenPrefix}${payload.wallet}:${payload.jti}`;
      const exists = await this.redis.exists(key);

      if (!exists) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      // Revoke old refresh token
      await this.redis.del(key);

      // Generate new token pair
      return this.generateTokenPair(payload.wallet);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async revokeRefreshToken(wallet: string, tokenId: string): Promise<void> {
    const key = `${this.refreshTokenPrefix}${wallet.toLowerCase()}:${tokenId}`;
    await this.redis.del(key);
  }

  async revokeAllRefreshTokens(wallet: string): Promise<void> {
    const pattern = `${this.refreshTokenPrefix}${wallet.toLowerCase()}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private parseTtl(ttlString: string): number {
    const match = ttlString.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60; // Default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}
