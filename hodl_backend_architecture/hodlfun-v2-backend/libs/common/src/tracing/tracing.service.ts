import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  Context,
  Attributes,
} from '@opentelemetry/api';

export interface TracingConfig {
  serviceName: string;
  endpoint: string;
  enabled: boolean;
}

export interface TracingMetrics {
  spansCreated: number;
  errorsRecorded: number;
}

/**
 * TracingService provides OpenTelemetry distributed tracing capabilities.
 * Wraps the OpenTelemetry API for easy use in NestJS services.
 */
@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private readonly tracer;
  private readonly config: TracingConfig;
  private spansCreated = 0;
  private errorsRecorded = 0;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      serviceName: this.configService.get<string>('OTEL_SERVICE_NAME', 'hodlfun-service'),
      endpoint: this.configService.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318'),
      enabled: this.configService.get<string>('NODE_ENV', 'development') !== 'test',
    };

    this.tracer = trace.getTracer(this.config.serviceName);
  }

  /**
   * Get the current tracing configuration.
   */
  getConfig(): TracingConfig {
    return this.config;
  }

  /**
   * Check if tracing is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Start a new span with the given name.
   */
  startSpan(name: string, attributes?: Attributes): Span {
    this.spansCreated++;
    const span = this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes,
    });
    return span;
  }

  /**
   * Start a client span (for outgoing requests).
   */
  startClientSpan(name: string, attributes?: Attributes): Span {
    this.spansCreated++;
    return this.tracer.startSpan(name, {
      kind: SpanKind.CLIENT,
      attributes,
    });
  }

  /**
   * Start a server span (for incoming requests).
   */
  startServerSpan(name: string, attributes?: Attributes): Span {
    this.spansCreated++;
    return this.tracer.startSpan(name, {
      kind: SpanKind.SERVER,
      attributes,
    });
  }

  /**
   * Start an internal span.
   */
  startInternalSpan(name: string, attributes?: Attributes): Span {
    this.spansCreated++;
    return this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes,
    });
  }

  /**
   * Get the current trace context.
   */
  getCurrentContext(): Context {
    return context.active();
  }

  /**
   * Get the current trace ID.
   */
  getTraceId(): string {
    const span = trace.getActiveSpan();
    if (span) {
      return span.spanContext().traceId;
    }
    return '00000000000000000000000000000000';
  }

  /**
   * Get the current span ID.
   */
  getSpanId(): string {
    const span = trace.getActiveSpan();
    if (span) {
      return span.spanContext().spanId;
    }
    return '0000000000000000';
  }

  /**
   * Wrap an async function with a span.
   * Automatically handles span start/end and error recording.
   */
  async withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Attributes,
  ): Promise<T> {
    const span = this.startSpan(name, attributes);

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      this.errorsRecorded++;
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get tracing metrics.
   */
  getMetrics(): TracingMetrics {
    return {
      spansCreated: this.spansCreated,
      errorsRecorded: this.errorsRecorded,
    };
  }

  /**
   * Record an event on the current span.
   */
  recordEvent(name: string, attributes?: Attributes): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set an attribute on the current span.
   */
  setAttribute(key: string, value: string | number | boolean): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Set the status of the current span.
   */
  setStatus(code: SpanStatusCode, message?: string): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({ code, message });
    }
  }
}
