// Prisma database client

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { trackDbQuery } from '../middleware/monitoring';

// Singleton Prisma Client
let prisma: PrismaClient;

/**
 * Get Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore - Prisma event types
      prisma.$on('query', (e: any) => {
        logger.debug('Query', {
          query: e.query,
          params: e.params,
          duration: e.duration,
        });
      });
    }

    // Log errors
    // @ts-ignore - Prisma event types
    prisma.$on('error', (e: any) => {
      logger.error('Database error', e);
    });

    // Log warnings
    // @ts-ignore - Prisma event types
    prisma.$on('warn', (e: any) => {
      logger.warn('Database warning', e);
    });

    // Add middleware for query performance tracking
    prisma.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;

      // Track in metrics
      trackDbQuery(params.model || 'unknown', params.action, duration);

      // Log slow queries (> 3.5 seconds) - Increased threshold to reduce noise
      // Note: Some queries (TokenMetric lookups) are expected to be ~1s due to table size
      // This is acceptable as they're cached and run in background workers
      if (duration > 3500) {
        logger.warn('Slow Query Detected', {
          model: params.model,
          action: params.action,
          duration,
          args: params.args,
        });
      }

      // Log very slow queries (> 10 seconds) - These need investigation
      if (duration > 10000) {
        logger.error('Very Slow Query Detected', {
          model: params.model,
          action: params.action,
          duration,
          args: params.args,
        });
      }

      return result;
    });

    // Only auto-connect in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      // Log successful connection
      prisma.$connect()
        .then(() => {
          logger.info('✅ Database connected successfully');

          // Log connection pool info
          logger.info('Database connection pool configured', {
            poolTimeout: process.env.DATABASE_POOL_TIMEOUT || '10s',
            connectionLimit: process.env.DATABASE_CONNECTION_LIMIT || '20',
          });
        })
        .catch((error) => {
          logger.error('❌ Database connection failed:', error);
          process.exit(1);
        });
    }
  }

  return prisma;
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}

// Export singleton instance
export const db = getPrismaClient();
