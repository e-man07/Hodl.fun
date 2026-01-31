'use client';

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { Loader2, Settings2, ArrowDownUp } from 'lucide-react';
import { toast } from 'sonner';
import { Contract, parseEther, parseUnits, JsonRpcProvider } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWallet } from '@/hooks/use-wallet';
import { useTradeStore, SLIPPAGE_PRESETS } from '@/store/trade';
import { useBuy } from '@/mutations/use-buy';
import { useSell } from '@/mutations/use-sell';
import { CONTRACTS } from '@/lib/contracts/config';
import { CORE_ABI } from '@/lib/contracts/abis';
import { formatNumber, formatFromWei, applySlippage, cn } from '@/lib/utils';
import type { Token } from '@/types';

// Memoized provider instance - created once per module load
let cachedProvider: JsonRpcProvider | null = null;
function getProvider(): JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
  }
  return cachedProvider;
}

interface TradingPanelProps {
  token: Token;
}

// Explicit variant labels for trade modes (patterns-explicit-variants rule)
const TRADE_MODE_LABELS = {
  buy: {
    inputLabel: 'You pay',
    inputCurrency: 'PUSH',
    outputCurrency: 'token', // Will be replaced with token.symbol
    buttonText: 'Buy',
    pendingText: 'Buying...',
  },
  sell: {
    inputLabel: 'You sell',
    inputCurrency: 'token', // Will be replaced with token.symbol
    outputCurrency: 'PUSH',
    buttonText: 'Sell',
    pendingText: 'Selling...',
  },
} as const;

export function TradingPanel({ token }: TradingPanelProps) {
  const { isConnected, balance, connect } = useWallet();
  const {
    mode,
    setMode,
    nativeAmount,
    tokenAmount,
    setNativeAmount,
    setTokenAmount,
    slippageBps,
    setSlippageBps,
    isPending,
    error,
  } = useTradeStore();

  const buyMutation = useBuy();
  const sellMutation = useSell();

  const [previewAmount, setPreviewAmount] = useState<string>('0');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Get preview amount when input changes
  useEffect(() => {
    const getPreview = async () => {
      const inputAmount = mode === 'buy' ? nativeAmount : tokenAmount;
      if (!inputAmount || parseFloat(inputAmount) === 0) {
        setPreviewAmount('0');
        return;
      }

      setIsLoadingPreview(true);
      try {
        // Use cached provider for read-only calls (faster, no waterfall)
        const provider = getProvider();
        const core = new Contract(CONTRACTS.CORE, CORE_ABI, provider);

        const amountIn =
          mode === 'buy'
            ? parseEther(inputAmount)
            : parseUnits(inputAmount, 18);

        const amountOut = await core.getAmountOut(
          amountIn,
          token.address,
          mode === 'buy'
        );

        setPreviewAmount(formatFromWei(amountOut.toString()).toString());
      } catch (err) {
        console.error('Preview error:', err);
        setPreviewAmount('0');
      } finally {
        setIsLoadingPreview(false);
      }
    };

    const debounce = setTimeout(getPreview, 300);
    return () => clearTimeout(debounce);
  }, [mode, nativeAmount, tokenAmount, token.address]);

  // Memoized handlers to prevent unnecessary re-renders
  const handleModeChange = useCallback(
    (v: string) => setMode(v as 'buy' | 'sell'),
    [setMode]
  );

  const handleNativeAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNativeAmount(e.target.value),
    [setNativeAmount]
  );

  const handleTokenAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setTokenAmount(e.target.value),
    [setTokenAmount]
  );

  const handleQuickAmount = useCallback(
    (amt: string) => setNativeAmount(amt),
    [setNativeAmount]
  );

  const handleTrade = useCallback(async () => {
    if (!isConnected) {
      connect();
      return;
    }

    const inputAmount = mode === 'buy' ? nativeAmount : tokenAmount;
    if (!inputAmount || parseFloat(inputAmount) === 0) {
      toast.error('Please enter an amount');
      return;
    }

    const previewNum = parseFloat(previewAmount);
    if (previewNum === 0) {
      toast.error('Invalid trade amount');
      return;
    }

    // Calculate minimum output with slippage
    const amountOutMin = applySlippage(
      BigInt(Math.floor(previewNum * 1e18)),
      slippageBps,
      mode === 'buy'
    );

    try {
      if (mode === 'buy') {
        await buyMutation.mutateAsync({
          tokenAddress: token.address,
          amountIn: nativeAmount,
          amountOutMin,
        });
        toast.success('Buy successful!');
      } else {
        await sellMutation.mutateAsync({
          tokenAddress: token.address,
          amountIn: tokenAmount,
          amountOutMin,
        });
        toast.success('Sell successful!');
      }
    } catch (err: unknown) {
      // Handle specific errors
      const error = err as { code?: number | string; message?: string };
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        toast.error('Transaction cancelled');
      } else if (error.message?.includes('ExcessiveInput')) {
        toast.error('Price moved too much. Increase slippage.');
      } else if (error.message?.includes('Expired')) {
        toast.error('Transaction expired. Please try again.');
      } else if (error.message?.includes('BondingCurveLocked')) {
        toast.error('This token has graduated. Trade on DEX.');
      } else {
        toast.error('Transaction failed');
      }
    }
  }, [
    isConnected,
    connect,
    mode,
    nativeAmount,
    tokenAmount,
    previewAmount,
    slippageBps,
    token.address,
    buyMutation,
    sellMutation,
  ]);

  const price = formatFromWei(token.price);
  const isLocked = token.status !== 'TRADING';

  // Use explicit variant labels instead of ternaries
  const modeLabels = TRADE_MODE_LABELS[mode];
  const inputCurrency = modeLabels.inputCurrency === 'token' ? token.symbol : modeLabels.inputCurrency;
  const outputCurrency = modeLabels.outputCurrency === 'token' ? token.symbol : modeLabels.outputCurrency;

  // Memoize min received calculation
  const minReceived = useMemo(
    () => formatNumber(parseFloat(previewAmount) * (1 - slippageBps / 10000), 6),
    [previewAmount, slippageBps]
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Trade</CardTitle>
          <SlippageSettings
            slippageBps={slippageBps}
            setSlippageBps={setSlippageBps}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buy/Sell Tabs */}
        <Tabs value={mode} onValueChange={handleModeChange}>
          <TabsList className="w-full">
            <TabsTrigger value="buy" className="flex-1 data-[state=active]:bg-success data-[state=active]:text-success-foreground">
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="flex-1 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
              Sell
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Use ternary for conditional rendering (rendering-conditional-render rule) */}
        {isLocked ? (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning">
            This token has graduated. Trading continues on DEX.
          </div>
        ) : null}

        {/* Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {modeLabels.inputLabel}
            </span>
            <span className="text-muted-foreground">
              Balance:{' '}
              <span className="text-foreground">
                {mode === 'buy' ? `${balance} PUSH` : '-- tokens'}
              </span>
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.0"
              value={mode === 'buy' ? nativeAmount : tokenAmount}
              onChange={mode === 'buy' ? handleNativeAmountChange : handleTokenAmountChange}
              className="pr-16 text-lg no-spinner"
              disabled={isPending || isLocked}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {inputCurrency}
            </span>
          </div>
          {/* Quick amounts */}
          {mode === 'buy' && (
            <QuickAmountButtons
              onSelect={handleQuickAmount}
              disabled={isPending || isLocked}
            />
          )}
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="p-2 rounded-full bg-muted">
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Output Preview */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">You receive</span>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">
                {isLoadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  formatNumber(parseFloat(previewAmount), 6)
                )}
              </span>
              <span className="text-sm text-muted-foreground">
                {outputCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* Trade Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price</span>
            <span>{formatNumber(price, 8)} PUSH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage</span>
            <span>{(slippageBps / 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Min received</span>
            <span>
              {minReceived} {outputCurrency}
            </span>
          </div>
        </div>

        {/* Error - use ternary for conditional rendering (rendering-conditional-render rule) */}
        {error ? (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* Trade Button */}
        <Button
          className={cn(
            'w-full',
            mode === 'buy'
              ? 'bg-success hover:bg-success/90'
              : 'bg-destructive hover:bg-destructive/90'
          )}
          size="lg"
          onClick={handleTrade}
          disabled={isPending || isLocked}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {modeLabels.pendingText}
            </>
          ) : !isConnected ? (
            'Connect Wallet'
          ) : (
            modeLabels.buttonText
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// Hoisted quick amounts to avoid recreation
const QUICK_AMOUNTS = ['0.1', '0.5', '1', '5'] as const;

// Memoized QuickAmountButtons to prevent unnecessary re-renders
const QuickAmountButtons = memo(function QuickAmountButtons({
  onSelect,
  disabled,
}: {
  onSelect: (amt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-2">
      {QUICK_AMOUNTS.map((amt) => (
        <Button
          key={amt}
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => onSelect(amt)}
          disabled={disabled}
        >
          {amt}
        </Button>
      ))}
    </div>
  );
});

// Memoized SlippageSettings to prevent unnecessary re-renders
const SlippageSettings = memo(function SlippageSettings({
  slippageBps,
  setSlippageBps,
}: {
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
}) {
  const [customValue, setCustomValue] = useState('');

  const handleCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setCustomValue(e.target.value),
    []
  );

  const handleSetCustom = useCallback(() => {
    const val = parseFloat(customValue);
    if (val > 0 && val <= 50) {
      setSlippageBps(Math.round(val * 100));
    }
  }, [customValue, setSlippageBps]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="text-xs">{(slippageBps / 100).toFixed(1)}%</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">Slippage Tolerance</p>
          <div className="flex gap-2">
            {SLIPPAGE_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={slippageBps === preset.value ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setSlippageBps(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Custom"
              value={customValue}
              onChange={handleCustomChange}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSetCustom}>
              Set
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Higher slippage increases chance of success but may result in worse
            prices.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
});
