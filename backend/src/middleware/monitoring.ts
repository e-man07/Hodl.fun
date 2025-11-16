// Monitoring and metrics middleware (Self-hosted - no external services)

import { Request, Response, NextFunction } from 'express';
import { Application } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { errorTracker } from '../utils/errorTracker';
import { metricsCollector } from '../utils/metricsCollector';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
      user?: { address: string };
    }
  }
}

// ============================================
// Self-Hosted Metrics (No Prometheus/External Services)
// ============================================

// ============================================
// Request ID Middleware
// ============================================

/**
 * Attach unique request ID to each request
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.id = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

// ============================================
// Request Logging Middleware
// ============================================

/**
 * Log HTTP requests with detailed info
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    const statusCode = res.statusCode;

    // Track in self-hosted metrics collector
    metricsCollector.trackHttpRequest(req, res, duration);

    // Log request
    const logData = {
      requestId: req.id,
      method: req.method,
      url: req.url,
      route: req.route?.path || req.path,
      statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.headers['x-forwarded-for'] || req.ip,
      userId: req.user?.address,
    };

    if (statusCode >= 500) {
      logger.error('HTTP Request Error', logData);
    } else if (statusCode >= 400) {
      logger.warn('HTTP Request Warning', logData);
    } else {
      logger.info('HTTP Request', logData);
    }

    // Log slow requests
    if (duration > 5000) {
      logger.warn('Slow Request Detected', {
        ...logData,
        slowQuery: true,
      });
    }
  });

  next();
}

// ============================================
// Monitoring Initialization (Self-Hosted)
// ============================================

/**
 * Initialize self-hosted monitoring (no external services)
 */
export function initializeMonitoring(_app: Application): void {
  logger.info('✅ Self-hosted monitoring initialized');
  logger.info('   - Error tracking: file-based logs');
  logger.info('   - Metrics collection: in-memory');
  logger.info('   - Dashboard: /admin/monitoring/dashboard');
}

// ============================================
// Error Tracking
// ============================================

/**
 * Track error in self-hosted error tracker
 */
export function trackError(
  error: Error | string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  context?: any
): void {
  errorTracker.captureError(error, severity, context);
  metricsCollector.trackError();
}

// ============================================
// Database Query Tracking
// ============================================

/**
 * Track database query performance
 */
export function trackDbQuery(model: string, action: string, duration: number): void {
  metricsCollector.trackDbQuery(model, action, duration);
}

// ============================================
// Cache Tracking
// ============================================

/**
 * Track cache operations
 */
export function trackCacheHit(): void {
  metricsCollector.trackCacheHit();
}

export function trackCacheMiss(): void {
  metricsCollector.trackCacheMiss();
}

export function trackCacheSet(): void {
  metricsCollector.trackCacheSet();
}
