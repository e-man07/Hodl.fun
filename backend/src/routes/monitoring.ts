// Self-hosted monitoring dashboard routes
import { Router, Request, Response } from 'express';
import { errorTracker } from '../utils/errorTracker';
import { metricsCollector } from '../utils/metricsCollector';
import { adminMiddleware, authMiddleware } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { db } from '../config/database';
import { cacheService } from '../config/redis';

const router = Router();

// Apply auth middleware to all monitoring routes
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * Get metrics summary
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  const summary = metricsCollector.getSummary();
  sendSuccess(res, summary);
});

/**
 * Get metrics in Prometheus format (for compatibility)
 */
router.get('/metrics/prometheus', async (_req: Request, res: Response) => {
  const prometheusFormat = metricsCollector.exportPrometheusFormat();
  res.setHeader('Content-Type', 'text/plain');
  res.send(prometheusFormat);
});

/**
 * Get error statistics
 */
router.get('/errors/stats', async (_req: Request, res: Response) => {
  const stats = errorTracker.getStats();
  sendSuccess(res, stats);
});

/**
 * Get recent errors
 */
router.get('/errors/recent', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const errors = errorTracker.getRecentErrors(limit);
  sendSuccess(res, { errors, count: errors.length });
});

/**
 * Get errors by severity
 */
router.get('/errors/:severity', async (req: Request, res: Response) => {
  const severity = req.params.severity as 'low' | 'medium' | 'high' | 'critical';
  const errors = errorTracker.getErrorsBySeverity(severity);
  sendSuccess(res, { errors, count: errors.length });
});

/**
 * Get database statistics
 */
router.get('/database/stats', async (_req: Request, res: Response) => {
  const [tokenCount, transactionCount, holderCount, portfolioCount] = await Promise.all([
    db.token.count(),
    db.transaction.count(),
    db.holder.count(),
    db.userPortfolio.count(),
  ]);

  sendSuccess(res, {
    tokens: tokenCount,
    transactions: transactionCount,
    holders: holderCount,
    portfolios: portfolioCount,
  });
});

/**
 * Get cache statistics
 */
router.get('/cache/stats', async (_req: Request, res: Response) => {
  if (!cacheService.isAvailable()) {
    sendSuccess(res, { available: false });
    return;
  }

  const info = await cacheService.getInfo();
  const metrics = metricsCollector.getCacheMetrics();

  sendSuccess(res, {
    available: true,
    ...info,
    ...metrics,
  });
});

/**
 * Clear cache
 */
router.post('/cache/clear', async (_req: Request, res: Response) => {
  if (!cacheService.isAvailable()) {
    sendSuccess(res, { success: false, message: 'Cache not available' });
    return;
  }

  await cacheService.clear();
  sendSuccess(res, { success: true, message: 'Cache cleared' });
});

/**
 * Health check with detailed status
 */
router.get('/health', async (_req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: false,
      cache: false,
    },
  };

  // Check database
  try {
    await db.$queryRaw`SELECT 1`;
    health.services.database = true;
  } catch {
    health.status = 'degraded';
  }

  // Check cache
  health.services.cache = cacheService.isAvailable();

  sendSuccess(res, health);
});

/**
 * Reset metrics
 */
router.post('/metrics/reset', async (_req: Request, res: Response) => {
  metricsCollector.reset();
  sendSuccess(res, { success: true, message: 'Metrics reset' });
});

/**
 * Simple HTML dashboard
 */
router.get('/dashboard', async (_req: Request, res: Response) => {
  const summary = metricsCollector.getSummary();
  const errorStats = errorTracker.getStats();
  const recentErrors = errorTracker.getRecentErrors(10);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hodl.fun Monitoring Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 2rem; color: #38bdf8; }
    h2 { font-size: 1.5rem; margin: 1.5rem 0 1rem; color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 1.5rem;
    }
    .card h3 { color: #94a3b8; font-size: 0.875rem; text-transform: uppercase; margin-bottom: 0.5rem; }
    .card .value { font-size: 2rem; font-weight: bold; color: #38bdf8; }
    .card .sub { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-weight: 600; font-size: 0.875rem; text-transform: uppercase; }
    td { color: #e2e8f0; }
    .status-healthy { color: #10b981; }
    .status-error { color: #ef4444; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; }
    .badge-success { background: #065f46; color: #10b981; }
    .badge-warning { background: #78350f; color: #fbbf24; }
    .badge-error { background: #7f1d1d; color: #ef4444; }
    .refresh-btn {
      position: fixed;
      top: 2rem;
      right: 2rem;
      background: #38bdf8;
      color: #0f172a;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      cursor: pointer;
      font-weight: 600;
    }
    .refresh-btn:hover { background: #0ea5e9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Hodl.fun Monitoring Dashboard</h1>

    <button class="refresh-btn" onclick="location.reload()">Refresh</button>

    <h2>System Overview</h2>
    <div class="grid">
      <div class="card">
        <h3>Uptime</h3>
        <div class="value">${Math.floor(summary.system.uptime / 3600)}h ${Math.floor((summary.system.uptime % 3600) / 60)}m</div>
        <div class="sub">System running</div>
      </div>
      <div class="card">
        <h3>Memory Usage</h3>
        <div class="value">${summary.system.memory.percentage}</div>
        <div class="sub">${summary.system.memory.used} / ${summary.system.memory.total}</div>
      </div>
      <div class="card">
        <h3>Total Requests</h3>
        <div class="value">${summary.requests.total.toLocaleString()}</div>
        <div class="sub">Error rate: ${summary.requests.errorRate}</div>
      </div>
      <div class="card">
        <h3>Cache Hit Rate</h3>
        <div class="value">${summary.cache.hitRate}%</div>
        <div class="sub">${summary.cache.hits} hits / ${summary.cache.misses} misses</div>
      </div>
    </div>

    <h2>HTTP Performance (Last Hour)</h2>
    <div class="grid">
      <div class="card">
        <h3>Requests</h3>
        <div class="value">${summary.http.totalRequests}</div>
      </div>
      <div class="card">
        <h3>Avg Duration</h3>
        <div class="value">${summary.http.avgDuration?.toFixed(2) || 0}ms</div>
      </div>
      <div class="card">
        <h3>P95 Duration</h3>
        <div class="value">${summary.http.p95?.toFixed(2) || 0}ms</div>
      </div>
      <div class="card">
        <h3>P99 Duration</h3>
        <div class="value">${summary.http.p99?.toFixed(2) || 0}ms</div>
      </div>
    </div>

    <h2>Error Statistics</h2>
    <div class="grid">
      <div class="card">
        <h3>Total Errors</h3>
        <div class="value">${errorStats.total}</div>
      </div>
      <div class="card">
        <h3>Last 24h</h3>
        <div class="value">${errorStats.last24h}</div>
      </div>
      <div class="card">
        <h3>Last Hour</h3>
        <div class="value">${errorStats.lastHour}</div>
      </div>
    </div>

    ${recentErrors.length > 0 ? `
    <h2>Recent Errors</h2>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Error</th>
            <th>Message</th>
            <th>Severity</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${recentErrors.map((error) => `
            <tr>
              <td>${new Date(error.timestamp).toLocaleString()}</td>
              <td>${error.error}</td>
              <td>${error.message}</td>
              <td>
                <span class="badge ${error.severity === 'critical' ? 'badge-error' : error.severity === 'high' ? 'badge-warning' : 'badge-success'}">
                  ${error.severity}
                </span>
              </td>
              <td>${error.count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <p style="margin-top: 2rem; text-align: center; color: #64748b;">
      Last updated: ${new Date().toLocaleString()} | Auto-refresh: 30s
    </p>
  </div>

  <script>
    // Auto-refresh every 30 seconds
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
