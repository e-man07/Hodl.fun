// Self-hosted error tracking system - replaces Sentry
import fs from 'fs';
import path from 'path';
import logger from './logger';

interface ErrorLog {
  timestamp: string;
  error: string;
  message: string;
  stack?: string;
  context?: any;
  environment: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
}

interface ErrorStats {
  total: number;
  last24h: number;
  lastHour: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}

class ErrorTracker {
  private logDir: string;
  private errorCache: Map<string, ErrorLog> = new Map();
  private maxCacheSize = 1000;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'errors');
    this.ensureLogDirectory();
    this.loadRecentErrors();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilePath(date: Date = new Date()): string {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.logDir, `errors-${dateStr}.jsonl`);
  }

  private getErrorKey(error: Error | string, context?: any): string {
    const errorMsg = typeof error === 'string' ? error : error.message;
    const contextKey = context ? JSON.stringify(context) : '';
    return `${errorMsg}:${contextKey}`;
  }

  /**
   * Track an error
   */
  captureError(
    error: Error | string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context?: any
  ): void {
    const errorKey = this.getErrorKey(error, context);
    const existingError = this.errorCache.get(errorKey);

    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      error: typeof error === 'string' ? error : error.name,
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      context,
      environment: process.env.NODE_ENV || 'development',
      severity,
      count: existingError ? existingError.count + 1 : 1,
    };

    // Update cache
    this.errorCache.set(errorKey, errorLog);

    // Trim cache if needed
    if (this.errorCache.size > this.maxCacheSize) {
      const firstKey = this.errorCache.keys().next().value;
      this.errorCache.delete(firstKey);
    }

    // Write to log file
    this.writeToLog(errorLog);

    // Log to console
    logger.error('Error tracked', { error: errorLog });
  }

  /**
   * Write error to log file
   */
  private writeToLog(errorLog: ErrorLog): void {
    try {
      const logFile = this.getLogFilePath();
      const logLine = JSON.stringify(errorLog) + '\n';
      fs.appendFileSync(logFile, logLine, 'utf-8');
    } catch (err) {
      logger.error('Failed to write error log', err);
    }
  }

  /**
   * Load recent errors from log files
   */
  private loadRecentErrors(): void {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const files = [this.getLogFilePath(today), this.getLogFilePath(yesterday)];

      for (const file of files) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          const lines = content.trim().split('\n').filter(Boolean);

          for (const line of lines.slice(-500)) {
            // Last 500 per file
            try {
              const errorLog: ErrorLog = JSON.parse(line);
              const key = this.getErrorKey(errorLog.message, errorLog.context);
              this.errorCache.set(key, errorLog);
            } catch {
              // Skip invalid lines
            }
          }
        }
      }

      logger.info(`Loaded ${this.errorCache.size} recent errors into cache`);
    } catch (err) {
      logger.error('Failed to load recent errors', err);
    }
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const lastHour = now - 60 * 60 * 1000;

    const stats: ErrorStats = {
      total: 0,
      last24h: 0,
      lastHour: 0,
      byType: {},
      bySeverity: {},
    };

    for (const error of this.errorCache.values()) {
      const timestamp = new Date(error.timestamp).getTime();

      stats.total += error.count;

      if (timestamp > last24h) {
        stats.last24h += error.count;
      }

      if (timestamp > lastHour) {
        stats.lastHour += error.count;
      }

      stats.byType[error.error] = (stats.byType[error.error] || 0) + error.count;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + error.count;
    }

    return stats;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): ErrorLog[] {
    const errors = Array.from(this.errorCache.values());
    return errors
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ErrorLog[] {
    return Array.from(this.errorCache.values())
      .filter((error) => error.severity === severity)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clear old error logs (keep last 7 days)
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.startsWith('errors-') && file.endsWith('.jsonl')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);

          if (stats.mtimeMs < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            logger.info(`Deleted old error log: ${file}`);
          }
        }
      }
    } catch (err) {
      logger.error('Failed to cleanup old logs', err);
    }
  }

  /**
   * Get error log directory
   */
  getLogDirectory(): string {
    return this.logDir;
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Cleanup old logs daily
setInterval(() => {
  errorTracker.cleanupOldLogs();
}, 24 * 60 * 60 * 1000);
