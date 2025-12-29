import { BadRequestException } from '@nestjs/common';
import { ParseAddressPipe } from '../pipes/parse-address.pipe';

describe('ParseAddressPipe', () => {
  let pipe: ParseAddressPipe;

  beforeEach(() => {
    pipe = new ParseAddressPipe();
  });

  describe('transform', () => {
    it('should accept valid Ethereum address', () => {
      const address = '0x' + 'a'.repeat(40);
      const result = pipe.transform(address);

      expect(result).toBe(address.toLowerCase());
    });

    it('should normalize address to lowercase', () => {
      const address = '0x' + 'A'.repeat(40);
      const result = pipe.transform(address);

      expect(result).toBe(address.toLowerCase());
    });

    it('should accept mixed case addresses', () => {
      const address = '0xAbCdEf' + 'a'.repeat(34);
      const result = pipe.transform(address);

      expect(result).toBe(address.toLowerCase());
    });

    it('should throw error for empty address', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
      expect(() => pipe.transform('')).toThrow('Address is required');
    });

    it('should throw error for null address', () => {
      expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
    });

    it('should throw error for undefined address', () => {
      expect(() => pipe.transform(undefined as any)).toThrow(BadRequestException);
    });

    it('should throw error for address without 0x prefix', () => {
      const address = 'a'.repeat(40);
      expect(() => pipe.transform(address)).toThrow(BadRequestException);
      expect(() => pipe.transform(address)).toThrow('Invalid address format');
    });

    it('should throw error for address with wrong length', () => {
      const shortAddress = '0x' + 'a'.repeat(39);
      const longAddress = '0x' + 'a'.repeat(41);

      expect(() => pipe.transform(shortAddress)).toThrow(BadRequestException);
      expect(() => pipe.transform(longAddress)).toThrow(BadRequestException);
    });

    it('should throw error for address with invalid characters', () => {
      const invalidAddress = '0x' + 'g'.repeat(40); // 'g' is not valid hex
      expect(() => pipe.transform(invalidAddress)).toThrow(BadRequestException);
    });

    it('should throw error for address with spaces', () => {
      const addressWithSpaces = '0x ' + 'a'.repeat(39);
      expect(() => pipe.transform(addressWithSpaces)).toThrow(BadRequestException);
    });

    it('should accept all hex characters (0-9, a-f, A-F)', () => {
      const validAddresses = [
        '0x' + '0'.repeat(40),
        '0x' + '1234567890abcdef'.repeat(2) + '12345678',
        '0x' + 'ABCDEF0123456789'.repeat(2) + 'ABCDEF01',
      ];

      validAddresses.forEach((address) => {
        const result = pipe.transform(address);
        expect(result).toBe(address.toLowerCase());
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle checksum addresses (EIP-55)', () => {
      const checksumAddress = '0x5aAeb6053ba3eF8E0F494E24000111000C99B5b3';
      const result = pipe.transform(checksumAddress);

      expect(result).toBe(checksumAddress.toLowerCase());
    });

    it('should handle addresses with all zeros except prefix', () => {
      const zeroAddress = '0x' + '0'.repeat(40);
      const result = pipe.transform(zeroAddress);

      expect(result).toBe(zeroAddress);
    });

    it('should handle addresses with all fs', () => {
      const ffAddress = '0x' + 'f'.repeat(40);
      const result = pipe.transform(ffAddress);

      expect(result).toBe(ffAddress);
    });

    it('should preserve leading zeros in address', () => {
      const addressWithLeadingZeros = '0x000000' + 'a'.repeat(34);
      const result = pipe.transform(addressWithLeadingZeros);

      expect(result).toBe(addressWithLeadingZeros);
    });

    it('should handle whitespace at boundaries', () => {
      const addressWithLeadingSpace = ' 0x' + 'a'.repeat(40);
      const addressWithTrailingSpace = '0x' + 'a'.repeat(40) + ' ';

      expect(() => pipe.transform(addressWithLeadingSpace)).toThrow(BadRequestException);
      expect(() => pipe.transform(addressWithTrailingSpace)).toThrow(BadRequestException);
    });

    it('should throw error for uppercase prefix', () => {
      const uppercase0x = '0X' + 'a'.repeat(40);
      expect(() => pipe.transform(uppercase0x)).toThrow(BadRequestException);
    });

    it('should handle batch processing multiple addresses', () => {
      const addresses = [
        '0x' + 'a'.repeat(40),
        '0x' + 'b'.repeat(40),
        '0x' + 'c'.repeat(40),
      ];

      addresses.forEach((address) => {
        const result = pipe.transform(address);
        expect(result).toBe(address.toLowerCase());
      });
    });
  });
});
