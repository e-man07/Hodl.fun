'use client';

import React from 'react';
import { PushUniversalAccountButton, usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface WalletButtonProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

export const WalletButton: React.FC<WalletButtonProps> = ({ 
  className = '', 
  variant = 'desktop' 
}) => {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = pushChainClient?.universal?.account;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  if (variant === 'mobile') {
    return (
      <div className="flex flex-col space-y-3 w-full">
        {isConnected && (
          <div className="bg-primary/10 border-2 border-primary/20 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-4 w-4 text-primary mr-2" />
              <Badge variant="secondary" className="text-xs">Connected</Badge>
            </div>
            <p className="text-sm font-mono text-foreground">{shortAddress}</p>
          </div>
        )}
        <PushUniversalAccountButton className={`w-full ${className}`} />
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          <div className="text-sm">
            <div className="font-mono text-foreground text-xs">{shortAddress}</div>
          </div>
        </div>
        <PushUniversalAccountButton className={className} />
      </div>
    );
  }

  return <PushUniversalAccountButton className={className} />;
};
