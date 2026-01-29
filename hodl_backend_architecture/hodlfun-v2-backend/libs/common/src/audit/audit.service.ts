import { Injectable, Logger, Inject } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';

/**
 * Injection token for the Prisma service.
 * This allows the AuditService to work with any Prisma service implementation.
 */
export const PRISMA_SERVICE = 'PrismaService';

/**
 * Interface for the Prisma service that AuditService depends on.
 * This decouples the audit module from the database module.
 */
export interface IAuditPrismaService {
  auditLog: {
    create(args: { data: Prisma.AuditLogCreateInput }): Promise<AuditLog>;
    findMany(args: Prisma.AuditLogFindManyArgs): Promise<AuditLog[]>;
    count(args: Prisma.AuditLogCountArgs): Promise<number>;
  };
}

/**
 * Predefined audit actions for consistent logging across the application.
 * Use these constants instead of raw strings for type safety.
 */
export const AuditAction = {
  // Authentication
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_REFRESH: 'auth:refresh',
  AUTH_FAILED: 'auth:failed',

  // Token operations
  TOKEN_CREATE: 'token:create',
  TOKEN_TRADE: 'token:trade',
  TOKEN_GRADUATE: 'token:graduate',

  // User operations
  USER_PROFILE_UPDATE: 'user:profile_update',
  USER_SETTINGS_UPDATE: 'user:settings_update',

  // Admin operations
  ADMIN_CONFIG_UPDATE: 'admin:config_update',
  ADMIN_USER_BAN: 'admin:user_ban',
  ADMIN_USER_UNBAN: 'admin:user_unban',
  ADMIN_TOKEN_HIDE: 'admin:token_hide',
  ADMIN_TOKEN_UNHIDE: 'admin:token_unhide',

  // System events
  SYSTEM_ERROR: 'system:error',
  RATE_LIMIT_EXCEEDED: 'system:rate_limit_exceeded',
  SECURITY_VIOLATION: 'system:security_violation',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Parameters for creating an audit log entry.
 */
export interface CreateAuditLogParams {
  /** Wallet address of the user performing the action (optional for system events) */
  walletAddress?: string;
  /** The action being performed (use AuditAction constants) */
  action: string;
  /** Type of entity being affected (e.g., 'token', 'user', 'config') */
  entityType?: string;
  /** ID of the entity being affected */
  entityId?: string;
  /** Additional details about the action (stored as JSON) */
  details?: Record<string, unknown>;
  /** IP address of the request */
  ipAddress?: string;
  /** User agent string from the request */
  userAgent?: string;
}

/**
 * Pagination options for querying audit logs.
 */
export interface AuditLogPaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Filter options for querying audit logs.
 */
export interface AuditLogFilterOptions extends AuditLogPaginationOptions {
  walletAddress?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Paginated result for audit log queries.
 */
export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Service for creating and querying audit logs.
 * Audit logs track user actions and system events for security and compliance.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: IAuditPrismaService,
  ) {}

  /**
   * Create an audit log entry.
   * Throws an error if the database operation fails.
   *
   * @param params - The audit log parameters
   * @returns The created audit log entry
   */
  async log(params: CreateAuditLogParams): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        walletAddress: params.walletAddress,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  /**
   * Create an audit log entry without throwing errors.
   * Use this method when you don't want logging failures to affect the main operation.
   *
   * @param params - The audit log parameters
   */
  async logSafe(params: CreateAuditLogParams): Promise<void> {
    try {
      await this.log(params);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create audit log: ${message}`, {
        action: params.action,
        walletAddress: params.walletAddress,
        error: message,
      });
    }
  }

  /**
   * Find audit logs for a specific wallet address.
   *
   * @param walletAddress - The wallet address to search for
   * @param options - Pagination options
   * @returns Array of audit logs
   */
  async findByWallet(
    walletAddress: string,
    options: AuditLogPaginationOptions = {},
  ): Promise<AuditLog[]> {
    const { limit = 100, offset = 0 } = options;

    return this.prisma.auditLog.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Find audit logs for a specific action type.
   *
   * @param action - The action to search for
   * @param options - Pagination options
   * @returns Array of audit logs
   */
  async findByAction(
    action: string,
    options: AuditLogPaginationOptions = {},
  ): Promise<AuditLog[]> {
    const { limit = 100, offset = 0 } = options;

    return this.prisma.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Find audit logs for a specific entity.
   *
   * @param entityType - The type of entity
   * @param entityId - The ID of the entity
   * @param options - Pagination options
   * @returns Array of audit logs
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    options: AuditLogPaginationOptions = {},
  ): Promise<AuditLog[]> {
    const { limit = 100, offset = 0 } = options;

    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Find all audit logs with filtering and pagination.
   *
   * @param options - Filter and pagination options
   * @returns Paginated audit logs with total count
   */
  async findAll(options: AuditLogFilterOptions = {}): Promise<PaginatedAuditLogs> {
    const {
      limit = 100,
      offset = 0,
      walletAddress,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
    } = options;

    const where: Prisma.AuditLogWhereInput = {};

    if (walletAddress) {
      where.walletAddress = walletAddress;
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      limit,
      offset,
    };
  }
}
