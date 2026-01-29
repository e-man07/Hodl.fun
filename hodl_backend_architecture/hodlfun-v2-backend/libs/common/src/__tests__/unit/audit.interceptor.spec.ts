import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import {
  AuditInterceptor,
  Audit,
  AUDIT_ACTION_KEY,
  AUDIT_ENTITY_TYPE_KEY,
  AuditService,
  AuditAction,
} from '../../audit';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: { logSafe: jest.Mock };
  let reflector: { get: jest.Mock };
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  const mockRequest = {
    ip: '192.168.1.1',
    method: 'POST',
    path: '/api/v1/auth/login',
    url: '/api/v1/auth/login',
    headers: {
      'user-agent': 'Mozilla/5.0 Test Browser',
    },
    user: {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    },
    params: {
      id: 'entity-123',
    },
    body: {
      name: 'Test',
    },
    query: {},
  };

  // Create a named function to use as handler mock
  function testHandler() {}

  beforeEach(() => {
    auditService = {
      logSafe: jest.fn().mockResolvedValue(undefined),
    };

    reflector = {
      get: jest.fn(),
    };

    // Create fresh mocks for each test
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn().mockReturnValue(testHandler),
      getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ success: true })),
    };

    interceptor = new AuditInterceptor(
      auditService as unknown as AuditService,
      reflector as unknown as Reflector,
    );
  });

  describe('intercept', () => {
    it('should not log when no audit action is defined', (done) => {
      reflector.get.mockReturnValue(undefined);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          expect(value).toEqual({ success: true });
          expect(auditService.logSafe).not.toHaveBeenCalled();
        },
        complete: () => done(),
      });
    });

    it('should log audit action on successful request', (done) => {
      reflector.get.mockImplementation((key: unknown) => {
        if (key === AUDIT_ACTION_KEY) return AuditAction.AUTH_LOGIN;
        if (key === AUDIT_ENTITY_TYPE_KEY) return undefined;
        return undefined;
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {},
        complete: () => {
          expect(auditService.logSafe).toHaveBeenCalledWith({
            walletAddress: mockRequest.user.walletAddress,
            action: AuditAction.AUTH_LOGIN,
            entityType: undefined,
            entityId: 'entity-123',
            ipAddress: mockRequest.ip,
            userAgent: mockRequest.headers['user-agent'],
            details: expect.objectContaining({
              method: 'POST',
              path: '/api/v1/auth/login',
              controller: 'TestController',
            }),
          });
          done();
        },
      });
    });

    it('should include entity info from params', (done) => {
      reflector.get.mockReturnValue(AuditAction.TOKEN_CREATE);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(auditService.logSafe).toHaveBeenCalledWith(
            expect.objectContaining({
              entityId: 'entity-123',
            }),
          );
          done();
        },
      });
    });

    it('should not log on request failure', (done) => {
      reflector.get.mockReturnValue(AuditAction.AUTH_LOGIN);
      const errorHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => new Error('Request failed'))),
      };

      interceptor.intercept(mockExecutionContext, errorHandler).subscribe({
        error: () => {
          expect(auditService.logSafe).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should handle missing user gracefully', (done) => {
      reflector.get.mockReturnValue(AuditAction.AUTH_LOGIN);
      const noUserContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            ...mockRequest,
            user: undefined,
          }),
        }),
        getHandler: jest.fn().mockReturnValue(testHandler),
        getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
      } as unknown as ExecutionContext;

      interceptor.intercept(noUserContext, mockCallHandler).subscribe({
        complete: () => {
          expect(auditService.logSafe).toHaveBeenCalledWith(
            expect.objectContaining({
              walletAddress: undefined,
            }),
          );
          done();
        },
      });
    });

    it('should extract entity type from metadata', (done) => {
      reflector.get.mockImplementation((key: unknown) => {
        if (key === AUDIT_ACTION_KEY) return AuditAction.TOKEN_CREATE;
        if (key === AUDIT_ENTITY_TYPE_KEY) return 'token';
        return undefined;
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(auditService.logSafe).toHaveBeenCalledWith(
            expect.objectContaining({
              entityType: 'token',
            }),
          );
          done();
        },
      });
    });

    it('should include body keys in details', (done) => {
      reflector.get.mockReturnValue(AuditAction.AUTH_LOGIN);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(auditService.logSafe).toHaveBeenCalledWith(
            expect.objectContaining({
              details: expect.objectContaining({
                bodyKeys: ['name'],
              }),
            }),
          );
          done();
        },
      });
    });
  });
});

describe('Audit decorator', () => {
  it('should work as method decorator', () => {
    class TestController {
      @Audit(AuditAction.TOKEN_CREATE)
      createToken() {}
    }

    const instance = new TestController();
    const metadata = Reflect.getMetadata(AUDIT_ACTION_KEY, instance.createToken);
    expect(metadata).toBe(AuditAction.TOKEN_CREATE);
  });

  it('should support entity type option', () => {
    class TestController {
      @Audit(AuditAction.TOKEN_CREATE, { entityType: 'token' })
      createToken() {}
    }

    const instance = new TestController();
    const actionMetadata = Reflect.getMetadata(AUDIT_ACTION_KEY, instance.createToken);
    const entityTypeMetadata = Reflect.getMetadata(AUDIT_ENTITY_TYPE_KEY, instance.createToken);

    expect(actionMetadata).toBe(AuditAction.TOKEN_CREATE);
    expect(entityTypeMetadata).toBe('token');
  });
});
