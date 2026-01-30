/**
 * Rate Limit Guard Unit Tests
 * Tests for rate limiting functionality
 */
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RateLimitConfig } from '../../guards/rate-limit.guard';
import { RATE_LIMIT_KEY } from '../../decorators/rate-limit.decorator';

// Mock RedisService
const createMockRedisService = () => ({
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
});

// Mock Reflector
const createMockReflector = () => ({
  get: jest.fn(),
});

// Create mock execution context
const createMockExecutionContext = (options: {
  ip?: string;
  cfConnectingIp?: string;
  xForwardedFor?: string;
  userWalletAddress?: string;
  routePath?: string;
  url?: string;
} = {}): ExecutionContext => {
  const headers: Record<string, string | undefined> = {
    'cf-connecting-ip': options.cfConnectingIp,
    'x-forwarded-for': options.xForwardedFor,
  };

  const mockRequest = {
    ip: options.ip || '127.0.0.1',
    url: options.url || '/api/tokens',
    route: { path: options.routePath || '/api/tokens' },
    headers,
    user: options.userWalletAddress ? { walletAddress: options.userWalletAddress } : undefined,
    get: jest.fn((header: string): string | undefined => headers[header.toLowerCase()]),
  };

  const mockResponse = {
    setHeader: jest.fn(),
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let mockRedis: ReturnType<typeof createMockRedisService>;
  let mockReflector: ReturnType<typeof createMockReflector>;

  beforeEach(() => {
    mockRedis = createMockRedisService();
    mockReflector = createMockReflector();
    guard = new RateLimitGuard(mockRedis as any, mockReflector as unknown as Reflector);
  });

  describe('canActivate', () => {
    it('should allow request when no rate limit is configured', async () => {
      mockReflector.get.mockReturnValue(undefined);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should allow request when under rate limit', async () => {
      const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
      mockReflector.get.mockReturnValue(rateLimit);
      mockRedis.incr.mockResolvedValue(5); // 5th request
      mockRedis.ttl.mockResolvedValue(30);

      const context = createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should set expire on first request', async () => {
      const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
      mockReflector.get.mockReturnValue(rateLimit);
      mockRedis.incr.mockResolvedValue(1); // First request
      mockRedis.ttl.mockResolvedValue(60);

      const context = createMockExecutionContext();
      await guard.canActivate(context);

      expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 60);
    });

    it('should not set expire on subsequent requests', async () => {
      const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
      mockReflector.get.mockReturnValue(rateLimit);
      mockRedis.incr.mockResolvedValue(5); // 5th request
      mockRedis.ttl.mockResolvedValue(30);

      const context = createMockExecutionContext();
      await guard.canActivate(context);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should throw 429 when rate limit exceeded', async () => {
      const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
      mockReflector.get.mockReturnValue(rateLimit);
      mockRedis.incr.mockResolvedValue(11); // Exceeded limit
      mockRedis.ttl.mockResolvedValue(30);

      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.TOO_MANY_REQUESTS,
        }),
      );
    });

    it('should set correct rate limit headers', async () => {
      const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
      mockReflector.get.mockReturnValue(rateLimit);
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.ttl.mockResolvedValue(30);

      const context = createMockExecutionContext();
      const response = context.switchToHttp().getResponse();

      await guard.canActivate(context);

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 5);
      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should set Retry-After header when rate limited', async () => {
      const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
      mockReflector.get.mockReturnValue(rateLimit);
      mockRedis.incr.mockResolvedValue(15);
      mockRedis.ttl.mockResolvedValue(30);

      const context = createMockExecutionContext();
      const response = context.switchToHttp().getResponse();

      try {
        await guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 30);
    });

    it('should show 0 remaining when at limit', async () => {
      const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
      mockReflector.get.mockReturnValue(rateLimit);
      mockRedis.incr.mockResolvedValue(15);
      mockRedis.ttl.mockResolvedValue(30);

      const context = createMockExecutionContext();
      const response = context.switchToHttp().getResponse();

      try {
        await guard.canActivate(context);
      } catch (e) {
        // Expected to throw
      }

      expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    });

    describe('client identification', () => {
      it('should use Cloudflare IP when available', async () => {
        const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
        mockReflector.get.mockReturnValue(rateLimit);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        const context = createMockExecutionContext({
          cfConnectingIp: '1.2.3.4',
          xForwardedFor: '5.6.7.8',
          ip: '127.0.0.1',
        });

        await guard.canActivate(context);

        expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('1.2.3.4'));
      });

      it('should use X-Forwarded-For when CF IP not available', async () => {
        const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
        mockReflector.get.mockReturnValue(rateLimit);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        const context = createMockExecutionContext({
          xForwardedFor: '5.6.7.8, 9.10.11.12',
          ip: '127.0.0.1',
        });

        await guard.canActivate(context);

        expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('5.6.7.8'));
      });

      it('should use request IP as fallback', async () => {
        const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
        mockReflector.get.mockReturnValue(rateLimit);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        const context = createMockExecutionContext({
          ip: '192.168.1.1',
        });

        await guard.canActivate(context);

        expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('192.168.1.1'));
      });

      it('should include user wallet address in key when authenticated', async () => {
        const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
        mockReflector.get.mockReturnValue(rateLimit);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        const context = createMockExecutionContext({
          userWalletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        });

        await guard.canActivate(context);

        expect(mockRedis.incr).toHaveBeenCalledWith(
          expect.stringContaining('0x1234567890abcdef1234567890abcdef12345678'),
        );
      });

      it('should use anonymous for unauthenticated users', async () => {
        const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
        mockReflector.get.mockReturnValue(rateLimit);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        const context = createMockExecutionContext();

        await guard.canActivate(context);

        expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringContaining('anonymous'));
      });
    });

    describe('key prefix', () => {
      it('should use default key prefix', async () => {
        const rateLimit: RateLimitConfig = { limit: 10, window: 60 };
        mockReflector.get.mockReturnValue(rateLimit);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        const context = createMockExecutionContext();
        await guard.canActivate(context);

        expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringMatching(/^rl:/));
      });

      it('should use custom key prefix when provided', async () => {
        const rateLimit: RateLimitConfig = { limit: 10, window: 60, keyPrefix: 'auth' };
        mockReflector.get.mockReturnValue(rateLimit);
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(60);

        const context = createMockExecutionContext();
        await guard.canActivate(context);

        expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringMatching(/^auth:/));
      });
    });

    describe('reflector priority', () => {
      it('should prefer method-level rate limit over class-level', async () => {
        const methodRateLimit: RateLimitConfig = { limit: 5, window: 30 };

        // Reflector returns method-level limit on first call (handler)
        // Since the guard does `reflector.get(KEY, handler) || reflector.get(KEY, classRef)`,
        // returning a truthy value on first call means it won't check class-level
        mockReflector.get.mockReturnValue(methodRateLimit);

        mockRedis.incr.mockResolvedValue(1);
        mockRedis.ttl.mockResolvedValue(30);

        const context = createMockExecutionContext();
        const response = context.switchToHttp().getResponse();

        await guard.canActivate(context);

        // Should use method-level limit (5)
        expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      });
    });
  });
});
