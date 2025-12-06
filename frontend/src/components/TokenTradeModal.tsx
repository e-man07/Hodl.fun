'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTokenTrading } from '@/hooks/useTokenTrading';
import { usePushWalletContext, PushUI } from '@pushchain/ui-kit';
import { getIPFSImageUrl, createIPFSImageErrorHandler } from '@/utils/ipfsImage';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
} from 'lucide-react';

interface TokenTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: {
    address: string;
    name: string;
    symbol: string;
    logo?: string;
    price: number;
    reserveRatio: number;
  };
}

// Parse error messages into user-friendly messages
const parseErrorMessage = (error: string | null): string => {
  if (!error) return '';
  
  const errorLower = error.toLowerCase();
  
  // Connection errors
  if (errorLower.includes('wallet not connected') || errorLower.includes('not connected')) {
    return 'Please connect your wallet to continue.';
  }
  
  if (errorLower.includes('user rejected') || errorLower.includes('user denied')) {
    return 'Transaction was cancelled.';
  }
  
  // Transaction revert errors
  if (errorLower.includes('execution reverted')) {
    if (errorLower.includes('insufficient balance') || errorLower.includes('insufficient funds')) {
      return 'Insufficient balance. Please check your wallet.';
    }
    if (errorLower.includes('slippage') || errorLower.includes('price moved')) {
      return 'Price moved too much. Try increasing slippage tolerance or try again.';
    }
    if (errorLower.includes('allowance') || errorLower.includes('approval')) {
      return 'Token approval required. Please try again.';
    }
    if (errorLower.includes('insufficient liquidity') || errorLower.includes('liquidity')) {
      return 'Insufficient liquidity. The trade amount may be too large.';
    }
    if (errorLower.includes('amount') && errorLower.includes('zero')) {
      return 'Trade amount must be greater than zero.';
    }
    return 'Transaction failed. Please try again or check your inputs.';
  }
  
  // Gas errors
  if (errorLower.includes('gas') || errorLower.includes('out of gas')) {
    return 'Transaction failed due to gas issues. Please try again.';
  }
  
  // Network errors
  if (errorLower.includes('network') || errorLower.includes('rpc') || errorLower.includes('provider')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  // Generic fallback - return first sentence or truncate long messages
  const firstSentence = error.split('.')[0].trim();
  if (firstSentence.length > 100) {
    return 'Transaction failed. Please try again.';
  }
  
  return firstSentence || 'Transaction failed. Please try again.';
};

export const TokenTradeModal = ({ isOpen, onClose, token }: TokenTradeModalProps) => {
  const { connectionStatus } = usePushWalletContext();
  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const {
    buyTokens,
    sellTokens,
    calculateTokensForEth,
    calculateEthForTokens,
    getTokenBalance,
    isLoading,
    error,
    clearError,
  } = useTokenTrading();

  // State
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [ethAmount, setEthAmount] = useState<string>('0.01');
  const [tokenAmount, setTokenAmount] = useState<string>('0');
  const [estimatedTokens, setEstimatedTokens] = useState<string>('0');
  const [estimatedEth, setEstimatedEth] = useState<string>('0');
  const [slippage, setSlippage] = useState<number>(5); // Default 5% slippage
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<boolean>(false);

  // Load token balance
  const loadTokenBalance = useCallback(async () => {
    if (token.address) {
      const balance = await getTokenBalance(token.address);
      setTokenBalance(balance);
    }
  }, [token.address, getTokenBalance]);

  // Calculate estimated tokens for ETH
  const calculateEstimatedTokens = useCallback(async () => {
    if (parseFloat(ethAmount) > 0) {
      const tokens = await calculateTokensForEth(token.address, ethAmount);
      setEstimatedTokens(tokens);
    } else {
      setEstimatedTokens('0');
    }
  }, [ethAmount, token.address, calculateTokensForEth]);

  // Calculate estimated ETH for tokens
  const calculateEstimatedEth = useCallback(async () => {
    if (parseFloat(tokenAmount) > 0) {
      const eth = await calculateEthForTokens(token.address, tokenAmount);
      setEstimatedEth(eth);
    } else {
      setEstimatedEth('0');
    }
  }, [tokenAmount, token.address, calculateEthForTokens]);

  // Clear errors and load token balance when modal opens or token changes
  useEffect(() => {
    if (isOpen) {
      clearError(); // Clear any previous errors when modal opens or token changes
      if (isConnected && token.address) {
        loadTokenBalance();
      }
    }
  }, [isOpen, token.address, isConnected, clearError, loadTokenBalance]);

  // Calculate estimated tokens/ETH when inputs change
  useEffect(() => {
    if (activeTab === 'buy' && parseFloat(ethAmount) > 0) {
      calculateEstimatedTokens();
    } else if (activeTab === 'sell' && parseFloat(tokenAmount) > 0) {
      calculateEstimatedEth();
    }
  }, [ethAmount, tokenAmount, activeTab, calculateEstimatedTokens, calculateEstimatedEth]);

  // Handle buy tokens
  const handleBuyTokens = async () => {
    if (parseFloat(ethAmount) <= 0) return;
    
    const result = await buyTokens(
      token.address,
      ethAmount,
      estimatedTokens,
      slippage
    );

    if (result.success && result.hash) {
      setTxHash(result.hash);
      setTxSuccess(true);
      loadTokenBalance(); // Refresh balance
      
      // Trigger marketplace refresh after successful transaction
      // Wait longer for blockchain confirmation and market cap update
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tokenDataChanged', { 
          detail: { tokenAddress: token.address } 
        }));
      }, 5000); // Wait 5 seconds for blockchain confirmation and market cap update
    }
  };

  // Handle sell tokens
  const handleSellTokens = async () => {
    if (parseFloat(tokenAmount) <= 0) return;
    
    const result = await sellTokens(
      token.address,
      tokenAmount,
      estimatedEth,
      slippage
    );

    if (result.success && result.hash) {
      setTxHash(result.hash);
      setTxSuccess(true);
      loadTokenBalance(); // Refresh balance
      
      // Trigger marketplace refresh after successful transaction
      // Wait longer for blockchain confirmation and market cap update
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tokenDataChanged', { 
          detail: { tokenAddress: token.address } 
        }));
      }, 5000); // Wait 5 seconds for blockchain confirmation and market cap update
    }
  };

  // Reset state when modal closes
  const handleClose = () => {
    setEthAmount('0.01');
    setTokenAmount('0');
    setEstimatedTokens('0');
    setEstimatedEth('0');
    setTxHash(null);
    setTxSuccess(false);
    clearError(); // Clear errors when modal closes
    onClose();
  };

  // Format number with commas
  const formatNumber = (value: string, decimals: number = 6): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] max-w-[calc(100vw-2rem)] w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            {token.logo ? (
              <Image
                src={getIPFSImageUrl(token.logo)}
                alt={`${token.name} logo`}
                width={24}
                height={24}
                className="rounded-full"
                onError={createIPFSImageErrorHandler(token.logo)}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
                {token.symbol.slice(0, 2)}
              </div>
            )}
            Trade {token.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Current price: {token.price.toFixed(6)} ETH per token
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Wallet Connection Warning */}
          {!isConnected && (
            <Alert className="bg-amber-50 text-amber-800 border-amber-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                Please connect your wallet to trade tokens
              </AlertDescription>
            </Alert>
          )}

          {/* Token Balance */}
          {isConnected && (
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm text-muted-foreground">Your Balance:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-medium">{formatNumber(tokenBalance)}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">{token.symbol}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  onClick={loadTokenBalance}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Trading Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'buy' | 'sell')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="buy" className="text-xs sm:text-sm">Buy</TabsTrigger>
              <TabsTrigger value="sell" className="text-xs sm:text-sm">Sell</TabsTrigger>
            </TabsList>

            {/* Buy Tab */}
            <TabsContent value="buy" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="ethAmount" className="text-xs sm:text-sm">ETH Amount</Label>
                <Input
                  id="ethAmount"
                  type="number"
                  step="0.001"
                  min="0"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  disabled={isLoading || !isConnected}
                  className="h-10 text-sm"
                />
                <div className="text-xs text-muted-foreground text-right">
                  ≈ ${(parseFloat(ethAmount) * 3000).toFixed(2)} USD
                </div>
              </div>

              <div className="flex justify-center py-1">
                <ArrowDown className="text-muted-foreground w-4 h-4" />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <Label htmlFor="estimatedTokens" className="text-xs sm:text-sm">Estimated Tokens</Label>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    Min. received: {formatNumber(
                      (parseFloat(estimatedTokens) * (100 - slippage) / 100).toString()
                    )}
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 bg-muted rounded-md flex justify-between items-center">
                  <span className="font-medium text-base sm:text-lg">
                    {formatNumber(estimatedTokens)}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground">{token.symbol}</span>
                </div>
              </div>

              <Button
                className="w-full h-10 sm:h-11 text-sm sm:text-base"
                onClick={handleBuyTokens}
                disabled={isLoading || !isConnected || parseFloat(ethAmount) <= 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buying...
                  </>
                ) : (
                  `Buy ${token.symbol}`
                )}
              </Button>
            </TabsContent>

            {/* Sell Tab */}
            <TabsContent value="sell" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <Label htmlFor="tokenAmount" className="text-xs sm:text-sm">Token Amount</Label>
                  {parseFloat(tokenBalance) > 0 && (
                    <button
                      className="text-[10px] sm:text-xs text-primary hover:underline"
                      onClick={() => setTokenAmount(tokenBalance)}
                    >
                      Max: {formatNumber(tokenBalance)}
                    </button>
                  )}
                </div>
                <Input
                  id="tokenAmount"
                  type="number"
                  step="0.001"
                  min="0"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  disabled={isLoading || !isConnected}
                  className="h-10 text-sm"
                />
              </div>

              <div className="flex justify-center py-1">
                <ArrowDown className="text-muted-foreground w-4 h-4" />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <Label htmlFor="estimatedEth" className="text-xs sm:text-sm">Estimated ETH</Label>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    Min. received: {formatNumber(
                      (parseFloat(estimatedEth) * (100 - slippage) / 100).toString()
                    )}
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 bg-muted rounded-md flex justify-between items-center">
                  <span className="font-medium text-base sm:text-lg">
                    {formatNumber(estimatedEth)}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground">ETH</span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  ≈ ${(parseFloat(estimatedEth) * 3000).toFixed(2)} USD
                </div>
              </div>

              <Button
                className="w-full h-10 sm:h-11 text-sm sm:text-base"
                onClick={handleSellTokens}
                disabled={
                  isLoading || 
                  !isConnected || 
                  parseFloat(tokenAmount) <= 0 ||
                  parseFloat(tokenAmount) > parseFloat(tokenBalance)
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Selling...
                  </>
                ) : (
                  `Sell ${token.symbol}`
                )}
              </Button>
            </TabsContent>
          </Tabs>

          {/* Slippage Settings */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between">
              <Label htmlFor="slippage" className="text-xs sm:text-sm">Slippage Tolerance: {slippage}%</Label>
            </div>
            <div className="flex gap-2 items-center">
              <Slider
                id="slippage"
                min={0.1}
                max={10}
                step={0.1}
                value={[slippage]}
                onValueChange={(values) => setSlippage(values[0])}
                className="flex-1"
              />
              <div className="w-10 sm:w-12 text-right text-xs sm:text-sm">{slippage}%</div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert className="bg-red-50 text-red-800 border-red-200">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm break-words">
                {parseErrorMessage(error)}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {txSuccess && txHash && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <AlertDescription className="text-xs sm:text-sm break-all">
                Transaction successful!{' '}
                <a
                  href={`https://donut.push.network/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  View on Explorer
                </a>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t mt-3">
          <Button variant="outline" onClick={handleClose} className="sm:w-auto w-full h-9 sm:h-10 text-sm">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
