import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import {
  CorrelationInterceptor,
  CorrelationService,
  CORRELATION_ID_HEADER,
} from '../../interceptors/correlation.interceptor';

describe('CorrelationInterceptor', () => {
  let interceptor: CorrelationInterceptor;
  let correlationService: CorrelationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationInterceptor, CorrelationService],
    }).compile();

    interceptor = module.get<CorrelationInterceptor>(CorrelationInterceptor);
    correlationService = module.get<CorrelationService>(CorrelationService);
  });

  const createMockContext = (headers: Record<string, string> = {}): ExecutionContext => {
    const mockRequest = {
      headers,
    };
    const mockResponse = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getType: () => 'http',
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (): CallHandler => ({
    handle: () => of({ data: 'test' }),
  });

  describe('intercept', () => {
    it('should generate a new correlation ID if not provided', (done) => {
      const context = createMockContext();
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe(() => {
        const response = context.switchToHttp().getResponse();
        expect(response.setHeader).toHaveBeenCalledWith(
          CORRELATION_ID_HEADER,
          expect.any(String),
        );
        done();
      });
    });

    it('should use existing correlation ID from header', (done) => {
      const existingId = 'existing-correlation-id-12345';
      const context = createMockContext({
        [CORRELATION_ID_HEADER.toLowerCase()]: existingId,
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe(() => {
        const response = context.switchToHttp().getResponse();
        expect(response.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, existingId);
        done();
      });
    });

    it('should generate UUID-like correlation ID', (done) => {
      const context = createMockContext();
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe(() => {
        const response = context.switchToHttp().getResponse();
        const call = (response.setHeader as jest.Mock).mock.calls[0];
        const generatedId = call[1];
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        expect(generatedId).toMatch(/^[a-f0-9-]{36}$/);
        done();
      });
    });

    it('should pass through the response data', (done) => {
      const context = createMockContext();
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe((result) => {
        expect(result).toEqual({ data: 'test' });
        done();
      });
    });
  });
});

describe('CorrelationService', () => {
  let service: CorrelationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationService],
    }).compile();

    service = module.get<CorrelationService>(CorrelationService);
  });

  describe('generateId', () => {
    it('should generate a valid UUID', () => {
      const id = service.generateId();
      expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(service.generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('correlation ID storage', () => {
    it('should set and get correlation ID within context', () => {
      const testId = 'test-correlation-id';

      service.runWithCorrelationId(testId, () => {
        expect(service.getCorrelationId()).toBe(testId);
      });
    });

    it('should return undefined outside of context', () => {
      expect(service.getCorrelationId()).toBeUndefined();
    });

    it('should support nested contexts with different IDs', () => {
      const outerId = 'outer-id';
      const innerId = 'inner-id';

      service.runWithCorrelationId(outerId, () => {
        expect(service.getCorrelationId()).toBe(outerId);

        service.runWithCorrelationId(innerId, () => {
          expect(service.getCorrelationId()).toBe(innerId);
        });

        expect(service.getCorrelationId()).toBe(outerId);
      });
    });

    it('should work with async operations', async () => {
      const testId = 'async-test-id';

      await service.runWithCorrelationIdAsync(testId, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(service.getCorrelationId()).toBe(testId);
      });
    });
  });

  describe('formatLogMessage', () => {
    it('should include correlation ID in log message', () => {
      const testId = 'log-test-id';
      const message = 'Test log message';

      service.runWithCorrelationId(testId, () => {
        const formatted = service.formatLogMessage(message);
        expect(formatted).toContain(testId);
        expect(formatted).toContain(message);
      });
    });

    it('should format message without correlation ID when not in context', () => {
      const message = 'Test log message';
      const formatted = service.formatLogMessage(message);
      expect(formatted).toContain(message);
      expect(formatted).not.toContain('[correlation_id=');
    });
  });
});
