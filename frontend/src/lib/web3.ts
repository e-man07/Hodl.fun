import { ethers } from 'ethers';
import { NETWORK_CONFIG, CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_FACTORY_ABI, TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';

// Web3 Provider and Signer
let provider: ethers.BrowserProvider | null = null;
let signer: ethers.JsonRpcSigner | null = null;

// Initialize Web3 connection
export const initWeb3 = async (): Promise<{ provider: ethers.BrowserProvider; signer: ethers.JsonRpcSigner }> => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  return { provider, signer };
};

// Get current provider
export const getProvider = (): ethers.BrowserProvider => {
  if (!provider) {
    throw new Error('Web3 not initialized. Call initWeb3() first.');
  }
  return provider;
};

// Get current signer
export const getSigner = (): ethers.JsonRpcSigner => {
  if (!signer) {
    throw new Error('Signer not available. Connect wallet first.');
  }
  return signer;
};

// Check if connected to correct network
export const checkNetwork = async (): Promise<boolean> => {
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    return Number(network.chainId) === NETWORK_CONFIG.chainId;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
};

// Switch to Push Chain network
export const switchToPushChain = async (): Promise<boolean> => {
  try {
    if (!window.ethereum) return false;

    // Try to switch to the network
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}` }],
      });
      return true;
    } catch (switchError: unknown) {
      // If network doesn't exist, add it
      if ((switchError as { code: number }).code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${NETWORK_CONFIG.chainId.toString(16)}`,
                chainName: NETWORK_CONFIG.chainName,
                rpcUrls: NETWORK_CONFIG.rpcUrls,
                blockExplorerUrls: NETWORK_CONFIG.blockExplorerUrls,
                nativeCurrency: NETWORK_CONFIG.nativeCurrency,
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Error adding network:', addError);
          return false;
        }
      }
      console.error('Error switching network:', switchError);
      return false;
    }
  } catch (error) {
    console.error('Error in switchToPushChain:', error);
    return false;
  }
};

// Contract instances
export const getTokenFactoryContract = () => {
  const signer = getSigner();
  return new ethers.Contract(CONTRACT_ADDRESSES.TokenFactory, TOKEN_FACTORY_ABI, signer);
};

export const getTokenMarketplaceContract = () => {
  const signer = getSigner();
  return new ethers.Contract(CONTRACT_ADDRESSES.TokenMarketplace, TOKEN_MARKETPLACE_ABI, signer);
};

export const getLaunchpadTokenContract = (tokenAddress: string) => {
  const signer = getSigner();
  return new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
};

// Read-only contract instances (for view functions)
export const getTokenFactoryContractReadOnly = () => {
  const provider = getProvider();
  return new ethers.Contract(CONTRACT_ADDRESSES.TokenFactory, TOKEN_FACTORY_ABI, provider);
};

export const getTokenMarketplaceContractReadOnly = () => {
  const provider = getProvider();
  return new ethers.Contract(CONTRACT_ADDRESSES.TokenMarketplace, TOKEN_MARKETPLACE_ABI, provider);
};

export const getLaunchpadTokenContractReadOnly = (tokenAddress: string) => {
  const provider = getProvider();
  return new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);
};

// Utility functions
export const formatEther = (value: bigint | string): string => {
  return ethers.formatEther(value);
};

export const parseEther = (value: string): bigint => {
  return ethers.parseEther(value);
};

export const formatUnits = (value: bigint | string, decimals: number = 18): string => {
  return ethers.formatUnits(value, decimals);
};

export const parseUnits = (value: string, decimals: number = 18): bigint => {
  return ethers.parseUnits(value, decimals);
};

// Get transaction receipt
export const waitForTransaction = async (txHash: string) => {
  const provider = getProvider();
  return await provider.waitForTransaction(txHash);
};

// Error handling
export const handleWeb3Error = (error: unknown): string => {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('user rejected')) {
      return 'Transaction was rejected by user';
    }
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    }
    if (error.message.includes('execution reverted')) {
      return 'Transaction failed - contract execution reverted';
    }
    return error.message;
  }
  return 'An unknown error occurred';
};

// Type definitions for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
