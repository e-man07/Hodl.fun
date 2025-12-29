import { CustomValidationPipe } from '../validation.pipe';
import { BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { IsString, IsNumber, IsEmail, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Test DTOs
class SimpleDTO {
  @IsString()
  name!: string;

  @IsNumber()
  age!: number;
}

class EmailDTO {
  @IsEmail()
  email!: string;
}

class OptionalDTO {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  age?: number;
}

class NestedItemDTO {
  @IsString()
  id!: string;
}

class NestedDTO {
  @ValidateNested({ each: true })
  @Type(() => NestedItemDTO)
  items!: NestedItemDTO[];
}

describe('CustomValidationPipe', () => {
  let pipe: CustomValidationPipe;

  beforeEach(() => {
    pipe = new CustomValidationPipe();
  });

  describe('Valid Data', () => {
    it('should pass through valid data', async () => {
      const value = { name: 'John', age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBeDefined();
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should transform plain object to DTO instance', async () => {
      const value = { name: 'Jane', age: 25 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBeInstanceOf(SimpleDTO);
    });

    it('should validate email format', async () => {
      const value = { email: 'test@example.com' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: EmailDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.email).toBe('test@example.com');
    });
  });

  describe('Invalid Data', () => {
    it('should throw BadRequestException for invalid string', async () => {
      const value = { name: 123, age: 30 }; // name should be string
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid email', async () => {
      const value = { email: 'not-an-email' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: EmailDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid number', async () => {
      const value = { name: 'John', age: 'thirty' }; // age should be number
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing required field', async () => {
      const value = { name: 'John' }; // age is required
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Error Messages', () => {
    it('should include validation message in error', async () => {
      const value = { email: 'invalid-email' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: EmailDTO,
        data: undefined,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should throw');
      } catch (error: any) {
        expect(error.message).toContain('Validation failed');
      }
    });

    it('should include field errors in response', async () => {
      const value = { name: 123, age: 'thirty' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should throw');
      } catch (error: any) {
        const response = error.getResponse() as any;
        expect(response.errors).toBeDefined();
        expect(response.errors.name).toBeDefined();
        expect(response.errors.age).toBeDefined();
      }
    });

    it('should include specific constraint messages', async () => {
      const value = { name: 123, age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should throw');
      } catch (error: any) {
        const response = error.getResponse() as any;
        expect(Array.isArray(response.errors.name)).toBe(true);
      }
    });
  });

  describe('Primitive Types', () => {
    it('should skip validation for string metatype', async () => {
      const value = 'test string';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: String,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe('test string');
    });

    it('should skip validation for number metatype', async () => {
      const value = 42;
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Number,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(42);
    });

    it('should skip validation for boolean metatype', async () => {
      const value = true;
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: Boolean,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(true);
    });

    it('should skip validation for array metatype', async () => {
      const value = [1, 2, 3];
      const metadata: ArgumentMetadata = {
        type: 'query',
        metatype: Array,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should skip validation for object metatype', async () => {
      const value = { key: 'value' };
      const metadata: ArgumentMetadata = {
        type: 'query',
        metatype: Object,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('Optional Fields', () => {
    it('should allow undefined optional fields', async () => {
      const value = { name: 'John' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: OptionalDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.name).toBe('John');
      expect(result.age).toBeUndefined();
    });

    it('should validate provided optional fields', async () => {
      const value = { name: 123, age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: OptionalDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });
  });

  describe('Undefined Metatype', () => {
    it('should return value when metatype is undefined', async () => {
      const value = { any: 'data' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: undefined,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toEqual(value);
    });
  });

  describe('Error Response Format', () => {
    it('should have message property', async () => {
      const value = { name: 123, age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should throw');
      } catch (error: any) {
        const response = error.getResponse() as any;
        expect(response.message).toBe('Validation failed');
      }
    });

    it('should have errors property with field errors', async () => {
      const value = { name: 123, age: 'thirty' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should throw');
      } catch (error: any) {
        const response = error.getResponse() as any;
        expect(response.errors).toBeDefined();
        expect(typeof response.errors).toBe('object');
      }
    });

    it('should map all validation errors', async () => {
      const value = { name: 123, age: 'not-a-number' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should throw');
      } catch (error: any) {
        const response = error.getResponse() as any;
        expect(Object.keys(response.errors)).toContain('name');
        expect(Object.keys(response.errors)).toContain('age');
      }
    });
  });

  describe('Complex Objects', () => {
    it('should validate nested objects', async () => {
      const value = {
        items: [{ id: 'item1' }, { id: 'item2' }],
      };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: NestedDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.items).toHaveLength(2);
    });

    it('should reject invalid nested objects', async () => {
      const value = {
        items: [{ id: 123 }], // id should be string
      };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: NestedDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });
  });

  describe('Multiple Validation Errors', () => {
    it('should collect multiple errors in response', async () => {
      const value = { name: 123, age: 'thirty' };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      try {
        await pipe.transform(value, metadata);
        fail('Should throw');
      } catch (error: any) {
        const response = error.getResponse() as any;
        expect(Object.keys(response.errors).length).toBeGreaterThan(1);
      }
    });
  });

  describe('Empty Objects', () => {
    it('should reject empty object for required fields', async () => {
      const value = {};
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });

    it('should accept empty object for optional DTO', async () => {
      const value = {};
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: OptionalDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBeDefined();
    });
  });

  describe('Null and Undefined Values', () => {
    it('should reject null for required field', async () => {
      const value = { name: null, age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });

    it('should reject undefined for required field', async () => {
      const value = { name: undefined, age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace strings', async () => {
      const value = { name: '   ', age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.name).toBe('   ');
    });

    it('should handle zero as valid number', async () => {
      const value = { name: 'John', age: 0 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.age).toBe(0);
    });

    it('should handle negative numbers', async () => {
      const value = { name: 'John', age: -5 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.age).toBe(-5);
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(10000);
      const value = { name: longString, age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.name).toBe(longString);
    });

    it('should handle special characters in strings', async () => {
      const value = { name: 'John @#$%^&*()', age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.name).toBe('John @#$%^&*()');
    });

    it('should handle unicode characters', async () => {
      const value = { name: '日本語テキスト', age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result.name).toBe('日本語テキスト');
    });
  });

  describe('Type Coercion', () => {
    it('should not coerce types during validation', async () => {
      const value = { name: 'John', age: '30' }; // string instead of number
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      await expect(pipe.transform(value, metadata)).rejects.toThrow();
    });
  });

  describe('Return Type', () => {
    it('should return instance of DTO class', async () => {
      const value = { name: 'John', age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBeInstanceOf(SimpleDTO);
    });

    it('should return same data for primitive types', async () => {
      const value = 'test';
      const metadata: ArgumentMetadata = {
        type: 'param',
        metatype: String,
        data: undefined,
      };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe('test');
    });
  });

  describe('Async Behavior', () => {
    it('should be async and return Promise', () => {
      const value = { name: 'John', age: 30 };
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const result = pipe.transform(value, metadata);

      expect(result).toBeInstanceOf(Promise);
    });

    it('should handle concurrent validations', async () => {
      const values = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 },
      ];
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: SimpleDTO,
        data: undefined,
      };

      const promises = values.map((v) => pipe.transform(v, metadata));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeInstanceOf(SimpleDTO);
      });
    });
  });

  describe('Email Validation', () => {
    it('should accept valid emails', async () => {
      const validEmails = [
        'test@example.com',
        'user+tag@example.co.uk',
        'info@sub.example.org',
      ];

      for (const email of validEmails) {
        const value = { email };
        const metadata: ArgumentMetadata = {
          type: 'body',
          metatype: EmailDTO,
          data: undefined,
        };

        const result = await pipe.transform(value, metadata);
        expect(result.email).toBe(email);
      }
    });

    it('should reject invalid emails', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@.com',
        'user name@example.com',
      ];

      for (const email of invalidEmails) {
        const value = { email };
        const metadata: ArgumentMetadata = {
          type: 'body',
          metatype: EmailDTO,
          data: undefined,
        };

        await expect(pipe.transform(value, metadata)).rejects.toThrow();
      }
    });
  });
});
