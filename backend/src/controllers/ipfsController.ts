// IPFS controller - Handles file uploads

import { Request, Response } from 'express';
import { ipfsService } from '../services/ipfsService';
import { sendSuccess, sendError } from '../utils/response';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError, TokenMetadata } from '../types';
import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export class IPFSController {
  // Multer middleware for file upload
  uploadMiddleware = upload.single('file');

  /**
   * POST /api/v1/ipfs/upload-image
   * Upload image to IPFS
   */
  uploadImage = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const metadata = req.body.name ? { name: req.body.name } : undefined;

    const result = await ipfsService.uploadImage(req.file, metadata);

    sendSuccess(res, result, 'Image uploaded successfully', 201);
  });

  /**
   * POST /api/v1/ipfs/upload-metadata
   * Upload JSON metadata to IPFS
   */
  uploadMetadata = asyncHandler(async (req: Request, res: Response) => {
    const metadata = req.body as TokenMetadata;

    // Validate required fields
    if (!metadata.name || !metadata.symbol) {
      throw new ValidationError('Name and symbol are required');
    }

    const result = await ipfsService.uploadJSON(metadata);

    sendSuccess(res, result, 'Metadata uploaded successfully', 201);
  });

  /**
   * GET /api/v1/ipfs/:hash
   * Fetch metadata from IPFS (cached)
   */
  getMetadata = asyncHandler(async (req: Request, res: Response) => {
    const { hash } = req.params;

    if (!hash) {
      throw new ValidationError('IPFS hash required');
    }

    const metadata = await ipfsService.fetchMetadata(hash);

    if (!metadata) {
      sendError(res, 'Metadata not found or failed to fetch', 404);
      return;
    }

    sendSuccess(res, metadata);
  });
}

// Export singleton instance
export const ipfsController = new IPFSController();
