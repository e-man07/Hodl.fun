import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dto/api-response.dto';
import { serializeBigInts } from '../utils/bigint.utils';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Serialize BigInts to strings to prevent JSON serialization errors
        const serializedData = serializeBigInts(data);

        // If already wrapped in ApiResponse, return as is
        if (serializedData && typeof serializedData === 'object' && 'success' in serializedData) {
          return serializedData;
        }
        return ApiResponse.success(serializedData);
      }),
    );
  }
}
