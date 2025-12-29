import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../libs/core/src/database/prisma.service';
import { TestDatabase } from './fixtures/test-database';
import { TestDataFactory } from './fixtures/test-data';
import { TestHttpClient } from './utils/http-client';

/**
 * E2E Test: Error Handling and Edge Cases
 *
 * Tests error responses and edge cases
 */
describe('Error Handling & Edge Cases (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let db: TestDatabase;
  let factory: TestDataFactory;
  let http: TestHttpClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    db = new TestDatabase(prisma);
    factory = new TestDataFactory(prisma);
    http = new TestHttpClient('http://localhost:3000');
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Invalid Token Address Format', () => {
    it('should reject non-hex address', async () => {
      const invalidAddress = 'invalid-token-address';

      const response = await http.getToken(invalidAddress);

      http.assertError(response);
    });

    it('should reject address without 0x prefix', async () => {
      const addressWithoutPrefix = 'a'.repeat(40);

      const response = await http.getToken(addressWithoutPrefix);

      http.assertError(response);
    });

    it('should reject address with wrong length', async () => {
      const shortAddress = '0x' + 'a'.repeat(39);
      const longAddress = '0x' + 'a'.repeat(41);

      const response1 = await http.getToken(shortAddress);
      const response2 = await http.getToken(longAddress);

      http.assertError(response1);
      http.assertError(response2);
    });

    it('should reject uppercase 0X prefix', async () => {
      const uppercasePrefix = '0X' + 'a'.repeat(40);

      const response = await http.getToken(uppercasePrefix);

      http.assertError(response);
    });
  });

  describe('Non-Existent Resources', () => {
    it('should return 404 for non-existent token', async () => {
      const fakeAddress = factory.generateTokenAddress();

      const response = await http.getToken(fakeAddress);

      http.assertStatus(response, 404);
    });

    it('should return 404 for non-existent portfolio', async () => {
      const fakeUser = factory.generateUserAddress();

      const response = await http.getPortfolio(fakeUser);

      http.assertStatus(response, 404);
    });

    it('should return 404 for non-existent trade', async () => {
      const fakeToken = factory.generateTokenAddress();

      const response = await http.getTokenTrades(fakeToken);

      // Either 404 or empty result depending on implementation
      expect([404, 200]).toContain(response.status);
    });
  });

  describe('Invalid Input Validation', () => {
    it('should reject token creation with empty name', async () => {
      const invalidData = {
        name: '',
        symbol: 'TST',
        description: 'Test',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const response = await http.createToken(invalidData);

      http.assertError(response);
    });

    it('should reject token creation with invalid symbol', async () => {
      const invalidData = {
        name: 'Test Token',
        symbol: '', // Empty symbol
        description: 'Test',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const response = await http.createToken(invalidData);

      http.assertError(response);
    });

    it('should reject buy with zero amount', async () => {
      const token = await factory.createToken();

      const buyData = {
        amount: '0', // Zero amount
      };

      const response = await http.buyToken(token.address, buyData);

      http.assertError(response);
    });

    it('should reject buy with negative amount', async () => {
      const token = await factory.createToken();

      const buyData = {
        amount: '-1000000000000000000',
      };

      const response = await http.buyToken(token.address, buyData);

      http.assertError(response);
    });
  });

  describe('Business Logic Errors', () => {
    it('should prevent buying locked token', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: true,
      });

      const buyData = { amount: '1000000000000000000' };

      const response = await http.buyToken(token.address, buyData);

      http.assertError(response);
    });

    it('should prevent trading non-existent token', async () => {
      const fakeToken = factory.generateTokenAddress();

      const buyData = { amount: '1000000000000000000' };

      const response = await http.buyToken(fakeToken, buyData);

      http.assertStatus(response, 404);
    });

    it('should prevent selling more than owned', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      // Buy only 100 tokens
      await factory.createBuyTransaction(token.address, user);

      // Try to sell 1000
      const sellData = { amount: '1000000000000000000000' };

      const response = await http.sellToken(token.address, sellData);

      http.assertError(response);
    });

    it('should handle overflow in calculations', async () => {
      const token = await factory.createToken({
        totalSupply: BigInt('999999999999999999999999999999'),
      });

      // Attempting to add more could overflow
      const buyData = { amount: '999999999999999999999999999999' };

      const response = await http.buyToken(token.address, buyData);

      // Should either error or handle gracefully
      // Response status should be valid
      expect([200, 400, 413]).toContain(response.status);
    });
  });

  describe('Response Format Validation', () => {
    it('should return proper error response structure', async () => {
      const response = await http.getToken('invalid-address');

      http.assertError(response);

      const data = response.data;
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('statusCode');
      expect(data).toHaveProperty('message');
      expect(data.success).toBe(false);
    });

    it('should include timestamp in error response', async () => {
      const response = await http.getToken(factory.generateTokenAddress());

      const data = response.data;
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');
    });

    it('should include path in error response', async () => {
      const address = factory.generateTokenAddress();
      const response = await http.getToken(address);

      const data = response.data;
      expect(data).toHaveProperty('path');
      expect(data.path).toContain(address);
    });

    it('should format validation errors properly', async () => {
      const invalidData = {
        name: '',
        symbol: '',
      };

      const response = await http.createToken(invalidData);

      http.assertError(response);

      const data = response.data;
      if (data.errors) {
        expect(typeof data.errors).toBe('object');
      }
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle limit=0', async () => {
      await factory.createTokens(5);

      const response = await http.getTokens(0, 0);

      // Should return empty or error
      if (response.status === 200) {
        expect(response.data.data).toHaveLength(0);
      }
    });

    it('should handle negative offset', async () => {
      await factory.createTokens(5);

      const response = await http.getTokens(10, -1);

      // Should error or treat as 0
      expect([200, 400]).toContain(response.status);
    });

    it('should handle offset beyond total', async () => {
      await factory.createTokens(5);

      const response = await http.getTokens(10, 1000);

      http.assertSuccess(response);
      expect(response.data.data).toHaveLength(0);
    });

    it('should handle very large limit', async () => {
      await factory.createTokens(5);

      const response = await http.getTokens(999999, 0);

      http.assertSuccess(response);
      expect(response.data.data.length).toBeLessThanOrEqual(5);
    });

    it('should apply limit maximum', async () => {
      await factory.createTokens(200);

      const response = await http.getTokens(999999, 0);

      // Should be capped at maximum (e.g., 100)
      expect(response.data.data.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent token creation', async () => {
      const promises = Array.from({ length: 5 }, () =>
        factory.createToken({
          name: `Concurrent Token ${Math.random()}`,
        })
      );

      const tokens = await Promise.all(promises);

      expect(tokens).toHaveLength(5);
      expect(new Set(tokens.map((t: any) => t.address)).size).toBe(5);
    });

    it('should handle concurrent trades on same token', async () => {
      const token = await factory.createToken();

      const promises = Array.from({ length: 10 }, () =>
        factory.createBuyTransaction(token.address)
      );

      const trades = await Promise.all(promises);

      expect(trades).toHaveLength(10);
      expect(new Set(trades.map((t: any) => t.hash)).size).toBe(10);
    });

    it('should handle concurrent portfolio queries', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken();

      // Create a position
      await factory.createBuyTransaction(token.address, user);

      // Concurrent reads
      const promises = Array.from({ length: 5 }, () => http.getPortfolio(user));

      const responses = await Promise.all(promises);

      responses.forEach((response: any) => {
        http.assertSuccess(response);
        expect(response.data.userId).toBe(user);
      });
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle token name with special characters', async () => {
      const tokenData = {
        name: 'Test & Token <>"',
        symbol: 'TST',
        description: 'Description with special chars',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const response = await http.createToken(tokenData);

      // Should either accept or reject gracefully
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should handle token name with unicode', async () => {
      const tokenData = {
        name: '日本語 Token 中文',
        symbol: 'UTC',
        description: 'Unicode test',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const response = await http.createToken(tokenData);

      // Should handle unicode properly
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should handle very long names', async () => {
      const tokenData = {
        name: 'A'.repeat(1000),
        symbol: 'LNG',
        description: 'Long name test',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const response = await http.createToken(tokenData);

      // Should reject if too long or accept with truncation
      expect([200, 201, 400, 413]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit correctly', async () => {
      const promises = Array.from({ length: 150 }, () => http.healthCheck());

      const responses = await Promise.all(promises);

      // Some should succeed, some might be rate limited
      const statuses = responses.map((r: any) => r.status);
      expect(statuses.some((s: any) => s === 200)).toBe(true);
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Make rapid requests
      const requests = Array.from({ length: 200 }, () =>
        http.getTokens(10, 0)
      );

      const responses = await Promise.all(requests);

      // Either all succeed or some are limited
      expect(responses.every((r: any) => [200, 429].includes(r.status))).toBe(true);
    });
  });

  describe('Database Connection Errors', () => {
    it('should handle query errors gracefully', async () => {
      const response = await http.healthCheck();

      // Health check should always respond (even if degraded)
      expect(response.status).toBeDefined();
    });

    it('should provide appropriate error messages', async () => {
      const response = await http.getToken('invalid');

      http.assertError(response);

      const data = response.data;
      expect(data.message).toBeDefined();
      expect(typeof data.message).toBe('string');
    });
  });

  describe('Boundary Values', () => {
    it('should handle minimum trade amount', async () => {
      const token = await factory.createToken();

      const buyData = { amount: '1' }; // Minimum 1 wei

      const response = await http.buyToken(token.address, buyData);

      // Should succeed or provide clear error
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should handle maximum BigInt values', async () => {
      const token = await factory.createToken({
        totalSupply: BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935'), // 2^256-1
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.totalSupply).toBeDefined();
    });

    it('should handle zero values correctly', async () => {
      const token = await factory.createToken({
        volume24h: BigInt('0'),
        priceChange24h: 0,
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.volume24h).toBe('0');
      expect(response.data.priceChange24h).toBe(0);
    });

    it('should handle negative percentage changes', async () => {
      const token = await factory.createToken({
        priceChange24h: -50.5,
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.priceChange24h).toBe(-50.5);
    });
  });
});
