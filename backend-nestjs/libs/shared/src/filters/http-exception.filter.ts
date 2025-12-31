import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HTTP Exception Filter
 *
 * Global exception handler for HTTP exceptions
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    this.logger.error(
      `HTTP ${status} - ${request.method} ${request.url} - ${
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : JSON.stringify(exceptionResponse)
      }`,
    );

    type JsonValue = string | number | boolean | null | object | undefined;
    interface ErrorResponse extends Record<string, JsonValue> {
      success: boolean;
      statusCode: number;
      timestamp: string;
      path: string;
      message?: string;
      error?: string;
    }

    let responseData: ErrorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const errorObj = exceptionResponse as Record<string, JsonValue>;
      responseData = {
        ...responseData,
        ...errorObj,
      };
    } else {
      responseData.message = exceptionResponse as string;
    }

    response.status(status).json(responseData);
  }
}
