'use client';

import React from 'react';
import { PushUniversalAccountButton, usePushWalletContext, PushUI } from '@pushchain/ui-kit';

interface WalletButtonProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

export const WalletButton: React.FC<WalletButtonProps> = ({ 
  className = '', 
  variant = 'desktop' 
}) => {
  const { connectionStatus } = usePushWalletContext();

  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;

  if (variant === 'mobile') {
    return (
      <div className="flex flex-col space-y-3 w-full">
        <div className={`w-full ${className}`}>
          <PushUniversalAccountButton />
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <div className={className}>
          <PushUniversalAccountButton />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <PushUniversalAccountButton />
    </div>
  );
};
