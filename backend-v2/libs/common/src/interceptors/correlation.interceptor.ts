import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

interface CorrelationStore {
  correlationId: string;
}

/**
 * Service for managing correlation IDs across async contexts.
 * Uses AsyncLocalStorage to maintain correlation ID through async operations.
 */
@Injectable()
export class CorrelationService {
  private readonly storage = new AsyncLocalStorage<CorrelationStore>();

  /**
   * Generate a new unique correlation ID.
   */
  generateId(): string {
    return randomUUID();
  }

  /**
   * Get the current correlation ID from the async context.
   */
  getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  /**
   * Run a synchronous function within a correlation context.
   */
  runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
    return this.storage.run({ correlationId }, fn);
  }

  /**
   * Run an async function within a correlation context.
   */
  async runWithCorrelationIdAsync<T>(
    correlationId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.storage.run({ correlationId }, fn);
  }

  /**
   * Format a log message with the correlation ID.
   */
  formatLogMessage(message: string): string {
    const correlationId = this.getCorrelationId();
    if (correlationId) {
      return `[correlation_id=${correlationId}] ${message}`;
    }
    return message;
  }

  /**
   * Get headers object with correlation ID for outgoing requests.
   */
  getCorrelationHeaders(): Record<string, string> {
    const correlationId = this.getCorrelationId();
    if (correlationId) {
      return { [CORRELATION_ID_HEADER]: correlationId };
    }
    return {};
  }
}

/**
 * Interceptor that adds correlation ID to requests and responses.
 * If X-Correlation-ID header is present, it uses that value.
 * Otherwise, it generates a new UUID.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(private readonly correlationService: CorrelationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get existing correlation ID from header or generate new one
    const correlationId =
      request.headers[CORRELATION_ID_HEADER.toLowerCase()] ||
      this.correlationService.generateId();

    // Set correlation ID on response header
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Run the handler within the correlation context
    return new Observable((subscriber) => {
      this.correlationService.runWithCorrelationIdAsync(correlationId, async () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
