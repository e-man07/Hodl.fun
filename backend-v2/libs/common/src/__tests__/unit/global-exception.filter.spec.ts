/**
 * Global Exception Filter Unit Tests
 * Tests for global exception handling and error response formatting
 */
import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../filters/global-exception.filter';
import { ApiResponse } from '../../dto/api-response.dto';

// Mock Logger - store the spy reference
const mockLoggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

// Create mock ArgumentsHost
const createMockArgumentsHost = (url = '/api/tokens'): ArgumentsHost => {
  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const mockRequest = {
    url,
  };

  return {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } as unknown as ArgumentsHost;
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    jest.clearAllMocks();
  });

  describe('HTTP Exceptions', () => {
    it('should handle BadRequestException', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            statusCode: 400,
            message: 'Bad request',
          }),
        }),
      );
    });

    it('should handle NotFoundException', () => {
      const host = createMockArgumentsHost('/api/tokens/0x123');
      const exception = new HttpException('Token not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            statusCode: 404,
            message: 'Token not found',
            path: '/api/tokens/0x123',
          }),
        }),
      );
    });

    it('should handle UnauthorizedException', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(401);
    });

    it('should handle ForbiddenException', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it('should handle TooManyRequestsException', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException(
        { statusCode: 429, message: 'Too many requests', retryAfter: 30 },
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(429);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            statusCode: 429,
            message: 'Too many requests',
          }),
        }),
      );
    });

    it('should handle InternalServerErrorException', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
    });

    it('should handle exception with object response', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException(
        { message: 'Validation failed', errors: ['field1 required'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Validation failed',
          }),
        }),
      );
    });

    it('should handle exception with array message', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException(
        { message: ['Field1 is required', 'Field2 is invalid'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: ['Field1 is required', 'Field2 is invalid'],
          }),
        }),
      );
    });
  });

  describe('Non-HTTP Exceptions', () => {
    it('should handle generic Error', () => {
      const host = createMockArgumentsHost();
      const exception = new Error('Something went wrong');

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            statusCode: 500,
            message: 'Something went wrong',
          }),
        }),
      );
    });

    it('should handle TypeError', () => {
      const host = createMockArgumentsHost();
      const exception = new TypeError('Cannot read property of undefined');

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Cannot read property of undefined',
          }),
        }),
      );
    });

    it('should handle RangeError', () => {
      const host = createMockArgumentsHost();
      const exception = new RangeError('Invalid array length');

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
    });

    it('should handle non-HTTP errors by returning 500', () => {
      const host = createMockArgumentsHost();
      const exception = new Error('Database connection failed');

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Database connection failed',
          }),
        }),
      );
    });

    it('should handle HTTP errors with correct status', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(404);
    });
  });

  describe('Unknown Exceptions', () => {
    it('should handle null exception', () => {
      const host = createMockArgumentsHost();

      filter.catch(null, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            statusCode: 500,
            message: 'Internal server error',
          }),
        }),
      );
    });

    it('should handle undefined exception', () => {
      const host = createMockArgumentsHost();

      filter.catch(undefined, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
    });

    it('should handle string exception', () => {
      const host = createMockArgumentsHost();

      filter.catch('Something failed' as unknown, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal server error',
          }),
        }),
      );
    });

    it('should handle object exception without message', () => {
      const host = createMockArgumentsHost();

      filter.catch({ code: 'ERROR_CODE' }, host);

      const response = host.switchToHttp().getResponse();
      expect(response.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Response format', () => {
    it('should include timestamp in error response', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      const before = new Date().toISOString();
      filter.catch(exception, host);
      const after = new Date().toISOString();

      const response = host.switchToHttp().getResponse();
      const call = (response.json as jest.Mock).mock.calls[0][0];
      const timestamp = call.error.timestamp;

      expect(timestamp).toBeDefined();
      expect(timestamp >= before).toBe(true);
      expect(timestamp <= after).toBe(true);
    });

    it('should include path in error response', () => {
      const host = createMockArgumentsHost('/api/users/portfolio');
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            path: '/api/users/portfolio',
          }),
        }),
      );
    });

    it('should set success to false', () => {
      const host = createMockArgumentsHost();
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, host);

      const response = host.switchToHttp().getResponse();
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });
});
