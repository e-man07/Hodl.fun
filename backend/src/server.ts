// Main Express server for Hodl.fun Backend

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import timeout from 'connect-timeout';
import { appConfig, validateConfig } from './config';
import logger, { httpLoggerStream } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimit';
import { sanitizeMiddleware } from './middleware/sanitize';
import {
  initializeMonitoring,
  requestIdMiddleware,
  requestLoggingMiddleware,
} from './middleware/monitoring';
import { disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';

// Import routes
import healthRoutes from './routes/health';
import tokenRoutes from './routes/tokens';
import ipfsRoutes from './routes/ipfs';
import userRoutes from './routes/users';
import marketRoutes from './routes/market';
import transactionRoutes from './routes/transactions';
import adminRoutes from './routes/admin';
import monitoringRoutes from './routes/monitoring';

// Validate configuration
try {
  validateConfig();
} catch (error) {
  logger.error('Configuration validation failed:', error);
  process.exit(1);
}

// Create Express app
const app: Application = express();

// ============================================
// Initialize Monitoring (Self-Hosted)
// ============================================

initializeMonitoring(app);

// ============================================
// Middleware
// ============================================

// Request timeout (30 seconds)
app.use(timeout('30s'));

// Request ID tracking
app.use(requestIdMiddleware);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: appConfig.cors.origin,
    credentials: true,
  })
);

// Compression
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6, // Balance between speed and compression
    threshold: 1024, // Only compress responses > 1KB
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// XSS Sanitization
app.use(sanitizeMiddleware);

// HTTP request logging
if (appConfig.env !== 'test') {
  app.use(
    morgan(
      appConfig.env === 'development'
        ? 'dev'
        : ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
      { stream: httpLoggerStream }
    )
  );
}

// Request logging (after other middleware)
app.use(requestLoggingMiddleware);

// Rate limiting
app.use(apiRateLimiter);

// Timeout handler
app.use((req, _res, next) => {
  if (!req.timedout) next();
});

// ============================================
// Routes
// ============================================

// Health check routes (no rate limiting)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// API routes (versioned)
const API_PREFIX = `/api/${appConfig.apiVersion}`;

app.use(`${API_PREFIX}/tokens`, tokenRoutes);
app.use(`${API_PREFIX}/ipfs`, ipfsRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/market`, marketRoutes);
app.use(`${API_PREFIX}/transactions`, transactionRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/monitoring`, monitoringRoutes);

// Welcome route
app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    message: 'Hodl.fun Backend API',
    version: appConfig.apiVersion,
    environment: appConfig.env,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// Server Startup
// ============================================

const server = app.listen(appConfig.port, async () => {
  logger.info(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║         🚀 Hodl.fun Backend API Server                ║
  ║                                                        ║
  ║  Environment: ${appConfig.env.padEnd(39)} ║
  ║  Port:        ${appConfig.port.toString().padEnd(39)} ║
  ║  API Version: ${appConfig.apiVersion.padEnd(39)} ║
  ║                                                        ║
  ║  Server URL:  http://localhost:${appConfig.port.toString().padEnd(23)} ║
  ║  API Base:    http://localhost:${appConfig.port}/api/${appConfig.apiVersion.padEnd(11)} ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

  logger.info('✅ Server is running');
  logger.info(`📡 CORS enabled for: ${appConfig.cors.origin.join(', ')}`);
  logger.info('⚡ API-only mode: Workers and Indexer should run as separate services');
});

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
