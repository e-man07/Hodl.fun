// IPFS service using Pinata with security and caching

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { ipfsConfig, cacheConfig } from '../config';
import { db } from '../config/database';
import { cacheService } from '../config/redis';
import logger from '../utils/logger';
import { TokenMetadata, IPFSUploadResponse, AppError } from '../types';

export class IPFSService {
  private client: AxiosInstance;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.pinata.cloud',
      headers: {
        'pinata_api_key': ipfsConfig.apiKey,
        'pinata_secret_api_key': ipfsConfig.secretKey,
      },
      timeout: 30000, // 30 seconds
    });
  }

  /**
   * Upload image to IPFS
   */
  async uploadImage(
    file: Express.Multer.File,
    metadata?: { name: string }
  ): Promise<IPFSUploadResponse> {
    // Validate file
    this.validateImageFile(file);

    try {
      const formData = new FormData();
      formData.append('file', file.buffer, file.originalname);

      if (metadata) {
        formData.append('pinataMetadata', JSON.stringify(metadata));
      }

      const response = await this.client.post('/pinning/pinFileToIPFS', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      const ipfsHash = response.data.IpfsHash;
      const url = `${ipfsConfig.gatewayUrl}${ipfsHash}`;

      // Cache in database
      await this.cacheIPFSData(ipfsHash, 'image', null, url);

      logger.info(`Image uploaded to IPFS: ${ipfsHash}`);

      return {
        ipfsHash,
        url,
        size: file.size,
        pinned: true,
      };
    } catch (error: any) {
      logger.error('IPFS image upload failed:', error);
      throw new AppError('Failed to upload image to IPFS', 500);
    }
  }

  /**
   * Upload JSON metadata to IPFS
   */
  async uploadJSON(
    metadata: TokenMetadata
  ): Promise<IPFSUploadResponse> {
    // Validate metadata
    this.validateMetadata(metadata);

    try {
      const response = await this.client.post('/pinning/pinJSONToIPFS', {
        pinataContent: metadata,
        pinataMetadata: {
          name: `${metadata.name}-metadata`,
        },
      });

      const ipfsHash = response.data.IpfsHash;
      const url = `${ipfsConfig.gatewayUrl}${ipfsHash}`;

      // Cache in database
      await this.cacheIPFSData(ipfsHash, 'json', metadata, url);

      logger.info(`JSON metadata uploaded to IPFS: ${ipfsHash}`);

      return {
        ipfsHash,
        url,
        size: JSON.stringify(metadata).length,
        pinned: true,
      };
    } catch (error: any) {
      logger.error('IPFS JSON upload failed:', error);
      throw new AppError('Failed to upload metadata to IPFS', 500);
    }
  }

  /**
   * Fetch metadata from IPFS with caching
   */
  async fetchMetadata(ipfsUri: string): Promise<TokenMetadata | null> {
    const ipfsHash = this.extractIPFSHash(ipfsUri);

    if (!ipfsHash) {
      logger.warn(`Invalid IPFS URI: ${ipfsUri}`);
      return null;
    }

    // Check cache first
    const cached = await this.getCachedMetadata(ipfsHash);
    if (cached) {
      logger.debug(`Metadata cache hit: ${ipfsHash}`);
      return cached;
    }

    // Fetch from IPFS gateways
    const gateways = [
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
      `https://ipfs.io/ipfs/${ipfsHash}`,
    ];

    for (const gatewayUrl of gateways) {
      try {
        const response = await axios.get(gatewayUrl, {
          timeout: 10000,
        });

        const metadata = response.data as TokenMetadata;

        // Cache the result with the gateway URL as blobURL for JSON
        await this.cacheIPFSData(ipfsHash, 'json', metadata, gatewayUrl);

        logger.info(`Metadata fetched from IPFS: ${ipfsHash}`);
        return metadata;
      } catch (error) {
        logger.debug(`Failed to fetch from gateway: ${gatewayUrl}`);
        continue;
      }
    }

    logger.error(`Failed to fetch metadata from all gateways: ${ipfsHash}`);
    return null;
  }

  /**
   * Get cached metadata from database
   */
  private async getCachedMetadata(ipfsHash: string): Promise<TokenMetadata | null> {
    try {
      // Try Redis first
      const redisKey = `ipfs:metadata:${ipfsHash}`;
      const redisCache = await cacheService.get<TokenMetadata>(redisKey);

      if (redisCache) {
        return redisCache;
      }

      // Try database
      const dbCache = await db.iPFSCache.findUnique({
        where: { ipfsHash },
      });

      if (dbCache && dbCache.data) {
        const metadata = dbCache.data as unknown as TokenMetadata;

        // Warm up Redis cache
        await cacheService.set(redisKey, metadata, cacheConfig.ttl.metadata / 1000);

        // Update last accessed
        await db.iPFSCache.update({
          where: { ipfsHash },
          data: { lastAccessed: new Date() },
        });

        return metadata;
      }

      return null;
    } catch (error) {
      logger.error(`Error fetching cached metadata: ${ipfsHash}`, error);
      return null;
    }
  }

  /**
   * Cache IPFS data in database
   */
  private async cacheIPFSData(
    ipfsHash: string,
    contentType: string,
    data?: TokenMetadata | null,
    blobURL?: string
  ): Promise<void> {
    try {
      await db.iPFSCache.upsert({
        where: { ipfsHash },
        create: {
          ipfsHash,
          contentType,
          data: data as any,
          blobURL,
          pinned: true,
        },
        update: {
          data: data as any,
          blobURL,
          lastAccessed: new Date(),
        },
      });

      // Also cache in Redis if available
      if (data && cacheService.isAvailable()) {
        const redisKey = `ipfs:metadata:${ipfsHash}`;
        await cacheService.set(redisKey, data, cacheConfig.ttl.metadata / 1000);
      }
    } catch (error) {
      logger.error('Failed to cache IPFS data:', error);
    }
  }

  /**
   * Extract IPFS hash from various URI formats
   */
  private extractIPFSHash(uri: string): string | null {
    if (!uri) return null;

    // ipfs://hash
    if (uri.startsWith('ipfs://')) {
      return uri.replace('ipfs://', '');
    }

    // https://gateway.../ipfs/hash
    const match = uri.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // Assume it's already a hash
    if (uri.match(/^[a-zA-Z0-9]+$/)) {
      return uri;
    }

    return null;
  }

  /**
   * Validate image file
   */
  private validateImageFile(file: Express.Multer.File): void {
    if (!file) {
      throw new AppError('No file provided', 400);
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new AppError('File size exceeds 10MB limit', 400);
    }

    if (!this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new AppError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed', 400);
    }

    // Additional security: Check file buffer for malicious content
    // This is a basic check - in production, use a proper antivirus/scanner
    const buffer = file.buffer.toString('hex', 0, Math.min(file.size, 100));
    if (buffer.includes('3c736372697074')) { // "<script" in hex
      throw new AppError('Suspicious file content detected', 400);
    }
  }

  /**
   * Validate metadata
   */
  private validateMetadata(metadata: TokenMetadata): void {
    if (!metadata.name || metadata.name.length > 100) {
      throw new AppError('Invalid token name', 400);
    }

    if (!metadata.symbol || metadata.symbol.length > 20) {
      throw new AppError('Invalid token symbol', 400);
    }

    if (metadata.description && metadata.description.length > 1000) {
      throw new AppError('Description too long (max 1000 characters)', 400);
    }

    // Sanitize text fields to prevent XSS
    metadata.name = this.sanitizeText(metadata.name);
    metadata.symbol = this.sanitizeText(metadata.symbol);
    if (metadata.description) {
      metadata.description = this.sanitizeText(metadata.description);
    }
  }

  /**
   * Basic text sanitization
   */
  private sanitizeText(text: string): string {
    return text
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }
}

// Export singleton instance
export const ipfsService = new IPFSService();
