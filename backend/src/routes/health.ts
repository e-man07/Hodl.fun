// Health check routes

import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { cacheService } from '../config/redis';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * Basic health check
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * Detailed health check with dependencies
 */
router.get(
  '/detailed',
  asyncHandler(async (_req: Request, res: Response) => {
    const checks = {
      database: false,
      redis: false,
    };

    // Check database connection
    try {
      await db.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      checks.database = false;
    }

    // Check Redis connection
    checks.redis = cacheService.isAvailable();

    const isHealthy = checks.database;

    sendSuccess(
      res,
      {
        status: isHealthy ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
          database: checks.database ? 'connected' : 'disconnected',
          redis: checks.redis ? 'connected' : 'disconnected',
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
      undefined,
      isHealthy ? 200 : 503
    );
  })
);

export default router;
