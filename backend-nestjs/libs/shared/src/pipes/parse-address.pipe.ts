import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

/**
 * Parse Address Pipe
 *
 * Validates and normalizes Ethereum addresses
 */
@Injectable()
export class ParseAddressPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException('Address is required');
    }

    // Check if valid Ethereum address format (0x + 40 hex characters)
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new BadRequestException(
        `Invalid address format: ${value}. Must be a valid Ethereum address.`,
      );
    }

    // Normalize to lowercase
    return value.toLowerCase();
  }
}
