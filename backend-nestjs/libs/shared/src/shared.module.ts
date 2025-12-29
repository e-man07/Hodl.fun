import { Global, Module } from '@nestjs/common';

import { JwtGuard, RateLimitGuard } from './guards';
import { LoggingInterceptor, ResponseTransformInterceptor } from './interceptors';
import { CustomValidationPipe, ParseAddressPipe } from './pipes';
import { HttpExceptionFilter, AllExceptionsFilter } from './filters';

/**
 * Shared Module
 *
 * Contains shared utilities:
 * - Guards (authentication, authorization, rate limiting)
 * - Interceptors (logging, caching, transformation)
 * - Pipes (validation, transformation)
 * - Filters (exception handling)
 * - Decorators (common metadata)
 */
@Global()
@Module({
  providers: [
    JwtGuard,
    RateLimitGuard,
    LoggingInterceptor,
    ResponseTransformInterceptor,
    CustomValidationPipe,
    ParseAddressPipe,
    HttpExceptionFilter,
    AllExceptionsFilter,
  ],
  exports: [
    JwtGuard,
    RateLimitGuard,
    LoggingInterceptor,
    ResponseTransformInterceptor,
    CustomValidationPipe,
    ParseAddressPipe,
    HttpExceptionFilter,
    AllExceptionsFilter,
  ],
})
export class SharedModule {}
