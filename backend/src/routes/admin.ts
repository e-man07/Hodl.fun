// Admin routes for system management

import express, { Request, Response } from 'express';
import { syncService } from '../services/syncService';
import logger from '../utils/logger';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { adminRateLimiter } from '../middleware/rateLimit';

const router = express.Router();

// Apply authentication and rate limiting to all admin routes
router.use(adminRateLimiter);
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /admin/sync/status
 * Check sync status
 */
router.get('/sync/status', async (_req: Request, res: Response) => {
  try {
    const status = await syncService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    logger.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      message: error.message,
    });
  }
});

/**
 * POST /admin/sync/tokens
 * Trigger full token sync from blockchain
 */
router.post('/sync/tokens', async (_req: Request, res: Response) => {
  try {
    logger.info('Manual token sync triggered via API');

    // Start sync in background
    syncService.syncAllTokens()
      .then((result) => {
        logger.info('Background token sync completed:', result);
      })
      .catch((error) => {
        logger.error('Background token sync failed:', error);
      });

    res.json({
      success: true,
      message: 'Token sync started in background',
    });
  } catch (error: any) {
    logger.error('Error starting token sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start token sync',
      message: error.message,
    });
  }
});

/**
 * POST /admin/sync/holders/:tokenAddress
 * Sync holders for a specific token
 */
router.post('/sync/holders/:tokenAddress', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;

    logger.info(`Manual holder sync triggered for ${tokenAddress}`);

    // Start sync in background
    syncService.syncTokenHolders(tokenAddress.toLowerCase())
      .then((count) => {
        logger.info(`Background holder sync completed for ${tokenAddress}: ${count} holders`);
      })
      .catch((error) => {
        logger.error(`Background holder sync failed for ${tokenAddress}:`, error);
      });

    res.json({
      success: true,
      message: 'Holder sync started in background',
      tokenAddress: tokenAddress.toLowerCase(),
    });
  } catch (error: any) {
    logger.error('Error starting holder sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start holder sync',
      message: error.message,
    });
  }
});

export default router;
