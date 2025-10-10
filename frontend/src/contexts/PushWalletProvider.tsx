'use client';

import React from 'react';
import { 
  PushUniversalWalletProvider,
  PushUI
} from '@pushchain/ui-kit';

// App metadata for Push Universal Wallet
const appMetadata = {
  logoUrl: '/logo.png', // Add your app logo
  title: 'TokenLaunch - Retro Token Launchpad',
  description: 'Create and trade tokens with bonding curve mechanics on Push Chain',
};

// Wallet configuration
const walletConfig = {
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET, // Push Chain Testnet
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

export const PushWalletProvider: React.FC<PushWalletProviderProps> = ({ children }) => {
  return (
    <PushUniversalWalletProvider config={walletConfig} app={appMetadata}>
      {children}
    </PushUniversalWalletProvider>
  );
};
