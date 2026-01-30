import { SetMetadata, applyDecorators } from '@nestjs/common';

/**
 * Metadata key for storing the audit action on decorated handlers.
 */
export const AUDIT_ACTION_KEY = 'audit:action';

/**
 * Metadata key for storing the entity type on decorated handlers.
 */
export const AUDIT_ENTITY_TYPE_KEY = 'audit:entityType';

/**
 * Options for the Audit decorator.
 */
export interface AuditOptions {
  /** Type of entity being affected (e.g., 'token', 'user') */
  entityType?: string;
}

/**
 * Decorator to mark a controller method for audit logging.
 * When applied, the AuditInterceptor will automatically log the action
 * after successful completion of the request.
 *
 * @example
 * ```typescript
 * @Post('login')
 * @Audit(AuditAction.AUTH_LOGIN)
 * async login(@Body() dto: LoginDto) {
 *   // ...
 * }
 *
 * @Post('tokens')
 * @Audit(AuditAction.TOKEN_CREATE, { entityType: 'token' })
 * async createToken(@Body() dto: CreateTokenDto) {
 *   // ...
 * }
 * ```
 *
 * @param action - The audit action to log (use AuditAction constants)
 * @param options - Additional options like entity type
 */
export function Audit(action: string, options?: AuditOptions): MethodDecorator {
  const decorators = [SetMetadata(AUDIT_ACTION_KEY, action)];

  if (options?.entityType) {
    decorators.push(SetMetadata(AUDIT_ENTITY_TYPE_KEY, options.entityType));
  }

  return applyDecorators(...decorators);
}
