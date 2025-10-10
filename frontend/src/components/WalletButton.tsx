'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/hooks/useWallet';
import { Wallet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface WalletButtonProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
}

export const WalletButton: React.FC<WalletButtonProps> = ({ 
  className = '', 
  variant = 'desktop' 
}) => {
  const { 
    isConnected, 
    address, 
    balance, 
    isCorrectNetwork, 
    isConnecting, 
    error, 
    connectWallet, 
    disconnectWallet, 
    switchToPushChain,
    isMetaMaskInstalled,
    mounted
  } = useWallet();

  // Show loading state during hydration
  if (!mounted) {
    return (
      <Button disabled className={`${className}`}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  // If not connected, show connect button
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <Button
          onClick={connectWallet}
          disabled={isConnecting || !isMetaMaskInstalled}
          className={className}
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </>
          )}
        </Button>
        
        {!isMetaMaskInstalled && (
          <p className="text-xs text-destructive">
            MetaMask not installed
          </p>
        )}
        
        {error && (
          <p className="text-xs text-destructive max-w-48 text-center">
            {error}
          </p>
        )}
      </div>
    );
  }

  // If connected but wrong network
  if (isConnected && !isCorrectNetwork) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <Button
          variant="destructive"
          onClick={switchToPushChain}
          className={className}
        >
          <AlertCircle className="mr-2 h-4 w-4" />
          Switch Network
        </Button>
        <p className="text-xs text-destructive text-center">
          Wrong network detected
        </p>
      </div>
    );
  }

  // If connected and correct network
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  
  if (variant === 'mobile') {
    return (
      <div className="flex flex-col space-y-3 w-full">
        <div className="bg-primary/10 border-2 border-primary/20 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <CheckCircle className="h-4 w-4 text-primary mr-2" />
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          </div>
          <p className="text-sm font-mono text-foreground">{shortAddress}</p>
          <p className="text-sm text-muted-foreground">{balance} PUSH</p>
        </div>
        <Button
          variant="outline"
          onClick={disconnectWallet}
          className="w-full"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 flex items-center space-x-2">
        <CheckCircle className="h-4 w-4 text-primary" />
        <div className="text-sm">
          <div className="font-mono text-foreground text-xs">{shortAddress}</div>
          <div className="text-muted-foreground text-xs">{balance} PUSH</div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={disconnectWallet}
        className="text-xs h-8"
      >
        Disconnect
      </Button>
    </div>
  );
};
