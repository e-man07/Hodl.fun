import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '@hodlfun/redis';

@Injectable()
export class WalletAuthService {
  private readonly noncePrefix = 'auth:nonce:';
  private readonly nonceTtl = 300; // 5 minutes

  constructor(private readonly redis: RedisService) {}

  async generateNonce(
    wallet: string,
  ): Promise<{ nonce: string; message: string; expiresAt: Date }> {
    const normalizedWallet = wallet.toLowerCase();
    const nonce = uuidv4();
    const timestamp = Date.now();

    const message = [
      'Welcome to Hodl.fun!',
      '',
      'Sign this message to verify your wallet.',
      'This will not trigger any blockchain transaction.',
      '',
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');

    await this.redis.set(
      `${this.noncePrefix}${normalizedWallet}`,
      JSON.stringify({ nonce, timestamp }),
      'EX',
      this.nonceTtl,
    );

    return {
      nonce,
      message,
      expiresAt: new Date(Date.now() + this.nonceTtl * 1000),
    };
  }

  async verifySignature(wallet: string, signature: string): Promise<boolean> {
    const normalizedWallet = wallet.toLowerCase();
    const key = `${this.noncePrefix}${normalizedWallet}`;

    const storedData = await this.redis.get(key);
    if (!storedData) {
      throw new UnauthorizedException('Nonce expired or not found');
    }

    const { nonce, timestamp } = JSON.parse(storedData);
    const message = [
      'Welcome to Hodl.fun!',
      '',
      'Sign this message to verify your wallet.',
      'This will not trigger any blockchain transaction.',
      '',
      `Nonce: ${nonce}`,
      `Timestamp: ${timestamp}`,
    ].join('\n');

    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const isValid = recoveredAddress.toLowerCase() === normalizedWallet;

      if (isValid) {
        await this.redis.del(key); // One-time use
      }

      return isValid;
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
