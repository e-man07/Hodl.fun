/**
 * API E2E Tests
 * End-to-end tests for the API service
 *
 * These tests verify the complete API behavior including:
 * - HTTP request/response handling
 * - Validation
 * - Authentication flows
 * - Database interactions
 * - Error handling
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ethers } from 'ethers';
import { TestAppModule } from './test-app.module';
import { PrismaService } from '@hodlfun/database';
import { RedisService } from '@hodlfun/redis';
import { GlobalExceptionFilter, TransformInterceptor } from '@hodlfun/common';
import { createMockToken, createMockTrade, resetTokenCounter } from '../mocks/factories';

describe('API E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  // Test wallet for authentication
  const testWallet = ethers.Wallet.createRandom();
  const testWalletAddress = testWallet.address.toLowerCase();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as production
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redis = moduleFixture.get<RedisService>(RedisService);

    // Clean test data
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    resetTokenCounter();
    // Clean database before each test to avoid unique constraint violations
    await cleanDatabase();
  });

  async function cleanDatabase() {
    // Clean Redis
    const keys = await redis.keys('*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    // Clean database tables in order (respecting foreign keys)
    await prisma.$executeRaw`TRUNCATE TABLE "price_history" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "trades" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "holders" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "tokens" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "user_portfolios" CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE "indexer_state" CASCADE`;
  }

  describe('Health Endpoints', () => {
    it('GET /api/v1/health/startup - should return ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/startup')
        .expect(200)
        .expect((res: any) => {
          expect(res.body.data.status).toBe('ok');
          expect(res.body.data.timestamp).toBeDefined();
        });
    });

    it('GET /api/v1/health/live - should return ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect((res: any) => {
          expect(res.body.data.status).toBe('ok');
        });
    });

    it('GET /api/v1/health/ready - should check database and redis', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200)
        .expect((res: any) => {
          expect(res.body.data.status).toBe('healthy');
          expect(res.body.data.checks.database).toBe('up');
          expect(res.body.data.checks.redis).toBe('up');
        });
    });
  });

  describe('Auth Endpoints', () => {
    describe('POST /api/v1/auth/nonce', () => {
      it('should generate nonce for valid wallet', () => {
        return request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({ wallet: testWalletAddress })
          .expect(201)
          .expect((res: any) => {
            expect(res.body.data.nonce).toBeDefined();
            expect(res.body.data.message).toContain('Welcome to Hodl.fun!');
            expect(res.body.data.expiresAt).toBeDefined();
          });
      });

      it('should reject invalid wallet address', () => {
        return request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({ wallet: 'invalid-address' })
          .expect(400)
          .expect((res: any) => {
            expect(res.body.success).toBe(false);
          });
      });

      it('should reject missing wallet', () => {
        return request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({})
          .expect(400);
      });
    });

    describe('POST /api/v1/auth/verify', () => {
      it('should verify signature and return tokens', async () => {
        // First get a nonce
        const nonceRes = await request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({ wallet: testWalletAddress });

        const { message } = nonceRes.body.data;

        // Sign the message with the test wallet
        const signature = await testWallet.signMessage(message);

        // Verify the signature
        return request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .send({ wallet: testWalletAddress, signature })
          .expect(201)
          .expect((res: any) => {
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.refreshToken).toBeDefined();
            expect(res.body.data.expiresIn).toBe(3600);
          });
      });

      it('should reject invalid signature', async () => {
        // Get a nonce first
        await request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({ wallet: testWalletAddress });

        // Try with invalid signature
        return request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .send({ wallet: testWalletAddress, signature: '0xinvalid' })
          .expect(401);
      });

      it('should reject expired/missing nonce', () => {
        const randomWallet = ethers.Wallet.createRandom();
        return request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .send({ wallet: randomWallet.address, signature: '0xsignature' })
          .expect(401)
          .expect((res: any) => {
            expect(res.body.success).toBe(false);
          });
      });
    });

    describe('POST /api/v1/auth/refresh', () => {
      it('should refresh tokens with valid refresh token', async () => {
        // Get tokens first
        const nonceRes = await request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({ wallet: testWalletAddress });

        const signature = await testWallet.signMessage(nonceRes.body.data.message);

        const verifyRes = await request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .send({ wallet: testWalletAddress, signature });

        const { refreshToken } = verifyRes.body.data;

        // Refresh tokens
        return request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(201)
          .expect((res: any) => {
            expect(res.body.data.accessToken).toBeDefined();
            expect(res.body.data.refreshToken).toBeDefined();
            // New refresh token should be different
            expect(res.body.data.refreshToken).not.toBe(refreshToken);
          });
      });

      it('should reject invalid refresh token', () => {
        return request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);
      });

      it('should reject reused refresh token', async () => {
        // Get tokens
        const nonceRes = await request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({ wallet: testWalletAddress });

        const signature = await testWallet.signMessage(nonceRes.body.data.message);

        const verifyRes = await request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .send({ wallet: testWalletAddress, signature });

        const { refreshToken } = verifyRes.body.data;

        // Use refresh token once
        await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(201);

        // Try to use same refresh token again (should fail - token rotation)
        return request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(401);
      });
    });
  });

  describe('Tokens Endpoints', () => {
    beforeEach(async () => {
      // Seed test tokens
      const tokens = [
        createMockToken({ status: 'TRADING' }),
        createMockToken({ status: 'TRADING' }),
        createMockToken({ status: 'LOCKED' }),
        createMockToken({ status: 'LISTED', poolAddress: '0xpool123' }),
      ];

      for (const token of tokens) {
        await prisma.token.create({ data: token as any });
      }
    });

    describe('GET /api/v1/tokens', () => {
      it('should return paginated list of tokens', () => {
        return request(app.getHttpServer())
          .get('/api/v1/tokens')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
            expect(res.body.data.data.length).toBeGreaterThan(0);
            expect(res.body.data.meta.total).toBeDefined();
            expect(res.body.data.meta.page).toBe(1);
          });
      });

      it('should support pagination', () => {
        return request(app.getHttpServer())
          .get('/api/v1/tokens?page=1&limit=2')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data.length).toBeLessThanOrEqual(2);
            expect(res.body.data.meta.limit).toBe(2);
          });
      });

      it('should filter by status', () => {
        return request(app.getHttpServer())
          .get('/api/v1/tokens?status=TRADING')
          .expect(200)
          .expect((res: any) => {
            res.body.data.data.forEach((token: any) => {
              expect(token.status).toBe('TRADING');
            });
          });
      });
    });

    describe('GET /api/v1/tokens/:address', () => {
      it('should return token by address', async () => {
        const tokens = await prisma.token.findMany({ take: 1 });
        const token = tokens[0];

        return request(app.getHttpServer())
          .get(`/api/v1/tokens/${token.address}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.address).toBe(token.address);
            expect(res.body.data.name).toBe(token.name);
            expect(res.body.data.symbol).toBe(token.symbol);
          });
      });

      it('should return 404 for non-existent token', () => {
        return request(app.getHttpServer())
          .get('/api/v1/tokens/0x0000000000000000000000000000000000000000')
          .expect(404);
      });
    });

    describe('GET /api/v1/tokens/trending', () => {
      it('should return trending tokens', () => {
        return request(app.getHttpServer())
          .get('/api/v1/tokens/trending')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
          });
      });
    });

    describe('GET /api/v1/tokens/new', () => {
      it('should return new tokens', () => {
        return request(app.getHttpServer())
          .get('/api/v1/tokens/new')
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
          });
      });
    });

    describe('GET /api/v1/tokens/:address/trades', () => {
      beforeEach(async () => {
        const tokens = await prisma.token.findMany({ take: 1 });
        const token = tokens[0];

        // Add trades
        const trades = [
          createMockTrade({ tokenAddress: token.address, type: 'BUY' }),
          createMockTrade({ tokenAddress: token.address, type: 'SELL' }),
        ];

        for (const trade of trades) {
          await prisma.trade.create({ data: trade as any });
        }
      });

      it('should return token trades', async () => {
        const tokens = await prisma.token.findMany({ take: 1 });
        const token = tokens[0];

        return request(app.getHttpServer())
          .get(`/api/v1/tokens/${token.address}/trades`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
            expect(res.body.data.data.length).toBeGreaterThan(0);
          });
      });
    });

    describe('GET /api/v1/tokens/:address/holders', () => {
      beforeEach(async () => {
        const tokens = await prisma.token.findMany({ take: 1 });
        const token = tokens[0];

        // Add holders
        await prisma.holder.create({
          data: {
            tokenAddress: token.address,
            holderAddress: testWalletAddress,
            balance: '1000000000000000000',
            firstBuyTimestamp: new Date(),
            lastActivityTimestamp: new Date(),
          },
        });
      });

      it('should return token holders', async () => {
        const tokens = await prisma.token.findMany({ take: 1 });
        const token = tokens[0];

        return request(app.getHttpServer())
          .get(`/api/v1/tokens/${token.address}/holders`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
            expect(res.body.data.data.length).toBeGreaterThan(0);
          });
      });
    });
  });

  describe('Users Endpoints', () => {
    beforeEach(async () => {
      // Create a token and holdings for test user
      const token = createMockToken({ creatorAddress: testWalletAddress });
      await prisma.token.create({ data: token as any });

      await prisma.holder.create({
        data: {
          tokenAddress: token.address,
          holderAddress: testWalletAddress,
          balance: '1000000000000000000',
          firstBuyTimestamp: new Date(),
          lastActivityTimestamp: new Date(),
        },
      });

      const trade = createMockTrade({
        tokenAddress: token.address,
        traderAddress: testWalletAddress,
        type: 'BUY',
      });
      await prisma.trade.create({ data: trade as any });
    });

    describe('GET /api/v1/users/:address', () => {
      it('should return user data', () => {
        return request(app.getHttpServer())
          .get(`/api/v1/users/${testWalletAddress}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data).toBeDefined();
          });
      });
    });

    describe('GET /api/v1/users/:address/holdings', () => {
      it('should return user holdings', () => {
        return request(app.getHttpServer())
          .get(`/api/v1/users/${testWalletAddress}/holdings`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
          });
      });
    });

    describe('GET /api/v1/users/:address/trades', () => {
      it('should return user trades', () => {
        return request(app.getHttpServer())
          .get(`/api/v1/users/${testWalletAddress}/trades`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
          });
      });
    });

    describe('GET /api/v1/users/:address/created-tokens', () => {
      it('should return tokens created by user', () => {
        return request(app.getHttpServer())
          .get(`/api/v1/users/${testWalletAddress}/created-tokens`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data.data).toBeInstanceOf(Array);
            expect(res.body.data.data.length).toBeGreaterThan(0);
          });
      });
    });

    describe('GET /api/v1/users/me/portfolio (protected)', () => {
      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get('/api/v1/users/me/portfolio')
          .expect(401);
      });

      it('should return portfolio with valid token', async () => {
        // Get auth token
        const nonceRes = await request(app.getHttpServer())
          .post('/api/v1/auth/nonce')
          .send({ wallet: testWalletAddress });

        const signature = await testWallet.signMessage(nonceRes.body.data.message);

        const verifyRes = await request(app.getHttpServer())
          .post('/api/v1/auth/verify')
          .send({ wallet: testWalletAddress, signature });

        const { accessToken } = verifyRes.body.data;

        return request(app.getHttpServer())
          .get('/api/v1/users/me/portfolio')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200)
          .expect((res: any) => {
            expect(res.body.data).toBeDefined();
          });
      });

      it('should reject expired/invalid token', () => {
        return request(app.getHttpServer())
          .get('/api/v1/users/me/portfolio')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', () => {
      return request(app.getHttpServer())
        .get('/api/v1/unknown-route')
        .expect(404);
    });

    it('should handle validation errors with proper format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/nonce')
        .send({ wallet: 'not-an-address' })
        .expect(400)
        .expect((res: any) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toBeDefined();
        });
    });

    it('should handle malformed JSON', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/nonce')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });
  });

  describe('Response Format', () => {
    it('should wrap successful responses in standard format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          // Timestamp might be at top level or in data depending on endpoint
          expect(res.body.data || res.body).toHaveProperty('status');
        });
    });

    it('should wrap error responses in standard format', () => {
      return request(app.getHttpServer())
        .get('/api/v1/tokens/0x0000000000000000000000000000000000000000')
        .expect(404)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('success', false);
          expect(res.body).toHaveProperty('error');
        });
    });
  });
});
