import { JwtGuard } from '../jwt.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtGuard', () => {
  let guard: JwtGuard;
  let mockContext: any;
  let mockRequest: any;

  beforeEach(() => {
    guard = new JwtGuard();

    mockRequest = {
      headers: {
        authorization: 'Bearer valid.jwt.token',
      },
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    };
  });

  describe('Authorization Header Validation', () => {
    it('should accept valid Bearer token', () => {
      mockRequest.headers.authorization = 'Bearer 0x' + 'a'.repeat(40);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should throw when authorization header is missing', () => {
      mockRequest.headers.authorization = undefined;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Missing authorization header');
    });

    it('should throw when authorization header is empty', () => {
      mockRequest.headers.authorization = '';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should throw when authorization header is null', () => {
      mockRequest.headers.authorization = null;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
  });

  describe('Bearer Scheme Validation', () => {
    it('should accept Bearer scheme', () => {
      mockRequest.headers.authorization = 'Bearer token123';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should throw for wrong authentication scheme', () => {
      mockRequest.headers.authorization = 'Basic token123';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Invalid authentication scheme');
    });

    it('should throw for lowercase bearer scheme', () => {
      mockRequest.headers.authorization = 'bearer token123';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should throw for api-key scheme', () => {
      mockRequest.headers.authorization = 'ApiKey token123';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should throw for digest scheme', () => {
      mockRequest.headers.authorization = 'Digest username=test';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
  });

  describe('Token Validation', () => {
    it('should throw when token is missing after Bearer', () => {
      mockRequest.headers.authorization = 'Bearer ';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(mockContext)).toThrow('Missing token');
    });

    it('should throw when only scheme is provided', () => {
      mockRequest.headers.authorization = 'Bearer';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should accept valid JWT token format', () => {
      mockRequest.headers.authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should accept ethereum address as token', () => {
      mockRequest.headers.authorization = 'Bearer 0x' + 'a'.repeat(40);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should accept simple string tokens', () => {
      mockRequest.headers.authorization = 'Bearer mytoken123';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });

  describe('User Context Setting', () => {
    it('should set user object on request', () => {
      mockRequest.headers.authorization = 'Bearer 0x' + 'a'.repeat(40);

      guard.canActivate(mockContext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user.address).toBeDefined();
    });

    it('should extract address from token', () => {
      const token = '0x' + 'a'.repeat(40);
      mockRequest.headers.authorization = `Bearer ${token}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user.address).toBe(token.substring(0, 42));
    });

    it('should extract 42 characters from token', () => {
      const token = '0x' + 'abcdef' + 'x'.repeat(100);
      mockRequest.headers.authorization = `Bearer ${token}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user.address.length).toBe(42);
    });

    it('should handle short tokens', () => {
      mockRequest.headers.authorization = 'Bearer 0x123';

      guard.canActivate(mockContext);

      expect(mockRequest.user.address).toBe('0x123');
    });

    it('should handle tokens longer than 42 characters', () => {
      const token = '0x' + 'a'.repeat(100);
      mockRequest.headers.authorization = `Bearer ${token}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user.address).toBe(token.substring(0, 42));
    });
  });

  describe('Header Case Sensitivity', () => {
    it('should handle lowercase authorization header', () => {
      mockRequest.headers.authorization = 'Bearer token123';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle mixed case in headers object', () => {
      mockRequest.headers.Authorization = 'Bearer token123';
      mockRequest.headers.authorization = undefined;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
  });

  describe('Multiple Spaces in Header', () => {
    it('should handle single space separator', () => {
      mockRequest.headers.authorization = 'Bearer token123';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should throw for multiple spaces', () => {
      mockRequest.headers.authorization = 'Bearer  token123';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should throw for tab separator', () => {
      mockRequest.headers.authorization = 'Bearer\ttoken123';

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
  });

  describe('Exception Details', () => {
    it('should throw UnauthorizedException type', () => {
      mockRequest.headers.authorization = undefined;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should provide descriptive error messages', () => {
      mockRequest.headers.authorization = 'Basic token';

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.message).toContain('Invalid authentication scheme');
      }
    });

    it('should throw with specific message for missing header', () => {
      mockRequest.headers.authorization = undefined;

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.message).toContain('Missing authorization header');
      }
    });

    it('should throw with specific message for missing token', () => {
      mockRequest.headers.authorization = 'Bearer ';

      try {
        guard.canActivate(mockContext);
        fail('Should throw');
      } catch (error: any) {
        expect(error.message).toContain('Missing token');
      }
    });
  });

  describe('Address Extraction', () => {
    it('should extract ethereum address format', () => {
      const token = '0x' + 'a'.repeat(40);
      mockRequest.headers.authorization = `Bearer ${token}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user.address).toMatch(/^0x[a-f0-9]{40}$/);
    });

    it('should preserve token case in extracted address', () => {
      const token = '0x' + 'AbCdEf' + 'a'.repeat(34);
      mockRequest.headers.authorization = `Bearer ${token}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user.address).toBe(token.substring(0, 42));
    });

    it('should handle non-hex characters in token', () => {
      const token = 'mytoken_with_special_chars_12345678901';
      mockRequest.headers.authorization = `Bearer ${token}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user.address.length).toBe(42);
    });
  });

  describe('Return Value', () => {
    it('should return true on valid token', () => {
      mockRequest.headers.authorization = 'Bearer valid_token';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should always return true when no exception is thrown', () => {
      mockRequest.headers.authorization = 'Bearer ' + 'x'.repeat(100);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Context Handling', () => {
    it('should switch to HTTP context', () => {
      mockRequest.headers.authorization = 'Bearer token';

      guard.canActivate(mockContext);

      expect(mockContext.switchToHttp).toHaveBeenCalled();
    });

    it('should retrieve request from context', () => {
      mockRequest.headers.authorization = 'Bearer token';
      const getRequestMock = mockContext.switchToHttp().getRequest;

      guard.canActivate(mockContext);

      expect(getRequestMock).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should authenticate valid bearer token and attach user', () => {
      const userAddress = '0x' + 'a'.repeat(40);
      mockRequest.headers.authorization = `Bearer ${userAddress}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user.address).toBe(userAddress);
    });

    it('should allow subsequent access to user data', () => {
      mockRequest.headers.authorization = 'Bearer 0x' + 'b'.repeat(40);

      guard.canActivate(mockContext);

      expect(mockRequest.user.address).toBeDefined();
      expect(mockRequest.user.address.length).toBe(42);
    });

    it('should handle multiple guard invocations', () => {
      const addresses = [
        '0x' + 'a'.repeat(40),
        '0x' + 'b'.repeat(40),
        '0x' + 'c'.repeat(40),
      ];

      addresses.forEach((addr) => {
        mockRequest.headers.authorization = `Bearer ${addr}`;
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
        expect(mockRequest.user.address).toBe(addr);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long authorization header', () => {
      mockRequest.headers.authorization = 'Bearer ' + 'x'.repeat(10000);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle special characters in token', () => {
      mockRequest.headers.authorization = 'Bearer token_with-special.chars@123';

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle whitespace in extracted address', () => {
      const token = 'bearer token with spaces';
      mockRequest.headers.authorization = `Bearer ${token}`;

      guard.canActivate(mockContext);

      expect(mockRequest.user.address).toBeDefined();
    });

    it('should not modify request object for errors', () => {
      mockRequest.headers.authorization = 'Basic token';
      const originalRequest = { ...mockRequest };

      try {
        guard.canActivate(mockContext);
      } catch {
        // Expected
      }

      // Authorization should still be the same (guard shouldn't modify on error)
      expect(mockRequest.headers.authorization).toBe(originalRequest.headers.authorization);
    });
  });
});
