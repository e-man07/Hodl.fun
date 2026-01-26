/**
 * Logging Interceptor Unit Tests
 * Tests for HTTP request/response logging
 */
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';

// Mock Logger
const mockLoggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
const mockLoggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

// Create mock execution context
const createMockExecutionContext = (options: {
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
} = {}): ExecutionContext => {
  const mockRequest = {
    method: options.method || 'GET',
    url: options.url || '/api/tokens',
    ip: options.ip || '127.0.0.1',
    get: jest.fn((header: string) => {
      if (header.toLowerCase() === 'user-agent') {
        return options.userAgent || 'jest-test-agent';
      }
      return undefined;
    }),
  };

  const mockResponse = {
    statusCode: options.statusCode || 200,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as unknown as ExecutionContext;
};

// Create mock call handler
const createMockCallHandler = <T>(returnValue: T): CallHandler => {
  return {
    handle: () => of(returnValue),
  };
};

// Create mock call handler that throws error
const createErrorCallHandler = (error: Error): CallHandler => {
  return {
    handle: () => throwError(() => error),
  };
};

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('successful requests', () => {
    it('should log successful GET request', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        method: 'GET',
        url: '/api/tokens',
        statusCode: 200,
      });
      const callHandler = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          expect(mockLoggerLog).toHaveBeenCalled();
          const logMessage = mockLoggerLog.mock.calls[0][0];
          expect(logMessage).toContain('GET');
          expect(logMessage).toContain('/api/tokens');
          expect(logMessage).toContain('200');
          done();
        },
      });
    });

    it('should log successful POST request', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        method: 'POST',
        url: '/api/auth/nonce',
        statusCode: 201,
      });
      const callHandler = createMockCallHandler({ nonce: 'abc123' });

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          expect(mockLoggerLog).toHaveBeenCalled();
          const logMessage = mockLoggerLog.mock.calls[0][0];
          expect(logMessage).toContain('POST');
          expect(logMessage).toContain('/api/auth/nonce');
          expect(logMessage).toContain('201');
          done();
        },
      });
    });

    it('should log client IP address', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        ip: '192.168.1.100',
      });
      const callHandler = createMockCallHandler({});

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          const logMessage = mockLoggerLog.mock.calls[0][0];
          expect(logMessage).toContain('192.168.1.100');
          done();
        },
      });
    });

    it('should log user agent', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        userAgent: 'Mozilla/5.0 (Test Browser)',
      });
      const callHandler = createMockCallHandler({});

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          const logMessage = mockLoggerLog.mock.calls[0][0];
          expect(logMessage).toContain('Mozilla/5.0 (Test Browser)');
          done();
        },
      });
    });

    it('should handle missing user agent', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        userAgent: undefined,
      });
      // Override the get function to return undefined
      const httpContext = context.switchToHttp();
      (httpContext.getRequest() as any).get = () => undefined;

      const callHandler = createMockCallHandler({});

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          expect(mockLoggerLog).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should log request duration', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext();
      const callHandler = createMockCallHandler({});

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          const logMessage = mockLoggerLog.mock.calls[0][0];
          // Should contain duration in ms format
          expect(logMessage).toMatch(/\d+ms/);
          done();
        },
      });
    });
  });

  describe('error requests', () => {
    it('should log error request with 500 status', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        method: 'GET',
        url: '/api/tokens/0x123',
      });
      const error = new Error('Database connection failed');
      (error as any).status = 500;
      const callHandler = createErrorCallHandler(error);

      interceptor.intercept(context, callHandler).subscribe({
        error: () => {
          expect(mockLoggerError).toHaveBeenCalled();
          const logMessage = mockLoggerError.mock.calls[0][0];
          expect(logMessage).toContain('GET');
          expect(logMessage).toContain('/api/tokens/0x123');
          expect(logMessage).toContain('500');
          expect(logMessage).toContain('Database connection failed');
          done();
        },
      });
    });

    it('should log error request with 404 status', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        method: 'GET',
        url: '/api/tokens/invalid',
      });
      const error = new Error('Token not found');
      (error as any).status = 404;
      const callHandler = createErrorCallHandler(error);

      interceptor.intercept(context, callHandler).subscribe({
        error: () => {
          const logMessage = mockLoggerError.mock.calls[0][0];
          expect(logMessage).toContain('404');
          expect(logMessage).toContain('Token not found');
          done();
        },
      });
    });

    it('should default to 500 status when error has no status', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext();
      const error = new Error('Unknown error');
      const callHandler = createErrorCallHandler(error);

      interceptor.intercept(context, callHandler).subscribe({
        error: () => {
          const logMessage = mockLoggerError.mock.calls[0][0];
          expect(logMessage).toContain('500');
          done();
        },
      });
    });

    it('should log error duration', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext();
      const error = new Error('Test error');
      const callHandler = createErrorCallHandler(error);

      interceptor.intercept(context, callHandler).subscribe({
        error: () => {
          const logMessage = mockLoggerError.mock.calls[0][0];
          expect(logMessage).toMatch(/\d+ms/);
          done();
        },
      });
    });

    it('should log error IP and user agent', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        ip: '10.0.0.1',
        userAgent: 'Test/1.0',
      });
      const error = new Error('Error');
      const callHandler = createErrorCallHandler(error);

      interceptor.intercept(context, callHandler).subscribe({
        error: () => {
          const logMessage = mockLoggerError.mock.calls[0][0];
          expect(logMessage).toContain('10.0.0.1');
          expect(logMessage).toContain('Test/1.0');
          done();
        },
      });
    });
  });

  describe('different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    methods.forEach((method) => {
      it(`should log ${method} requests`, (done) => {
        jest.useRealTimers();
        const context = createMockExecutionContext({ method });
        const callHandler = createMockCallHandler({});

        interceptor.intercept(context, callHandler).subscribe({
          next: () => {
            const logMessage = mockLoggerLog.mock.calls[0][0];
            expect(logMessage).toContain(method);
            done();
          },
        });
      });
    });
  });

  describe('different URLs', () => {
    it('should log query parameters in URL', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        url: '/api/tokens?page=1&limit=20',
      });
      const callHandler = createMockCallHandler({});

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          const logMessage = mockLoggerLog.mock.calls[0][0];
          expect(logMessage).toContain('/api/tokens?page=1&limit=20');
          done();
        },
      });
    });

    it('should log path parameters in URL', (done) => {
      jest.useRealTimers();
      const context = createMockExecutionContext({
        url: '/api/tokens/0x1234567890abcdef',
      });
      const callHandler = createMockCallHandler({});

      interceptor.intercept(context, callHandler).subscribe({
        next: () => {
          const logMessage = mockLoggerLog.mock.calls[0][0];
          expect(logMessage).toContain('/api/tokens/0x1234567890abcdef');
          done();
        },
      });
    });
  });
});
