/**
 * Tokens Controller Unit Tests
 * Tests for token API endpoints
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TokensController } from '../../tokens/tokens.controller';
import { TokensService } from '../../tokens/tokens.service';

const createMockTokensService = () => ({
  findAll: jest.fn(),
  findByAddress: jest.fn(),
  getTrades: jest.fn(),
  getHolders: jest.fn(),
  getPriceHistory: jest.fn(),
  getTrending: jest.fn(),
  getNew: jest.fn(),
});

describe('TokensController', () => {
  let controller: TokensController;
  let mockService: ReturnType<typeof createMockTokensService>;

  beforeEach(async () => {
    mockService = createMockTokensService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TokensController],
      providers: [{ provide: TokensService, useValue: mockService }],
    }).compile();

    controller = module.get<TokensController>(TokensController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /tokens', () => {
    it('should call findAll with query parameters', async () => {
      const query = { page: 1, limit: 20, status: 'TRADING' };
      const expectedResult = { items: [], pagination: {} };
      mockService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query as any);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      mockService.findAll.mockResolvedValue({ items: [] });

      await controller.findAll({});

      expect(mockService.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('GET /tokens/trending', () => {
    it('should call getTrending with pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const expectedResult = { items: [], pagination: {} };
      mockService.getTrending.mockResolvedValue(expectedResult);

      const result = await controller.getTrending(pagination);

      expect(mockService.getTrending).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('GET /tokens/new', () => {
    it('should call getNew with pagination', async () => {
      const pagination = { page: 1, limit: 20 };
      const expectedResult = { items: [], pagination: {} };
      mockService.getNew.mockResolvedValue(expectedResult);

      const result = await controller.getNew(pagination);

      expect(mockService.getNew).toHaveBeenCalledWith(pagination);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('GET /tokens/:address', () => {
    it('should call findByAddress with token address', async () => {
      const address = '0xabc123';
      const expectedToken = { address, name: 'Test Token' };
      mockService.findByAddress.mockResolvedValue(expectedToken);

      const result = await controller.findOne(address);

      expect(mockService.findByAddress).toHaveBeenCalledWith(address);
      expect(result).toEqual(expectedToken);
    });
  });

  describe('GET /tokens/:address/trades', () => {
    it('should call getTrades with address and pagination', async () => {
      const address = '0xabc123';
      const pagination = { page: 1, limit: 20 };
      const expectedResult = { items: [], pagination: {} };
      mockService.getTrades.mockResolvedValue(expectedResult);

      const result = await controller.getTrades(address, pagination);

      expect(mockService.getTrades).toHaveBeenCalledWith(address, pagination);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('GET /tokens/:address/holders', () => {
    it('should call getHolders with address and pagination', async () => {
      const address = '0xabc123';
      const pagination = { page: 1, limit: 20 };
      const expectedResult = { items: [], pagination: {} };
      mockService.getHolders.mockResolvedValue(expectedResult);

      const result = await controller.getHolders(address, pagination);

      expect(mockService.getHolders).toHaveBeenCalledWith(address, pagination);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('GET /tokens/:address/price-history', () => {
    it('should call getPriceHistory with address and interval', async () => {
      const address = '0xabc123';
      const query = { interval: 'ONE_HOUR' };
      const expectedResult = [{ open: '100', close: '110' }];
      mockService.getPriceHistory.mockResolvedValue(expectedResult);

      const result = await controller.getPriceHistory(address, query as any);

      expect(mockService.getPriceHistory).toHaveBeenCalledWith(address, 'ONE_HOUR');
      expect(result).toEqual(expectedResult);
    });
  });
});
