import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QueueName } from '../config/queue-config';
import { IpfsService } from '../../services/ipfs/ipfs.service';
import { PrismaService } from '@core';

/**
 * Metadata Enrichment Processor
 *
 * Fetches and enriches token metadata from IPFS
 * Updates token details with logo, description, social links
 */
@Processor(QueueName.METADATA_ENRICHMENT)
export class MetadataEnrichmentProcessor {
  private readonly logger = new Logger(MetadataEnrichmentProcessor.name);

  constructor(
    private readonly ipfsService: IpfsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process metadata enrichment job
   */
  @Process()
  async process(
    job: Job<{
      tokenId: string;
      tokenAddress: string;
      ipfsHash: string;
    }>,
  ): Promise<any> {
    try {
      const { tokenAddress, ipfsHash } = job.data;

      this.logger.log(
        `Processing metadata enrichment for token ${tokenAddress}: ${ipfsHash}`,
      );

      // Fetch metadata from IPFS
      const metadata = await this.ipfsService.getMetadata(ipfsHash);

      if (!metadata) {
        throw new Error('Failed to retrieve metadata from IPFS');
      }

      // Update token with enriched metadata
      await this.prisma.token.update({
        where: { address: tokenAddress },
        data: {
          name: metadata.name || undefined,
          description: metadata.description || undefined,
          logoURL: metadata.logo || undefined,
          metadataCache: metadata,
          metadataURI: ipfsHash,
        },
      });

      this.logger.log(`Metadata enrichment completed for ${tokenAddress}`);
      return { tokenAddress, ipfsHash, success: true };
    } catch (error) {
      this.logger.error(
        `Metadata enrichment failed for job ${job.id}: ${error.message}`,
      );
      throw error;
    }
  }
}
