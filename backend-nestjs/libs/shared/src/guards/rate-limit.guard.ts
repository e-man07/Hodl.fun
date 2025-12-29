import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Rate Limiting Guard
 *
 * Implements basic rate limiting per IP or user
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequests = 100;
  private readonly windowMs = 60 * 1000; // 1 minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientId = this.getClientId(request);
    const now = Date.now();

    const record = this.requests.get(clientId);

    if (!record) {
      this.requests.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (now > record.resetTime) {
      // Window expired, reset
      record.count = 1;
      record.resetTime = now + this.windowMs;
      return true;
    }

    if (record.count >= this.maxRequests) {
      throw new HttpException(
        `Rate limit exceeded. Max ${this.maxRequests} requests per minute`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
    return true;
  }

  private getClientId(request: Request): string {
    // Use user address if authenticated, otherwise use IP
    const user = (request as any).user;
    if (user?.address) {
      return user.address;
    }

    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.ip ||
      'unknown'
    );
  }
}
