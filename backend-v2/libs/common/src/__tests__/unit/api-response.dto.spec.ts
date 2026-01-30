/**
 * API Response DTO Unit Tests
 * Tests for standardized API response formatting
 */
import { ApiResponse } from '../../dto/api-response.dto';

describe('ApiResponse', () => {
  describe('success', () => {
    it('should create a success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = ApiResponse.success(data);

      expect(response).toEqual({
        success: true,
        data: { id: 1, name: 'Test' },
      });
    });

    it('should create a success response with array data', () => {
      const data = [1, 2, 3];
      const response = ApiResponse.success(data);

      expect(response).toEqual({
        success: true,
        data: [1, 2, 3],
      });
    });

    it('should create a success response with null data', () => {
      const response = ApiResponse.success(null);

      expect(response).toEqual({
        success: true,
        data: null,
      });
    });

    it('should create a success response with undefined data', () => {
      const response = ApiResponse.success(undefined);

      expect(response).toEqual({
        success: true,
        data: undefined,
      });
    });

    it('should create a success response with string data', () => {
      const response = ApiResponse.success('test message');

      expect(response).toEqual({
        success: true,
        data: 'test message',
      });
    });

    it('should create a success response with nested objects', () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'Test',
            settings: { theme: 'dark' },
          },
        },
      };
      const response = ApiResponse.success(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });

    it('should not have error property on success', () => {
      const response = ApiResponse.success({ test: true });

      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });
  });

  describe('error', () => {
    it('should create an error response with string message', () => {
      const response = ApiResponse.error(400, 'Bad request');

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.statusCode).toBe(400);
      expect(response.error?.message).toBe('Bad request');
      expect(response.error?.timestamp).toBeDefined();
    });

    it('should create an error response with array message', () => {
      const messages = ['Field is required', 'Invalid format'];
      const response = ApiResponse.error(422, messages);

      expect(response.success).toBe(false);
      expect(response.error?.message).toEqual(['Field is required', 'Invalid format']);
    });

    it('should include path when provided', () => {
      const response = ApiResponse.error(404, 'Not found', '/api/tokens/0x123');

      expect(response.error?.path).toBe('/api/tokens/0x123');
    });

    it('should not include path when not provided', () => {
      const response = ApiResponse.error(500, 'Internal error');

      expect(response.error?.path).toBeUndefined();
    });

    it('should include valid timestamp', () => {
      const before = new Date().toISOString();
      const response = ApiResponse.error(500, 'Error');
      const after = new Date().toISOString();

      const timestamp = response.error?.timestamp;
      expect(timestamp).toBeDefined();
      expect(timestamp! >= before).toBe(true);
      expect(timestamp! <= after).toBe(true);
    });

    it('should not have data property on error', () => {
      const response = ApiResponse.error(500, 'Error');

      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
    });

    it('should handle 400 Bad Request', () => {
      const response = ApiResponse.error(400, 'Invalid input', '/api/tokens');

      expect(response.error?.statusCode).toBe(400);
    });

    it('should handle 401 Unauthorized', () => {
      const response = ApiResponse.error(401, 'Unauthorized');

      expect(response.error?.statusCode).toBe(401);
    });

    it('should handle 403 Forbidden', () => {
      const response = ApiResponse.error(403, 'Forbidden');

      expect(response.error?.statusCode).toBe(403);
    });

    it('should handle 404 Not Found', () => {
      const response = ApiResponse.error(404, 'Token not found');

      expect(response.error?.statusCode).toBe(404);
    });

    it('should handle 429 Too Many Requests', () => {
      const response = ApiResponse.error(429, 'Rate limit exceeded');

      expect(response.error?.statusCode).toBe(429);
    });

    it('should handle 500 Internal Server Error', () => {
      const response = ApiResponse.error(500, 'Internal server error');

      expect(response.error?.statusCode).toBe(500);
    });
  });

  describe('type safety', () => {
    it('should correctly type the response data', () => {
      interface User {
        id: number;
        name: string;
      }

      const user: User = { id: 1, name: 'Test' };
      const response = ApiResponse.success<User>(user);

      // TypeScript should infer response.data as User
      expect(response.data?.id).toBe(1);
      expect(response.data?.name).toBe('Test');
    });

    it('should correctly type array responses', () => {
      const items = [1, 2, 3];
      const response = ApiResponse.success<number[]>(items);

      expect(response.data?.length).toBe(3);
    });
  });
});
