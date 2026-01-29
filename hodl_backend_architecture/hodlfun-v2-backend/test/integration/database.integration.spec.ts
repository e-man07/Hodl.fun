/**
 * Database Integration Tests
 * Real tests against PostgreSQL - no mocks
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../libs/database/src';

describe('Database Integration Tests', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.trade.deleteMany({});
    await prisma.holder.deleteMany({});
    await prisma.priceHistory.deleteMany({});
    await prisma.token.deleteMany({});
    await prisma.userPortfolio.deleteMany({});
    await prisma.creatorFee.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Token CRUD operations', () => {
    const testToken = {
      address: '0xtest1234567890abcdef1234567890abcdef12345678',
      curveAddress: '0xcurve234567890abcdef1234567890abcdef12345678',
      creatorAddress: '0xcreator4567890abcdef1234567890abcdef12345678',
      name: 'Test Token',
      symbol: 'TEST',
      tokenUri: 'https://example.com/token.json',
      virtualNative: '1000000000000000000',
      virtualToken: '50000000000000000000000000',
      realNative: '0',
      realToken: '0',
      k: '50000000000000000000000000000000000000000000',
      currentPrice: '20000000000000000',
      marketCap: '1000000000000000000000000',
      status: 'TRADING' as const,
      createdBlock: BigInt(1000),
    };

    it('should create a new token', async () => {
      const token = await prisma.token.create({
        data: testToken,
      });

      expect(token).toBeDefined();
      expect(token.address).toBe(testToken.address);
      expect(token.name).toBe('Test Token');
      expect(token.symbol).toBe('TEST');
      expect(token.status).toBe('TRADING');
    });

    it('should find token by address', async () => {
      const token = await prisma.token.findUnique({
        where: { address: testToken.address },
      });

      expect(token).toBeDefined();
      expect(token?.name).toBe('Test Token');
    });

    it('should update token price', async () => {
      const newPrice = '25000000000000000';
      const token = await prisma.token.update({
        where: { address: testToken.address },
        data: { currentPrice: newPrice },
      });

      expect(token.currentPrice).toBe(newPrice);
    });

    it('should list all trading tokens', async () => {
      const tokens = await prisma.token.findMany({
        where: { status: 'TRADING' },
      });

      expect(tokens.length).toBeGreaterThanOrEqual(1);
      expect(
        tokens.some((t: { address: string }) => t.address === testToken.address),
      ).toBe(true);
    });
  });

  describe('Trade operations', () => {
    const testTrade = {
      tokenAddress: '0xtest1234567890abcdef1234567890abcdef12345678',
      type: 'BUY' as const,
      traderAddress: '0xtrader567890abcdef1234567890abcdef12345678',
      amountIn: '1000000000000000000',
      amountOut: '50000000000000000000',
      price: '20000000000000000',
      feeAmount: '10000000000000000',
      txHash: '0xtx' + Date.now().toString(16),
      blockNumber: BigInt(1001),
      timestamp: new Date(),
    };

    it('should create a buy trade', async () => {
      const trade = await prisma.trade.create({
        data: testTrade,
      });

      expect(trade).toBeDefined();
      expect(trade.type).toBe('BUY');
      expect(trade.amountIn).toBe(testTrade.amountIn);
    });

    it('should find trades by token', async () => {
      const trades = await prisma.trade.findMany({
        where: { tokenAddress: testTrade.tokenAddress },
      });

      expect(trades.length).toBeGreaterThanOrEqual(1);
    });

    it('should count trades correctly', async () => {
      const count = await prisma.trade.count({
        where: { tokenAddress: testTrade.tokenAddress },
      });

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Holder operations', () => {
    const testHolder = {
      tokenAddress: '0xtest1234567890abcdef1234567890abcdef12345678',
      holderAddress: '0xholder567890abcdef1234567890abcdef12345678',
      balance: '50000000000000000000',
      firstBuyTimestamp: new Date(),
      lastActivityTimestamp: new Date(),
    };

    it('should create a holder record', async () => {
      const holder = await prisma.holder.create({
        data: testHolder,
      });

      expect(holder).toBeDefined();
      expect(holder.balance).toBe(testHolder.balance);
    });

    it('should find holder by token and address', async () => {
      const holder = await prisma.holder.findUnique({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: testHolder.tokenAddress,
            holderAddress: testHolder.holderAddress,
          },
        },
      });

      expect(holder).toBeDefined();
      expect(holder?.balance).toBe(testHolder.balance);
    });

    it('should update holder balance', async () => {
      const newBalance = '100000000000000000000';
      const holder = await prisma.holder.update({
        where: {
          tokenAddress_holderAddress: {
            tokenAddress: testHolder.tokenAddress,
            holderAddress: testHolder.holderAddress,
          },
        },
        data: { balance: newBalance },
      });

      expect(holder.balance).toBe(newBalance);
    });
  });

  describe('User Portfolio operations', () => {
    const testPortfolio = {
      walletAddress: '0xportfolio567890abcdef1234567890abcdef12345678',
      totalInvested: '10000000000000000000',
      totalReturned: '15000000000000000000',
      totalTrades: 5,
    };

    it('should create user portfolio', async () => {
      const portfolio = await prisma.userPortfolio.create({
        data: testPortfolio,
      });

      expect(portfolio).toBeDefined();
      expect(portfolio.totalTrades).toBe(5);
    });

    it('should upsert portfolio on update', async () => {
      const updated = await prisma.userPortfolio.upsert({
        where: { walletAddress: testPortfolio.walletAddress },
        update: { totalTrades: 10 },
        create: testPortfolio,
      });

      expect(updated.totalTrades).toBe(10);
    });
  });

  describe('Price History operations', () => {
    const testCandle = {
      tokenAddress: '0xtest1234567890abcdef1234567890abcdef12345678',
      timestamp: new Date('2026-01-27T12:00:00Z'),
      interval: 'ONE_MINUTE' as const,
      open: '20000000000000000',
      high: '22000000000000000',
      low: '19000000000000000',
      close: '21000000000000000',
      volumeNative: '5000000000000000000',
      volumeToken: '250000000000000000000',
      tradeCount: 10,
    };

    it('should create price history candle', async () => {
      const candle = await prisma.priceHistory.create({
        data: testCandle,
      });

      expect(candle).toBeDefined();
      expect(candle.tradeCount).toBe(10);
    });

    it('should find candles by token and interval', async () => {
      const candles = await prisma.priceHistory.findMany({
        where: {
          tokenAddress: testCandle.tokenAddress,
          interval: 'ONE_MINUTE',
        },
      });

      expect(candles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Aggregations and queries', () => {
    it('should count tokens by status', async () => {
      const tradingCount = await prisma.token.count({
        where: { status: 'TRADING' },
      });

      expect(tradingCount).toBeGreaterThanOrEqual(1);
    });

    it('should get tokens with holder counts', async () => {
      const tokens = await prisma.token.findMany({
        where: { status: 'TRADING' },
        include: {
          _count: {
            select: { holders: true },
          },
        },
      });

      expect(tokens.length).toBeGreaterThanOrEqual(1);
      expect(tokens[0]._count).toBeDefined();
    });
  });
});
