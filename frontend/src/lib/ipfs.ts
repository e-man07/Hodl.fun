// IPFS Integration using Pinata
// Real IPFS upload with Pinata service

interface IPFSMetadata {
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  social_links?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

// Upload image file to IPFS
export const uploadImageToIPFS = async (file: File): Promise<string> => {
  try {
    console.log('📤 Uploading image to IPFS:', file.name);

    // Get Pinata credentials from environment
    const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
    const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;

    // Check if credentials are available
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error('IPFS credentials not configured. Please add NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_SECRET_KEY to your .env.local file');
    }

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pinataMetadata', JSON.stringify({
      name: `token-logo-${file.name}`,
      keyvalues: {
        type: 'token-logo',
        platform: 'TokenLaunch',
        network: 'PushChain',
        timestamp: new Date().toISOString()
      }
    }));

    // Real Pinata file upload
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Pinata API error:', response.status, errorText);
      throw new Error(`IPFS image upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const ipfsHash = result.IpfsHash;
    const ipfsURI = `ipfs://${ipfsHash}`;
    
    console.log('✅ Image uploaded to IPFS successfully!');
    console.log('🔗 IPFS Hash:', ipfsHash);
    console.log('🔗 IPFS URI:', ipfsURI);
    console.log('🌐 Gateway URL:', `https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    
    return ipfsURI;

  } catch (error) {
    console.error('❌ IPFS image upload failed:', error);
    
    // Provide specific error messages for different failure types
    if (error instanceof Error) {
      if (error.message.includes('credentials not configured')) {
        throw new Error('IPFS Configuration Error: Missing Pinata API credentials. Please check your .env.local file.');
      } else if (error.message.includes('IPFS image upload failed: 401')) {
        throw new Error('IPFS Authentication Error: Invalid Pinata API credentials. Please check your API key and secret.');
      } else if (error.message.includes('IPFS image upload failed: 403')) {
        throw new Error('IPFS Permission Error: Pinata API key does not have permission to upload files.');
      } else if (error.message.includes('IPFS image upload failed')) {
        throw new Error(`IPFS Upload Error: ${error.message}`);
      } else {
        throw new Error(`IPFS Error: ${error.message}`);
      }
    }
    
    throw new Error('IPFS image upload failed with unknown error');
  }
};

// Real IPFS upload using Pinata
export const uploadMetadataToIPFS = async (metadata: IPFSMetadata): Promise<string> => {
  try {
    console.log('📤 Uploading metadata to IPFS:', metadata);

    // Get Pinata credentials from environment
    const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
    const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;

    // Check if credentials are available
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error('IPFS credentials not configured. Please add NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_SECRET_KEY to your .env.local file');
    }

    // Real Pinata upload
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `${metadata.name}-metadata`,
          keyvalues: {
            tokenName: metadata.name,
            platform: 'TokenLaunch',
            network: 'PushChain',
            timestamp: new Date().toISOString()
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Pinata API error:', response.status, errorText);
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const ipfsHash = result.IpfsHash;
    const ipfsURI = `ipfs://${ipfsHash}`;
    
    console.log('✅ Metadata uploaded to IPFS successfully!');
    console.log('🔗 IPFS Hash:', ipfsHash);
    console.log('🔗 IPFS URI:', ipfsURI);
    console.log('🌐 Gateway URL:', `https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    
    return ipfsURI;

  } catch (error) {
    console.error('❌ IPFS upload failed:', error);
    
    // Provide specific error messages for different failure types
    if (error instanceof Error) {
      if (error.message.includes('credentials not configured')) {
        throw new Error('IPFS Configuration Error: Missing Pinata API credentials. Please check your .env.local file.');
      } else if (error.message.includes('IPFS upload failed: 401')) {
        throw new Error('IPFS Authentication Error: Invalid Pinata API credentials. Please check your API key and secret.');
      } else if (error.message.includes('IPFS upload failed: 403')) {
        throw new Error('IPFS Permission Error: Pinata API key does not have permission to upload files.');
      } else if (error.message.includes('IPFS upload failed')) {
        throw new Error(`IPFS Upload Error: ${error.message}`);
      } else {
        throw new Error(`IPFS Error: ${error.message}`);
      }
    }
    
    throw new Error('IPFS upload failed with unknown error');
  }
};


// Helper to create metadata object
export const createTokenMetadata = async (
  name: string, 
  description: string, 
  socialLinks: { website?: string; twitter?: string; telegram?: string } = {},
  logoFile?: File
): Promise<IPFSMetadata> => {
  let logoURI = '';
  
  // Upload logo if provided
  if (logoFile) {
    try {
      logoURI = await uploadImageToIPFS(logoFile);
      console.log('✅ Logo uploaded to IPFS:', logoURI);
    } catch (error) {
      console.error('❌ Logo upload failed:', error);
      // Continue without logo rather than failing the entire process
    }
  }

  return {
    name,
    description,
    image: logoURI,
    external_url: socialLinks.website || '',
    social_links: {
      website: socialLinks.website || '',
      twitter: socialLinks.twitter || '',
      telegram: socialLinks.telegram || '',
    },
    // Add standard NFT metadata fields
    attributes: [
      {
        trait_type: 'Platform',
        value: 'TokenLaunch'
      },
      {
        trait_type: 'Network',
        value: 'Push Chain'
      },
      {
        trait_type: 'Created',
        value: new Date().toISOString()
      }
    ]
  };
};

// Instructions for setting up real IPFS
export const IPFS_SETUP_INSTRUCTIONS = `
🔧 To enable real IPFS uploads:

1. Sign up at https://pinata.cloud (free tier available)
2. Get your API keys from the dashboard
3. Add to your .env.local file:
   NEXT_PUBLIC_PINATA_API_KEY=your_api_key
   NEXT_PUBLIC_PINATA_SECRET_KEY=your_secret_key
4. Uncomment the real upload code in ipfs.ts
5. Remove the mock upload section

Alternative IPFS services:
- Infura IPFS: https://infura.io/product/ipfs
- Web3.Storage: https://web3.storage/
- NFT.Storage: https://nft.storage/
`;

console.log(IPFS_SETUP_INSTRUCTIONS);
