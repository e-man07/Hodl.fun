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
  // This handles gateway URLs that are already in the correct format
  return ipfsUri;
}

/**
 * Extract IPFS hash from IPFS URI for fallback gateways
 * @param ipfsUri IPFS URI (e.g., ipfs://QmHash...)
 * @returns IPFS hash or null
 */
function extractIPFSHash(ipfsUri: string): string | null {
  if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) {
    return null;
  }
  
  const hash = ipfsUri.replace('ipfs://', '').trim();
  // Remove any trailing slashes or query params
  return hash.split('/')[0].split('?')[0] || null;
}

/**
 * Get multiple gateway URLs for IPFS images (for fallback)
 * @param ipfsUri IPFS URI
 * @returns Array of gateway URLs
 */
export function getIPFSImageGateways(ipfsUri: string): string[] {
  if (!ipfsUri) {
    return [];
  }
  
  // Extract hash from ipfs:// URI
  const hash = extractIPFSHash(ipfsUri);
  
  if (hash) {
    return [
      `https://gateway.pinata.cloud/ipfs/${hash}`,
      `https://cloudflare-ipfs.com/ipfs/${hash}`,
      `https://dweb.link/ipfs/${hash}`,
      `https://ipfs.io/ipfs/${hash}`
    ];
  }
  
  // If it's already a gateway URL, return it as-is (no fallbacks needed)
  return [ipfsUri];
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

/**
 * Create an onError handler that tries fallback gateways
 * Uses a closure to track which gateway we're currently trying
 * @param originalSrc Original image source
 * @returns onError handler function
 */
export function createIPFSImageErrorHandler(
  originalSrc: string
): (e: React.SyntheticEvent<HTMLImageElement>) => void {
  const gateways = getIPFSImageGateways(originalSrc);
  
  // Only create handler if we have multiple gateways to try
  if (gateways.length <= 1) {
    return () => {
      // No fallbacks available - this is fine, just log it
      console.warn('❌ No fallback gateways available for:', originalSrc);
    };
  }

  // Use a Map to track current gateway index per image element
  // Using a data attribute as key since React may recreate elements
  const gatewayIndexMap = new Map<string, number>();

  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    
    // Use a unique identifier for this image (src or a data attribute)
    const imageKey = target.getAttribute('data-ipfs-key') || target.src || originalSrc;
    
    // Get current gateway index for this image (default to 0 if first error)
    let currentIndex = gatewayIndexMap.get(imageKey) ?? 0;
    
    // Try next gateway
    currentIndex++;
    if (currentIndex < gateways.length) {
      const nextGateway = gateways[currentIndex];
      console.log(`🔄 Trying fallback gateway ${currentIndex + 1}/${gateways.length}:`, nextGateway);
      
      // Update the image src to try the next gateway
      gatewayIndexMap.set(imageKey, currentIndex);
      target.src = nextGateway;
    } else {
      console.warn('❌ All IPFS gateways failed for:', originalSrc);
      // All gateways failed - hide the image so fallback UI can show
      target.style.display = 'none';
    }
  };
}
