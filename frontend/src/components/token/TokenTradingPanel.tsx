'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTokenTrading } from '@/hooks/useTokenTrading';
import { usePushWalletContext, PushUI } from '@pushchain/ui-kit';
import { formatNumber } from '@/lib/utils';

interface TokenTradingPanelProps {
  tokenData: {
    address: string;
    name: string;
    symbol: string;
    price: number;
    reserveRatio: number;
  };
}

// Parse error messages into user-friendly messages
const parseErrorMessage = (error: string | null): string => {
  if (!error) return '';
  
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('wallet not connected') || errorLower.includes('not connected')) {
    return 'Please connect your wallet to continue.';
  }
  
  if (errorLower.includes('user rejected') || errorLower.includes('user denied')) {
    return 'Transaction was cancelled.';
  }
  
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
  
  if (errorLower.includes('gas') || errorLower.includes('out of gas')) {
    return 'Transaction failed due to gas issues. Please try again.';
  }
  
  if (errorLower.includes('network') || errorLower.includes('rpc') || errorLower.includes('provider')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  const firstSentence = error.split('.')[0].trim();
  if (firstSentence.length > 100) {
    return 'Transaction failed. Please try again.';
  }
  
  return firstSentence || 'Transaction failed. Please try again.';
};

export const TokenTradingPanel: React.FC<TokenTradingPanelProps> = ({ tokenData }) => {
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

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [ethAmount, setEthAmount] = useState<string>('0.01');
  const [tokenAmount, setTokenAmount] = useState<string>('0');
  const [estimatedTokens, setEstimatedTokens] = useState<string>('0');
  const [estimatedEth, setEstimatedEth] = useState<string>('0');
  const [slippage, setSlippage] = useState<number>(5);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<boolean>(false);

  // Load token balance
  const loadTokenBalance = useCallback(async () => {
    if (tokenData.address) {
      const balance = await getTokenBalance(tokenData.address);
      setTokenBalance(balance);
    }
  }, [tokenData.address, getTokenBalance]);

  // Calculate estimated tokens for ETH
  const calculateEstimatedTokens = useCallback(async () => {
    if (parseFloat(ethAmount) > 0) {
      const tokens = await calculateTokensForEth(tokenData.address, ethAmount);
      setEstimatedTokens(tokens);
    } else {
      setEstimatedTokens('0');
    }
  }, [ethAmount, tokenData.address, calculateTokensForEth]);

  // Calculate estimated ETH for tokens
  const calculateEstimatedEth = useCallback(async () => {
    if (parseFloat(tokenAmount) > 0) {
      const eth = await calculateEthForTokens(tokenData.address, tokenAmount);
      setEstimatedEth(eth);
    } else {
      setEstimatedEth('0');
    }
  }, [tokenAmount, tokenData.address, calculateEthForTokens]);

  // Load token balance when component mounts or connection changes
  useEffect(() => {
    if (isConnected && tokenData.address) {
      loadTokenBalance();
      clearError();
    }
  }, [isConnected, tokenData.address, loadTokenBalance, clearError]);

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
      tokenData.address,
      ethAmount,
      estimatedTokens,
      slippage
    );

    if (result.success && result.hash) {
      setTxHash(result.hash);
      setTxSuccess(true);
      loadTokenBalance();
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tokenDataChanged', { 
          detail: { tokenAddress: tokenData.address } 
        }));
      }, 5000);
    }
  };

  // Handle sell tokens
  const handleSellTokens = async () => {
    if (parseFloat(tokenAmount) <= 0) return;
    
    const result = await sellTokens(
      tokenData.address,
      tokenAmount,
      estimatedEth,
      slippage
    );

    if (result.success && result.hash) {
      setTxHash(result.hash);
      setTxSuccess(true);
      loadTokenBalance();
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tokenDataChanged', { 
          detail: { tokenAddress: tokenData.address } 
        }));
      }, 5000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade {tokenData.symbol}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Wallet Connection Warning */}
        {!isConnected && (
          <Alert className="mb-4 bg-amber-50 text-amber-800 border-amber-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to trade tokens
            </AlertDescription>
          </Alert>
        )}

        {/* Token Balance */}
        {isConnected && (
          <div className="flex items-center justify-between mb-4 p-2 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Your Balance:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatNumber(parseFloat(tokenBalance) || 0)}</span>
              <span className="text-sm text-muted-foreground">{tokenData.symbol}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
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
          onValueChange={(value) => {
            setActiveTab(value as 'buy' | 'sell');
            clearError();
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>

          {/* Buy Tab */}
          <TabsContent value="buy" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="ethAmount">ETH Amount</Label>
              <Input
                id="ethAmount"
                type="number"
                step="0.001"
                min="0"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                disabled={isLoading || !isConnected}
              />
              <div className="text-xs text-muted-foreground text-right">
                ≈ ${(parseFloat(ethAmount) * 3000).toFixed(2)} USD
              </div>
            </div>

            <div className="flex justify-center my-2">
              <ArrowDown className="text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="estimatedTokens">Estimated Tokens</Label>
                <span className="text-xs text-muted-foreground">
                  Min. received: {formatNumber(
                    parseFloat(estimatedTokens) * (100 - slippage) / 100
                  )}
                </span>
              </div>
              <div className="p-3 bg-muted rounded-md flex justify-between items-center">
                <span className="font-medium text-lg">
                  {formatNumber(parseFloat(estimatedTokens) || 0)}
                </span>
                <span className="text-muted-foreground">{tokenData.symbol}</span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleBuyTokens}
              disabled={isLoading || !isConnected || parseFloat(ethAmount) <= 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buying...
                </>
              ) : (
                `Buy ${tokenData.symbol}`
              )}
            </Button>
          </TabsContent>

          {/* Sell Tab */}
          <TabsContent value="sell" className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="tokenAmount">Token Amount</Label>
                {parseFloat(tokenBalance) > 0 && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setTokenAmount(tokenBalance)}
                  >
                    Max: {formatNumber(parseFloat(tokenBalance) || 0)}
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
              />
            </div>

            <div className="flex justify-center my-2">
              <ArrowDown className="text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="estimatedEth">Estimated ETH</Label>
                <span className="text-xs text-muted-foreground">
                  Min. received: {formatNumber(
                    parseFloat(estimatedEth) * (100 - slippage) / 100
                  )}
                </span>
              </div>
              <div className="p-3 bg-muted rounded-md flex justify-between items-center">
                <span className="font-medium text-lg">
                  {formatNumber(parseFloat(estimatedEth) || 0)}
                </span>
                <span className="text-muted-foreground">ETH</span>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                ≈ ${(parseFloat(estimatedEth) * 3000).toFixed(2)} USD
              </div>
            </div>

            <Button
              className="w-full"
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
                `Sell ${tokenData.symbol}`
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Slippage Settings */}
        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between">
            <Label htmlFor="slippage">Slippage Tolerance: {slippage}%</Label>
          </div>
          <div className="flex gap-2 items-center">
            <Slider
              id="slippage"
              min={0.1}
              max={10}
              step={0.1}
              value={[slippage]}
              onValueChange={(values) => setSlippage(values[0])}
            />
            <div className="w-12 text-right">{slippage}%</div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert className="mt-4 bg-red-50 text-red-800 border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-sm break-words">
              {parseErrorMessage(error)}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {txSuccess && txHash && (
          <Alert className="mt-4 bg-green-50 text-green-800 border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="break-all text-sm">
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
      </CardContent>
    </Card>
  );
};

