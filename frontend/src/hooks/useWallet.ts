'use client';

import { useState, useEffect, useCallback } from 'react';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string;
  chainId: number | null;
  isCorrectNetwork: boolean;
}

const PUSH_CHAIN_ID = 42101;
const PUSH_CHAIN_CONFIG = {
  chainId: `0x${PUSH_CHAIN_ID.toString(16)}`,
  chainName: 'Push Chain Testnet',
  rpcUrls: ['https://evm.rpc-testnet-donut-node1.push.org/'],
  blockExplorerUrls: ['https://donut.push.network'],
  nativeCurrency: {
    name: 'PUSH',
    symbol: 'PUSH',
    decimals: 18,
  },
};

export const useWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: '0',
    chainId: null,
    isCorrectNetwork: false,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && window.ethereum;
  }, []);

  // Update balance
  const updateBalance = useCallback(async (address: string) => {
    if (!window.ethereum) return;
    
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }) as string;
      // Convert from wei to ether
      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18);
      setWalletState(prev => ({ ...prev, balance: balanceInEth.toFixed(4) }));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, []);

  // Check network
  const checkNetwork = useCallback(async () => {
    if (!window.ethereum) return false;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      const currentChainId = parseInt(chainId, 16);
      const isCorrect = currentChainId === PUSH_CHAIN_ID;
      
      setWalletState(prev => ({ 
        ...prev, 
        chainId: currentChainId, 
        isCorrectNetwork: isCorrect 
      }));
      
      return isCorrect;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  }, []);

  // Switch to Push Chain
  const switchToPushChain = useCallback(async () => {
    if (!window.ethereum) return false;

    try {
      // Try to switch to the network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: PUSH_CHAIN_CONFIG.chainId }],
      });
      return true;
    } catch (switchError: unknown) {
      // If network doesn't exist, add it
      if (switchError && typeof switchError === 'object' && 'code' in switchError && (switchError as { code: number }).code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [PUSH_CHAIN_CONFIG],
          });
          return true;
        } catch (addError) {
          console.error('Error adding network:', addError);
          setError('Failed to add Push Chain network');
          return false;
        }
      }
      console.error('Error switching network:', switchError);
      setError('Failed to switch to Push Chain network');
      return false;
    }
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request account access
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      
      // Check and switch network if needed
      const isCorrectNetwork = await checkNetwork();
      if (!isCorrectNetwork) {
        const switched = await switchToPushChain();
        if (!switched) {
          setError('Please switch to Push Chain network to continue');
          setIsConnecting(false);
          return;
        }
      }

      // Update wallet state
      setWalletState(prev => ({
        ...prev,
        isConnected: true,
        address,
        isCorrectNetwork: true,
      }));

      // Update balance
      await updateBalance(address);

      console.log('✅ Wallet connected:', address);
    } catch (error: unknown) {
      console.error('❌ Error connecting wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled, checkNetwork, switchToPushChain, updateBalance]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setWalletState({
      isConnected: false,
      address: null,
      balance: '0',
      chainId: null,
      isCorrectNetwork: false,
    });
    setError(null);
    console.log('🔌 Wallet disconnected');
  }, []);

  // Handle account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0] !== walletState.address) {
        setWalletState(prev => ({ ...prev, address: accounts[0] }));
        updateBalance(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      checkNetwork();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [walletState.address, updateBalance, checkNetwork, disconnectWallet]);

  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if already connected on mount
  useEffect(() => {
    if (!mounted) return;
    
    const checkConnection = async () => {
      if (!window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        if (accounts.length > 0) {
          setWalletState(prev => ({
            ...prev,
            isConnected: true,
            address: accounts[0],
          }));
          await checkNetwork();
          await updateBalance(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    };

    checkConnection();
  }, [mounted, checkNetwork, updateBalance]);

  return {
    ...walletState,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    switchToPushChain,
    isMetaMaskInstalled: mounted ? isMetaMaskInstalled() : false,
    mounted,
  };
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
