// Token routes

import { Router } from 'express';
import { tokenController } from '../controllers/tokenController';
import { readRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply read rate limiter to all routes
router.use(readRateLimiter);

/**
 * GET /api/v1/tokens
 * List all tokens with pagination, filtering, and sorting
 * Query params: page, limit, sort, order, search, creator, minMarketCap, maxMarketCap, minPrice, maxPrice
 */
router.get('/', tokenController.getTokens);

/**
 * GET /api/v1/tokens/trending
 * Get trending tokens
 * Query params: limit
 */
router.get('/trending', tokenController.getTrendingTokens);

/**
 * GET /api/v1/tokens/new
 * Get recently launched tokens
 * Query params: limit
 */
router.get('/new', tokenController.getNewTokens);

/**
 * GET /api/v1/tokens/:address
 * Get token details by address
 */
router.get('/:address', tokenController.getTokenByAddress);

/**
 * GET /api/v1/tokens/:address/metrics
 * Get token price history and metrics
 * Query params: period (1h, 24h, 7d, 30d, all)
 */
router.get('/:address/metrics', tokenController.getTokenMetrics);

/**
 * GET /api/v1/tokens/:address/holders
 * Get token holders list
 * Query params: page, limit
 */
router.get('/:address/holders', tokenController.getTokenHolders);

/**
 * GET /api/v1/tokens/:address/trades
 * Get token trade history
 * Query params: page, limit
 */
router.get('/:address/trades', tokenController.getTokenTrades);

/**
 * POST /api/v1/tokens/:address/calculate-buy
 * Calculate how many tokens user will receive for given ETH amount
 * Body: { ethAmount: string }
 */
router.post('/:address/calculate-buy', tokenController.calculateBuyQuote);

/**
 * POST /api/v1/tokens/:address/calculate-sell
 * Calculate how much ETH user will receive for given token amount
 * Body: { tokenAmount: string }
 */
router.post('/:address/calculate-sell', tokenController.calculateSellQuote);

/**
 * GET /api/v1/tokens/:address/balance/:userAddress
 * Get token balance for a specific user address
 */
router.get('/:address/balance/:userAddress', tokenController.getTokenBalance);

/**
 * GET /api/v1/tokens/:address/allowance/:owner/:spender
 * Get token allowance for owner/spender pair
 */
router.get('/:address/allowance/:owner/:spender', tokenController.getAllowance);

/**
 * GET /api/v1/tokens/:address/holder-count
 * Get total number of holders for a token
 */
router.get('/:address/holder-count', tokenController.getHolderCount);

export default router;
