// User controller - Handles HTTP requests for users

import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { sendSuccess, sendPaginated } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types';

export class UserController {
  /**
   * GET /api/v1/users/:address/portfolio
   * Get user portfolio
   */
  getPortfolio = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid address format');
    }

    const portfolio = await userService.getUserPortfolio(address);

    sendSuccess(res, portfolio);
  });

  /**
   * GET /api/v1/users/:address/transactions
   * Get user transactions
   */
  getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid address format');
    }

    if (page < 1) throw new ValidationError('Page must be >= 1');
    if (limit < 1 || limit > 100) throw new ValidationError('Limit must be between 1 and 100');

    const { transactions, total } = await userService.getUserTransactions(address, page, limit);

    sendPaginated(res, transactions, page, limit, total);
  });

  /**
   * GET /api/v1/users/:address/created
   * Get tokens created by user
   */
  getCreatedTokens = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid address format');
    }

    const tokens = await userService.getUserCreatedTokens(address);

    sendSuccess(res, {
      creator: address,
      tokens,
      count: tokens.length,
    });
  });

  /**
   * GET /api/v1/users/:address/pnl
   * Get user profit/loss summary
   */
  getPnLSummary = asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError('Invalid address format');
    }

    const summary = await userService.getUserPnLSummary(address);

    sendSuccess(res, summary);
  });
}

// Export singleton instance
export const userController = new UserController();
