import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDIT_ACTION_KEY, AUDIT_ENTITY_TYPE_KEY } from './audit.decorator';

/**
 * Interceptor that automatically logs audit events for decorated controller methods.
 * Only logs on successful request completion to avoid logging failed attempts.
 *
 * @example
 * ```typescript
 * // Register globally in AppModule
 * providers: [
 *   {
 *     provide: APP_INTERCEPTOR,
 *     useClass: AuditInterceptor,
 *   },
 * ],
 *
 * // Or register on specific controllers
 * @UseInterceptors(AuditInterceptor)
 * @Controller('auth')
 * export class AuthController {}
 * ```
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());

    // If no audit action is defined, just pass through
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const entityType = this.reflector.get<string>(AUDIT_ENTITY_TYPE_KEY, context.getHandler());

    // Extract relevant information from request
    const walletAddress = request.user?.walletAddress;
    const ipAddress = request.ip;
    const userAgent = request.headers?.['user-agent'];

    // Try to extract entity ID from params (common patterns: id, tokenId, address)
    const entityId =
      request.params?.id ||
      request.params?.tokenId ||
      request.params?.address ||
      request.params?.walletAddress;

    // Build details object with request metadata
    const details: Record<string, unknown> = {
      method: request.method,
      path: request.path || request.url,
      controller: context.getClass().name,
      handler: context.getHandler().name,
    };

    // Include query params if present
    if (request.query && Object.keys(request.query).length > 0) {
      details.query = request.query;
    }

    // Include body keys (but not values for security) if present
    if (request.body && Object.keys(request.body).length > 0) {
      details.bodyKeys = Object.keys(request.body);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          // Log on successful completion
          this.auditService.logSafe({
            walletAddress,
            action,
            entityType,
            entityId,
            details,
            ipAddress,
            userAgent,
          });
        },
        // We don't log on error - failed requests shouldn't create audit trails
        // for actions that didn't actually complete
      }),
    );
  }
}
