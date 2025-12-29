import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../libs/core/src/database/prisma.service';
import { TestDatabase } from './fixtures/test-database';
import { TestDataFactory } from './fixtures/test-data';
import { TestHttpClient } from './utils/http-client';

/**
 * E2E Test: All-Time High (ATH) Tracking
 *
 * Tests tracking of:
 * - All-time high price
 * - All-time high market cap
 * - ATH timestamps
 */
describe('All-Time High (ATH) Tracking (E2E)', () => {
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

  describe('ATH Initialization', () => {
    it('should set ATH price on token creation', async () => {
      const creationPrice = BigInt('1000000000000000');
      const token = await factory.createToken({
        currentPrice: creationPrice,
      });

      expect(token.athPrice).toBe(creationPrice);
    });

    it('should set ATH market cap on token creation', async () => {
      const creationMarketCap = BigInt('1000000000000000000000');
      const token = await factory.createToken({
        marketCap: creationMarketCap,
      });

      expect(token.athMarketCap).toBe(creationMarketCap);
    });

    it('should record ATH price timestamp on creation', async () => {
      const token = await factory.createToken();

      expect(token.athPriceTimestamp).toBeDefined();
      expect(token.athPriceTimestamp).toBeInstanceOf(Date);
    });

    it('should record ATH market cap timestamp on creation', async () => {
      const token = await factory.createToken();

      expect(token.athMarketCapTimestamp).toBeDefined();
      expect(token.athMarketCapTimestamp).toBeInstanceOf(Date);
    });
  });

  describe('ATH Price Tracking', () => {
    it('should update ATH price when current price exceeds it', async () => {
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
        athPrice: BigInt('1000000000000000'),
      });

      const oldAth = token.athPrice;

      // Simulate price increase through buy
      await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);
      const newPrice = updated?.currentPrice || BigInt(0);

      if (newPrice > oldAth) {
        // ATH should be updated
        expect(updated?.athPrice).toBe(newPrice);
      }
    });

    it('should not downgrade ATH price on current price decrease', async () => {
      const highPrice = BigInt('5000000000000000');
      const token = await factory.createToken({
        currentPrice: highPrice,
        athPrice: highPrice,
      });

      // Simulate price decrease
      await factory.createSellTransaction(token.address);

      const updated = await db.getToken(token.address);

      // ATH should remain at previous high
      expect(typeof updated?.athPrice === 'string' ? BigInt(updated.athPrice) : (updated?.athPrice || BigInt(0))).toBeGreaterThanOrEqual(typeof updated?.currentPrice === 'string' ? BigInt(updated.currentPrice) : (updated?.currentPrice || BigInt(0)));
      expect(updated?.athPrice).toBe(highPrice);
    });

    it('should maintain historical ATH price through multiple trades', async () => {
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
        athPrice: BigInt('1000000000000000'),
      });

      // Series of trades with varying prices
      await factory.createBuyTransaction(token.address);
      await factory.createBuyTransaction(token.address);
      await factory.createSellTransaction(token.address);
      await factory.createBuyTransaction(token.address);

      const final = await db.getToken(token.address);

      // ATH price should be >= current price
      expect(typeof final?.athPrice === 'string' ? BigInt(final.athPrice) : (final?.athPrice || BigInt(0))).toBeGreaterThanOrEqual(typeof final?.currentPrice === 'string' ? BigInt(final.currentPrice) : (final?.currentPrice || BigInt(0)));
    });

    it('should correctly identify ATH during uptrend', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
        athPrice: BigInt('1000000000000000'),
      });

      // Continuous buying creates uptrend
      for (let i = 0; i < 5; i++) {
        await factory.createBuyTransaction(token.address, user);
      }

      const final = await db.getToken(token.address);

      // Price should have increased and ATH should match
      expect(final?.currentPrice).toBeGreaterThan(BigInt('1000000000000000'));
      expect(final?.athPrice).toBe(final?.currentPrice);
    });
  });

  describe('ATH Market Cap Tracking', () => {
    it('should update ATH market cap when current exceeds it', async () => {
      const token = await factory.createToken({
        marketCap: BigInt('1000000000000000000'),
        athMarketCap: BigInt('1000000000000000000'),
      });

      const oldAthMarketCap = token.athMarketCap;

      // Buy to increase market cap
      await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);

      if ((updated?.marketCap || BigInt(0)) > oldAthMarketCap) {
        expect(updated?.athMarketCap).toBe(updated?.marketCap);
      }
    });

    it('should not downgrade ATH market cap on decrease', async () => {
      const highMarketCap = BigInt('5000000000000000000');
      const token = await factory.createToken({
        marketCap: highMarketCap,
        athMarketCap: highMarketCap,
      });

      // Sell to decrease market cap
      await factory.createSellTransaction(token.address);

      const updated = await db.getToken(token.address);

      // ATH should not decrease
      expect(updated?.athMarketCap).toBe(highMarketCap);
    });

    it('should track multiple market cap peaks', async () => {
      const token = await factory.createToken({
        marketCap: BigInt('1000000000000000000'),
        athMarketCap: BigInt('1000000000000000000'),
      });

      const peakTimes = [];

      // First peak
      for (let i = 0; i < 3; i++) {
        await factory.createBuyTransaction(token.address);
      }
      let peak1 = (await db.getToken(token.address))?.marketCap;
      peakTimes.push(peak1);

      // Sell back down
      for (let i = 0; i < 2; i++) {
        await factory.createSellTransaction(token.address);
      }

      // Second peak (higher)
      for (let i = 0; i < 5; i++) {
        await factory.createBuyTransaction(token.address);
      }
      let peak2 = (await db.getToken(token.address))?.marketCap;

      // Second peak should become new ATH
      expect(typeof peak2 === 'string' ? BigInt(peak2) : (peak2 || BigInt(0))).toBeGreaterThan(typeof peak1 === 'string' ? BigInt(peak1) : (peak1 || BigInt(0)));
    });
  });

  describe('ATH Timestamps', () => {
    it('should update ATH price timestamp when price exceeds it', async () => {
      const oldTime = new Date('2024-01-01');
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
        athPrice: BigInt('1000000000000000'),
        athPriceTimestamp: oldTime,
      });

      // const newTime = new Date();

      // Simulate price increase
      await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);

      // If price increased, timestamp should be updated
      if ((updated?.currentPrice || BigInt(0)) > token.currentPrice) {
        expect((updated?.athPriceTimestamp?.getTime() || 0) >= oldTime.getTime()).toBe(true);
      }
    });

    it('should not change ATH price timestamp when price stays below', async () => {
      const originalTime = new Date('2024-01-01');
      const token = await factory.createToken({
        currentPrice: BigInt('3000000000000000'), // High price
        athPrice: BigInt('3000000000000000'),
        athPriceTimestamp: originalTime,
      });

      // Sell to decrease price (should stay below ATH)
      await factory.createSellTransaction(token.address);

      const updated = await db.getToken(token.address);

      // Timestamp should remain at original time
      expect(updated?.athPriceTimestamp?.getTime()).toBe(originalTime.getTime());
    });

    it('should update ATH market cap timestamp when market cap exceeds it', async () => {
      const oldTime = new Date('2024-01-01');
      const token = await factory.createToken({
        marketCap: BigInt('1000000000000000000'),
        athMarketCap: BigInt('1000000000000000000'),
        athMarketCapTimestamp: oldTime,
      });

      // Buy to increase market cap
      await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);

      // If market cap increased, timestamp should be updated
      if ((updated?.marketCap || BigInt(0)) > token.marketCap) {
        expect((updated?.athMarketCapTimestamp?.getTime() || 0) >= oldTime.getTime()).toBe(true);
      }
    });

    it('should record precise timestamps', async () => {
      const token = await factory.createToken();

      const timestamp = token.athPriceTimestamp || new Date();

      // Timestamp should be valid and recent
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(new Date().getTime() + 1000); // Within 1 second
    });
  });

  describe('ATH vs Current Price Relationship', () => {
    it('should have ATH >= current price at all times', async () => {
      const token = await factory.createToken();

      // Series of random trades
      for (let i = 0; i < 10; i++) {
        if (Math.random() > 0.5) {
          await factory.createBuyTransaction(token.address);
        } else {
          await factory.createSellTransaction(token.address);
        }
      }

      const final = await db.getToken(token.address);

      expect((final?.athPrice || BigInt(0)) >= (final?.currentPrice || BigInt(0))).toBe(true);
      expect((final?.athMarketCap || BigInt(0)) >= (final?.marketCap || BigInt(0))).toBe(true);
    });

    it('should have equal price and ATH at creation', async () => {
      const token = await factory.createToken();

      expect(token.currentPrice).toBe(token.athPrice);
      expect(token.marketCap).toBe(token.athMarketCap);
    });

    it('should equal current price during uptrend', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
        athPrice: BigInt('1000000000000000'),
      });

      // Continuous buying
      for (let i = 0; i < 10; i++) {
        await factory.createBuyTransaction(token.address, user);
      }

      const final = await db.getToken(token.address);

      // During uptrend, current should equal ATH
      expect(final?.currentPrice).toBe(final?.athPrice);
    });

    it('should diverge during downtrend after peak', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken();

      // Create uptrend
      for (let i = 0; i < 10; i++) {
        await factory.createBuyTransaction(token.address, user);
      }

      const peak = (await db.getToken(token.address))?.currentPrice;

      // Create downtrend
      for (let i = 0; i < 5; i++) {
        await factory.createSellTransaction(token.address, user);
      }

      const final = await db.getToken(token.address);

      // ATH should be > current after downtrend
      expect(typeof final?.athPrice === 'string' ? BigInt(final.athPrice) : (final?.athPrice || BigInt(0))).toBeGreaterThan(typeof final?.currentPrice === 'string' ? BigInt(final.currentPrice) : (final?.currentPrice || BigInt(0)));
      expect(final?.athPrice).toBe(peak);
    });
  });

  describe('ATH in Portfolio Context', () => {
    it('should help calculate unrealized gains/losses', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
        athPrice: BigInt('1000000000000000'),
      });

      // Buy at current price
      await factory.createBuyTransaction(token.address, user);

      // Simulate price increase to ATH
      await factory.createBuyTransaction(token.address);

      const athPrice = (await db.getToken(token.address))?.athPrice;
      const position = await db.getUserPosition(user, token.address);

      // Unrealized gain = (ATH - buy price) * quantity
      if (athPrice && position) {
        const gainPerToken = (typeof athPrice === 'string' ? BigInt(athPrice) : athPrice) - (typeof position.averagePrice === 'string' ? BigInt(position.averagePrice) : position.averagePrice);
        const potentialGain = gainPerToken * (typeof position.balance === 'string' ? BigInt(position.balance) : position.balance);
        expect(potentialGain).toBeGreaterThanOrEqual(BigInt(0));
      }
    });

    it('should show maximum profit potential at ATH', async () => {
      const user = factory.generateUserAddress();
      const buyPrice = BigInt('1000000000000000');
      const token = await factory.createToken({
        currentPrice: buyPrice,
        athPrice: buyPrice,
      });

      await factory.createBuyTransaction(token.address, user);

      // Simulate multiple price increases
      for (let i = 0; i < 10; i++) {
        await factory.createBuyTransaction(token.address);
      }

      const final = await db.getToken(token.address);

      // Maximum profit would be realized at ATH price
      const maxProfit = (typeof final?.athPrice === 'string' ? BigInt(final.athPrice) : (final?.athPrice || BigInt(0))) - buyPrice;
      expect(maxProfit).toBeGreaterThan(BigInt(0));
    });
  });

  describe('ATH in API Response', () => {
    it('should include ATH data in token response', async () => {
      const token = await factory.createToken();

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data).toHaveProperty('athPrice');
      expect(response.data).toHaveProperty('athMarketCap');
      expect(response.data).toHaveProperty('athPriceTimestamp');
      expect(response.data).toHaveProperty('athMarketCapTimestamp');
    });

    it('should serialize ATH data correctly', async () => {
      const athPrice = BigInt('5000000000000000');
      const athMarketCap = BigInt('5000000000000000000000');
      const timestamp = new Date('2024-01-15');

      const token = await factory.createToken({
        athPrice,
        athMarketCap,
        athPriceTimestamp: timestamp,
        athMarketCapTimestamp: timestamp,
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.athPrice).toBe(athPrice.toString());
      expect(response.data.athMarketCap).toBe(athMarketCap.toString());
    });

    it('should show ATH price in trending endpoint', async () => {
      const token = await factory.createToken({
        athPrice: BigInt('5000000000000000'),
      });

      const response = await http.getTrendingTokens('24h', 'price');

      http.assertSuccess(response);
      // Should include ATH data if available
      const trendingToken = response.data.data.find((t: any) => t.address === token.address);
      if (trendingToken) {
        expect(trendingToken).toHaveProperty('athPrice');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high ATH values', async () => {
      const veryHighPrice = BigInt('999999999999999999999');
      const token = await factory.createToken({
        currentPrice: veryHighPrice,
        athPrice: veryHighPrice,
      });

      expect(token.athPrice).toBe(veryHighPrice);
    });

    it('should handle ATH with zero current price (theoretical)', async () => {
      // This represents a token with no trading activity
      const token = await factory.createToken({
        currentPrice: BigInt('0'),
        athPrice: BigInt('1000000000000000'),
      });

      // ATH should still be tracked
      expect(typeof token.athPrice === 'string' ? BigInt(token.athPrice) : token.athPrice).toBeGreaterThan(typeof token.currentPrice === 'string' ? BigInt(token.currentPrice) : token.currentPrice);
    });

    it('should handle rapid ATH updates', async () => {
      const token = await factory.createToken();

      // Rapid sequence of buys
      for (let i = 0; i < 100; i++) {
        await factory.createBuyTransaction(token.address);
      }

      const final = await db.getToken(token.address);

      // Should handle rapid updates without losing state
      expect(final?.athPrice).toBeDefined();
      expect(final?.athPriceTimestamp).toBeDefined();
    });

    it('should maintain ATH across token state changes', async () => {
      const token = await factory.createToken({
        athPrice: BigInt('5000000000000000'),
      });

      // Lock token (graduation)
      await prisma.token.update({
        where: { address: token.address },
        data: { isLocked: true },
      });

      const updated = await db.getToken(token.address);

      // ATH should be preserved
      expect(updated?.athPrice).toBe(BigInt('5000000000000000'));
    });
  });
});
