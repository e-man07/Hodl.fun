'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Upload, Rocket, Info, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useWallet } from '@/hooks/use-wallet';
import { useCreateToken } from '@/mutations/use-create-token';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { FEES } from '@/lib/contracts/config';
import { uploadTokenMetadata, isIPFSConfigured } from '@/lib/ipfs/upload';
import { LaunchSuccess } from '@/components/launch/launch-success';

interface LaunchResult {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  transactionHash?: string;
}

const launchSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(32, 'Name must be 32 characters or less'),
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(8, 'Symbol must be 8 characters or less')
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters and numbers only'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  initialBuy: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      'Must be a valid number'
    ),
});

type LaunchFormData = z.infer<typeof launchSchema>;

// Hoist constants outside component to avoid recalculation (rendering-hoist-jsx rule)
const VIRTUAL_NATIVE = 1; // 1 PUSH initial virtual reserve
const VIRTUAL_TOKEN = 50_000_000; // 50M tokens initial virtual reserve
const INITIAL_PRICE = VIRTUAL_NATIVE / VIRTUAL_TOKEN;
const TOTAL_SUPPLY = 1_000_000_000; // 1B total supply
const INITIAL_MARKET_CAP = INITIAL_PRICE * TOTAL_SUPPLY;

export default function LaunchPage() {
  const { isConnected, connect } = useWallet();
  const createToken = useCreateToken();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LaunchFormData>({
    resolver: zodResolver(launchSchema),
    defaultValues: {
      name: '',
      symbol: '',
      description: '',
      initialBuy: '',
    },
  });

  const watchedValues = watch();
  const deployFee = parseFloat(FEES.DEPLOY_FEE) / 1e18;
  const initialBuy = parseFloat(watchedValues.initialBuy || '0') || 0;
  const totalCost = deployFee + initialBuy;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Logo must be less than 5MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: LaunchFormData) => {
    if (!isConnected) {
      connect();
      return;
    }

    try {
      // Upload metadata to IPFS (falls back to data URI if Pinata not configured)
      const tokenURI = await uploadTokenMetadata(
        {
          name: data.name,
          symbol: data.symbol,
          description: data.description || '',
        },
        logoFile || undefined
      );

      const result = await createToken.mutateAsync({
        name: data.name,
        symbol: data.symbol,
        tokenURI,
        initialBuyAmount: data.initialBuy || '0',
      });

      toast.success('Token launched successfully!');
      setLaunchResult({
        tokenAddress: result.tokenAddress,
        tokenName: data.name,
        tokenSymbol: data.symbol,
        transactionHash: result.txHash,
      });
    } catch (err: unknown) {
      const error = err as { code?: number | string; message?: string };
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        toast.error('Transaction cancelled');
      } else if (error.message?.includes('IPFS')) {
        toast.error('Failed to upload to IPFS. Please try again.');
        console.error(err);
      } else {
        toast.error('Failed to launch token');
        console.error(err);
      }
    }
  };

  // Show success screen after launch
  if (launchResult) {
    return (
      <LaunchSuccess
        tokenAddress={launchResult.tokenAddress}
        tokenName={launchResult.tokenName}
        tokenSymbol={launchResult.tokenSymbol}
        transactionHash={launchResult.transactionHash}
        onLaunchAnother={() => {
          setLaunchResult(null);
          setLogoFile(null);
          setLogoPreview(null);
          reset();
        }}
      />
    );
  }

  // Use hoisted constants for initial price calculations
  const initialPrice = INITIAL_PRICE;
  const initialMarketCap = INITIAL_MARKET_CAP;

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Launch Your Token</h1>
        <p className="text-muted-foreground">
          Create an ERC20 token with automated bonding curve mechanics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
        <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Token Details</CardTitle>
            <CardDescription>
              Basic information about your token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Logo (optional)</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG or GIF. Max 5MB.
                    {isIPFSConfigured() ? (
                      <span className="text-success ml-1">• IPFS enabled</span>
                    ) : (
                      <span className="text-warning ml-1">• Logo won&apos;t be uploaded</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="token-name" className="block text-sm font-medium mb-2">Name *</label>
              <Input
                id="token-name"
                {...register('name')}
                placeholder="My Awesome Token"
                maxLength={32}
                autoComplete="off"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Symbol */}
            <div>
              <label htmlFor="token-symbol" className="block text-sm font-medium mb-2">Symbol *</label>
              <Input
                id="token-symbol"
                {...register('symbol')}
                placeholder="MAT"
                maxLength={8}
                className="uppercase"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                }}
              />
              {errors.symbol && (
                <p className="text-sm text-destructive mt-1">{errors.symbol.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="token-description" className="block text-sm font-medium mb-2">Description</label>
              <textarea
                id="token-description"
                {...register('description')}
                placeholder="A brief description of your token..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                maxLength={500}
                autoComplete="off"
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Initial Buy */}
            <div>
              <label htmlFor="initial-buy" className="block text-sm font-medium mb-2">
                Initial Buy (optional)
              </label>
              <div className="relative">
                <Input
                  id="initial-buy"
                  {...register('initialBuy')}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.0"
                  className="pr-16"
                  autoComplete="off"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  PUSH
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Optionally buy tokens immediately after creation
              </p>
              {errors.initialBuy && (
                <p className="text-sm text-destructive mt-1">
                  {errors.initialBuy.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Cost Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Deploy Fee</span>
                <span>{formatCurrency(deployFee, 'PUSH')}</span>
              </div>
              {initialBuy > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Initial Buy</span>
                  <span>{formatCurrency(initialBuy, 'PUSH')}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(totalCost, 'PUSH')}</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">How it works</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Your token starts with a bonding curve for price discovery</li>
                  <li>• Trading is enabled immediately after creation</li>
                  <li>• When market cap reaches threshold, token graduates to DEX</li>
                  <li>• You earn 30% of platform fees as the creator</li>
                </ul>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={isSubmitting || createToken.isPending}
            >
              {isSubmitting || createToken.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Launching...
                </>
              ) : !isConnected ? (
                'Connect Wallet'
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Launch Token
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
        </div>

        {/* Tokenomics Preview Card */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Token Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Token Name Preview */}
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <Image
                      src={logoPreview}
                      alt="Token preview"
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {watchedValues.symbol?.slice(0, 2) || '??'}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">
                      {watchedValues.name || 'Token Name'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {watchedValues.symbol || 'SYMBOL'}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Tokenomics */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Tokenomics</h3>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs mb-1">Total Supply</p>
                      <p className="font-mono font-semibold">1B</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs mb-1">Initial Price</p>
                      <p className="font-mono font-semibold">{formatNumber(initialPrice, 8)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs mb-1">Initial MC</p>
                      <p className="font-mono font-semibold">{formatCurrency(initialMarketCap, 'PUSH')}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs mb-1">Graduation MC</p>
                      <p className="font-mono font-semibold">1M PUSH</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Bonding Curve Visualization */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Bonding Curve</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Launch</span>
                      <span className="text-muted-foreground">Graduation</span>
                    </div>
                    <Progress value={0} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Price increases as more tokens are bought. When market cap reaches 1M PUSH, the token graduates to DEX.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Fee Distribution */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Fee Distribution</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trading Fee</span>
                      <span>1%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creator Share</span>
                      <span className="text-primary">30% of fees</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform</span>
                      <span>70% of fees</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <p className="text-sm text-center">
                  <span className="text-primary font-semibold">Fair launch</span> — No pre-sale, no team allocation. Everyone buys on the same curve.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
