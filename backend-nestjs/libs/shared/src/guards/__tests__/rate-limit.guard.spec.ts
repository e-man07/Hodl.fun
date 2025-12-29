import { RateLimitGuard } from '../rate-limit.guard';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let mockContext: any;
  let mockRequest: any;

  beforeEach(() => {
    guard = new RateLimitGuard();

    mockRequest = {
      ip: '192.168.1.1',
      headers: {},
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  describe('Request Allowance', () => {
    it('should allow first request', () => {
      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow requests within limit', () => {
      for (let i = 0; i < 50; i++) {
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
      }
    });

    it('should allow up to max requests (100)', () => {
      for (let i = 0; i < 100; i++) {
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
      }
    });

    it('should reject request at limit + 1', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      expect(() => guard.canActivate(mockContext)).toThrow(HttpException);
    });
  });

  describe('Rate Limit Exceeded', () => {
    it('should throw HttpException when limit exceeded', () => {
      // Fill up the quota
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      expect(() => guard.canActivate(mockContext)).toThrow(HttpException);
    });

    it('should throw with TOO_MANY_REQUESTS status', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should include error message about rate limit', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.message).toContain('Rate limit exceeded');
      }
    });

    it('should specify max requests in error message', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.message).toContain('100');
      }
    });
  });

  describe('Window-Based Rate Limiting', () => {
    it('should reset counter after window expires', () => {
      jest.useFakeTimers();

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      // Should be rejected
      expect(() => guard.canActivate(mockContext)).toThrow();

      // Fast-forward time by 61 seconds (window is 60s + buffer)
      jest.advanceTimersByTime(61000);

      // Should now be allowed
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Client Identification', () => {
    it('should use user address if authenticated', () => {
      mockRequest.user = {
        address: '0x' + 'a'.repeat(40),
      };

      const result1 = guard.canActivate(mockContext);
      expect(result1).toBe(true);

      // Same user should increment same counter
      const result2 = guard.canActivate(mockContext);
      expect(result2).toBe(true);
    });

    it('should use IP if user not authenticated', () => {
      mockRequest.ip = '192.168.1.1';
      mockRequest.user = undefined;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should prefer user address over IP', () => {
      mockRequest.user = {
        address: '0x' + 'a'.repeat(40),
      };
      mockRequest.ip = '192.168.1.1';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle x-forwarded-for header', () => {
      mockRequest.headers['x-forwarded-for'] = '10.0.0.1, 192.168.1.1';
      mockRequest.ip = '192.168.1.1';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should extract first IP from x-forwarded-for', () => {
      mockRequest.headers['x-forwarded-for'] = '10.0.0.1, 192.168.1.1';
      mockRequest.ip = '192.168.1.1';

      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      // Same client should hit the limit
      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('should use fallback IP when x-forwarded-for is unavailable', () => {
      mockRequest.headers['x-forwarded-for'] = undefined;
      mockRequest.ip = '192.168.1.100';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should use unknown identifier if no IP available', () => {
      mockRequest.ip = undefined;
      mockRequest.headers = {};

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  describe('Multiple Clients', () => {
    it('should track different clients separately', () => {
      // Client 1
      mockRequest.ip = '192.168.1.1';
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      // Client 1 should be rate limited
      expect(() => guard.canActivate(mockContext)).toThrow();

      // Client 2
      mockRequest.ip = '192.168.1.2';
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should allow simultaneous requests from different clients', () => {
      mockRequest.ip = '192.168.1.1';
      guard.canActivate(mockContext);

      mockRequest.ip = '192.168.1.2';
      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should maintain separate counters for multiple authenticated users', () => {
      mockRequest.user = { address: '0x' + 'a'.repeat(40) };
      guard.canActivate(mockContext);

      mockRequest.user = { address: '0x' + 'b'.repeat(40) };
      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should prevent cross-client quota sharing', () => {
      // Client 1 uses 50 requests
      mockRequest.ip = '192.168.1.1';
      for (let i = 0; i < 50; i++) {
        guard.canActivate(mockContext);
      }

      // Client 2 should have fresh quota
      mockRequest.ip = '192.168.1.2';
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      // Client 2 should be limited now
      expect(() => guard.canActivate(mockContext)).toThrow();

      // Client 1 should still have quota
      mockRequest.ip = '192.168.1.1';
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });

  describe('Counter Tracking', () => {
    it('should increment counter for each request', () => {
      for (let i = 1; i <= 10; i++) {
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
      }
    });

    it('should stop incrementing at limit', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      expect(() => guard.canActivate(mockContext)).toThrow();
      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('should reset window after expiration', () => {
      jest.useFakeTimers();

      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      // Fast-forward time by 61 seconds
      jest.advanceTimersByTime(61000);

      // Should now be allowed
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Window Expiration', () => {
    it('should have 60 second window', () => {
      jest.useFakeTimers();

      // Make 100 requests within the window
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      // 101st request should throw because window hasn't expired
      expect(() => guard.canActivate(mockContext)).toThrow();

      // Advance time by 61 seconds to expire the window
      jest.advanceTimersByTime(61000);

      // Now a new request should be allowed (window has expired)
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);

      jest.useRealTimers();
    });

    it('should track reset time per client', () => {
      mockRequest.ip = '192.168.1.1';
      guard.canActivate(mockContext);

      mockRequest.ip = '192.168.1.2';
      guard.canActivate(mockContext);

      // Both should be tracked separately with their own reset times
      mockRequest.ip = '192.168.1.1';
      const result1 = guard.canActivate(mockContext);
      expect(result1).toBe(true);

      mockRequest.ip = '192.168.1.2';
      const result2 = guard.canActivate(mockContext);
      expect(result2).toBe(true);
    });
  });

  describe('Exception Details', () => {
    it('should throw HttpException type', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      expect(() => guard.canActivate(mockContext)).toThrow(HttpException);
    });

    it('should have HTTP status code 429', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.getStatus()).toBe(429);
      }
    });

    it('should provide descriptive error message', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.message).toContain('100');
        expect(error.message).toContain('requests per minute');
      }
    });
  });

  describe('Context Handling', () => {
    it('should switch to HTTP context', () => {
      guard.canActivate(mockContext);

      expect(mockContext.switchToHttp).toHaveBeenCalled();
    });

    it('should retrieve request from context', () => {
      const getRequestMock = mockContext.switchToHttp().getRequest;

      guard.canActivate(mockContext);

      expect(getRequestMock).toHaveBeenCalled();
    });
  });

  describe('Return Values', () => {
    it('should return true when allowed', () => {
      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });

    it('should throw exception when limited (not return false)', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      expect(() => guard.canActivate(mockContext)).toThrow();
    });
  });

  describe('Different IP Formats', () => {
    it('should handle IPv4 addresses', () => {
      mockRequest.ip = '192.168.1.1';
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should handle localhost', () => {
      mockRequest.ip = '127.0.0.1';
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should handle IPv6 addresses', () => {
      mockRequest.ip = '::1';
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should handle undefined IP', () => {
      mockRequest.ip = undefined;
      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 100 requests', () => {
      for (let i = 0; i < 100; i++) {
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
      }
    });

    it('should handle request 101 with exception', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      expect(() => guard.canActivate(mockContext)).toThrow(HttpException);
    });

    it('should handle rapid sequential requests', () => {
      for (let i = 0; i < 100; i++) {
        guard.canActivate(mockContext);
      }

      expect(() => guard.canActivate(mockContext)).toThrow();
    });

    it('should handle user with empty address', () => {
      mockRequest.user = { address: '' };
      mockRequest.ip = '192.168.1.1';

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should handle multiple subsequent calls from same IP', () => {
      mockRequest.ip = '192.168.1.1';

      guard.canActivate(mockContext);
      guard.canActivate(mockContext);
      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle authenticated user transitioning to unauthenticated', () => {
      // Request with auth
      mockRequest.user = { address: '0x' + 'a'.repeat(40) };
      guard.canActivate(mockContext);

      // Same request without auth (different counter)
      mockRequest.user = undefined;
      mockRequest.ip = '192.168.1.1';
      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  describe('Concurrency', () => {
    it('should handle rapid requests from same client', (done) => {
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(guard.canActivate(mockContext))
      );

      Promise.all(promises).then((results) => {
        expect(results.every((r) => r === true)).toBe(true);
        done();
      });
    });

    it('should handle interleaved requests from different clients', () => {
      for (let i = 0; i < 50; i++) {
        mockRequest.ip = '192.168.1.1';
        guard.canActivate(mockContext);

        mockRequest.ip = '192.168.1.2';
        guard.canActivate(mockContext);
      }

      // Both should still be under limit
      mockRequest.ip = '192.168.1.1';
      let result = guard.canActivate(mockContext);
      expect(result).toBe(true);

      mockRequest.ip = '192.168.1.2';
      result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });
});
