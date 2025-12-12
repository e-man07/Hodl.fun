// Market controller - Handles HTTP requests for market statistics

import { Request, Response } from 'express';
import { marketService } from '../services/marketService';
import { tokenService } from '../services/tokenService';
import { sendSuccess } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types';

export class MarketController {
  /**
   * GET /api/v1/market/stats
   * Get global market statistics
   */
  getStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await marketService.getMarketStats();

    sendSuccess(res, stats);
  });

  /**
   * GET /api/v1/market/trending
   * Get trending tokens
   */
  getTrending = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    const trending = await marketService.getTrendingTokens(limit);

    sendSuccess(res, {
      trending,
      count: Array.isArray(trending) ? trending.length : 0,
    });
  });

  /**
   * GET /api/v1/market/gainers
   * Get top gaining tokens (24h)
   */
  getGainers = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    const gainers = await marketService.getTopGainers(limit);

    sendSuccess(res, {
      gainers,
      count: Array.isArray(gainers) ? gainers.length : 0,
    });
  });

  /**
   * GET /api/v1/market/losers
   * Get top losing tokens (24h)
   */
  getLosers = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    const losers = await marketService.getTopLosers(limit);

    sendSuccess(res, {
      losers,
      count: Array.isArray(losers) ? losers.length : 0,
    });
  });

  /**
   * GET /api/v1/market/sorted
   * Get marketplace tokens sorted by market cap (optimized for frontend marketplace page)
   */
  getMarketplaceSorted = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    const page = parseInt(req.query.page as string) || 1;

    if (limit < 1 || limit > 200) {
      throw new ValidationError('Limit must be between 1 and 200');
    }

    if (page < 1) {
      throw new ValidationError('Page must be >= 1');
    }

    // Get tokens sorted by market cap (descending)
    const result = await tokenService.getTokens({
      page,
      limit,
      sort: 'marketCap',
      order: 'desc',
    });

    sendSuccess(res, {
      tokens: result.tokens,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  });

  /**
   * GET /api/v1/market/recent-trades
   * Get recent trades across all tokens (for trading activity banner)
   */
  getRecentTrades = asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (limit < 1 || limit > 50) {
      throw new ValidationError('Limit must be between 1 and 50');
    }

    const trades = await marketService.getRecentTrades(limit);

    sendSuccess(res, {
      trades,
      count: trades.length,
    });
  });
}

// Export singleton instance
export const marketController = new MarketController();
