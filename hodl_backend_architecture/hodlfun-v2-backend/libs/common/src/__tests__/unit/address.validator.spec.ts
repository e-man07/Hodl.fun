/**
 * Address Validator Unit Tests
 * Tests for Ethereum address validation decorators
 */
import { validate } from 'class-validator';
import { IsEthAddress, IsEthAddressOrEmpty } from '../../validators/address.validator';

// Test DTO with IsEthAddress
class TestAddressDto {
  @IsEthAddress()
  address!: string;
}

// Test DTO with IsEthAddressOrEmpty
class TestOptionalAddressDto {
  @IsEthAddressOrEmpty()
  address?: string;
}

// Test DTO with custom message
class TestCustomMessageDto {
  @IsEthAddress({ message: 'Custom error message' })
  address!: string;
}

describe('Address Validators', () => {
  describe('IsEthAddress', () => {
    it('should pass validation for a valid lowercase address', async () => {
      const dto = new TestAddressDto();
      dto.address = '0x1234567890abcdef1234567890abcdef12345678';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for a valid mixed-case checksummed address', async () => {
      const dto = new TestAddressDto();
      // Use a properly checksummed address - ethers.isAddress requires valid checksum for mixed case
      dto.address = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'; // Valid checksummed address

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for a valid checksummed address', async () => {
      const dto = new TestAddressDto();
      dto.address = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'; // Vitalik's address

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation for an invalid address (too short)', async () => {
      const dto = new TestAddressDto();
      dto.address = '0x1234567890abcdef';

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('address');
    });

    it('should pass validation for address without 0x prefix (ethers v6 accepts this)', async () => {
      // Note: ethers v6 isAddress() accepts addresses without 0x prefix
      const dto = new TestAddressDto();
      dto.address = '1234567890abcdef1234567890abcdef12345678';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation for an invalid address (invalid characters)', async () => {
      const dto = new TestAddressDto();
      dto.address = '0xgg34567890abcdef1234567890abcdef12345678';

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
    });

    it('should fail validation for an empty string', async () => {
      const dto = new TestAddressDto();
      dto.address = '';

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
    });

    it('should fail validation for null', async () => {
      const dto = new TestAddressDto();
      dto.address = null as unknown as string;

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
    });

    it('should fail validation for undefined', async () => {
      const dto = new TestAddressDto();
      // address is not set (undefined)

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
    });

    it('should fail validation for non-string types', async () => {
      const dto = new TestAddressDto();
      dto.address = 12345 as unknown as string;

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
    });

    it('should return default error message', async () => {
      const dto = new TestAddressDto();
      dto.address = 'invalid';

      const errors = await validate(dto);
      expect(errors[0].constraints?.isEthAddress).toBe('address must be a valid Ethereum address');
    });

    it('should return custom error message when provided', async () => {
      const dto = new TestCustomMessageDto();
      dto.address = 'invalid';

      const errors = await validate(dto);
      expect(errors[0].constraints?.isEthAddress).toBe('Custom error message');
    });

    it('should pass validation for zero address', async () => {
      const dto = new TestAddressDto();
      dto.address = '0x0000000000000000000000000000000000000000';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('IsEthAddressOrEmpty', () => {
    it('should pass validation for a valid address', async () => {
      const dto = new TestOptionalAddressDto();
      dto.address = '0x1234567890abcdef1234567890abcdef12345678';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for an empty string', async () => {
      const dto = new TestOptionalAddressDto();
      dto.address = '';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for undefined', async () => {
      const dto = new TestOptionalAddressDto();
      // address is not set

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass validation for null', async () => {
      const dto = new TestOptionalAddressDto();
      dto.address = null as unknown as string;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation for an invalid address', async () => {
      const dto = new TestOptionalAddressDto();
      dto.address = 'invalid-address';

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].constraints?.isEthAddressOrEmpty).toBe(
        'address must be a valid Ethereum address or empty',
      );
    });

    it('should fail validation for a partial address', async () => {
      const dto = new TestOptionalAddressDto();
      dto.address = '0x1234';

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
    });
  });
});
