// Self-hosted metrics collection - replaces Prometheus
import { Request, Response } from 'express';

interface MetricData {
  timestamp: number;
  value: number;
}

interface HttpMetric {
  method: string;
  route: string;
  statusCode: number;
  duration: number;
  timestamp: number;
}

interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: number;
}

class MetricsCollector {
  private httpMetrics: HttpMetric[] = [];
  private dbQueryMetrics: Map<string, MetricData[]> = new Map();
  private cacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
  };
  private errorCount = 0;
  private requestCount = 0;
  private maxMetricsSize = 10000; // Keep last 10k metrics

  constructor() {
    // Start collecting system metrics every minute
    setInterval(() => this.collectSystemMetrics(), 60000);
  }

  /**
   * Track HTTP request
   */
  trackHttpRequest(req: Request, res: Response, duration: number): void {
    this.requestCount++;

    const metric: HttpMetric = {
      method: req.method,
      route: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: Date.now(),
    };

    this.httpMetrics.push(metric);

    // Keep only recent metrics
    if (this.httpMetrics.length > this.maxMetricsSize) {
      this.httpMetrics = this.httpMetrics.slice(-this.maxMetricsSize);
    }
  }

  /**
   * Track database query
   */
  trackDbQuery(model: string, action: string, duration: number): void {
    const key = `${model}.${action}`;
    const metrics = this.dbQueryMetrics.get(key) || [];

    metrics.push({
      timestamp: Date.now(),
      value: duration,
    });

    // Keep only recent metrics
    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.dbQueryMetrics.set(key, metrics);
  }

  /**
   * Track cache operation
   */
  trackCacheHit(): void {
    this.cacheMetrics.hits++;
  }

  trackCacheMiss(): void {
    this.cacheMetrics.misses++;
  }

  trackCacheSet(): void {
    this.cacheMetrics.sets++;
  }

  /**
   * Track error
   */
  trackError(): void {
    this.errorCount++;
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal + memUsage.external + memUsage.arrayBuffers;
    const usedMem = memUsage.heapUsed;

    return {
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
  }

  /**
   * Get HTTP metrics summary
   */
  getHttpMetrics(minutes: number = 60): any {
    const now = Date.now();
    const cutoff = now - minutes * 60 * 1000;
    const recentMetrics = this.httpMetrics.filter((m) => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        avgDuration: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        statusCodes: {},
        byRoute: {},
      };
    }

    const durations = recentMetrics.map((m) => m.duration).sort((a, b) => a - b);
    const statusCodes: Record<string, number> = {};
    const byRoute: Record<string, { count: number; avgDuration: number }> = {};

    for (const metric of recentMetrics) {
      // Status codes
      const code = metric.statusCode.toString();
      statusCodes[code] = (statusCodes[code] || 0) + 1;

      // By route
      if (!byRoute[metric.route]) {
        byRoute[metric.route] = { count: 0, avgDuration: 0 };
      }
      byRoute[metric.route].count++;
      byRoute[metric.route].avgDuration += metric.duration;
    }

    // Calculate average durations per route
    for (const route in byRoute) {
      byRoute[route].avgDuration = byRoute[route].avgDuration / byRoute[route].count;
    }

    return {
      totalRequests: recentMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      statusCodes,
      byRoute,
    };
  }

  /**
   * Get database metrics summary
   */
  getDbMetrics(): any {
    const summary: Record<string, any> = {};

    for (const [key, metrics] of this.dbQueryMetrics.entries()) {
      const durations = metrics.map((m) => m.value).sort((a, b) => a - b);

      if (durations.length > 0) {
        summary[key] = {
          count: durations.length,
          avg: durations.reduce((a, b) => a + b, 0) / durations.length,
          p50: durations[Math.floor(durations.length * 0.5)],
          p95: durations[Math.floor(durations.length * 0.95)],
          p99: durations[Math.floor(durations.length * 0.99)],
          max: Math.max(...durations),
        };
      }
    }

    return summary;
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): any {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    const hitRate = total > 0 ? (this.cacheMetrics.hits / total) * 100 : 0;

    return {
      hits: this.cacheMetrics.hits,
      misses: this.cacheMetrics.misses,
      sets: this.cacheMetrics.sets,
      hitRate: hitRate.toFixed(2),
    };
  }

  /**
   * Get overall summary
   */
  getSummary(): any {
    const systemMetrics = this.collectSystemMetrics();

    return {
      system: {
        uptime: Math.floor(systemMetrics.uptime),
        memory: {
          used: `${(systemMetrics.memory.used / 1024 / 1024).toFixed(2)} MB`,
          total: `${(systemMetrics.memory.total / 1024 / 1024).toFixed(2)} MB`,
          percentage: `${systemMetrics.memory.percentage.toFixed(2)}%`,
        },
      },
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        errorRate: this.requestCount > 0 ? ((this.errorCount / this.requestCount) * 100).toFixed(2) + '%' : '0%',
      },
      http: this.getHttpMetrics(60), // Last 60 minutes
      database: this.getDbMetrics(),
      cache: this.getCacheMetrics(),
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.httpMetrics = [];
    this.dbQueryMetrics.clear();
    this.cacheMetrics = { hits: 0, misses: 0, sets: 0 };
    this.errorCount = 0;
    this.requestCount = 0;
  }

  /**
   * Export metrics in Prometheus format (optional, for compatibility)
   */
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    const httpMetrics = this.getHttpMetrics(60);
    const cacheMetrics = this.getCacheMetrics();
    const systemMetrics = this.collectSystemMetrics();

    // HTTP metrics
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.requestCount}`);

    lines.push('# HELP http_request_duration_avg Average HTTP request duration');
    lines.push('# TYPE http_request_duration_avg gauge');
    lines.push(`http_request_duration_avg ${httpMetrics.avgDuration || 0}`);

    // Cache metrics
    lines.push('# HELP cache_hits_total Total cache hits');
    lines.push('# TYPE cache_hits_total counter');
    lines.push(`cache_hits_total ${cacheMetrics.hits}`);

    lines.push('# HELP cache_misses_total Total cache misses');
    lines.push('# TYPE cache_misses_total counter');
    lines.push(`cache_misses_total ${cacheMetrics.misses}`);

    // Memory
    lines.push('# HELP memory_usage_percentage Memory usage percentage');
    lines.push('# TYPE memory_usage_percentage gauge');
    lines.push(`memory_usage_percentage ${systemMetrics.memory.percentage}`);

    return lines.join('\n');
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
