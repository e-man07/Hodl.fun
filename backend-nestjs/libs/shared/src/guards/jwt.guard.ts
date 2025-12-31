import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

interface JwtPayload {
  address: string;
  iat: number;
  exp: number;
  nonce?: string;
}

interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
    iat: number;
    exp: number;
  };
}

/**
 * JWT Authentication Guard
 *
 * Validates JWT token in Authorization header using HMAC-SHA256.
 * Supports wallet-based authentication for Web3 applications.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);
  private readonly jwtSecret: string;

  constructor(private readonly configService: ConfigService) {
    // Get JWT secret from config or use a default for development
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') ||
      'hodl-fun-development-secret-change-in-production';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      throw new UnauthorizedException('Invalid authentication scheme');
    }

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const payload = this.verifyToken(token);

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new UnauthorizedException('Token has expired');
      }

      // Validate Ethereum address format
      if (!this.isValidEthereumAddress(payload.address)) {
        throw new UnauthorizedException('Invalid wallet address in token');
      }

      // Attach user info to request
      request.user = {
        address: payload.address.toLowerCase(),
        iat: payload.iat,
        exp: payload.exp,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`Token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Verify JWT token signature and decode payload
   */
  private verifyToken(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const data = `${headerB64}.${payloadB64}`;
    const expectedSignature = this.createSignature(data);

    if (!this.secureCompare(signatureB64, expectedSignature)) {
      throw new Error('Invalid signature');
    }

    // Decode and parse payload
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as JwtPayload;

    // Validate required fields
    if (!payload.address || !payload.iat || !payload.exp) {
      throw new Error('Missing required fields in token payload');
    }

    return payload;
  }

  /**
   * Create HMAC-SHA256 signature
   */
  private createSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('base64url');
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Validate Ethereum address format
   */
  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Static method to create a JWT token (for use in auth service)
   */
  static createToken(address: string, secret: string, expirySeconds: number = 86400): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      address: address.toLowerCase(),
      iat: now,
      exp: now + expirySeconds,
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${headerB64}.${payloadB64}`;

    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    return `${data}.${signature}`;
  }
}
