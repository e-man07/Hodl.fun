'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PushUniversalWalletProvider, PushUI } from '@pushchain/ui-kit';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { getQueryClient } from '@/queries/client';

// Push Wallet configuration
const appMetadata = {
  logoUrl: '/hodl-logo.png',
  title: 'Hodl.fun - Token Launchpad',
  description: 'Create and trade tokens with bonding curve mechanics on Push Chain',
};

const walletConfig = {
  network: PushUI.CONSTANTS.PUSH_NETWORK.TESTNET_DONUT,
  login: {
    email: true,
    google: true,
    wallet: { enabled: true },
    appPreview: true,
  },
  modal: {
    loginLayout: PushUI.CONSTANTS.LOGIN.LAYOUT.SPLIT,
    connectedLayout: PushUI.CONSTANTS.CONNECTED.LAYOUT.HOVER,
    appPreview: true,
  },
};

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <PushUniversalWalletProvider config={walletConfig} app={appMetadata}>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  },
                }}
              />
            </TooltipProvider>
          </PushUniversalWalletProvider>
        </NuqsAdapter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
