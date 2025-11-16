#!/usr/bin/env tsx
/**
 * Enrich existing tokens with metadata from IPFS
 * This can run separately from the main sync to add metadata to already-synced tokens
 */

import { ethers } from 'ethers';
import axios from 'axios';
import { db } from '../src/config/database';
import { rpcService } from '../src/services/rpcService';
import logger from '../src/utils/logger';

// Multiple IPFS gateways for rotation (avoid rate limits)
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/',
  'https://nftstorage.link/ipfs/',
];

let currentGatewayIndex = 0;

function getNextGateway(): string {
  const gateway = IPFS_GATEWAYS[currentGatewayIndex];
  currentGatewayIndex = (currentGatewayIndex + 1) % IPFS_GATEWAYS.length;
  return gateway;
}

function extractIPFSHash(uri: string): string | null {
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

async function fetchFromIPFS(ipfsHash: string, maxRetries: number = 3): Promise<any> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    const gateway = getNextGateway();
    const url = `${gateway}${ipfsHash}`;

    try {
      logger.debug(`Fetching from ${gateway}...`);
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        }
      });
      return response.data;
    } catch (error: any) {
      lastError = error;
      logger.debug(`Failed with ${gateway}: ${error.message}`);

      // Wait before trying next gateway (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw lastError;
}

async function enrichTokenMetadata(tokenAddress: string): Promise<boolean> {
  try {
    const provider = rpcService.getProvider();

    // Create token contract with metadataURI function
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function metadataURI() view returns (string)'],
      provider
    );

    // Get metadata URI from token contract
    let metadataURI = '';
    try {
      metadataURI = await tokenContract.metadataURI();
      logger.debug(`Token ${tokenAddress} has metadataURI: ${metadataURI}`);
    } catch (error) {
      logger.debug(`Token ${tokenAddress} has no metadataURI function`);
      return false;
    }

    if (!metadataURI || metadataURI.trim() === '') {
      logger.debug(`Token ${tokenAddress} has empty metadataURI`);
      return false;
    }

    // Extract IPFS hash
    const ipfsHash = extractIPFSHash(metadataURI);
    if (!ipfsHash) {
      logger.warn(`Invalid IPFS URI format: ${metadataURI}`);
      return false;
    }

    // Fetch metadata from IPFS with gateway rotation
    let metadata: any = null;
    try {
      metadata = await fetchFromIPFS(ipfsHash);
    } catch (error: any) {
      logger.warn(`Failed to fetch IPFS metadata for ${tokenAddress}: ${error.message}`);
      // Still update the metadataURI even if fetch failed
      await db.token.update({
        where: { address: tokenAddress },
        data: { metadataURI }
      });
      return false;
    }

    if (!metadata) {
      logger.debug(`No metadata returned for ${tokenAddress}`);
      await db.token.update({
        where: { address: tokenAddress },
        data: { metadataURI }
      });
      return false;
    }

    // Process the logo image URL
    let logoURL = null;
    if (metadata.image) {
      // Convert IPFS URI to gateway URL
      const imageHash = extractIPFSHash(metadata.image);
      if (imageHash) {
        logoURL = `${getNextGateway()}${imageHash}`;

        // Cache the image blob URL in IPFSCache table
        try {
          await db.iPFSCache.upsert({
            where: { ipfsHash: imageHash },
            create: {
              ipfsHash: imageHash,
              contentType: 'image',
              blobURL: logoURL,
              pinned: false,
            },
            update: {
              blobURL: logoURL,
              lastAccessed: new Date(),
            }
          });
        } catch (err) {
          logger.debug(`Failed to cache image blob URL for ${tokenAddress}`);
        }
      } else {
        // If not IPFS, use the URL directly
        logoURL = metadata.image;
      }
    }

    // Update token with full metadata
    await db.token.update({
      where: { address: tokenAddress },
      data: {
        metadataURI,
        metadataCache: metadata as any,
        logoURL: logoURL,
        description: metadata.description || null,
        socialLinks: metadata.social as any,
      }
    });

    logger.info(`✅ Enriched metadata for ${tokenAddress}`);
    return true;

  } catch (error: any) {
    logger.error(`Error enriching token ${tokenAddress}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Token Metadata Enrichment');
  console.log('='.repeat(60));
  console.log();

  try {
    // Get tokens that need enrichment (no metadata yet)
    console.log('Fetching tokens that need enrichment...');
    const tokens = await db.token.findMany({
      where: {
        OR: [
          { metadataCache: { equals: null as any } },
          { logoURL: null },
          { description: null }
        ]
      },
      select: { address: true, name: true, symbol: true, metadataURI: true },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${tokens.length} tokens needing enrichment\n`);

    if (tokens.length === 0) {
      console.log('No tokens to enrich. Run sync first!');
      process.exit(0);
    }

    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    // Process each token
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      console.log(`[${i + 1}/${tokens.length}] Processing ${token.name} (${token.symbol})...`);

      const success = await enrichTokenMetadata(token.address);
      if (success) {
        enriched++;
      } else {
        skipped++;
      }

      // Progress update
      if ((i + 1) % 10 === 0) {
        console.log(`\nProgress: ${i + 1}/${tokens.length} processed`);
        console.log(`  Enriched: ${enriched}`);
        console.log(`  Skipped: ${skipped}`);
        console.log(`  Errors: ${errors}\n`);
      }

      // Rate limiting - don't hammer IPFS gateways
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('ENRICHMENT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Enriched:  ${enriched} tokens with metadata`);
    console.log(`⏭️  Skipped:   ${skipped} tokens (no metadata or failed)`);
    console.log(`❌ Errors:    ${errors} tokens`);
    console.log('='.repeat(60));

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Enrichment failed:', error.message);
    process.exit(1);
  }
}

main();
