/**
 * IPFS upload utilities using Pinata
 */

const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

interface PinataUploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
  properties?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    website?: string;
  };
}

/**
 * Upload a file to IPFS via Pinata
 */
export async function uploadFileToIPFS(file: File): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  const formData = new FormData();
  formData.append('file', file);

  // Optional: Add metadata about the pin
  const pinataMetadata = JSON.stringify({
    name: file.name,
  });
  formData.append('pinataMetadata', pinataMetadata);

  // Optional: Pin options
  const pinataOptions = JSON.stringify({
    cidVersion: 1,
  });
  formData.append('pinataOptions', pinataOptions);

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload file to IPFS: ${error}`);
  }

  const data: PinataUploadResponse = await response.json();
  return `ipfs://${data.IpfsHash}`;
}

/**
 * Upload JSON metadata to IPFS via Pinata
 */
export async function uploadJSONToIPFS(json: object, name?: string): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error('Pinata JWT not configured');
  }

  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataContent: json,
      pinataMetadata: {
        name: name || 'token-metadata.json',
      },
      pinataOptions: {
        cidVersion: 1,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload JSON to IPFS: ${error}`);
  }

  const data: PinataUploadResponse = await response.json();
  return `ipfs://${data.IpfsHash}`;
}

/**
 * Upload token metadata (logo + JSON) to IPFS
 * Returns the IPFS URI for the metadata JSON
 */
export async function uploadTokenMetadata(
  metadata: Omit<TokenMetadata, 'image'>,
  logoFile?: File
): Promise<string> {
  // If Pinata is not configured, fallback to data URI
  if (!PINATA_JWT) {
    console.warn('Pinata not configured, using data URI fallback');
    const dataUri = `data:application/json;base64,${btoa(
      JSON.stringify({ ...metadata, image: '' })
    )}`;
    return dataUri;
  }

  let imageUri: string | undefined;

  // Upload logo if provided
  if (logoFile) {
    imageUri = await uploadFileToIPFS(logoFile);
  }

  // Create metadata with image URI
  const fullMetadata: TokenMetadata = {
    ...metadata,
    image: imageUri,
  };

  // Upload metadata JSON
  const metadataUri = await uploadJSONToIPFS(fullMetadata, `${metadata.symbol}-metadata.json`);

  return metadataUri;
}

/**
 * Check if IPFS upload is available (Pinata configured)
 */
export function isIPFSConfigured(): boolean {
  return !!PINATA_JWT;
}
