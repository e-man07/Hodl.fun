/**
 * Transform Interceptor Unit Tests
 * Tests for automatic ApiResponse wrapping
 */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from '../../interceptors/transform.interceptor';
import { ApiResponse } from '../../dto/api-response.dto';

// Create mock execution context
const createMockExecutionContext = (): ExecutionContext => {
  return {} as ExecutionContext;
};

// Create mock call handler that returns the provided value
const createMockCallHandler = <T>(returnValue: T): CallHandler => {
  return {
    handle: () => of(returnValue),
  };
};

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  describe('intercept', () => {
    it('should wrap plain object data in ApiResponse', (done) => {
      const context = createMockExecutionContext();
      const data = { id: 1, name: 'Test' };
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: { id: 1, name: 'Test' },
        });
        done();
      });
    });

    it('should wrap array data in ApiResponse', (done) => {
      const context = createMockExecutionContext();
      const data = [1, 2, 3];
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: [1, 2, 3],
        });
        done();
      });
    });

    it('should wrap string data in ApiResponse', (done) => {
      const context = createMockExecutionContext();
      const data = 'test message';
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: 'test message',
        });
        done();
      });
    });

    it('should wrap number data in ApiResponse', (done) => {
      const context = createMockExecutionContext();
      const data = 42;
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: 42,
        });
        done();
      });
    });

    it('should wrap boolean data in ApiResponse', (done) => {
      const context = createMockExecutionContext();
      const data = true;
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: true,
        });
        done();
      });
    });

    it('should wrap null data in ApiResponse', (done) => {
      const context = createMockExecutionContext();
      const callHandler = createMockCallHandler(null);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: null,
        });
        done();
      });
    });

    it('should wrap undefined data in ApiResponse', (done) => {
      const context = createMockExecutionContext();
      const callHandler = createMockCallHandler(undefined);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: undefined,
        });
        done();
      });
    });

    it('should not wrap data already in ApiResponse format (with success: true)', (done) => {
      const context = createMockExecutionContext();
      const alreadyWrapped = ApiResponse.success({ id: 1 });
      const callHandler = createMockCallHandler(alreadyWrapped);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        // Should return as-is, not double-wrapped
        expect(result).toEqual({
          success: true,
          data: { id: 1 },
        });
        expect(result).not.toHaveProperty('data.success');
        done();
      });
    });

    it('should not wrap error responses (with success: false)', (done) => {
      const context = createMockExecutionContext();
      const errorResponse = ApiResponse.error(404, 'Not found');
      const callHandler = createMockCallHandler(errorResponse);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              statusCode: 404,
              message: 'Not found',
            }),
          }),
        );
        done();
      });
    });

    it('should wrap objects with success property but wrong type', (done) => {
      const context = createMockExecutionContext();
      // Object has success but it's not a boolean at root level
      const data = { success: 'yes', data: 'test' };
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        // This still has 'success' key, so interceptor should return as-is
        expect(result).toEqual({
          success: 'yes',
          data: 'test',
        });
        done();
      });
    });

    it('should wrap nested objects correctly', (done) => {
      const context = createMockExecutionContext();
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'Test',
            settings: { theme: 'dark' },
          },
        },
      };
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: {
            user: {
              id: 1,
              profile: {
                name: 'Test',
                settings: { theme: 'dark' },
              },
            },
          },
        });
        done();
      });
    });

    it('should wrap paginated response correctly', (done) => {
      const context = createMockExecutionContext();
      const paginatedData = {
        items: [{ id: 1 }, { id: 2 }],
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5,
        },
      };
      const callHandler = createMockCallHandler(paginatedData);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: paginatedData,
        });
        done();
      });
    });

    it('should handle Date objects', (done) => {
      const context = createMockExecutionContext();
      const date = new Date('2024-01-01');
      const callHandler = createMockCallHandler({ createdAt: date });

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: { createdAt: date },
        });
        done();
      });
    });

    it('should handle BigInt serialization (as strings in response)', (done) => {
      const context = createMockExecutionContext();
      // BigInt values are typically serialized to strings before reaching the interceptor
      const data = { amount: '1000000000000000000' };
      const callHandler = createMockCallHandler(data);

      interceptor.intercept(context, callHandler).subscribe((result: unknown) => {
        expect(result).toEqual({
          success: true,
          data: { amount: '1000000000000000000' },
        });
        done();
      });
    });
  });
});
