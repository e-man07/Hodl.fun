'use client';

import React from 'react';
import { Button as RetroButton } from 'pixel-retroui';
import { useWallet } from '@/hooks/useWallet';
import { Wallet, AlertCircle, CheckCircle } from 'lucide-react';

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
    isMetaMaskInstalled 
  } = useWallet();

  // If not connected, show connect button
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <RetroButton
          className={`bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 border-4 border-white font-minecraft text-sm ${className}`}
          onClick={connectWallet}
          disabled={isConnecting || !isMetaMaskInstalled}
        >
          {isConnecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              CONNECTING...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              💰 CONNECT WALLET
            </>
          )}
        </RetroButton>
        
        {!isMetaMaskInstalled && (
          <p className="text-xs text-red-400 font-minecraft">
            MetaMask not installed
          </p>
        )}
        
        {error && (
          <p className="text-xs text-red-400 font-minecraft max-w-48 text-center">
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
        <RetroButton
          className={`bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 border-4 border-white font-minecraft text-sm ${className}`}
          onClick={switchToPushChain}
        >
          <AlertCircle className="mr-2 h-4 w-4" />
          SWITCH TO PUSH CHAIN
        </RetroButton>
        <p className="text-xs text-orange-400 font-minecraft text-center">
          Wrong network detected
        </p>
      </div>
    );
  }

  // If connected and correct network
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  
  if (variant === 'mobile') {
    return (
      <div className="flex flex-col space-y-2 w-full">
        <div className="bg-green-600 border-4 border-white p-3 text-center">
          <div className="flex items-center justify-center mb-2">
            <CheckCircle className="h-4 w-4 text-white mr-2" />
            <span className="font-minecraft text-white font-bold text-xs">CONNECTED</span>
          </div>
          <p className="font-minecraft text-white text-xs">{shortAddress}</p>
          <p className="font-minecraft text-white text-xs">{balance} PUSH</p>
        </div>
        <RetroButton
          className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 border-4 border-white font-minecraft text-sm w-full"
          onClick={disconnectWallet}
        >
          DISCONNECT
        </RetroButton>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="bg-green-600 border-4 border-white px-3 py-2 flex items-center space-x-2">
        <CheckCircle className="h-4 w-4 text-white" />
        <div className="text-white font-minecraft text-xs">
          <div>{shortAddress}</div>
          <div>{balance} PUSH</div>
        </div>
      </div>
      <RetroButton
        className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-2 border-4 border-white font-minecraft text-xs"
        onClick={disconnectWallet}
      >
        DISCONNECT
      </RetroButton>
    </div>
  );
};
