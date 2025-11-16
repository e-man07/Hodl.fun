// IPFS cache warming processor
// Prefetches IPFS metadata for trending tokens to improve load times

import { Job } from 'bull';
import { db } from '../../config/database';
import { ipfsService } from '../../services/ipfsService';
import logger from '../../utils/logger';

interface IPFSCacheJobData {
  type: 'trending' | 'new' | 'all';
  limit?: number;
}

/**
 * Process IPFS cache warming job
 */
export async function processIPFSCacheWarming(job: Job<IPFSCacheJobData>): Promise<void> {
  const { type, limit = 50 } = job.data;

  try {
    logger.info(`Starting IPFS cache warming for type: ${type}`);

    let tokens;

    switch (type) {
      case 'trending':
      case 'new':
        // Get newest tokens (metrics table removed)
        tokens = await db.token.findMany({
          where: {
            tradingEnabled: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        break;

      case 'all':
      default:
        // Get all tokens without cached metadata
        tokens = await db.token.findMany({
          where: {
            metadataCache: { equals: null as any },
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
        break;
    }

    logger.info(`Found ${tokens.length} tokens to cache`);

    let cached = 0;
    let errors = 0;

    // Process in batches of 5 to avoid gateway overload
    const batchSize = 5;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (token) => {
          try {
            if (token.metadataURI) {
              const metadata = await ipfsService.fetchMetadata(token.metadataURI);

              if (metadata) {
                // Update token with cached metadata
                await db.token.update({
                  where: { address: token.address },
                  data: {
                    metadataCache: metadata as any,
                    logoURL: metadata.image || token.logoURL,
                    description: metadata.description || token.description,
                    socialLinks: (metadata.social || token.socialLinks) as any,
                  },
                });

                cached++;
              }
            }
          } catch (error) {
            logger.error(`Failed to cache metadata for token ${token.address}:`, error);
            errors++;
          }
        })
      );

      // Update progress
      await job.progress(((i + batch.length) / tokens.length) * 100);
    }

    logger.info(
      `IPFS cache warming completed: ${cached} cached, ${errors} errors out of ${tokens.length} total`
    );
  } catch (error) {
    logger.error('IPFS cache warming job failed:', error);
    throw error;
  }
}
