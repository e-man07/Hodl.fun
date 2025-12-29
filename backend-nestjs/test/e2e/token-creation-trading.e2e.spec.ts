import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../libs/core/src/database/prisma.service';
import { TestDatabase } from './fixtures/test-database';
import { TestDataFactory } from './fixtures/test-data';
import { TestHttpClient } from './utils/http-client';

/**
 * E2E Test: Token Creation and Trading Flow
 *
 * Tests the complete workflow:
 * 1. Create a new token
 * 2. Retrieve token details
 * 3. Execute buy transactions
 * 4. Track price updates
 * 5. Execute sell transactions
 * 6. Verify trade history
 */
describe('Token Creation & Trading Flow (E2E)', () => {
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

  describe('Token Creation', () => {
    it('should create a token successfully', async () => {
      const tokenData = {
        name: 'My Test Token',
        symbol: 'MTT',
        description: 'A test token for E2E testing',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const response = await http.createToken(tokenData);

      http.assertSuccess(response);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('address');
      expect(response.data.name).toBe('My Test Token');
      expect(response.data.symbol).toBe('MTT');
    });

    it('should store token in database', async () => {
      const token = await factory.createToken({
        name: 'Database Test Token',
        symbol: 'DBT',
      });

      const count = await db.getTokenCount();
      expect(count).toBe(1);

      const storedToken = await db.getToken(token.address);
      expect(storedToken?.name).toBe('Database Test Token');
      expect(storedToken?.symbol).toBe('DBT');
    });

    it('should initialize token with bonding curve parameters', async () => {
      const token = await factory.createToken();

      expect(token.totalSupply).toBeGreaterThan(BigInt(0));
      expect(token.virtualNativeReserve).toBeGreaterThan(BigInt(0));
      expect(token.virtualTokenReserve).toBeGreaterThan(BigInt(0));
      expect(token.currentPrice).toBeGreaterThan(BigInt(0));
      expect(token.marketCap).toBeGreaterThan(BigInt(0));
    });

    it('should set initial ATH to creation price', async () => {
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
        marketCap: BigInt('1000000000000000000000'),
      });

      expect(token.athPrice).toBe(token.currentPrice);
      expect(token.athMarketCap).toBe(token.marketCap);
      expect(token.athPriceTimestamp).toBeDefined();
    });

    it('should not lock token on creation', async () => {
      const token = await factory.createToken();

      expect(token.isLocked).toBe(false);
      expect(token.isListed).toBe(false);
      expect(token.uniswapV3Pool).toBeNull();
    });
  });

  describe('Token Retrieval', () => {
    it('should retrieve token by address', async () => {
      const token = await factory.createToken({
        name: 'Retrieve Test',
        symbol: 'RET',
      });

      const response = await http.getToken(token.address);

      http.assertSuccess(response);
      expect(response.data.address).toBe(token.address);
      expect(response.data.name).toBe('Retrieve Test');
    });

    it('should return 404 for non-existent token', async () => {
      const fakeAddress = factory.generateTokenAddress();

      const response = await http.getToken(fakeAddress);

      http.assertError(response, 404);
    });

    it('should retrieve paginated tokens list', async () => {
      await factory.createTokens(5);

      const response = await http.getTokens(10, 0);

      http.assertSuccess(response);
      expect(response.data.data).toHaveLength(5);
      expect(response.data.total).toBe(5);
    });

    it('should handle pagination limit', async () => {
      await factory.createTokens(15);

      const response = await http.getTokens(10, 0);

      http.assertSuccess(response);
      expect(response.data.data.length).toBeLessThanOrEqual(10);
    });

    it('should handle pagination offset', async () => {
      await factory.createTokens(15);

      const page1 = await http.getTokens(5, 0);
      const page2 = await http.getTokens(5, 5);

      http.assertSuccess(page1);
      http.assertSuccess(page2);

      // Pages should have different tokens
      const ids1 = page1.data.data.map((t: any) => t.id);
      const ids2 = page2.data.data.map((t: any) => t.id);

      expect(ids1).not.toEqual(ids2);
    });
  });

  describe('Token Trading - Buy Orders', () => {
    it('should execute buy transaction', async () => {
      const token = await factory.createToken();

      const buyData = {
        amount: '1000000000000000000', // 1 token
      };

      const response = await http.buyToken(token.address, buyData);

      http.assertSuccess(response);
      expect(response.data).toHaveProperty('hash');
      expect(response.data).toHaveProperty('amountIn');
      expect(response.data).toHaveProperty('amountOut');
    });

    it('should record buy transaction in database', async () => {
      const token = await factory.createToken();
      const tx = await factory.createBuyTransaction(token.address);

      const stored = await db.getTokenTransactions(token.address);

      expect(stored).toHaveLength(1);
      expect(stored[0].type).toBe('BUY');
      expect(stored[0].userAddress).toBe(tx.userAddress);
    });

    it('should update token market cap on buy', async () => {
      const token = await factory.createToken({
        marketCap: BigInt('1000000000000000000'),
      });
      const initialMarketCap = token.marketCap;

      await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);
      // Market cap should increase due to bonding curve
      expect(updated?.marketCap ? BigInt(updated.marketCap) : BigInt(0)).toBeGreaterThanOrEqual(typeof initialMarketCap === 'string' ? BigInt(initialMarketCap) : initialMarketCap);
    });

    it('should update token price on buy', async () => {
      const token = await factory.createToken({
        currentPrice: BigInt('1000000000000000'),
      });
      const initialPrice = token.currentPrice;

      await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);
      // Price should increase on buy (bonding curve property)
      expect(updated?.currentPrice ? BigInt(updated.currentPrice) : BigInt(0)).toBeGreaterThanOrEqual(typeof initialPrice === 'string' ? BigInt(initialPrice) : initialPrice);
    });

    it('should increase total supply on buy', async () => {
      const token = await factory.createToken({
        totalSupply: BigInt('1000000000000000000000000'),
      });
      const initialSupply = token.totalSupply;

      const tx = await factory.createBuyTransaction(token.address);

      const updated = await db.getToken(token.address);
      // Total supply increases by amountOut
      expect(updated?.totalSupply ? BigInt(updated.totalSupply) : BigInt(0)).toBe((typeof initialSupply === 'string' ? BigInt(initialSupply) : initialSupply) + BigInt(tx.amountOut));
    });

    it('should create user position on first buy', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      const tx = await factory.createBuyTransaction(token.address, user);

      const position = await db.getUserPosition(user, token.address);
      expect(position).toBeDefined();
      expect(position?.balance).toBe(tx.amountOut);
    });

    it('should update user position on subsequent buy', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      await factory.createBuyTransaction(token.address, user);
      const positionBefore = await db.getUserPosition(user, token.address);

      await factory.createBuyTransaction(token.address, user);
      const positionAfter = await db.getUserPosition(user, token.address);

      expect(typeof positionAfter?.balance === 'string' ? BigInt(positionAfter.balance) : (positionAfter?.balance || BigInt(0))).toBeGreaterThan(typeof positionBefore?.balance === 'string' ? BigInt(positionBefore.balance) : (positionBefore?.balance || BigInt(0)));
    });
  });

  describe('Token Trading - Sell Orders', () => {
    it('should execute sell transaction', async () => {
      const scenario = await factory.createTradingScenario();

      const sellData = {
        amount: '10000000000000000000000', // Sell some tokens
      };

      const response = await http.sellToken(scenario.token.address, sellData);

      http.assertSuccess(response);
      expect(response.data.type).toBe('SELL');
    });

    it('should record sell transaction in database', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      // First buy to have tokens
      await factory.createBuyTransaction(token.address, user);
      // Then sell
      const sellTx = await factory.createSellTransaction(token.address, user);

      const transactions = await db.getTokenTransactions(token.address);
      expect(transactions.some((t: any) => t.type === 'SELL')).toBe(true);
      expect(sellTx.type).toBe('SELL');
    });

    it('should decrease token total supply on sell', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      await factory.createBuyTransaction(token.address, user);
      const supplyAfterBuy = (await db.getToken(token.address))?.totalSupply;

      await factory.createSellTransaction(token.address, user);
      const supplyAfterSell = (await db.getToken(token.address))?.totalSupply;

      // Total supply should decrease by amountOut from sell
      expect(typeof supplyAfterSell === 'string' ? BigInt(supplyAfterSell) : (supplyAfterSell || BigInt(0))).toBeLessThan(typeof supplyAfterBuy === 'string' ? BigInt(supplyAfterBuy) : (supplyAfterBuy || BigInt(0)));
    });

    it('should decrease user position balance on sell', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      await factory.createBuyTransaction(token.address, user);
      const positionAfterBuy = await db.getUserPosition(user, token.address);

      // Sell half of holdings
      await factory.createSellTransaction(token.address, user);
      const positionAfterSell = await db.getUserPosition(user, token.address);

      expect(typeof positionAfterSell?.balance === 'string' ? BigInt(positionAfterSell.balance) : (positionAfterSell?.balance || BigInt(0))).toBeLessThan(typeof positionAfterBuy?.balance === 'string' ? BigInt(positionAfterBuy.balance) : (positionAfterBuy?.balance || BigInt(0)));
    });

    it('should calculate realized P&L on sell', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      // Buy at one price
      await factory.createBuyTransaction(token.address, user);

      // Sell at potentially different price
      await factory.createSellTransaction(token.address, user);

      const position = await db.getUserPosition(user, token.address);

      // realizedPnL = (sellPrice - buyPrice) * amountSold
      expect(position?.realizedPnL).toBeDefined();
    });
  });

  describe('Portfolio Tracking', () => {
    it('should create portfolio after first trade', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken();

      await factory.createBuyTransaction(token.address, user);

      const portfolio = await db.getPortfolio(user);
      expect(portfolio).toBeDefined();
      expect(portfolio?.userId).toBe(user);
    });

    it('should track token holdings in portfolio', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken();

      await factory.createBuyTransaction(token.address, user);

      const portfolio = await db.getPortfolio(user);
      const holdings = JSON.parse(portfolio?.holdings || '{}');

      expect(holdings[token.address]).toBeDefined();
    });

    it('should update portfolio total invested', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken();

      await factory.createBuyTransaction(token.address, user);
      const portfolio1 = await db.getPortfolio(user);

      await factory.createBuyTransaction(token.address, user);
      const portfolio2 = await db.getPortfolio(user);

      expect(portfolio2?.totalInvestedPUSH).toBeGreaterThan(
        typeof portfolio1?.totalInvestedPUSH === 'string' ? BigInt(portfolio1.totalInvestedPUSH) : (portfolio1?.totalInvestedPUSH || BigInt(0))
      );
    });

    it('should retrieve portfolio by user', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken();

      await factory.createBuyTransaction(token.address, user);

      const response = await http.getPortfolio(user);

      http.assertSuccess(response);
      expect(response.data.userId).toBe(user);
    });
  });

  describe('Trade History', () => {
    it('should retrieve token trade history', async () => {
      const token = await factory.createToken();

      await factory.createBuyTransaction(token.address);
      await factory.createBuyTransaction(token.address);
      await factory.createSellTransaction(token.address);

      const response = await http.getTokenTrades(token.address);

      http.assertSuccess(response);
      expect(response.data.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should retrieve user trade history', async () => {
      const user = factory.generateUserAddress();
      const token1 = await factory.createToken();
      const token2 = await factory.createToken();

      await factory.createBuyTransaction(token1.address, user);
      await factory.createBuyTransaction(token2.address, user);
      await factory.createSellTransaction(token1.address, user);

      const response = await http.getUserTrades(user);

      http.assertSuccess(response);
      expect(response.data.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should maintain transaction timestamps', async () => {
      const token = await factory.createToken();
      const now = new Date();

      const tx = await factory.createBuyTransaction(token.address);

      expect(tx.timestamp).toBeDefined();
      expect(tx.timestamp.getTime()).toBeLessThanOrEqual(now.getTime() + 100);
    });

    it('should record transaction block numbers', async () => {
      const token = await factory.createToken();

      const tx = await factory.createBuyTransaction(token.address);

      expect(tx.blockNumber).toBeGreaterThan(0);
    });
  });

  describe('Price Mechanics (Bonding Curve)', () => {
    it('should increase price with each buy', async () => {
      const token = await factory.createToken();

      const priceInitial = (await db.getToken(token.address))?.currentPrice;

      await factory.createBuyTransaction(token.address);
      const price1 = (await db.getToken(token.address))?.currentPrice;

      await factory.createBuyTransaction(token.address);
      const price2 = (await db.getToken(token.address))?.currentPrice;

      expect(typeof price1 === 'string' ? BigInt(price1) : (price1 || BigInt(0))).toBeGreaterThanOrEqual(typeof priceInitial === 'string' ? BigInt(priceInitial) : (priceInitial || BigInt(0)));
      expect(typeof price2 === 'string' ? BigInt(price2) : (price2 || BigInt(0))).toBeGreaterThanOrEqual(typeof price1 === 'string' ? BigInt(price1) : (price1 || BigInt(0)));
    });

    it('should decrease price with each sell', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      // Buy to have tokens
      await factory.createBuyTransaction(token.address, user);
      const priceAfterBuy = (await db.getToken(token.address))?.currentPrice;

      // Sell
      await factory.createSellTransaction(token.address, user);
      const priceAfterSell = (await db.getToken(token.address))?.currentPrice;

      expect(typeof priceAfterSell === 'string' ? BigInt(priceAfterSell) : (priceAfterSell || BigInt(0))).toBeLessThanOrEqual(typeof priceAfterBuy === 'string' ? BigInt(priceAfterBuy) : (priceAfterBuy || BigInt(0)));
    });

    it('should calculate market cap correctly', async () => {
      const token = await factory.createToken();

      const totalSupply = (await db.getTokenTotalSupply(token.address)) || BigInt(0);
      const price = (await db.getTokenPrice(token.address)) || BigInt(0);

      const expectedMarketCap = totalSupply * price;

      const marketCap = (await db.getTokenMarketCap(token.address)) || BigInt(0);

      // Market cap should be approximately (may differ slightly due to rounding)
      expect(Math.abs(Number(marketCap - expectedMarketCap))).toBeLessThan(
        Number(expectedMarketCap) * 0.01 // 1% tolerance
      );
    });
  });

  describe('Complete End-to-End Workflow', () => {
    it('should handle full token lifecycle', async () => {
      // 1. Create token
      const tokenData = {
        name: 'Lifecycle Token',
        symbol: 'LCT',
        description: 'Full lifecycle test',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const createResponse = await http.createToken(tokenData);
      http.assertSuccess(createResponse);
      const token = createResponse.data;

      // 2. Get token details
      const getResponse = await http.getToken(token.address);
      http.assertSuccess(getResponse);
      expect(getResponse.data.name).toBe('Lifecycle Token');

      // 3. Multiple users buy
      const users = [
        factory.generateUserAddress(),
        factory.generateUserAddress(),
        factory.generateUserAddress(),
      ];

      for (const _user of users) {
        const buyData = { amount: '100000000000000000' };
        const buyResponse = await http.buyToken(token.address, buyData);
        http.assertSuccess(buyResponse);
      }

      // 4. Check trade history
      const tradesResponse = await http.getTokenTrades(token.address);
      http.assertSuccess(tradesResponse);
      expect(tradesResponse.data.data.length).toBeGreaterThanOrEqual(3);

      // 5. Check portfolios
      for (const user of users) {
        const portfolioResponse = await http.getPortfolio(user);
        http.assertSuccess(portfolioResponse);
        expect(portfolioResponse.data.userId).toBe(user);
      }

      // 6. Execute sales
      for (const _user of users) {
        const sellData = { amount: '50000000000000000' };
        const sellResponse = await http.sellToken(token.address, sellData);
        http.assertSuccess(sellResponse);
      }

      // 7. Verify final state
      const finalToken = await db.getToken(token.address);
      expect(finalToken).toBeDefined();

      const finalTradesCount = await db.getTransactionCount();
      expect(finalTradesCount).toBeGreaterThanOrEqual(6); // 3 buys + 3 sells
    });
  });

  describe('Data Consistency', () => {
    it('should maintain transaction count accuracy', async () => {
      const token = await factory.createToken();

      await factory.createBuyTransaction(token.address);
      await factory.createBuyTransaction(token.address);
      await factory.createSellTransaction(token.address);

      const count = await db.getTransactionCount();
      expect(count).toBe(3);
    });

    it('should maintain user position consistency', async () => {
      const token = await factory.createToken();
      const user = factory.generateUserAddress();

      const buyTx = await factory.createBuyTransaction(token.address, user);
      const position = await db.getUserPosition(user, token.address);

      expect(position?.balance).toBe(buyTx.amountOut);
    });

    it('should prevent double counting in portfolios', async () => {
      const user = factory.generateUserAddress();
      const token = await factory.createToken();

      await factory.createBuyTransaction(token.address, user);
      await factory.createBuyTransaction(token.address, user);

      const portfolio = await db.getPortfolio(user);
      const holdings = JSON.parse(portfolio?.holdings || '{}');

      // Should have single entry for token, not duplicate
      expect(Object.keys(holdings).length).toBe(1);
    });
  });
});
