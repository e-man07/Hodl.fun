import { Trade } from '../entities/trade.entity';

describe('Trade Entity', () => {
  const validTradeId = 'trade-' + '0'.repeat(60);
  const validTokenId = 'token-123';
  const validUser = '0x' + 'a'.repeat(40);
  const validTxHash = '0x' + 'b'.repeat(64);
  const blockNumber = 12345;
  const timestamp = new Date('2024-01-01T12:00:00Z');

  describe('Buy Trade Creation', () => {
    it('should create a buy trade', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade).toBeDefined();
      expect(trade.type).toBe('buy');
    });

    it('should set correct amounts for buy trade', () => {
      const amountInPUSH = BigInt(10) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(5000000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.amountIn).toBe(amountInPUSH);
      expect(trade.amountOut).toBe(amountOutTokens);
      expect(trade.totalValue).toBe(amountInPUSH); // For buy, totalValue = amountIn
    });

    it('should reject buy with zero amount in', () => {
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      expect(() =>
        Trade.createBuy(
          validTradeId,
          validTokenId,
          validUser,
          0n,
          amountOutTokens,
          pricePerToken,
          validTxHash,
          blockNumber,
          timestamp,
        ),
      ).toThrow('Trade amounts must be positive');
    });

    it('should reject buy with zero amount out', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      expect(() =>
        Trade.createBuy(
          validTradeId,
          validTokenId,
          validUser,
          amountInPUSH,
          0n,
          pricePerToken,
          validTxHash,
          blockNumber,
          timestamp,
        ),
      ).toThrow('Trade amounts must be positive');
    });

    it('should reject buy with negative amount in', () => {
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      expect(() =>
        Trade.createBuy(
          validTradeId,
          validTokenId,
          validUser,
          -BigInt(1) * BigInt(10 ** 18),
          amountOutTokens,
          pricePerToken,
          validTxHash,
          blockNumber,
          timestamp,
        ),
      ).toThrow('Trade amounts must be positive');
    });
  });

  describe('Sell Trade Creation', () => {
    it('should create a sell trade', () => {
      const amountInTokens = BigInt(500000) * BigInt(10 ** 18);
      const amountOutPUSH = BigInt(1) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createSell(
        validTradeId,
        validTokenId,
        validUser,
        amountInTokens,
        amountOutPUSH,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade).toBeDefined();
      expect(trade.type).toBe('sell');
    });

    it('should set correct amounts for sell trade', () => {
      const amountInTokens = BigInt(5000000) * BigInt(10 ** 18);
      const amountOutPUSH = BigInt(10) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createSell(
        validTradeId,
        validTokenId,
        validUser,
        amountInTokens,
        amountOutPUSH,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.amountIn).toBe(amountInTokens);
      expect(trade.amountOut).toBe(amountOutPUSH);
      expect(trade.totalValue).toBe(amountOutPUSH); // For sell, totalValue = amountOut
    });

    it('should reject sell with zero amount in', () => {
      const amountOutPUSH = BigInt(1) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      expect(() =>
        Trade.createSell(
          validTradeId,
          validTokenId,
          validUser,
          0n,
          amountOutPUSH,
          pricePerToken,
          validTxHash,
          blockNumber,
          timestamp,
        ),
      ).toThrow('Trade amounts must be positive');
    });

    it('should reject sell with zero amount out', () => {
      const amountInTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      expect(() =>
        Trade.createSell(
          validTradeId,
          validTokenId,
          validUser,
          amountInTokens,
          0n,
          pricePerToken,
          validTxHash,
          blockNumber,
          timestamp,
        ),
      ).toThrow('Trade amounts must be positive');
    });
  });

  describe('Trade Properties', () => {
    it('should store trade ID', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.id).toBe(validTradeId);
    });

    it('should store token ID', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.tokenId).toBe(validTokenId);
    });

    it('should store user address', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.user).toBe(validUser);
    });

    it('should store transaction hash', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.transactionHash).toBe(validTxHash);
    });

    it('should store block number', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.blockNumber).toBe(blockNumber);
    });

    it('should store timestamp', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.timestamp).toEqual(timestamp);
    });
  });

  describe('Slippage Calculation', () => {
    it('should calculate slippage for higher actual price (buy)', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const actualPrice = BigInt(2500) * BigInt(10 ** 12); // Actual price paid
      const expectedPrice = BigInt(2000) * BigInt(10 ** 12); // Expected price

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        actualPrice,
        validTxHash,
        blockNumber,
        timestamp,
      );

      const slippage = trade.getSlippage(expectedPrice);

      expect(slippage).toBeGreaterThan(0);
      expect(slippage).toBeLessThanOrEqual(100);
    });

    it('should calculate slippage for lower actual price', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const actualPrice = BigInt(1500) * BigInt(10 ** 12); // Actual price
      const expectedPrice = BigInt(2000) * BigInt(10 ** 12); // Expected price

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        actualPrice,
        validTxHash,
        blockNumber,
        timestamp,
      );

      const slippage = trade.getSlippage(expectedPrice);

      expect(slippage).toBeGreaterThanOrEqual(0);
      expect(slippage).toBeLessThanOrEqual(100);
    });

    it('should return 0 slippage when prices match', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const price = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        price,
        validTxHash,
        blockNumber,
        timestamp,
      );

      const slippage = trade.getSlippage(price);

      expect(slippage).toBe(0);
    });

    it('should handle zero expected price', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      const slippage = trade.getSlippage(0n);

      expect(slippage).toBe(0);
    });
  });

  describe('Trade Age Checking', () => {
    it('should identify old trades', () => {
      const oldTimestamp = new Date();
      oldTimestamp.setDate(oldTimestamp.getDate() - 10); // 10 days ago

      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        oldTimestamp,
      );

      expect(trade.isOlderThan(7)).toBe(true);
    });

    it('should identify recent trades', () => {
      const recentTimestamp = new Date();

      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        recentTimestamp,
      );

      expect(trade.isOlderThan(7)).toBe(false);
    });
  });

  describe('Trade Summary', () => {
    it('should provide trade summary', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      const summary = trade.getSummary();

      expect(summary.type).toBe('buy');
      expect(summary.amountIn).toBe(amountInPUSH);
      expect(summary.amountOut).toBe(amountOutTokens);
      expect(summary.pricePerToken).toBe(pricePerToken);
      expect(summary.timestamp).toEqual(timestamp);
    });
  });

  describe('Trade Reconstruction', () => {
    it('should reconstruct trade from data', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const reconstructionData = {
        id: validTradeId,
        tokenId: validTokenId,
        type: 'buy' as const,
        user: validUser,
        amountIn: amountInPUSH,
        amountOut: amountOutTokens,
        pricePerToken,
        totalValue: amountInPUSH,
        transactionHash: validTxHash,
        blockNumber,
        timestamp,
      };

      const trade = Trade.reconstruct(reconstructionData);

      expect(trade.id).toBe(validTradeId);
      expect(trade.type).toBe('buy');
      expect(trade.amountIn).toBe(amountInPUSH);
      expect(trade.amountOut).toBe(amountOutTokens);
    });

    it('should reconstruct sell trade from data', () => {
      const amountInTokens = BigInt(500000) * BigInt(10 ** 18);
      const amountOutPUSH = BigInt(1) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const reconstructionData = {
        id: validTradeId,
        tokenId: validTokenId,
        type: 'sell' as const,
        user: validUser,
        amountIn: amountInTokens,
        amountOut: amountOutPUSH,
        pricePerToken,
        totalValue: amountOutPUSH,
        transactionHash: validTxHash,
        blockNumber,
        timestamp,
      };

      const trade = Trade.reconstruct(reconstructionData);

      expect(trade.id).toBe(validTradeId);
      expect(trade.type).toBe('sell');
      expect(trade.amountIn).toBe(amountInTokens);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', () => {
      const hugeAmount = BigInt('999999999999999999999999999999');
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        hugeAmount,
        hugeAmount,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.amountIn).toBe(hugeAmount);
    });

    it('should handle minimum amounts (1 wei)', () => {
      const minAmount = BigInt(1);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        minAmount,
        minAmount,
        pricePerToken,
        validTxHash,
        blockNumber,
        timestamp,
      );

      expect(trade.amountIn).toBe(minAmount);
      expect(trade.amountOut).toBe(minAmount);
    });

    it('should handle zero block number (pending trades)', () => {
      const amountInPUSH = BigInt(1) * BigInt(10 ** 18);
      const amountOutTokens = BigInt(500000) * BigInt(10 ** 18);
      const pricePerToken = BigInt(2000) * BigInt(10 ** 12);

      const trade = Trade.createBuy(
        validTradeId,
        validTokenId,
        validUser,
        amountInPUSH,
        amountOutTokens,
        pricePerToken,
        validTxHash,
        0, // Pending trade
        timestamp,
      );

      expect(trade.blockNumber).toBe(0);
    });
  });
});
