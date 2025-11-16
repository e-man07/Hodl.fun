// Transaction controller - Handles transaction-related requests

import { Request, Response } from 'express';
import { db } from '../config/database';
import { rpcService } from '../services/rpcService';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types';
import { ethers } from 'ethers';
import logger from '../utils/logger';

export class TransactionController {
  /**
   * GET /api/v1/transactions/:hash/status
   * Get transaction status and details
   */
  getTransactionStatus = asyncHandler(async (req: Request, res: Response) => {
    const { hash } = req.params;

    // Validate transaction hash format
    if (!hash || !hash.match(/^0x[a-fA-F0-9]{64}$/)) {
      throw new ValidationError('Invalid transaction hash format');
    }

    const txHash = hash.toLowerCase();

    // Check if transaction exists in database
    const dbTransaction = await db.transaction.findUnique({
      where: { hash: txHash },
    });

    if (dbTransaction) {
      // Transaction found in database
      logger.debug(`Transaction found in database: ${txHash}`);

      sendSuccess(res, {
        hash: txHash,
        status: dbTransaction.status,
        tokenAddress: dbTransaction.tokenAddress,
        type: dbTransaction.type,
        userAddress: dbTransaction.userAddress,
        amountIn: dbTransaction.amountIn,
        amountOut: dbTransaction.amountOut,
        price: dbTransaction.price,
        timestamp: dbTransaction.timestamp.toISOString(),
        blockNumber: Number(dbTransaction.blockNumber),
        found: true,
        fromDatabase: true,
      });
      return;
    }

    // Not in database, check RPC
    logger.debug(`Transaction not in database, checking RPC: ${txHash}`);

    try {
      const provider = rpcService.getProvider();
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        // Transaction not found or still pending
        sendSuccess(res, {
          hash: txHash,
          status: 'PENDING',
          found: false,
          fromDatabase: false,
        });
        return;
      }

      // Parse token address from logs if it's a TokenCreated event
      let tokenAddress: string | undefined;
      const tokenCreatedTopic = ethers.id('TokenCreated(address,address,string,string,uint256,uint256,string)');

      for (const log of receipt.logs) {
        if (log.topics[0] === tokenCreatedTopic) {
          // Token address is the first indexed parameter
          tokenAddress = ethers.getAddress('0x' + log.topics[1].slice(26));
          break;
        }
      }

      sendSuccess(res, {
        hash: txHash,
        status: receipt.status === 1 ? 'SUCCESS' : 'FAILED',
        blockNumber: receipt.blockNumber,
        tokenAddress,
        found: true,
        fromDatabase: false,
      });
    } catch (error: any) {
      logger.error(`Error fetching transaction receipt: ${txHash}`, error);

      // If RPC fails, assume pending
      sendSuccess(res, {
        hash: txHash,
        status: 'PENDING',
        found: false,
        fromDatabase: false,
        error: 'Failed to fetch from RPC',
      });
    }
  });
}

// Export singleton instance
export const transactionController = new TransactionController();
