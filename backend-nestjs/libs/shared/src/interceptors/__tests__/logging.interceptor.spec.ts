import { LoggingInterceptor } from '../logging.interceptor';
import { Logger } from '@nestjs/common';
import { of } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockContext: any;
  let mockResponse: any;
  let mockRequest: any;
  let mockCallHandler: any;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();

    mockResponse = {
      statusCode: 200,
    };

    mockRequest = {
      method: 'GET',
      url: '/api/tokens',
      ip: '192.168.1.1',
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };

    mockCallHandler = {
      handle: jest.fn(),
    };

    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should log HTTP request information', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        expect(loggerSpy).toHaveBeenCalled();
        done();
      });
    });

    it('should log request method', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('GET');
        done();
      });
    });

    it('should log request URL', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/tokens');
        done();
      });
    });

    it('should log response status code', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('200');
        done();
      });
    });

    it('should log client IP address', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('192.168.1.1');
        done();
      });
    });
  });

  describe('Duration Tracking', () => {
    it('should measure request duration', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toMatch(/\d+ms/);
        done();
      });
    });

    it('should include duration in log message', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('ms');
        done();
      });
    });

    it('should log realistic duration', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      const startTime = Date.now();
      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const elapsed = Date.now() - startTime;
        const logCall = loggerSpy.mock.calls[0][0];

        // Extract duration from log message (format: "...duration ms...")
        const durationMatch = logCall.match(/(\d+)ms/);
        expect(durationMatch).toBeTruthy();

        const loggedDuration = parseInt(durationMatch![1]);
        expect(loggedDuration).toBeLessThanOrEqual(elapsed + 100); // Allow some overhead
        done();
      });
    });
  });

  describe('HTTP Methods', () => {
    it('should log GET requests', (done) => {
      mockRequest.method = 'GET';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('GET');
        done();
      });
    });

    it('should log POST requests', (done) => {
      mockRequest.method = 'POST';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('POST');
        done();
      });
    });

    it('should log PUT requests', (done) => {
      mockRequest.method = 'PUT';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('PUT');
        done();
      });
    });

    it('should log DELETE requests', (done) => {
      mockRequest.method = 'DELETE';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('DELETE');
        done();
      });
    });

    it('should log PATCH requests', (done) => {
      mockRequest.method = 'PATCH';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('PATCH');
        done();
      });
    });
  });

  describe('Status Codes', () => {
    it('should log 200 status code', (done) => {
      mockResponse.statusCode = 200;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('200');
        done();
      });
    });

    it('should log 201 status code', (done) => {
      mockResponse.statusCode = 201;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('201');
        done();
      });
    });

    it('should log 400 status code', (done) => {
      mockResponse.statusCode = 400;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('400');
        done();
      });
    });

    it('should log 404 status code', (done) => {
      mockResponse.statusCode = 404;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('404');
        done();
      });
    });

    it('should log 500 status code', (done) => {
      mockResponse.statusCode = 500;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('500');
        done();
      });
    });
  });

  describe('Request URLs', () => {
    it('should log simple API paths', (done) => {
      const urls = ['/api/tokens', '/api/users', '/health'];
      let completed = 0;

      urls.forEach((url) => {
        loggerSpy.mockClear();
        mockRequest.url = url;
        mockCallHandler.handle.mockReturnValue(of({}));

        interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
          const logCall = loggerSpy.mock.calls[0][0];
          expect(logCall).toContain(url);
          completed++;

          if (completed === urls.length) {
            done();
          }
        });
      });
    });

    it('should log paths with URL parameters', (done) => {
      mockRequest.url = '/api/tokens/0x123abc';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/tokens/0x123abc');
        done();
      });
    });

    it('should log paths with query parameters', (done) => {
      mockRequest.url = '/api/tokens?limit=10&offset=0';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/tokens?limit=10&offset=0');
        done();
      });
    });
  });

  describe('IP Address Handling', () => {
    it('should log IPv4 addresses', (done) => {
      mockRequest.ip = '192.168.1.100';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('192.168.1.100');
        done();
      });
    });

    it('should log localhost address', (done) => {
      mockRequest.ip = '127.0.0.1';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('127.0.0.1');
        done();
      });
    });

    it('should handle undefined IP address', (done) => {
      mockRequest.ip = undefined;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        expect(loggerSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Log Format', () => {
    it('should include all essential information in log message', (done) => {
      mockRequest.method = 'GET';
      mockRequest.url = '/api/tokens';
      mockResponse.statusCode = 200;
      mockRequest.ip = '192.168.1.1';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];

        expect(logCall).toContain('GET');
        expect(logCall).toContain('/api/tokens');
        expect(logCall).toContain('200');
        expect(logCall).toContain('192.168.1.1');
        expect(logCall).toMatch(/\d+ms/);
        done();
      });
    });

    it('should have consistent log format', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];

        // Expected format: "GET /api/tokens - 200 - Xms - IP: 192.168.1.1"
        expect(logCall).toMatch(/^[A-Z]+\s+\/\S+\s+-\s+\d+\s+-\s+\d+ms\s+-\s+IP:/);
        done();
      });
    });
  });

  describe('Response Status Capture Timing', () => {
    it('should log status after handler execution', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      let handlerExecuted = false;
      mockCallHandler.handle.mockImplementation(() => {
        handlerExecuted = true;
        return of({});
      });

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        expect(handlerExecuted).toBe(true);
        expect(loggerSpy).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Multiple Requests', () => {
    it('should log multiple sequential requests', (done) => {
      const requests = [
        { method: 'GET', url: '/api/tokens', statusCode: 200 },
        { method: 'POST', url: '/api/tokens', statusCode: 201 },
        { method: 'GET', url: '/api/tokens/123', statusCode: 200 },
      ];

      let completed = 0;

      requests.forEach((req) => {
        loggerSpy.mockClear();
        mockRequest.method = req.method;
        mockRequest.url = req.url;
        mockResponse.statusCode = req.statusCode;
        mockCallHandler.handle.mockReturnValue(of({}));

        interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
          const logCall = loggerSpy.mock.calls[0][0];
          expect(logCall).toContain(req.method);
          expect(logCall).toContain(req.url);
          expect(logCall).toContain(String(req.statusCode));

          completed++;
          if (completed === requests.length) {
            done();
          }
        });
      });
    });
  });

  describe('Observable Behavior', () => {
    it('should return an Observable', () => {
      mockCallHandler.handle.mockReturnValue(of({}));

      const result = interceptor.intercept(mockContext, mockCallHandler);

      expect(result).toBeDefined();
      expect(result.subscribe).toBeDefined();
    });

    it('should pass through response data', (done) => {
      const responseData = { id: '1', name: 'Token' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual(responseData);
        done();
      });
    });

    it('should log after response is received', (done) => {
      const responseData = { id: '1' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      let logCalled = false;
      loggerSpy.mockImplementation(() => {
        logCalled = true;
      });

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual(responseData);
        expect(logCalled).toBe(true);
        done();
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should not log on unhandled errors', (done) => {
      const error = new Error('Handler error');
      mockCallHandler.handle.mockReturnValue(
        of({}).pipe(() => {
          throw error;
        })
      );

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: () => {
          // Errors from the handler don't go through tap
          done();
        },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very fast requests', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('ms');
        done();
      });
    });

    it('should handle requests with special characters in URL', (done) => {
      mockRequest.url = '/api/search?q=token&filter=@active';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        const logCall = loggerSpy.mock.calls[0][0];
        expect(logCall).toContain('/api/search?q=token&filter=@active');
        done();
      });
    });

    it('should handle undefined status code', (done) => {
      mockResponse.statusCode = undefined;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        expect(loggerSpy).toHaveBeenCalled();
        done();
      });
    });
  });
});
