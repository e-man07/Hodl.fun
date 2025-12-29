import { HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    process.env.NODE_ENV = 'production';

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'GET',
      url: '/api/tokens',
      headers: {},
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  describe('Exception Catching', () => {
    it('should catch all exceptions', () => {
      const exception = new Error('Some error');

      expect(() => filter.catch(exception, mockHost)).not.toThrow();
    });

    it('should handle Error instances', () => {
      const exception = new Error('Test error message');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', () => {
      const exception = 'String error';
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle null exceptions', () => {
      filter.catch(null, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Internal server error',
        }),
      );
    });

    it('should handle undefined exceptions', () => {
      filter.catch(undefined, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Response Formatting', () => {
    it('should return success=false', () => {
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it('should return 500 status code', () => {
      const exception = new Error('Any error');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        }),
      );
    });

    it('should include timestamp', () => {
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });

    it('should include request path', () => {
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/tokens',
        }),
      );
    });

    it('should include error message', () => {
      const errorMessage = 'Database connection failed';
      const exception = new Error(errorMessage);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: errorMessage,
        }),
      );
    });
  });

  describe('Error Messages', () => {
    it('should extract message from Error instances', () => {
      const exception = new Error('Connection timeout');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Connection timeout',
        }),
      );
    });

    it('should use default message for non-Error exceptions', () => {
      filter.catch('String error', mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Internal server error',
        }),
      );
    });

    it('should handle errors with empty message', () => {
      const exception = new Error('');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
        }),
      );
    });

    it('should handle errors with special characters', () => {
      const exception = new Error('Invalid token: @#$%^&*()');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token: @#$%^&*()',
        }),
      );
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(1000);
      const exception = new Error(longMessage);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: longMessage,
        }),
      );
    });
  });

  describe('Development Environment Stack Trace', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should include stack trace in development', () => {
      const exception = new Error('Development error');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Error: Development error'),
        }),
      );
    });

    it('should include full stack trace from Error', () => {
      const exception = new Error('Stack trace test');
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.error).toContain('at');
    });

    it('should not include stack trace for non-Error exceptions in development', () => {
      filter.catch('String error', mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.error).toBe('String error');
    });
  });

  describe('Production Environment Stack Trace', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should not include stack trace in production', () => {
      const exception = new Error('Production error');
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.error).toBeUndefined();
    });

    it('should not include error field in production response', () => {
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('error');
    });

    it('should contain only safe fields in production', () => {
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      const keys = Object.keys(callArg);
      expect(keys).toContain('success');
      expect(keys).toContain('statusCode');
      expect(keys).toContain('timestamp');
      expect(keys).toContain('path');
      expect(keys).toContain('message');
      expect(keys).not.toContain('error');
    });
  });

  describe('Request Path Handling', () => {
    it('should handle various request paths', () => {
      const paths = [
        '/api/tokens',
        '/api/tokens/0xabc123',
        '/api/users/profile',
        '/api/trades/buy',
        '/health',
      ];

      paths.forEach((path) => {
        mockRequest.url = path;
        const exception = new Error('Error');
        mockResponse.json.mockClear();

        filter.catch(exception, mockHost);

        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            path,
          }),
        );
      });
    });

    it('should handle paths with query strings', () => {
      mockRequest.url = '/api/tokens?limit=10&offset=0';
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/tokens?limit=10&offset=0',
        }),
      );
    });
  });

  describe('Timestamp Handling', () => {
    it('should generate ISO timestamp', () => {
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      const timestamp = new Date(callArg.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
    });

    it('should format timestamp correctly', () => {
      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Multiple Exception Types', () => {
    it('should handle TypeError', () => {
      const exception = new TypeError('Cannot read property of undefined');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cannot read property of undefined',
        }),
      );
    });

    it('should handle ReferenceError', () => {
      const exception = new ReferenceError('Variable is not defined');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle SyntaxError', () => {
      const exception = new SyntaxError('Unexpected token');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle RangeError', () => {
      const exception = new RangeError('Value out of range');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Response Method Chaining', () => {
    it('should call status before json', () => {
      const callOrder: string[] = [];
      mockResponse.status.mockImplementation(() => {
        callOrder.push('status');
        return mockResponse;
      });
      mockResponse.json.mockImplementation(() => {
        callOrder.push('json');
      });

      const exception = new Error('Error');
      filter.catch(exception, mockHost);

      expect(callOrder).toEqual(['status', 'json']);
    });
  });

  describe('Consistent Response Structure', () => {
    it('should have consistent response structure across exception types', () => {
      const exceptions = [
        new Error('Error 1'),
        new TypeError('Error 2'),
        'String error',
        null,
      ];

      exceptions.forEach((exception) => {
        mockResponse.json.mockClear();
        filter.catch(exception, mockHost);

        const callArg = mockResponse.json.mock.calls[0][0];
        expect(callArg).toHaveProperty('success');
        expect(callArg).toHaveProperty('statusCode');
        expect(callArg).toHaveProperty('timestamp');
        expect(callArg).toHaveProperty('path');
        expect(callArg).toHaveProperty('message');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle exception with circular reference', () => {
      const exception: any = { message: 'Error' };
      exception.self = exception;

      expect(() => filter.catch(exception, mockHost)).not.toThrow();
    });

    it('should handle exception with very long stack trace', () => {
      process.env.NODE_ENV = 'development';

      let error = new Error('Base error');
      try {
        throw error;
      } catch (e) {
        // Stack trace is generated
        error = e as Error;
      }

      filter.catch(error, mockHost);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle concurrent exception handling', async () => {
      const exceptions = Array.from({ length: 10 }, (_, i) => new Error(`Error ${i}`));

      const promises = exceptions.map((exception) => {
        mockResponse.json.mockClear();
        return Promise.resolve(filter.catch(exception, mockHost));
      });

      await Promise.all(promises);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });
});
