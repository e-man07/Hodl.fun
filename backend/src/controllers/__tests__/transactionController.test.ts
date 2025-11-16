// Transaction controller tests
// Mock the entire database module BEFORE imports
jest.mock('../../config/database', () => ({
  db: {
    transaction: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Mock logger BEFORE imports
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock response utils BEFORE imports
jest.mock('../../utils/response');

// Create a persistent mock provider BEFORE imports
const mockGetTransactionReceipt = jest.fn();
const mockProvider = {
  getTransactionReceipt: mockGetTransactionReceipt,
};

// Mock RPC service BEFORE imports
jest.mock('../../services/rpcService', () => ({
  rpcService: {
    getProvider: jest.fn(() => mockProvider),
  },
}));

import { transactionController } from '../transactionController';
import { db } from '../../config/database';
import { rpcService } from '../../services/rpcService';
import { sendSuccess } from '../../utils/response';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers/testUtils';
import { mockTransaction } from '../../__tests__/helpers/mockData';

describe('TransactionController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock sendSuccess to actually call res.json
    (sendSuccess as jest.Mock).mockImplementation((res, data) => {
      res.json({ success: true, data });
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status from database if found', async () => {
      const txHash = mockTransaction.hash;

      (db.transaction.findUnique as jest.Mock).mockResolvedValue(mockTransaction);

      const req = createMockRequest({
        params: { hash: txHash },
      });
      const res = createMockResponse();

      await transactionController.getTransactionStatus(req as any, res as any);

      expect(db.transaction.findUnique).toHaveBeenCalledWith({
        where: { hash: txHash.toLowerCase() },
      });

      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data.hash).toBe(txHash.toLowerCase());
      expect(callArg.data.status).toBe(mockTransaction.status);
      expect(callArg.data.fromDatabase).toBe(true);
    });

    it.skip('should fetch from RPC if not in database', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const mockReceipt = {
        status: 1,
        blockNumber: 1000001,
        logs: [],
      };

      (db.transaction.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetTransactionReceipt.mockResolvedValue(mockReceipt);

      const req = createMockRequest({
        params: { hash: txHash },
      });
      const res = createMockResponse();

      await transactionController.getTransactionStatus(req as any, res as any);

      expect(mockGetTransactionReceipt).toHaveBeenCalledWith(txHash);
      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data.status).toBe('SUCCESS');
      expect(callArg.data.fromDatabase).toBe(false);
    });

    it.skip('should return pending status if receipt not found', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      (db.transaction.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetTransactionReceipt.mockResolvedValue(null);

      const req = createMockRequest({
        params: { hash: txHash },
      });
      const res = createMockResponse();

      await transactionController.getTransactionStatus(req as any, res as any);

      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data.status).toBe('PENDING');
      expect(callArg.data.found).toBe(false);
    });

    it('should validate transaction hash format', async () => {
      const req = createMockRequest({
        params: { hash: 'invalid-hash' },
      });
      const res = createMockResponse();
      const next = jest.fn();

      await transactionController.getTransactionStatus(req as any, res as any, next as any);

      // The error should be passed to next function
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('Invalid transaction hash format');
    });
  });
});
