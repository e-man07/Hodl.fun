import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Interface for IPFS token metadata
 */
export interface IpfsMetadata {
  name?: string;
  description?: string;
  logo?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  [key: string]: string | undefined;
}

/**
 * IPFS Service
 *
 * Handles metadata uploads and retrieval from Pinata IPFS gateway
 * Manages token metadata (logo, description, social links, etc.)
 * Provides caching and error handling for IPFS operations
 */
@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private readonly apiClient: AxiosInstance;
  private readonly gatewayUrl = 'https://gateway.pinata.cloud/ipfs';

  constructor(private readonly config: ConfigService) {
    const pinataJwt = this.config.get<string>('PINATA_JWT');

    if (!pinataJwt) {
      this.logger.warn('PINATA_JWT not configured - IPFS uploads will be disabled');
    }

    // Create axios instance with Pinata API credentials
    this.apiClient = axios.create({
      baseURL: 'https://api.pinata.cloud',
      headers: {
        Authorization: pinataJwt ? `Bearer ${pinataJwt}` : undefined,
      },
    });
  }

  /**
   * Upload JSON metadata to IPFS
   * Returns IPFS hash if successful
   */
  async uploadMetadata(metadata: {
    name: string;
    symbol: string;
    description?: string;
    logo?: string;
    socials?: {
      twitter?: string;
      telegram?: string;
      website?: string;
      discord?: string;
    };
  }): Promise<string> {
    try {
      if (!this.config.get<string>('PINATA_JWT')) {
        throw new Error('PINATA_JWT not configured');
      }

      const response = await this.apiClient.post('/pinning/pinJSONToIPFS', metadata, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const ipfsHash = response.data.IpfsHash;
      this.logger.log(`Metadata uploaded to IPFS: ${ipfsHash}`);

      return ipfsHash;
    } catch (error) {
      this.logger.error(`Error uploading metadata to IPFS: ${error.message}`);
      throw new BadRequestException('Failed to upload metadata to IPFS');
    }
  }

  /**
   * Upload file to IPFS
   * Returns IPFS hash if successful
   */
  async uploadFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    try {
      if (!this.config.get<string>('PINATA_JWT')) {
        throw new Error('PINATA_JWT not configured');
      }

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      formData.append('file', blob, fileName);

      const response = await this.apiClient.post('/pinning/pinFileToIPFS', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const ipfsHash = response.data.IpfsHash;
      this.logger.log(`File uploaded to IPFS: ${ipfsHash}`);

      return ipfsHash;
    } catch (error) {
      this.logger.error(`Error uploading file to IPFS: ${error.message}`);
      throw new BadRequestException('Failed to upload file to IPFS');
    }
  }

  /**
   * Retrieve metadata from IPFS
   */
  async getMetadata(ipfsHash: string): Promise<IpfsMetadata> {
    try {
      const url = `${this.gatewayUrl}/${ipfsHash}`;
      const response = await axios.get(url, { timeout: 10000 });
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error retrieving metadata from IPFS ${ipfsHash}: ${error.message}`,
      );
      throw new BadRequestException('Failed to retrieve metadata from IPFS');
    }
  }

  /**
   * Retrieve file from IPFS as buffer
   */
  async getFile(ipfsHash: string): Promise<Buffer> {
    try {
      const url = `${this.gatewayUrl}/${ipfsHash}`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Error retrieving file from IPFS ${ipfsHash}: ${error.message}`);
      throw new BadRequestException('Failed to retrieve file from IPFS');
    }
  }

  /**
   * Pin content to IPFS (make it permanent)
   */
  async pinContent(ipfsHash: string): Promise<boolean> {
    try {
      if (!this.config.get<string>('PINATA_JWT')) {
        throw new Error('PINATA_JWT not configured');
      }

      await this.apiClient.post('/pinning/pinByHash', {
        hashToPin: ipfsHash,
      });

      this.logger.log(`Content pinned to IPFS: ${ipfsHash}`);
      return true;
    } catch (error) {
      this.logger.error(`Error pinning content to IPFS: ${error.message}`);
      return false;
    }
  }

  /**
   * Unpin content from IPFS
   */
  async unpinContent(ipfsHash: string): Promise<boolean> {
    try {
      if (!this.config.get<string>('PINATA_JWT')) {
        throw new Error('PINATA_JWT not configured');
      }

      await this.apiClient.delete(`/pinning/unpin/${ipfsHash}`);

      this.logger.log(`Content unpinned from IPFS: ${ipfsHash}`);
      return true;
    } catch (error) {
      this.logger.error(`Error unpinning content from IPFS: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify if content exists on IPFS
   */
  async verifyContent(ipfsHash: string): Promise<boolean> {
    try {
      const url = `${this.gatewayUrl}/${ipfsHash}`;
      const response = await axios.head(url, { timeout: 5000 });
      return response.status === 200;
    } catch {
      this.logger.debug(`Content not found on IPFS: ${ipfsHash}`);
      return false;
    }
  }

  /**
   * Build gateway URL for accessing IPFS content
   */
  getGatewayUrl(ipfsHash: string): string {
    return `${this.gatewayUrl}/${ipfsHash}`;
  }

  /**
   * Health check - verify Pinata connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.config.get<string>('PINATA_JWT')) {
        this.logger.warn('PINATA_JWT not configured - IPFS service unavailable');
        return false;
      }

      await this.apiClient.get('/data/testAuthentication');
      return true;
    } catch (error) {
      this.logger.error(`IPFS health check failed: ${error.message}`);
      return false;
    }
  }
}
