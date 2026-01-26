import { ValidationPipe, BadRequestException, ValidationError } from '@nestjs/common';

/**
 * Custom validation pipe with enhanced error formatting
 */
export const customValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (errors: ValidationError[]) => {
    const formatErrors = (errors: ValidationError[], parentPath = ''): string[] => {
      const messages: string[] = [];

      for (const error of errors) {
        const propertyPath = parentPath ? `${parentPath}.${error.property}` : error.property;

        if (error.constraints) {
          const constraintMessages = Object.values(error.constraints);
          messages.push(...constraintMessages.map((msg) => `${propertyPath}: ${msg}`));
        }

        if (error.children && error.children.length > 0) {
          messages.push(...formatErrors(error.children, propertyPath));
        }
      }

      return messages;
    };

    const messages = formatErrors(errors);

    return new BadRequestException({
      statusCode: 400,
      error: 'Validation Error',
      message: messages.length === 1 ? messages[0] : messages,
    });
  },
});

/**
 * Strict validation pipe that rejects unknown properties
 */
export const strictValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: false,
  },
  exceptionFactory: (errors: ValidationError[]) => {
    const messages = errors.map((error) => {
      if (error.constraints) {
        return Object.values(error.constraints).join(', ');
      }
      return `Invalid value for ${error.property}`;
    });

    return new BadRequestException({
      statusCode: 400,
      error: 'Validation Error',
      message: messages,
    });
  },
});
