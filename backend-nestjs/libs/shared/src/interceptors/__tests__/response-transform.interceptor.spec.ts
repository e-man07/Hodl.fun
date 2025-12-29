import { ResponseTransformInterceptor } from '../response-transform.interceptor';
import { of, throwError } from 'rxjs';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor;
  let mockContext: any;
  let mockResponse: any;
  let mockRequest: any;
  let mockCallHandler: any;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();

    mockResponse = {
      statusCode: 200,
    };

    mockRequest = {
      url: '/api/tokens',
      method: 'GET',
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
  });

  describe('Response Transformation', () => {
    it('should wrap successful response in standard format', (done) => {
      const responseData = { id: '1', name: 'Test Token' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result).toEqual({
          success: true,
          statusCode: 200,
          timestamp: expect.any(String),
          path: '/api/tokens',
          data: responseData,
        });
        done();
      });
    });

    it('should include success=true', (done) => {
      mockCallHandler.handle.mockReturnValue(of({ id: '1' }));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.success).toBe(true);
        done();
      });
    });

    it('should include HTTP status code', (done) => {
      mockResponse.statusCode = 201;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.statusCode).toBe(201);
        done();
      });
    });

    it('should include request path', (done) => {
      mockRequest.url = '/api/users/profile';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.path).toBe('/api/users/profile');
        done();
      });
    });

    it('should include timestamp', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.timestamp).toBeDefined();
        expect(typeof result.timestamp).toBe('string');
        done();
      });
    });

    it('should include original data', (done) => {
      const data = { tokenAddress: '0x123', name: 'MyToken' };
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toEqual(data);
        done();
      });
    });
  });

  describe('Timestamp Handling', () => {
    it('should generate ISO format timestamp', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        done();
      });
    });

    it('should generate timestamp close to current time', (done) => {
      const beforeTime = new Date();
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        const afterTime = new Date();
        const resultTime = new Date(result.timestamp);

        expect(resultTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(resultTime.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 100);
        done();
      });
    });
  });

  describe('Status Codes', () => {
    it('should handle 200 status code', (done) => {
      mockResponse.statusCode = 200;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.statusCode).toBe(200);
        done();
      });
    });

    it('should handle 201 status code', (done) => {
      mockResponse.statusCode = 201;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.statusCode).toBe(201);
        done();
      });
    });

    it('should handle 204 status code', (done) => {
      mockResponse.statusCode = 204;
      mockCallHandler.handle.mockReturnValue(of(null));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.statusCode).toBe(204);
        done();
      });
    });

    it('should handle various 2xx status codes', (done) => {
      const statusCodes = [200, 201, 202, 203, 204, 205, 206];
      let completed = 0;

      statusCodes.forEach((code) => {
        mockResponse.statusCode = code;
        mockCallHandler.handle.mockReturnValue(of({}));

        interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
          expect(result.statusCode).toBe(code);
          completed++;

          if (completed === statusCodes.length) {
            done();
          }
        });
      });
    });
  });

  describe('Request Path Handling', () => {
    it('should handle simple paths', (done) => {
      const paths = ['/api/tokens', '/api/users', '/health'];

      let completed = 0;
      paths.forEach((path) => {
        mockRequest.url = path;
        mockCallHandler.handle.mockReturnValue(of({}));

        interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
          expect(result.path).toBe(path);
          completed++;

          if (completed === paths.length) {
            done();
          }
        });
      });
    });

    it('should handle paths with query parameters', (done) => {
      mockRequest.url = '/api/tokens?limit=10&offset=0';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.path).toBe('/api/tokens?limit=10&offset=0');
        done();
      });
    });

    it('should handle paths with URL parameters', (done) => {
      mockRequest.url = '/api/tokens/0x123abc';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.path).toBe('/api/tokens/0x123abc');
        done();
      });
    });
  });

  describe('Data Types', () => {
    it('should handle object responses', (done) => {
      const data = { id: '1', name: 'Token' };
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toEqual(data);
        done();
      });
    });

    it('should handle array responses', (done) => {
      const data = [{ id: '1' }, { id: '2' }];
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toEqual(data);
        done();
      });
    });

    it('should handle string responses', (done) => {
      const data = 'Success message';
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBe(data);
        done();
      });
    });

    it('should handle number responses', (done) => {
      const data = 42;
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBe(42);
        done();
      });
    });

    it('should handle null responses', (done) => {
      mockCallHandler.handle.mockReturnValue(of(null));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBeNull();
        done();
      });
    });

    it('should handle undefined responses', (done) => {
      mockCallHandler.handle.mockReturnValue(of(undefined));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBeUndefined();
        done();
      });
    });

    it('should handle boolean responses', (done) => {
      mockCallHandler.handle.mockReturnValue(of(true));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBe(true);
        done();
      });
    });
  });

  describe('Complex Data Structures', () => {
    it('should handle deeply nested objects', (done) => {
      const data = {
        user: {
          id: '1',
          profile: {
            name: 'John',
            addresses: {
              primary: '0x123',
              secondary: '0x456',
            },
          },
        },
      };
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toEqual(data);
        done();
      });
    });

    it('should handle large arrays', (done) => {
      const data = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toHaveLength(1000);
        done();
      });
    });

    it('should handle mixed data structures', (done) => {
      const data = {
        items: [1, 'two', { three: 3 }],
        metadata: { total: 3 },
        success: true,
      };
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toEqual(data);
        done();
      });
    });
  });

  describe('Response Transformation Consistency', () => {
    it('should always include all required fields', (done) => {
      mockCallHandler.handle.mockReturnValue(of({ id: '1' }));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('statusCode');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('path');
        expect(result).toHaveProperty('data');
        done();
      });
    });

    it('should not add extra fields', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        const keys = Object.keys(result);
        expect(keys).toEqual(['success', 'statusCode', 'timestamp', 'path', 'data']);
        done();
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

    it('should properly handle async responses', (done) => {
      mockCallHandler.handle.mockReturnValue(of({ id: '1' }).pipe());

      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
        expect(mockCallHandler.handle).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('Error Handling by Handler', () => {
    it('should not transform error responses', (done) => {
      const error = new Error('Handler error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          fail('Should not emit value on error');
        },
        error: (err) => {
          expect(err).toBe(error);
          done();
        },
      });
    });
  });

  describe('Multiple Requests', () => {
    it('should handle multiple sequential requests', (done) => {
      const responses = [{ id: '1' }, { id: '2' }, { id: '3' }];
      let completed = 0;

      responses.forEach((data) => {
        mockCallHandler.handle.mockReturnValue(of(data));

        interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
          expect(result.data).toEqual(data);
          completed++;

          if (completed === responses.length) {
            done();
          }
        });
      });
    });
  });

  describe('BigInt Handling', () => {
    it('should handle BigInt in response data', (done) => {
      const data = {
        amount: BigInt('1000000000000000000'),
        id: '1',
      };
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data.amount).toBe(BigInt('1000000000000000000'));
        done();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object response', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toEqual({});
        done();
      });
    });

    it('should handle empty array response', (done) => {
      mockCallHandler.handle.mockReturnValue(of([]));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toEqual([]);
        done();
      });
    });

    it('should handle response with special characters', (done) => {
      const data = { message: 'Error: @#$%^&*()' };
      mockCallHandler.handle.mockReturnValue(of(data));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data.message).toBe('Error: @#$%^&*()');
        done();
      });
    });

    it('should handle 0 as valid response data', (done) => {
      mockCallHandler.handle.mockReturnValue(of(0));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBe(0);
        done();
      });
    });

    it('should handle empty string as valid response data', (done) => {
      mockCallHandler.handle.mockReturnValue(of(''));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBe('');
        done();
      });
    });

    it('should handle false as valid response data', (done) => {
      mockCallHandler.handle.mockReturnValue(of(false));

      interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
        expect(result.data).toBe(false);
        done();
      });
    });
  });
});
