import { Portfolio } from '../entities/portfolio.entity';

describe('Portfolio Entity', () => {
  const userId = 'user-123';
  const tokenAddress1 = '0x' + 'a'.repeat(40);
  const tokenAddress2 = '0x' + 'b'.repeat(40);
  const tokenSymbol1 = 'TEST1';
  const tokenSymbol2 = 'TEST2';

  describe('Portfolio Creation', () => {
    it('should create empty portfolio for new user', () => {
      const portfolio = Portfolio.create(userId);

      expect(portfolio).toBeDefined();
      expect(portfolio.getUserId()).toBe(userId);
      expect(portfolio.getHoldings()).toHaveLength(0);
      expect(portfolio.getTotalInvestedPUSH()).toBe(0n);
    });

    it('should generate portfolio ID from user ID', () => {
      const portfolio = Portfolio.create(userId);

      expect(portfolio.getId()).toBe(`${userId}-portfolio`);
    });

    it('should initialize with current timestamp', () => {
      const beforeCreation = new Date();
      const portfolio = Portfolio.create(userId);
      const afterCreation = new Date();

      const createdAt = portfolio.getCreatedAt();
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('Portfolio Reconstruction', () => {
    it('should reconstruct portfolio from database data', () => {
      const holdings = [
        {
          tokenAddress: tokenAddress1,
          tokenSymbol: tokenSymbol1,
          balance: BigInt(1000) * BigInt(10 ** 18),
          avgBuyPrice: BigInt(100) * BigInt(10 ** 12),
          totalSpent: BigInt(100000) * BigInt(10 ** 18),
          totalSold: BigInt(50000) * BigInt(10 ** 18),
          realizedPNL: BigInt(10000) * BigInt(10 ** 18),
        },
      ];

      const reconstructionData = {
        id: `${userId}-portfolio`,
        userId,
        holdings,
        totalInvestedPUSH: BigInt(100000) * BigInt(10 ** 18),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const portfolio = Portfolio.reconstruct(reconstructionData);

      expect(portfolio.getUserId()).toBe(userId);
      expect(portfolio.getHoldings()).toHaveLength(1);
      expect(portfolio.getTotalInvestedPUSH()).toBe(BigInt(100000) * BigInt(10 ** 18));
    });

    it('should reconstruct portfolio with multiple holdings', () => {
      const holdings = [
        {
          tokenAddress: tokenAddress1,
          tokenSymbol: tokenSymbol1,
          balance: BigInt(1000) * BigInt(10 ** 18),
          avgBuyPrice: BigInt(100) * BigInt(10 ** 12),
          totalSpent: BigInt(100000) * BigInt(10 ** 18),
          totalSold: 0n,
          realizedPNL: 0n,
        },
        {
          tokenAddress: tokenAddress2,
          tokenSymbol: tokenSymbol2,
          balance: BigInt(500) * BigInt(10 ** 18),
          avgBuyPrice: BigInt(200) * BigInt(10 ** 12),
          totalSpent: BigInt(100000) * BigInt(10 ** 18),
          totalSold: 0n,
          realizedPNL: 0n,
        },
      ];

      const reconstructionData = {
        id: `${userId}-portfolio`,
        userId,
        holdings,
        totalInvestedPUSH: BigInt(200000) * BigInt(10 ** 18),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const portfolio = Portfolio.reconstruct(reconstructionData);

      expect(portfolio.getHoldings()).toHaveLength(2);
    });
  });

  describe('Buy Operations', () => {
    it('should record first buy of a token', () => {
      const portfolio = Portfolio.create(userId);

      const amountOutTokens = BigInt(1000) * BigInt(10 ** 18);
      const amountInPUSH = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, amountOutTokens, amountInPUSH, pricePerToken);

      expect(portfolio.getBalance(tokenAddress1)).toBe(amountOutTokens);
      expect(portfolio.getTotalInvestedPUSH()).toBe(amountInPUSH);
    });

    it('should update balance on subsequent buys of same token', () => {
      const portfolio = Portfolio.create(userId);

      const firstAmountOut = BigInt(1000) * BigInt(10 ** 18);
      const firstAmountIn = BigInt(100) * BigInt(10 ** 18);
      const firstPrice = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, firstAmountOut, firstAmountIn, firstPrice);

      const secondAmountOut = BigInt(500) * BigInt(10 ** 18);
      const secondAmountIn = BigInt(60) * BigInt(10 ** 18);
      const secondPrice = BigInt(120) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, secondAmountOut, secondAmountIn, secondPrice);

      expect(portfolio.getBalance(tokenAddress1)).toBe(firstAmountOut + secondAmountOut);
      expect(portfolio.getTotalInvestedPUSH()).toBe(firstAmountIn + secondAmountIn);
    });

    it('should calculate weighted average price on multiple buys', () => {
      const portfolio = Portfolio.create(userId);

      const firstAmountOut = BigInt(1000) * BigInt(10 ** 18);
      const firstAmountIn = BigInt(100) * BigInt(10 ** 18);
      const firstPrice = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, firstAmountOut, firstAmountIn, firstPrice);

      const secondAmountOut = BigInt(500) * BigInt(10 ** 18);
      const secondAmountIn = BigInt(60) * BigInt(10 ** 18);
      const secondPrice = BigInt(120) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, secondAmountOut, secondAmountIn, secondPrice);

      const holdings = portfolio.getHoldings();
      const holding = holdings.find((h) => h.tokenAddress === tokenAddress1);

      // Average should be between the two prices
      expect(holding?.avgBuyPrice).toBeGreaterThanOrEqual(firstPrice);
      expect(holding?.avgBuyPrice).toBeLessThanOrEqual(secondPrice);
    });

    it('should record multiple token buys', () => {
      const portfolio = Portfolio.create(userId);

      const amountOut1 = BigInt(1000) * BigInt(10 ** 18);
      const amountIn1 = BigInt(100) * BigInt(10 ** 18);
      const price1 = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, amountOut1, amountIn1, price1);

      const amountOut2 = BigInt(500) * BigInt(10 ** 18);
      const amountIn2 = BigInt(75) * BigInt(10 ** 18);
      const price2 = BigInt(150) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress2, tokenSymbol2, amountOut2, amountIn2, price2);

      expect(portfolio.getBalance(tokenAddress1)).toBe(amountOut1);
      expect(portfolio.getBalance(tokenAddress2)).toBe(amountOut2);
      expect(portfolio.getTotalInvestedPUSH()).toBe(amountIn1 + amountIn2);
      expect(portfolio.getHoldings()).toHaveLength(2);
    });
  });

  describe('Sell Operations', () => {
    it('should record sell of a token', () => {
      const portfolio = Portfolio.create(userId);

      // First buy
      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);

      // Then sell
      const sellAmount = BigInt(500) * BigInt(10 ** 18);
      const sellProceeds = BigInt(75) * BigInt(10 ** 18);

      portfolio.recordSell(tokenAddress1, sellAmount, sellProceeds);

      expect(portfolio.getBalance(tokenAddress1)).toBe(BigInt(500) * BigInt(10 ** 18));
    });

    it('should calculate realized PNL on sell', () => {
      const portfolio = Portfolio.create(userId);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);

      const sellAmount = BigInt(500) * BigInt(10 ** 18);
      const sellProceeds = BigInt(100) * BigInt(10 ** 18); // Profit: proceeds > cost basis

      portfolio.recordSell(tokenAddress1, sellAmount, sellProceeds);

      const holding = portfolio.getHoldings().find((h) => h.tokenAddress === tokenAddress1);
      expect(holding?.realizedPNL).toBeGreaterThan(0n);
    });

    it('should remove holding when balance reaches zero', () => {
      const portfolio = Portfolio.create(userId);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);

      expect(portfolio.getHoldings()).toHaveLength(1);

      portfolio.recordSell(tokenAddress1, buyAmount, BigInt(100) * BigInt(10 ** 18));

      expect(portfolio.getHoldings()).toHaveLength(0);
      expect(portfolio.getBalance(tokenAddress1)).toBe(0n);
    });

    it('should reject sell with insufficient balance', () => {
      const portfolio = Portfolio.create(userId);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);

      const excessiveSellAmount = BigInt(2000) * BigInt(10 ** 18);

      expect(() =>
        portfolio.recordSell(tokenAddress1, excessiveSellAmount, BigInt(200) * BigInt(10 ** 18)),
      ).toThrow('Insufficient balance for sell');
    });

    it('should reject sell of non-existent token', () => {
      const portfolio = Portfolio.create(userId);

      expect(() =>
        portfolio.recordSell(tokenAddress1, BigInt(1000) * BigInt(10 ** 18), BigInt(100) * BigInt(10 ** 18)),
      ).toThrow('Insufficient balance for sell');
    });
  });

  describe('Balance Queries', () => {
    it('should return zero balance for non-existent token', () => {
      const portfolio = Portfolio.create(userId);

      expect(portfolio.getBalance(tokenAddress1)).toBe(0n);
    });

    it('should return correct balance after buy and sell', () => {
      const portfolio = Portfolio.create(userId);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);
      const balanceAfterBuy = portfolio.getBalance(tokenAddress1);
      expect(balanceAfterBuy).toBe(buyAmount);

      const sellAmount = BigInt(300) * BigInt(10 ** 18);
      portfolio.recordSell(tokenAddress1, sellAmount, BigInt(45) * BigInt(10 ** 18));
      const balanceAfterSell = portfolio.getBalance(tokenAddress1);
      expect(balanceAfterSell).toBe(buyAmount - sellAmount);
    });

    it('should check if token is held', () => {
      const portfolio = Portfolio.create(userId);

      expect(portfolio.hasBalance(tokenAddress1)).toBe(false);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);

      expect(portfolio.hasBalance(tokenAddress1)).toBe(true);

      portfolio.recordSell(tokenAddress1, buyAmount, BigInt(100) * BigInt(10 ** 18));

      expect(portfolio.hasBalance(tokenAddress1)).toBe(false);
    });
  });

  describe('Holdings Retrieval', () => {
    it('should return empty holdings for new portfolio', () => {
      const portfolio = Portfolio.create(userId);

      expect(portfolio.getHoldings()).toEqual([]);
    });

    it('should return all holdings', () => {
      const portfolio = Portfolio.create(userId);

      const amount1 = BigInt(1000) * BigInt(10 ** 18);
      const amount2 = BigInt(500) * BigInt(10 ** 18);

      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        amount1,
        BigInt(100) * BigInt(10 ** 18),
        BigInt(100) * BigInt(10 ** 12),
      );
      portfolio.recordBuy(
        tokenAddress2,
        tokenSymbol2,
        amount2,
        BigInt(75) * BigInt(10 ** 18),
        BigInt(150) * BigInt(10 ** 12),
      );

      const holdings = portfolio.getHoldings();

      expect(holdings).toHaveLength(2);
      expect(holdings.some((h) => h.tokenAddress === tokenAddress1)).toBe(true);
      expect(holdings.some((h) => h.tokenAddress === tokenAddress2)).toBe(true);
    });

    it('should include holding details', () => {
      const portfolio = Portfolio.create(userId);

      const amount = BigInt(1000) * BigInt(10 ** 18);
      const spent = BigInt(100) * BigInt(10 ** 18);
      const price = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, amount, spent, price);

      const holdings = portfolio.getHoldings();
      const holding = holdings[0];

      expect(holding.tokenAddress).toBe(tokenAddress1);
      expect(holding.tokenSymbol).toBe(tokenSymbol1);
      expect(holding.balance).toBe(amount);
      expect(holding.avgBuyPrice).toBe(price);
      expect(holding.totalSpent).toBe(spent);
    });
  });

  describe('PNL Calculations', () => {
    it('should calculate unrealized PNL', () => {
      const portfolio = Portfolio.create(userId);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);

      const currentPrice = BigInt(150) * BigInt(10 ** 12); // 50% profit
      const unrealizedPNL = portfolio.getUnrealizedPNL(tokenAddress1, currentPrice);

      expect(unrealizedPNL).toBeGreaterThan(0n);
    });

    it('should calculate negative unrealized PNL on price decrease', () => {
      const portfolio = Portfolio.create(userId);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);

      const currentPrice = BigInt(50) * BigInt(10 ** 12); // 50% loss
      const unrealizedPNL = portfolio.getUnrealizedPNL(tokenAddress1, currentPrice);

      expect(unrealizedPNL).toBeLessThan(0n);
    });

    it('should return zero unrealized PNL for non-existent token', () => {
      const portfolio = Portfolio.create(userId);

      const unrealizedPNL = portfolio.getUnrealizedPNL(tokenAddress1, BigInt(100) * BigInt(10 ** 12));

      expect(unrealizedPNL).toBe(0n);
    });

    it('should return zero unrealized PNL for zero balance', () => {
      const portfolio = Portfolio.create(userId);

      const buyAmount = BigInt(1000) * BigInt(10 ** 18);
      const buyPrice = BigInt(100) * BigInt(10 ** 18);
      const pricePerToken = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, buyAmount, buyPrice, pricePerToken);
      portfolio.recordSell(tokenAddress1, buyAmount, BigInt(100) * BigInt(10 ** 18));

      const unrealizedPNL = portfolio.getUnrealizedPNL(tokenAddress1, BigInt(100) * BigInt(10 ** 12));

      expect(unrealizedPNL).toBe(0n);
    });
  });

  describe('Portfolio Value', () => {
    it('should calculate portfolio value at current prices', () => {
      const portfolio = Portfolio.create(userId);

      const amount1 = BigInt(1000) * BigInt(10 ** 18);
      const amount2 = BigInt(500) * BigInt(10 ** 18);

      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        amount1,
        BigInt(100) * BigInt(10 ** 18),
        BigInt(100) * BigInt(10 ** 12),
      );
      portfolio.recordBuy(
        tokenAddress2,
        tokenSymbol2,
        amount2,
        BigInt(75) * BigInt(10 ** 18),
        BigInt(150) * BigInt(10 ** 12),
      );

      const prices = new Map<string, bigint>([
        [tokenAddress1, BigInt(100) * BigInt(10 ** 12)],
        [tokenAddress2, BigInt(150) * BigInt(10 ** 12)],
      ]);

      const portfolioValue = portfolio.getPortfolioValue(prices);

      expect(portfolioValue).toBeGreaterThan(0n);
      expect(portfolioValue).toBe(
        amount1 * BigInt(100) * BigInt(10 ** 12) + amount2 * BigInt(150) * BigInt(10 ** 12),
      );
    });

    it('should handle missing price data', () => {
      const portfolio = Portfolio.create(userId);

      const amount = BigInt(1000) * BigInt(10 ** 18);

      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        amount,
        BigInt(100) * BigInt(10 ** 18),
        BigInt(100) * BigInt(10 ** 12),
      );

      const prices = new Map<string, bigint>(); // Empty prices

      const portfolioValue = portfolio.getPortfolioValue(prices);

      expect(portfolioValue).toBe(0n);
    });
  });

  describe('Portfolio Summary', () => {
    it('should return portfolio summary with all metrics', () => {
      const portfolio = Portfolio.create(userId);

      const amount1 = BigInt(1000) * BigInt(10 ** 18);
      const spent1 = BigInt(100) * BigInt(10 ** 18);
      const price1 = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, amount1, spent1, price1);

      const prices = new Map<string, bigint>([[tokenAddress1, BigInt(150) * BigInt(10 ** 12)]]);

      const summary = portfolio.getSummary(prices);

      expect(summary.totalInvested).toBe(spent1);
      expect(summary.currentValue).toBeGreaterThan(0n);
      expect(summary.unrealizedPNL).toBeGreaterThan(0n);
      expect(summary.realizedPNL).toBe(0n);
      expect(summary.holdingCount).toBe(1);
    });

    it('should include realized and unrealized PNL in summary', () => {
      const portfolio = Portfolio.create(userId);

      const amount = BigInt(1000) * BigInt(10 ** 18);
      const spent = BigInt(100) * BigInt(10 ** 18);
      const price = BigInt(100) * BigInt(10 ** 12);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, amount, spent, price);

      // Sell some at profit
      const sellAmount = BigInt(500) * BigInt(10 ** 18);
      const sellProceeds = BigInt(100) * BigInt(10 ** 18);

      portfolio.recordSell(tokenAddress1, sellAmount, sellProceeds);

      const currentPrice = BigInt(200) * BigInt(10 ** 12);
      const prices = new Map<string, bigint>([[tokenAddress1, currentPrice]]);

      const summary = portfolio.getSummary(prices);

      expect(summary.realizedPNL).toBeGreaterThan(0n);
      expect(summary.unrealizedPNL).toBeGreaterThan(0n);
    });

    it('should handle empty portfolio summary', () => {
      const portfolio = Portfolio.create(userId);

      const prices = new Map<string, bigint>();

      const summary = portfolio.getSummary(prices);

      expect(summary.totalInvested).toBe(0n);
      expect(summary.currentValue).toBe(0n);
      expect(summary.unrealizedPNL).toBe(0n);
      expect(summary.realizedPNL).toBe(0n);
      expect(summary.holdingCount).toBe(0);
    });
  });

  describe('Getters', () => {
    it('should return portfolio ID and user ID', () => {
      const portfolio = Portfolio.create(userId);

      expect(portfolio.getId()).toBe(`${userId}-portfolio`);
      expect(portfolio.getUserId()).toBe(userId);
    });

    it('should return total invested amount', () => {
      const portfolio = Portfolio.create(userId);

      const spent1 = BigInt(100) * BigInt(10 ** 18);
      const spent2 = BigInt(75) * BigInt(10 ** 18);

      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        BigInt(1000) * BigInt(10 ** 18),
        spent1,
        BigInt(100) * BigInt(10 ** 12),
      );
      portfolio.recordBuy(
        tokenAddress2,
        tokenSymbol2,
        BigInt(500) * BigInt(10 ** 18),
        spent2,
        BigInt(150) * BigInt(10 ** 12),
      );

      expect(portfolio.getTotalInvestedPUSH()).toBe(spent1 + spent2);
    });

    it('should return creation and update timestamps', () => {
      const portfolio = Portfolio.create(userId);

      expect(portfolio.getCreatedAt()).toBeDefined();
      expect(portfolio.getUpdatedAt()).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', () => {
      const portfolio = Portfolio.create(userId);

      const hugeAmount = BigInt('999999999999999999999999999');

      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        hugeAmount,
        hugeAmount,
        BigInt(100) * BigInt(10 ** 12),
      );

      expect(portfolio.getBalance(tokenAddress1)).toBe(hugeAmount);
    });

    it('should handle minimum amounts (1 wei)', () => {
      const portfolio = Portfolio.create(userId);

      const minAmount = BigInt(1);

      portfolio.recordBuy(tokenAddress1, tokenSymbol1, minAmount, minAmount, BigInt(1));

      expect(portfolio.getBalance(tokenAddress1)).toBe(minAmount);
    });

    it('should handle multiple trades per token', () => {
      const portfolio = Portfolio.create(userId);

      for (let i = 0; i < 10; i++) {
        const amount = BigInt(100) * BigInt(10 ** 18);
        const spent = BigInt(10) * BigInt(10 ** 18);

        portfolio.recordBuy(
          tokenAddress1,
          tokenSymbol1,
          amount,
          spent,
          BigInt(100 + i * 5) * BigInt(10 ** 12),
        );
      }

      expect(portfolio.getBalance(tokenAddress1)).toBe(BigInt(1000) * BigInt(10 ** 18));
      expect(portfolio.getTotalInvestedPUSH()).toBe(BigInt(100) * BigInt(10 ** 18));
    });

    it('should handle portfolio with many tokens', () => {
      const portfolio = Portfolio.create(userId);

      for (let i = 0; i < 50; i++) {
        const tokenAddr = '0x' + i.toString().padStart(40, '0');
        const amount = BigInt(1000) * BigInt(10 ** 18);
        const spent = BigInt(100) * BigInt(10 ** 18);

        portfolio.recordBuy(tokenAddr, `TOKEN${i}`, amount, spent, BigInt(100) * BigInt(10 ** 12));
      }

      expect(portfolio.getHoldings()).toHaveLength(50);
    });

    it('should preserve precision with wei values', () => {
      const portfolio = Portfolio.create(userId);

      const preciseAmount = BigInt('1234567890123456789');
      const preciseSpent = BigInt('9876543210987654321');

      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        preciseAmount,
        preciseSpent,
        BigInt('8765432109876543210'),
      );

      expect(portfolio.getBalance(tokenAddress1)).toBe(preciseAmount);
      expect(portfolio.getTotalInvestedPUSH()).toBe(preciseSpent);
    });

    it('should handle complete buy and sell cycles', () => {
      const portfolio = Portfolio.create(userId);

      // Buy 1000 tokens
      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        BigInt(1000) * BigInt(10 ** 18),
        BigInt(100) * BigInt(10 ** 18),
        BigInt(100) * BigInt(10 ** 12),
      );

      // Sell 300 tokens
      portfolio.recordSell(tokenAddress1, BigInt(300) * BigInt(10 ** 18), BigInt(45) * BigInt(10 ** 18));

      // Buy 500 more
      portfolio.recordBuy(
        tokenAddress1,
        tokenSymbol1,
        BigInt(500) * BigInt(10 ** 18),
        BigInt(100) * BigInt(10 ** 18),
        BigInt(200) * BigInt(10 ** 12),
      );

      // Sell all remaining
      portfolio.recordSell(
        tokenAddress1,
        BigInt(1200) * BigInt(10 ** 18),
        BigInt(300) * BigInt(10 ** 18),
      );

      expect(portfolio.getBalance(tokenAddress1)).toBe(0n);
      expect(portfolio.hasBalance(tokenAddress1)).toBe(false);
    });
  });
});
