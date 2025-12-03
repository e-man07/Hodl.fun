'use client';

import React from 'react';
import { 
  PushUniversalWalletProvider,
  PushUI
} from '@pushchain/ui-kit';

// App metadata for Push Universal Wallet
const appMetadata = {
  logoUrl: '/hodl-logo.png', // Add your app logo
  title: 'hodl.fun - Retro Token Platform',
  description: 'Create and trade tokens with bonding curve mechanics on Push Chain - hodl.fun',
};

// Wallet configuration
const walletConfig = {
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET_DONUT, // Push Chain Testnet Donut
  login: {
    email: true,
    google: true,
    wallet: {
      enabled: true,
    },
    appPreview: true,
  },
  modal: {
    loginLayout: PushUI.CONSTANTS.LOGIN.LAYOUT.SPLIT,
    connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
    appPreview: true,
  },
};

interface PushWalletProviderProps {
  children: React.ReactNode;
}

// Function to clear wallet connection state
// This runs synchronously before React renders to ensure wallet state is cleared
const clearWalletConnectionState = () => {
  if (typeof window === 'undefined') return;
  
  // Clear common Push Wallet and WalletConnect localStorage keys
  const keysToRemove: string[] = [];
  
  // Check all localStorage keys and remove wallet connection/auth related ones
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      // Remove keys specifically related to wallet connections and authentication
      // More targeted to avoid removing unrelated data
      const lowerKey = key.toLowerCase();
      if (
        // WalletConnect patterns
        key.startsWith('wc@') ||
        key.startsWith('WCM_') ||
        key.startsWith('walletconnect') ||
        // Push Wallet specific patterns
        key.startsWith('push-wallet') ||
        key.startsWith('pushchain-wallet') ||
        key.startsWith('pushchain_') ||
        // Connection/auth state patterns
        (lowerKey.includes('connection') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        (lowerKey.includes('auth') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        (lowerKey.includes('session') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        // Account/address storage
        (lowerKey.includes('account') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        (lowerKey.includes('address') && (lowerKey.includes('wallet') || lowerKey.includes('push')))
      ) {
        keysToRemove.push(key);
      }
    }
  }
  
  // Remove all wallet connection-related keys
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage key: ${key}`, error);
    }
  });
  
  // Also clear sessionStorage for wallet connection items
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) {
      const lowerKey = key.toLowerCase();
      if (
        key.startsWith('wc@') ||
        key.startsWith('WCM_') ||
        key.startsWith('walletconnect') ||
        key.startsWith('push-wallet') ||
        key.startsWith('pushchain-wallet') ||
        key.startsWith('pushchain_') ||
        (lowerKey.includes('connection') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        (lowerKey.includes('auth') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        (lowerKey.includes('session') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        (lowerKey.includes('account') && (lowerKey.includes('wallet') || lowerKey.includes('push'))) ||
        (lowerKey.includes('address') && (lowerKey.includes('wallet') || lowerKey.includes('push')))
      ) {
        try {
          sessionStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove sessionStorage key: ${key}`, error);
        }
      }
    }
  }
};

// Clear wallet state before provider initializes
if (typeof window !== 'undefined') {
  clearWalletConnectionState();
}

export const PushWalletProvider: React.FC<PushWalletProviderProps> = ({ children }) => {
  return (
    <PushUniversalWalletProvider config={walletConfig} app={appMetadata}>
      {children}
    </PushUniversalWalletProvider>
  );
};
