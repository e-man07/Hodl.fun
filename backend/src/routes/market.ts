// Market routes

import { Router } from 'express';
import { marketController } from '../controllers/marketController';
import { readRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply read rate limiter to all routes
router.use(readRateLimiter);

/**
 * GET /api/v1/market/stats
 * Get global market statistics
 */
router.get('/stats', marketController.getStats);

/**
 * GET /api/v1/market/trending
 * Get trending tokens
 * Query params: limit
 */
router.get('/trending', marketController.getTrending);

/**
 * GET /api/v1/market/gainers
 * Get top gaining tokens (24h)
 * Query params: limit
 */
router.get('/gainers', marketController.getGainers);

/**
 * GET /api/v1/market/losers
 * Get top losing tokens (24h)
 * Query params: limit
 */
router.get('/losers', marketController.getLosers);

/**
 * GET /api/v1/market/sorted
 * Get marketplace tokens sorted by market cap
 * Query params: page, limit
 */
router.get('/sorted', marketController.getMarketplaceSorted);

/**
 * GET /api/v1/market/recent-trades
 * Get recent trades across all tokens (for trading activity banner)
 * Query params: limit (default 10, max 50)
 */
router.get('/recent-trades', marketController.getRecentTrades);

export default router;
