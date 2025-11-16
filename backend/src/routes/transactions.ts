// Transaction routes

import { Router } from 'express';
import { transactionController } from '../controllers/transactionController';
import { readRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Apply read rate limiter to all routes
router.use(readRateLimiter);

/**
 * GET /api/v1/transactions/:hash/status
 * Get transaction status and details
 */
router.get('/:hash/status', transactionController.getTransactionStatus);

export default router;
