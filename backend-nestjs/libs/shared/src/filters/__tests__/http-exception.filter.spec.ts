import { HttpException, HttpStatus, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from '../http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

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

  describe('Exception Handling', () => {
    it('should catch HttpException', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      expect(() => filter.catch(exception, mockHost)).not.toThrow();
    });

    it('should extract status code from exception', () => {
      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('should handle different HTTP status codes', () => {
      const statusCodes = [
        HttpStatus.BAD_REQUEST,
        HttpStatus.UNAUTHORIZED,
        HttpStatus.FORBIDDEN,
        HttpStatus.NOT_FOUND,
        HttpStatus.INTERNAL_SERVER_ERROR,
      ];

      statusCodes.forEach((status) => {
        const exception = new HttpException('Error', status);
        filter.catch(exception, mockHost);
        expect(mockResponse.status).toHaveBeenCalledWith(status);
      });
    });
  });

  describe('Response Formatting', () => {
    it('should return success=false', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it('should include status code in response', () => {
      const exception = new HttpException('Error', HttpStatus.NOT_FOUND);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
        }),
      );
    });

    it('should include timestamp in response', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });

    it('should include request path in response', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/tokens',
        }),
      );
    });
  });

  describe('String Exception Messages', () => {
    it('should handle string exception messages', () => {
      const exception = new HttpException('Token not found', HttpStatus.NOT_FOUND);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Token not found',
        }),
      );
    });

    it('should wrap string messages correctly', () => {
      const exception = new HttpException('Invalid address format', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.message).toBe('Invalid address format');
      expect(callArg.success).toBe(false);
    });
  });

  describe('Object Exception Messages', () => {
    it('should handle object exception responses', () => {
      const exceptionResponse = {
        message: 'Validation failed',
        errors: {
          name: ['Name is required'],
          symbol: ['Symbol is required'],
        },
      };
      const exception = new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation failed',
          errors: expect.any(Object),
        }),
      );
    });

    it('should merge object response with standard fields', () => {
      const exceptionResponse = {
        message: 'Insufficient balance',
        code: 'BALANCE_ERROR',
      };
      const exception = new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.success).toBe(false);
      expect(callArg.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(callArg.message).toBe('Insufficient balance');
      expect(callArg.code).toBe('BALANCE_ERROR');
    });

    it('should handle nested error objects', () => {
      const exceptionResponse = {
        message: 'Validation error',
        errors: {
          address: {
            isAddress: 'Invalid Ethereum address',
            isNotEmpty: 'Address cannot be empty',
          },
          amount: {
            isNumber: 'Amount must be a number',
          },
        },
      };
      const exception = new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.errors).toBeDefined();
      expect(callArg.errors.address).toBeDefined();
    });
  });

  describe('NestJS Standard Exceptions', () => {
    it('should handle BadRequestException', () => {
      const exception = new BadRequestException('Invalid input');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
        }),
      );
    });

    it('should handle NotFoundException', () => {
      const exception = new NotFoundException('Token not found');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should handle ForbiddenException', () => {
      const exception = new ForbiddenException('Access denied');
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });
  });

  describe('Request Details', () => {
    it('should log request method', () => {
      mockRequest.method = 'POST';
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should log request URL', () => {
      mockRequest.url = '/api/tokens/0xabc123';
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/tokens/0xabc123',
        }),
      );
    });

    it('should handle various request URLs', () => {
      const urls = [
        '/api/tokens',
        '/api/tokens/0xabc123',
        '/api/users/profile',
        '/api/trades/buy',
      ];

      urls.forEach((url) => {
        mockRequest.url = url;
        const exception = new HttpException('Error', HttpStatus.NOT_FOUND);
        mockResponse.json.mockClear();

        filter.catch(exception, mockHost);

        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            path: url,
          }),
        );
      });
    });
  });

  describe('Timestamp Handling', () => {
    it('should generate ISO timestamp', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      const timestamp = new Date(callArg.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(callArg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should have consistent timestamp format', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      // ISO format: 2024-01-15T10:30:45.123Z
      expect(callArg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exception with empty message', () => {
      const exception = new HttpException('', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
        }),
      );
    });

    it('should handle exception with null response', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle exception with large error objects', () => {
      const exceptionResponse = {
        message: 'Multiple validation errors',
        errors: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`field${i}`, ['Error message']])
        ),
      };
      const exception = new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      const callArg = mockResponse.json.mock.calls[0][0];
      expect(callArg.errors).toBeDefined();
      expect(Object.keys(callArg.errors)).toHaveLength(50);
    });

    it('should handle special characters in error messages', () => {
      const exception = new HttpException(
        'Invalid token: @#$%^&*()',
        HttpStatus.BAD_REQUEST
      );
      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token: @#$%^&*()',
        }),
      );
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

      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);
      filter.catch(exception, mockHost);

      expect(callOrder).toEqual(['status', 'json']);
    });
  });
});
