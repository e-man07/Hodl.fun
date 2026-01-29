import { Injectable, LoggerService, ConsoleLogger, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Log level for the JSON logger
 */
export type LogLevel = 'debug' | 'log' | 'warn' | 'error' | 'verbose' | 'fatal';

/**
 * Structured log entry format for ELK/cloud logging ingestion
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level (debug, log, warn, error, verbose, fatal) */
  level: LogLevel;
  /** Logger context (e.g., service name) */
  context?: string;
  /** Log message */
  message: string;
  /** Service name for filtering */
  service: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Trace ID from OpenTelemetry */
  traceId?: string;
  /** Span ID from OpenTelemetry */
  spanId?: string;
  /** Additional structured data */
  data?: Record<string, unknown>;
  /** Error details if applicable */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Configuration options for JsonLoggerService
 */
export interface JsonLoggerOptions {
  /** Service name for log identification */
  serviceName: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Log level threshold */
  logLevel: LogLevel;
  /** Whether to pretty-print JSON in development */
  prettyPrint?: boolean;
}

/**
 * JSON Logger Service for structured logging compatible with ELK stack.
 *
 * Features:
 * - Outputs logs in JSON format for easy parsing
 * - Includes correlation IDs for request tracing
 * - Integrates with OpenTelemetry trace/span IDs
 * - Supports structured data in log entries
 *
 * Usage:
 * ```typescript
 * @Module({
 *   providers: [
 *     { provide: Logger, useClass: JsonLoggerService },
 *   ],
 * })
 * ```
 */
@Injectable({ scope: Scope.TRANSIENT })
export class JsonLoggerService extends ConsoleLogger implements LoggerService {
  private serviceName = 'hodlfun';
  private environment = 'development';
  private jsonEnabled = false;
  private prettyPrint = false;

  /**
   * Configure the logger with options
   */
  configure(options: Partial<JsonLoggerOptions>): void {
    if (options.serviceName) this.serviceName = options.serviceName;
    if (options.environment) this.environment = options.environment;
    if (options.prettyPrint !== undefined) this.prettyPrint = options.prettyPrint;
    this.jsonEnabled = options.environment !== 'development' || options.prettyPrint === false;
  }

  /**
   * Set the service name from ConfigService
   */
  setServiceName(name: string): void {
    this.serviceName = name;
  }

  /**
   * Enable/disable JSON output
   */
  setJsonEnabled(enabled: boolean): void {
    this.jsonEnabled = enabled;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    if (this.jsonEnabled) {
      this.writeJsonLog('log', message, optionalParams);
    } else {
      super.log(message, ...optionalParams);
    }
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    if (this.jsonEnabled) {
      this.writeJsonLog('error', message, optionalParams);
    } else {
      super.error(message, ...optionalParams);
    }
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    if (this.jsonEnabled) {
      this.writeJsonLog('warn', message, optionalParams);
    } else {
      super.warn(message, ...optionalParams);
    }
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    if (this.jsonEnabled) {
      this.writeJsonLog('debug', message, optionalParams);
    } else {
      super.debug(message, ...optionalParams);
    }
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    if (this.jsonEnabled) {
      this.writeJsonLog('verbose', message, optionalParams);
    } else {
      super.verbose(message, ...optionalParams);
    }
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    if (this.jsonEnabled) {
      this.writeJsonLog('fatal', message, optionalParams);
    } else {
      super.error(message, ...optionalParams);
    }
  }

  private writeJsonLog(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const entry = this.formatLogEntry(level, message, optionalParams);
    const jsonString = this.prettyPrint
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    if (level === 'error' || level === 'fatal') {
      process.stderr.write(jsonString + '\n');
    } else {
      process.stdout.write(jsonString + '\n');
    }
  }

  private formatLogEntry(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      message: String(message),
    };

    // Extract context from optionalParams
    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];

      // Check if last param is a context string
      if (typeof lastParam === 'string') {
        entry.context = lastParam;
        optionalParams = optionalParams.slice(0, -1);
      }

      // Check for error objects
      for (const param of optionalParams) {
        if (param instanceof Error) {
          entry.error = {
            name: param.name,
            message: param.message,
            stack: param.stack,
          };
        } else if (typeof param === 'object' && param !== null) {
          // Merge additional data
          entry.data = { ...entry.data, ...(param as Record<string, unknown>) };
        }
      }
    }

    // Try to extract trace context from AsyncLocalStorage
    // (This would be set by CorrelationInterceptor or TracingService)
    try {
      // Import would be circular, so we access global if available
      const correlationId = (global as unknown as { __correlationId?: string }).__correlationId;
      if (correlationId) {
        entry.correlationId = correlationId;
      }
    } catch {
      // Ignore if not available
    }

    return entry;
  }
}

/**
 * Create a pre-configured JSON logger for use outside NestJS DI
 */
export function createJsonLogger(options: JsonLoggerOptions): JsonLoggerService {
  const logger = new JsonLoggerService();
  logger.configure(options);
  return logger;
}
