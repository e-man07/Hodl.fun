/**
 * Optimized IPFS metadata fetching with caching and gateway racing
 */

import { getCachedIPFS, setCachedIPFS } from './tokenCache';

interface TokenMetadata {
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  social_links?: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
}

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
] as const;

const GATEWAY_TIMEOUT = 8000; // 8 seconds per gateway

/**
 * Fetch from a single gateway with timeout
 */
async function fetchFromGateway(
  gatewayUrl: string,
  timeout: number
): Promise<TokenMetadata> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(gatewayUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Race all IPFS gateways concurrently
 */
async function raceGateways(ipfsHash: string): Promise<TokenMetadata> {
  const gatewayUrls = IPFS_GATEWAYS.map(gateway => `${gateway}${ipfsHash}`);

  // Create promises for all gateways
  const promises = gatewayUrls.map(url =>
    fetchFromGateway(url, GATEWAY_TIMEOUT)
      .then(data => ({ success: true as const, data, url }))
      .catch(error => ({ success: false as const, error, url }))
  );

  // Race all promises and return first successful one
  const results = await Promise.all(promises);

  // Find first successful result
  const successResult = results.find(r => r.success);

  if (successResult && successResult.success) {
    console.log('✅ IPFS fetch succeeded from:', successResult.url);
    return successResult.data;
  }

  // All failed, throw error with details
  const errors = results
    .filter(r => !r.success)
    .map(r => r.success === false && `${r.url}: ${r.error}`)
    .join(', ');

  throw new Error(`All IPFS gateways failed: ${errors}`);
}

/**
 * Fetch IPFS metadata with caching
 */
export async function fetchIPFSMetadata(
  metadataURI: string
): Promise<TokenMetadata | null> {
  try {
    // Handle data URIs (inline JSON)
    if (metadataURI && metadataURI.startsWith('data:application/json,')) {
      try {
        const jsonData = decodeURIComponent(
          metadataURI.replace('data:application/json,', '')
        );
        const metadata = JSON.parse(jsonData);
        console.log('✅ Parsed inline metadata');
        return metadata;
      } catch (parseError) {
        console.warn('Failed to parse inline metadata:', parseError);
        return null;
      }
    }

    // Validate IPFS URI
    if (!metadataURI || !metadataURI.startsWith('ipfs://')) {
      console.warn('Invalid metadata URI:', metadataURI);
      return null;
    }

    // Extract IPFS hash
    const ipfsHash = metadataURI.replace('ipfs://', '');

    // Validate hash
    if (ipfsHash.includes('QmHash') || ipfsHash.length < 40) {
      console.warn('Placeholder or invalid IPFS hash:', ipfsHash);
      return null;
    }

    // Check cache first
    const cached = getCachedIPFS<TokenMetadata>(ipfsHash);
    if (cached) {
      console.log('✅ IPFS metadata from cache:', ipfsHash);
      return cached;
    }

    // Fetch from IPFS with gateway racing
    console.log('🔄 Fetching IPFS metadata:', ipfsHash);
    const metadata = await raceGateways(ipfsHash);

    // Cache the result
    setCachedIPFS(ipfsHash, metadata);

    return metadata;
  } catch (error) {
    console.warn('Error fetching IPFS metadata:', error);
    return null;
  }
}

/**
 * Prefetch multiple IPFS hashes in background
 */
export function prefetchIPFSMetadata(hashes: string[]): void {
  // Fetch in background without blocking
  hashes.forEach(hash => {
    if (hash && !getCachedIPFS(hash)) {
      fetchIPFSMetadata(`ipfs://${hash}`).catch(() => {
        // Silent fail for prefetch
      });
    }
  });
}
