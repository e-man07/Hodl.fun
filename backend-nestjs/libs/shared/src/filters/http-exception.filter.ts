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

    let responseData: any = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (typeof exceptionResponse === 'object') {
      responseData = {
        ...responseData,
        ...(exceptionResponse as any),
      };
    } else {
      responseData.message = exceptionResponse;
    }

    response.status(status).json(responseData);
  }
}
