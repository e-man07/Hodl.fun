/**
 * Utility functions for handling IPFS images with fallback gateways
 */

/**
 * Convert IPFS URI to HTTP gateway URL for images
 * Uses Pinata gateway as primary since it's more reliable for images
 * @param ipfsUri IPFS URI (e.g., ipfs://QmHash...)
 * @returns HTTP gateway URL or original URL if not IPFS
 */
export function getIPFSImageUrl(ipfsUri: string): string {
  if (!ipfsUri) {
    return '';
  }
  
  if (ipfsUri.startsWith('ipfs://')) {
    const ipfsHash = ipfsUri.replace('ipfs://', '');
    // Use Pinata gateway for better reliability
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  }
  
  // Return original URL if it's not an IPFS URI
  return ipfsUri;
}

/**
 * Get multiple gateway URLs for IPFS images (for fallback)
 * @param ipfsUri IPFS URI
 * @returns Array of gateway URLs
 */
export function getIPFSImageGateways(ipfsUri: string): string[] {
  if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) {
    return [ipfsUri];
  }
  
  const ipfsHash = ipfsUri.replace('ipfs://', '');
  
  return [
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
    `https://dweb.link/ipfs/${ipfsHash}`,
    `https://ipfs.io/ipfs/${ipfsHash}`
  ];
}

/**
 * React component props for handling IPFS images with fallback
 */
export interface IPFSImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Get image props with IPFS gateway conversion
 * @param src Original image source (could be IPFS URI)
 * @param alt Alt text
 * @param options Additional options
 * @returns Props object for img/Image component
 */
export function getIPFSImageProps(
  src: string, 
  alt: string, 
  options: Partial<IPFSImageProps> = {}
): IPFSImageProps {
  return {
    src: getIPFSImageUrl(src),
    alt,
    ...options
  };
}
