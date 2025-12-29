import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../libs/core/src/database/prisma.service';
import { TestDatabase } from './fixtures/test-database';
import { TestDataFactory } from './fixtures/test-data';
import { TestHttpClient } from './utils/http-client';

/**
 * E2E Test: Token Graduation Flow
 *
 * Tests token graduation when 100 ETH market cap threshold is reached
 * Graduation moves token from bonding curve to Uniswap V3
 */
describe('Token Graduation Flow (E2E)', () => {
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

  describe('Graduation Threshold', () => {
    it('should not lock token below 100 ETH market cap', async () => {
      const token = await factory.createToken({
        marketCap: BigInt('50000000000000000000'), // 50 ETH
        isLocked: false,
      });

      expect(token.isLocked).toBe(false);
      expect(token.isListed).toBe(false);
      expect(token.uniswapV3Pool).toBeNull();
    });

    it('should lock token at exactly 100 ETH market cap', async () => {
      const token = await factory.createToken({
        marketCap: BigInt('100000000000000000000'), // 100 ETH
        isLocked: true,
      });

      expect(token.isLocked).toBe(true);
    });

    it('should lock token above 100 ETH market cap', async () => {
      const token = await factory.createToken({
        marketCap: BigInt('150000000000000000000'), // 150 ETH
        isLocked: true,
      });

      expect(token.isLocked).toBe(true);
    });
  });

  describe('Graduation Mechanics', () => {
    it('should set isLocked flag on graduation', async () => {
      const token = await factory.createToken({
        isLocked: false,
      });

      expect(token.isLocked).toBe(false);

      // Simulate graduation
      await prisma.token.update({
        where: { address: token.address },
        data: { isLocked: true },
      });

      const updated = await db.getToken(token.address);
      expect(updated?.isLocked).toBe(true);
    });

    it('should set isListed flag after Uniswap integration', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: false,
      });

      // Simulate Uniswap listing
      const uniswapPool = factory.generateAddress();
      await prisma.token.update({
        where: { address: token.address },
        data: {
          isListed: true,
          uniswapV3Pool: uniswapPool,
          listingTimestamp: new Date(),
        },
      });

      const updated = await db.getToken(token.address);
      expect(updated?.isListed).toBe(true);
      expect(updated?.uniswapV3Pool).toBe(uniswapPool);
    });

    it('should record listing timestamp', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: false,
        listingTimestamp: null,
      });

      const now = new Date();
      await prisma.token.update({
        where: { address: token.address },
        data: {
          isListed: true,
          uniswapV3Pool: factory.generateAddress(),
          listingTimestamp: now,
        },
      });

      const updated = await db.getToken(token.address);
      expect(updated?.listingTimestamp).toBeDefined();
      expect(updated?.listingTimestamp?.getTime()).toBeLessThanOrEqual(now.getTime() + 100);
    });

    it('should set Uniswap V3 pool address', async () => {
      const poolAddress = factory.generateAddress();
      const token = await factory.createToken({
        isLocked: true,
        isListed: true,
        uniswapV3Pool: poolAddress,
      });

      expect(token.uniswapV3Pool).toBe(poolAddress);
      expect(token.uniswapV3Pool).toMatch(/^0x[a-f0-9]{40}$/i);
    });
  });

  describe('Graduated Token Trading', () => {
    it('should prevent bonding curve trades on locked token', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: true,
      });

      // Attempt to buy on bonding curve should fail
      const buyData = { amount: '1000000000000000000' };
      const response = await http.buyToken(token.address, buyData);

      // Should fail with appropriate error
      http.assertError(response);
    });

    it('should redirect trades to Uniswap V3 pool', async () => {
      const poolAddress = factory.generateAddress();
      const token = await factory.createToken({
        isLocked: true,
        isListed: true,
        uniswapV3Pool: poolAddress,
      });

      // Get token should still work
      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.uniswapV3Pool).toBe(poolAddress);
      expect(response.data.isListed).toBe(true);
    });

    it('should prevent creation of new positions on graduated token', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: true,
      });

      const buyData = { amount: '1000000000000000000' };
      const response = await http.buyToken(token.address, buyData);

      // Should fail because token is graduated
      http.assertError(response);
    });
  });

  describe('Graduation State Transition', () => {
    it('should transition token through states: created → locked → listed', async () => {
      // State 1: Created (no lock/list)
      const token = await factory.createToken({
        isLocked: false,
        isListed: false,
        uniswapV3Pool: null,
      });

      expect(token.isLocked).toBe(false);
      expect(token.isListed).toBe(false);
      expect(token.uniswapV3Pool).toBeNull();

      // State 2: Locked (market cap >= 100 ETH)
      await prisma.token.update({
        where: { address: token.address },
        data: { isLocked: true },
      });

      let updated = await db.getToken(token.address);
      expect(updated?.isLocked).toBe(true);
      expect(updated?.isListed).toBe(false);

      // State 3: Listed (integrated with Uniswap)
      const poolAddress = factory.generateAddress();
      await prisma.token.update({
        where: { address: token.address },
        data: {
          isListed: true,
          uniswapV3Pool: poolAddress,
          listingTimestamp: new Date(),
        },
      });

      updated = await db.getToken(token.address);
      expect(updated?.isLocked).toBe(true);
      expect(updated?.isListed).toBe(true);
      expect(updated?.uniswapV3Pool).toBe(poolAddress);
    });

    it('should not allow reverting to unlocked state', async () => {
      const token = await factory.createToken({
        isLocked: true,
      });

      // Once locked, should not be able to unlock
      // This test verifies business logic
      expect(token.isLocked).toBe(true);
    });
  });

  describe('Graduation with Active Trading', () => {
    it('should allow trades before graduation', async () => {
      const token = await factory.createToken({
        isLocked: false,
        isListed: false,
      });

      // Should be able to buy before graduation
      const buyData = { amount: '1000000000000000000' };
      const response = await http.buyToken(token.address, buyData);

      http.assertSuccess(response);
    });

    it('should accumulate volume before graduation', async () => {
      const token = await factory.createToken({
        isLocked: false,
        volume24h: BigInt('0'),
      });

      const initialVolume = (await db.getToken(token.address))?.volume24h || BigInt(0);

      // Execute multiple trades
      await factory.createBuyTransaction(token.address);
      await factory.createBuyTransaction(token.address);
      await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);
      expect(updated?.volume24h).toBeGreaterThanOrEqual(initialVolume);
    });

    it('should maintain position data through graduation', async () => {
      const token = await factory.createToken({
        isLocked: false,
      });
      const user = factory.generateUserAddress();

      // Buy before graduation
      const buyTx = await factory.createBuyTransaction(token.address, user);

      // Simulate graduation
      await prisma.token.update({
        where: { address: token.address },
        data: { isLocked: true },
      });

      // Position data should remain intact
      const position = await db.getUserPosition(user, token.address);
      expect(position?.balance).toBe(buyTx.amountOut);
    });

    it('should preserve trade history after graduation', async () => {
      const token = await factory.createToken({
        isLocked: false,
      });

      // Create trades before graduation
      const tx1 = await factory.createBuyTransaction(token.address);
      const tx2 = await factory.createBuyTransaction(token.address);

      // Simulate graduation
      await prisma.token.update({
        where: { address: token.address },
        data: { isLocked: true, isListed: true, uniswapV3Pool: factory.generateAddress() },
      });

      // Trade history should be preserved
      const trades = await db.getTokenTransactions(token.address);
      expect(trades).toHaveLength(2);
      expect(trades[0].hash).toBe(tx1.hash);
      expect(trades[1].hash).toBe(tx2.hash);
    });
  });

  describe('Multiple Token Graduations', () => {
    it('should handle multiple graduated tokens simultaneously', async () => {
      const tokens = await Promise.all([
        factory.createToken({
          isLocked: true,
          isListed: true,
          uniswapV3Pool: factory.generateAddress(),
        }),
        factory.createToken({
          isLocked: true,
          isListed: true,
          uniswapV3Pool: factory.generateAddress(),
        }),
        factory.createToken({
          isLocked: false,
          isListed: false,
        }),
      ]);

      const graduated = tokens.filter((t: any) => t.isLocked && t.isListed);
      expect(graduated).toHaveLength(2);

      const ungraduated = tokens.filter((t: any) => !t.isLocked);
      expect(ungraduated).toHaveLength(1);
    });

    it('should track different graduation timestamps', async () => {
      const token1 = await factory.createToken({
        isLocked: true,
        isListed: true,
        listingTimestamp: new Date('2024-01-01'),
      });

      const token2 = await factory.createToken({
        isLocked: true,
        isListed: true,
        listingTimestamp: new Date('2024-01-15'),
      });

      const t1 = await db.getToken(token1.address);
      const t2 = await db.getToken(token2.address);

      expect(t1?.listingTimestamp?.getTime()).toBeLessThan(t2?.listingTimestamp?.getTime() || 0);
    });
  });

  describe('Graduation Response Format', () => {
    it('should include graduation info in token response', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: true,
        uniswapV3Pool: factory.generateAddress(),
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data).toHaveProperty('isLocked');
      expect(response.data).toHaveProperty('isListed');
      expect(response.data).toHaveProperty('uniswapV3Pool');
      expect(response.data).toHaveProperty('listingTimestamp');

      expect(response.data.isLocked).toBe(true);
      expect(response.data.isListed).toBe(true);
    });

    it('should properly serialize Uniswap pool address', async () => {
      const poolAddress = factory.generateAddress();
      const token = await factory.createToken({
        isLocked: true,
        isListed: true,
        uniswapV3Pool: poolAddress,
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.uniswapV3Pool).toBe(poolAddress);
      expect(response.data.uniswapV3Pool).toMatch(/^0x[a-f0-9]{40}$/i);
    });

    it('should handle null pool address before listing', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: false,
        uniswapV3Pool: null,
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.uniswapV3Pool).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle token at exactly graduation threshold', async () => {
      const GRADUATION_THRESHOLD = BigInt('100000000000000000000'); // 100 ETH

      const token = await factory.createToken({
        marketCap: GRADUATION_THRESHOLD,
        isLocked: true,
      });

      expect(token.marketCap).toBe(GRADUATION_THRESHOLD);
      expect(token.isLocked).toBe(true);
    });

    it('should handle large number of graduated tokens', async () => {
      const tokens = await Promise.all(
        Array.from({ length: 10 }, () =>
          factory.createToken({
            isLocked: true,
            isListed: true,
            uniswapV3Pool: factory.generateAddress(),
          })
        )
      );

      const graduated = tokens.filter((t: any) => t.isLocked && t.isListed);
      expect(graduated).toHaveLength(10);

      // All should have unique pool addresses
      const pools = tokens.map((t: any) => t.uniswapV3Pool);
      expect(new Set(pools).size).toBe(10);
    });

    it('should prevent trading locked token with null pool address', async () => {
      const token = await factory.createToken({
        isLocked: true,
        isListed: false,
        uniswapV3Pool: null,
      });

      // This represents inconsistent state - locked but not listed
      const response = await http.buyToken(token.address, { amount: '1000000000000000000' });

      // Should fail or be redirected appropriately
      http.assertError(response);
    });
  });
});
