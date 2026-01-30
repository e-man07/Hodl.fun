/**
 * Users Controller Unit Tests
 * Tests for user-related endpoints
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../users/users.controller';
import { UsersService } from '../../users/users.service';

const createMockUsersService = () => ({
  getUser: jest.fn(),
  getPortfolio: jest.fn(),
  getHoldings: jest.fn(),
  getTrades: jest.fn(),
  getCreatedTokens: jest.fn(),
});

describe('UsersController', () => {
  let controller: UsersController;
  let mockUsersService: ReturnType<typeof createMockUsersService>;

  const mockAddress = '0xabc123def456';
  const mockPagination = { page: 1, limit: 20 };

  beforeEach(async () => {
    mockUsersService = createMockUsersService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    const mockUser = {
      address: mockAddress,
      createdTokensCount: 5,
      tradesCount: 100,
      totalVolumeUsd: '50000.00',
    };

    it('should return user data for valid address', async () => {
      mockUsersService.getUser.mockResolvedValue(mockUser);

      const result = await controller.getUser(mockAddress);

      expect(mockUsersService.getUser).toHaveBeenCalledWith(mockAddress);
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found', async () => {
      mockUsersService.getUser.mockResolvedValue(null);

      const result = await controller.getUser(mockAddress);

      expect(result).toBeNull();
    });

    it('should handle service errors', async () => {
      mockUsersService.getUser.mockRejectedValue(new Error('Database error'));

      await expect(controller.getUser(mockAddress)).rejects.toThrow('Database error');
    });
  });

  describe('getPortfolio', () => {
    const mockPortfolio = {
      walletAddress: mockAddress,
      totalInvested: '10000000000000000000000',
      totalReturned: '10500000000000000000000',
      totalTrades: 50,
      realizedPnl: '500000000000000000000',
    };

    it('should return portfolio for valid address', async () => {
      mockUsersService.getPortfolio.mockResolvedValue(mockPortfolio);

      const result = await controller.getPortfolio(mockAddress);

      expect(mockUsersService.getPortfolio).toHaveBeenCalledWith(mockAddress);
      expect(result).toEqual(mockPortfolio);
    });

    it('should handle empty portfolio', async () => {
      const emptyPortfolio = {
        walletAddress: mockAddress,
        totalInvested: '0',
        totalReturned: '0',
        totalTrades: 0,
        realizedPnl: '0',
      };
      mockUsersService.getPortfolio.mockResolvedValue(emptyPortfolio);

      const result = await controller.getPortfolio(mockAddress);

      expect(result).toEqual(emptyPortfolio);
    });
  });

  describe('getHoldings', () => {
    const mockHoldings = {
      data: [
        { tokenAddress: '0xtoken1', balance: '1000000000000000000', valueUsd: '100.00' },
        { tokenAddress: '0xtoken2', balance: '2000000000000000000', valueUsd: '200.00' },
      ],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    };

    it('should return holdings with pagination', async () => {
      mockUsersService.getHoldings.mockResolvedValue(mockHoldings);

      const result = await controller.getHoldings(mockAddress, mockPagination);

      expect(mockUsersService.getHoldings).toHaveBeenCalledWith(mockAddress, mockPagination);
      expect(result).toEqual(mockHoldings);
    });

    it('should handle empty holdings', async () => {
      mockUsersService.getHoldings.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const result = await controller.getHoldings(mockAddress, mockPagination);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('should pass pagination parameters correctly', async () => {
      const customPagination = { page: 3, limit: 50 };
      mockUsersService.getHoldings.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 3, limit: 50, totalPages: 0 },
      });

      await controller.getHoldings(mockAddress, customPagination);

      expect(mockUsersService.getHoldings).toHaveBeenCalledWith(mockAddress, customPagination);
    });
  });

  describe('getTrades', () => {
    const mockTrades = {
      data: [
        {
          txHash: '0xtx1',
          type: 'BUY',
          amountIn: '1000000000000000000',
          amountOut: '100000000000000000000',
        },
      ],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };

    it('should return trades with pagination', async () => {
      mockUsersService.getTrades.mockResolvedValue(mockTrades);

      const result = await controller.getTrades(mockAddress, mockPagination);

      expect(mockUsersService.getTrades).toHaveBeenCalledWith(mockAddress, mockPagination);
      expect(result).toEqual(mockTrades);
    });

    it('should handle empty trade history', async () => {
      mockUsersService.getTrades.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const result = await controller.getTrades(mockAddress, mockPagination);

      expect(result.data).toEqual([]);
    });
  });

  describe('getCreatedTokens', () => {
    const mockTokens = {
      data: [
        { address: '0xtoken1', name: 'Token One', symbol: 'TKN1' },
        { address: '0xtoken2', name: 'Token Two', symbol: 'TKN2' },
      ],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    };

    it('should return created tokens with pagination', async () => {
      mockUsersService.getCreatedTokens.mockResolvedValue(mockTokens);

      const result = await controller.getCreatedTokens(mockAddress, mockPagination);

      expect(mockUsersService.getCreatedTokens).toHaveBeenCalledWith(mockAddress, mockPagination);
      expect(result).toEqual(mockTokens);
    });

    it('should handle user with no created tokens', async () => {
      mockUsersService.getCreatedTokens.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const result = await controller.getCreatedTokens(mockAddress, mockPagination);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getMyPortfolio', () => {
    const mockUser = { wallet: mockAddress, iat: 1700000000, exp: 1700003600 };
    const mockPortfolio = {
      totalValueUsd: '5000.00',
      holdings: [],
    };

    it('should use wallet from authenticated user', async () => {
      mockUsersService.getPortfolio.mockResolvedValue(mockPortfolio);

      const result = await controller.getMyPortfolio(mockUser);

      expect(mockUsersService.getPortfolio).toHaveBeenCalledWith(mockAddress);
      expect(result).toEqual(mockPortfolio);
    });

    it('should handle different wallet addresses', async () => {
      const differentUser = { wallet: '0xdifferent', iat: 1700000000, exp: 1700003600 };
      mockUsersService.getPortfolio.mockResolvedValue(mockPortfolio);

      await controller.getMyPortfolio(differentUser);

      expect(mockUsersService.getPortfolio).toHaveBeenCalledWith('0xdifferent');
    });
  });
});
