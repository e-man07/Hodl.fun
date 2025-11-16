// Token controller tests
import { tokenController } from '../tokenController';
import { contractService } from '../../services/contractService';
import { tokenService } from '../../services/tokenService';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers/testUtils';
import { mockTokenAddress, mockUserAddress } from '../../__tests__/helpers/mockData';
import { ethers } from 'ethers';

// Mock the services
jest.mock('../../services/contractService');
jest.mock('../../services/tokenService');

describe('TokenController - Price Calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateBuyQuote', () => {
    it('should return token amount for given ETH amount', async () => {
      const ethAmount = '1.0';
      const expectedTokens = ethers.parseEther('1000');

      // Mock contract service response
      (contractService.calculatePurchaseReturn as jest.Mock).mockResolvedValue(expectedTokens);

      const req = createMockRequest({
        params: { address: mockTokenAddress },
        body: { ethAmount },
      });
      const res = createMockResponse();

      await tokenController.calculateBuyQuote(req as any, res as any);

      expect(contractService.calculatePurchaseReturn).toHaveBeenCalledWith(
        mockTokenAddress,
        ethers.parseEther(ethAmount)
      );
      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data.ethAmount).toBe(ethAmount);
      expect(callArg.data.tokenAmount).toBe(ethers.formatEther(expectedTokens));
    });

    it('should handle invalid ETH amount', async () => {
      const req = createMockRequest({
        params: { address: mockTokenAddress },
        body: { ethAmount: 'invalid' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      await tokenController.calculateBuyQuote(req as any, res as any, next as any);

      // The error should be passed to next function
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('Invalid ETH amount');
    });

    it('should handle zero ETH amount', async () => {
      const req = createMockRequest({
        params: { address: mockTokenAddress },
        body: { ethAmount: '0' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      await tokenController.calculateBuyQuote(req as any, res as any, next as any);

      // The error should be passed to next function
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('ETH amount must be greater than 0');
    });
  });

  describe('calculateSellQuote', () => {
    it('should return ETH amount for given token amount', async () => {
      const tokenAmount = '1000';
      const expectedEth = ethers.parseEther('0.95');

      (contractService.calculateSaleReturn as jest.Mock).mockResolvedValue(expectedEth);

      const req = createMockRequest({
        params: { address: mockTokenAddress },
        body: { tokenAmount },
      });
      const res = createMockResponse();

      await tokenController.calculateSellQuote(req as any, res as any);

      expect(contractService.calculateSaleReturn).toHaveBeenCalledWith(
        mockTokenAddress,
        ethers.parseEther(tokenAmount)
      );
      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
    });

    it('should handle invalid token amount', async () => {
      const req = createMockRequest({
        params: { address: mockTokenAddress },
        body: { tokenAmount: 'invalid' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      await tokenController.calculateSellQuote(req as any, res as any, next as any);

      // The error should be passed to next function
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('Invalid token amount');
    });
  });

  describe('getTokenBalance', () => {
    it('should return token balance for user address', async () => {
      const balance = ethers.parseEther('100');

      (contractService.getTokenBalance as jest.Mock).mockResolvedValue(balance);

      const req = createMockRequest({
        params: {
          address: mockTokenAddress,
          userAddress: mockUserAddress,
        },
      });
      const res = createMockResponse();

      await tokenController.getTokenBalance(req as any, res as any);

      expect(contractService.getTokenBalance).toHaveBeenCalledWith(
        mockTokenAddress,
        mockUserAddress
      );
      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data.balance).toBe(balance.toString());
    });

    it('should handle invalid addresses', async () => {
      const req = createMockRequest({
        params: {
          address: 'invalid',
          userAddress: mockUserAddress,
        },
      });
      const res = createMockResponse();
      const next = jest.fn();

      await tokenController.getTokenBalance(req as any, res as any, next as any);

      // The error should be passed to next function
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toContain('Invalid');
    });
  });

  describe('getHolderCount', () => {
    it('should return holder count', async () => {
      (tokenService.getHolderCount as jest.Mock).mockResolvedValue(150);

      const req = createMockRequest({
        params: { address: mockTokenAddress },
      });
      const res = createMockResponse();

      await tokenController.getHolderCount(req as any, res as any);

      expect(tokenService.getHolderCount).toHaveBeenCalledWith(mockTokenAddress);
      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data.holderCount).toBe(150);
    });
  });
});
