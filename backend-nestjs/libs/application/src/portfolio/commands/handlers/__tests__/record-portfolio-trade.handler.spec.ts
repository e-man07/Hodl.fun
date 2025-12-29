import { Test, TestingModule } from '@nestjs/testing';
import { RecordPortfolioTradeHandler } from '../record-portfolio-trade.handler';
import { RecordPortfolioTradeCommand } from '../../record-portfolio-trade.command';
import { IPortfolioRepository, PORTFOLIO_REPOSITORY } from '@domain';

describe('RecordPortfolioTradeHandler', () => {
  let handler: RecordPortfolioTradeHandler;
  let mockPortfolioRepository: jest.Mocked<IPortfolioRepository>;

  const createMockPortfolio = (userId: string) => ({
    getId: jest.fn().mockReturnValue(`portfolio-${userId}`),
    getUserId: jest.fn().mockReturnValue(userId),
    recordBuy: jest.fn(),
    recordSell: jest.fn(),
    getTotalInvested: jest.fn().mockReturnValue(BigInt(10000000000000000000)),
  } as any);

  beforeEach(async () => {
    mockPortfolioRepository = {
      findOrCreateByUserId: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordPortfolioTradeHandler,
        { provide: PORTFOLIO_REPOSITORY, useValue: mockPortfolioRepository },
      ],
    }).compile();

    handler = module.get<RecordPortfolioTradeHandler>(RecordPortfolioTradeHandler);
  });

  describe('execute', () => {
    it('should record buy trade in portfolio', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const command = new RecordPortfolioTradeCommand(
        userId,
        '0x' + 'b'.repeat(40),
        'TEST',
        'buy',
        BigInt(100),
        BigInt(1000),
        BigInt(10),
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      const result = await handler.execute(command);

      expect(result).toEqual(mockPortfolio);
      expect(mockPortfolio.recordBuy).toHaveBeenCalled();
      expect(mockPortfolioRepository.save).toHaveBeenCalled();
    });

    it('should record sell trade in portfolio', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const command = new RecordPortfolioTradeCommand(
        userId,
        '0x' + 'b'.repeat(40),
        'TEST',
        'sell',
        BigInt(50),
        BigInt(500),
        BigInt(10),
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      const result = await handler.execute(command);

      expect(result).toEqual(mockPortfolio);
      expect(mockPortfolio.recordSell).toHaveBeenCalled();
    });

    it('should get or create portfolio for user', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const command = new RecordPortfolioTradeCommand(
        userId,
        '0x' + 'b'.repeat(40),
        'TEST',
        'buy',
        BigInt(100),
        BigInt(1000),
        BigInt(10),
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      await handler.execute(command);

      expect(mockPortfolioRepository.findOrCreateByUserId).toHaveBeenCalledWith(userId);
    });

    it('should save updated portfolio', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const command = new RecordPortfolioTradeCommand(
        userId,
        '0x' + 'b'.repeat(40),
        'TEST',
        'buy',
        BigInt(100),
        BigInt(1000),
        BigInt(10),
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      await handler.execute(command);

      expect(mockPortfolioRepository.save).toHaveBeenCalledWith(mockPortfolio);
    });

    it('should record buy with all parameters', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const tokenAddress = '0x' + 'b'.repeat(40);
      const symbol = 'TOKEN';
      const tokenAmount = BigInt(123);
      const pushAmount = BigInt(456);
      const pricePerToken = BigInt(370);

      const command = new RecordPortfolioTradeCommand(
        userId,
        tokenAddress,
        symbol,
        'buy',
        tokenAmount,
        pushAmount,
        pricePerToken,
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      await handler.execute(command);

      expect(mockPortfolio.recordBuy).toHaveBeenCalledWith(
        tokenAddress,
        symbol,
        tokenAmount,
        pushAmount,
        pricePerToken,
      );
    });

    it('should record sell with all parameters', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const tokenAddress = '0x' + 'b'.repeat(40);
      const symbol = 'TOKEN';
      const tokenAmount = BigInt(50);
      const pushAmount = BigInt(300);

      const command = new RecordPortfolioTradeCommand(
        userId,
        tokenAddress,
        symbol,
        'sell',
        tokenAmount,
        pushAmount,
        BigInt(0),
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      await handler.execute(command);

      expect(mockPortfolio.recordSell).toHaveBeenCalledWith(
        tokenAddress,
        tokenAmount,
        pushAmount,
      );
    });

    it('should handle large token amounts', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const command = new RecordPortfolioTradeCommand(
        userId,
        '0x' + 'b'.repeat(40),
        'TEST',
        'buy',
        BigInt('9'.repeat(40)),
        BigInt(1000),
        BigInt(10),
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect(mockPortfolio.recordBuy).toHaveBeenCalled();
    });

    it('should handle different user IDs', async () => {
      const userIds = [
        '0x' + 'a'.repeat(40),
        '0x' + 'b'.repeat(40),
        '0x' + 'c'.repeat(40),
      ];

      for (const userId of userIds) {
        const command = new RecordPortfolioTradeCommand(
          userId,
          '0x' + 'd'.repeat(40),
          'TEST',
          'buy',
          BigInt(100),
          BigInt(1000),
          BigInt(10),
        );

        const mockPortfolio = createMockPortfolio(userId);
        mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
        mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

        const result = await handler.execute(command);

        expect(result.getUserId()).toBe(userId);
      }
    });

    it('should return saved portfolio', async () => {
      const userId = '0x' + 'a'.repeat(40);
      const command = new RecordPortfolioTradeCommand(
        userId,
        '0x' + 'b'.repeat(40),
        'TEST',
        'buy',
        BigInt(100),
        BigInt(1000),
        BigInt(10),
      );

      const mockPortfolio = createMockPortfolio(userId);
      mockPortfolioRepository.findOrCreateByUserId.mockResolvedValue(mockPortfolio);
      mockPortfolioRepository.save.mockResolvedValue(mockPortfolio);

      const result = await handler.execute(command);

      expect(result).toEqual(mockPortfolio);
    });
  });
});
