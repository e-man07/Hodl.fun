'use client';

import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { NETWORK } from '@/lib/contracts/config';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string;
  chainId: number | null;
  isCorrectNetwork: boolean;
}

export function useWallet() {
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

  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && !!window.ethereum;
  }, []);

  const updateBalance = useCallback(async (address: string) => {
    if (!window.ethereum) return;

    try {
      const balance = (await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      })) as string;
      const balanceInEth = parseInt(balance, 16) / 1e18;
      setWalletState((prev) => ({ ...prev, balance: balanceInEth.toFixed(4) }));
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  }, []);

  const checkNetwork = useCallback(async () => {
    if (!window.ethereum) return false;

    try {
      const chainId = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string;
      const currentChainId = parseInt(chainId, 16);
      const isCorrect = currentChainId === NETWORK.chainId;

      setWalletState((prev) => ({
        ...prev,
        chainId: currentChainId,
        isCorrectNetwork: isCorrect,
      }));

      return isCorrect;
    } catch (err) {
      console.error('Error checking network:', err);
      return false;
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return false;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK.chainIdHex }],
      });
      return true;
    } catch (switchError: unknown) {
      // Chain not added, try to add it
      if (
        switchError &&
        typeof switchError === 'object' &&
        'code' in switchError &&
        (switchError as { code: number }).code === 4902
      ) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: NETWORK.chainIdHex,
                chainName: NETWORK.name,
                rpcUrls: [NETWORK.rpcUrl],
                blockExplorerUrls: [NETWORK.blockExplorer],
                nativeCurrency: NETWORK.nativeCurrency,
              },
            ],
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

  const connect = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = (await window.ethereum!.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];

      const isCorrectNetwork = await checkNetwork();
      if (!isCorrectNetwork) {
        const switched = await switchNetwork();
        if (!switched) {
          setError('Please switch to Push Chain network');
          setIsConnecting(false);
          return;
        }
      }

      setWalletState((prev) => ({
        ...prev,
        isConnected: true,
        address,
        isCorrectNetwork: true,
      }));

      await updateBalance(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled, checkNetwork, switchNetwork, updateBalance]);

  const disconnect = useCallback(() => {
    setWalletState({
      isConnected: false,
      address: null,
      balance: '0',
      chainId: null,
      isCorrectNetwork: false,
    });
    setError(null);
  }, []);

  const getSigner = useCallback(async (): Promise<JsonRpcSigner | null> => {
    if (!window.ethereum || !walletState.isConnected) return null;

    try {
      const provider = new BrowserProvider(window.ethereum);
      return provider.getSigner();
    } catch (err) {
      console.error('Error getting signer:', err);
      return null;
    }
  }, [walletState.isConnected]);

  // Handle account and chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== walletState.address) {
        setWalletState((prev) => ({ ...prev, address: accounts[0] }));
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
  }, [walletState.address, updateBalance, checkNetwork, disconnect]);

  // Check connection on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const checkConnection = async () => {
      if (!window.ethereum) return;

      try {
        const accounts = (await window.ethereum.request({
          method: 'eth_accounts',
        })) as string[];

        if (accounts.length > 0) {
          setWalletState((prev) => ({
            ...prev,
            isConnected: true,
            address: accounts[0],
          }));
          // Run network check and balance fetch in parallel (async-parallel rule)
          await Promise.all([checkNetwork(), updateBalance(accounts[0])]);
        }
      } catch (err) {
        console.error('Error checking connection:', err);
      }
    };

    checkConnection();
  }, [mounted, checkNetwork, updateBalance]);

  return {
    ...walletState,
    isConnecting,
    error,
    mounted,
    connect,
    disconnect,
    switchNetwork,
    getSigner,
    isMetaMaskInstalled: mounted ? isMetaMaskInstalled() : false,
  };
}

// Type declarations
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
