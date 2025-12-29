import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * JWT Authentication Guard
 *
 * Validates JWT token in Authorization header
 */
@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest() as any;
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

    // For now, just validate that token exists
    // In production, validate JWT signature and expiration
    try {
      // TODO: Validate JWT signature
      request.user = {
        address: this.extractAddressFromToken(token),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractAddressFromToken(token: string): string {
    // TODO: Properly decode and validate JWT
    // For now, just return a placeholder
    return token.substring(0, 42);
  }
}
