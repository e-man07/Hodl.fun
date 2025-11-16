// User routes

import { Router } from 'express';
import { userController } from '../controllers/userController';
import { readRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply read rate limiter to all routes
router.use(readRateLimiter);

/**
 * GET /api/v1/users/:address/portfolio
 * Get user portfolio with all holdings
 */
router.get('/:address/portfolio', userController.getPortfolio);

/**
 * GET /api/v1/users/:address/transactions
 * Get user transaction history
 * Query params: page, limit
 */
router.get('/:address/transactions', userController.getTransactions);

/**
 * GET /api/v1/users/:address/created
 * Get tokens created by user
 */
router.get('/:address/created', userController.getCreatedTokens);

/**
 * GET /api/v1/users/:address/pnl
 * Get user profit/loss summary
 */
router.get('/:address/pnl', userController.getPnLSummary);

export default router;
