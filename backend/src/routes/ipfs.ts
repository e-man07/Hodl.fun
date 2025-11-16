// IPFS routes

import { Router } from 'express';
import { ipfsController } from '../controllers/ipfsController';
import { uploadRateLimiter, readRateLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * POST /api/v1/ipfs/upload-image
 * Upload image to IPFS
 * Content-Type: multipart/form-data
 * Body: file (image file), name (optional)
 */
router.post(
  '/upload-image',
  uploadRateLimiter,
  ipfsController.uploadMiddleware,
  ipfsController.uploadImage
);

/**
 * POST /api/v1/ipfs/upload-metadata
 * Upload JSON metadata to IPFS
 * Content-Type: application/json
 * Body: TokenMetadata object
 */
router.post(
  '/upload-metadata',
  uploadRateLimiter,
  ipfsController.uploadMetadata
);

/**
 * GET /api/v1/ipfs/:hash
 * Fetch metadata from IPFS (with caching)
 */
router.get(
  '/:hash',
  readRateLimiter,
  ipfsController.getMetadata
);

export default router;
