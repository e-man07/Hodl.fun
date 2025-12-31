import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

type ClassConstructor = new (...args: unknown[]) => object;

/**
 * Validation Pipe
 *
 * Validates and transforms incoming request data using class-validator
 */
@Injectable()
export class CustomValidationPipe<T = object> implements PipeTransform<unknown, Promise<T>> {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<T> {
    if (!metatype || !this.toValidate(metatype)) {
      return value as T;
    }

    const object = plainToInstance(metatype, value as object);
    const errors = await validate(object);

    if (errors.length > 0) {
      const errorMessages = this.formatErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    return object as T;
  }

  private toValidate(metatype: ClassConstructor): boolean {
    const types: ClassConstructor[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: ValidationError[]): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    errors.forEach((error) => {
      const field = error.property;
      const constraints = error.constraints || {};
      formatted[field] = Object.values(constraints);
    });

    return formatted;
  }
}
