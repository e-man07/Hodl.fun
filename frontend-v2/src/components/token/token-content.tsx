'use client';

import React, { memo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  TrendingUp,
  Users,
  BarChart3,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Token, TokenStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TradesTable } from '@/components/token/trades-table';
import { HoldersTable } from '@/components/token/holders-table';
import { useToken } from '@/queries/tokens';
import { useTokenPageRealtime } from '@/hooks/use-realtime-sync';
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatFromWei,
  formatRelativeTime,
  formatDate,
  truncateAddress,
  copyToClipboard,
  getIPFSUrl,
  cn,
} from '@/lib/utils';
import { NETWORK } from '@/lib/contracts/config';
import { TokenSchema, BreadcrumbSchema } from '@/components/seo/json-ld';

// Dynamic imports for code splitting - reduces initial bundle size
const PriceChart = dynamic(
  () => import('@/components/charts/price-chart').then((mod) => mod.PriceChart),
  {
    loading: () => (
      <div className="h-[400px] bg-card rounded-lg flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    ),
    ssr: false,
  }
);

// Lazy load TradingPanel - only needed when user wants to trade
const TradingPanel = dynamic(
  () => import('@/components/trading/trading-panel').then((mod) => mod.TradingPanel),
  {
    loading: () => (
      <Card className="p-6">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-12 w-full" />
      </Card>
    ),
    ssr: false,
  }
);

// Hoist constants outside component to avoid recreation on every render
const STATUS_COLORS: Record<TokenStatus, string> = {
  TRADING: 'bg-success text-success-foreground',
  LOCKED: 'bg-warning text-warning-foreground',
  LISTED: 'bg-primary text-primary-foreground',
};

const GRADUATION_THRESHOLD = 1000000; // 1M PUSH

interface TokenContentProps {
  address: string;
}

export function TokenContent({ address }: TokenContentProps) {
  const { data: token, isLoading, error } = useToken(address);

  // Enable real-time updates
  useTokenPageRealtime(address);

  // Memoize copy handler - must be called before any conditional returns (Rules of Hooks)
  const handleCopyAddress = useCallback(async () => {
    const success = await copyToClipboard(address);
    if (success) {
      toast.success('Address copied to clipboard');
    }
  }, [address]);

  if (isLoading) {
    return <TokenPageSkeleton />;
  }

  if (error || !token) {
    return <TokenNotFound />;
  }

  const price = formatFromWei(token.price);
  const marketCap = formatFromWei(token.marketCap);
  const athPrice = formatFromWei(token.athPrice);
  const athMarketCap = formatFromWei(token.athMarketCap);
  const volume = formatFromWei(token.volume24h);
  const imageUrl = token.metadata?.image ? getIPFSUrl(token.metadata.image) : null;

  // Calculate graduation progress
  const graduationProgress = Math.min((marketCap / GRADUATION_THRESHOLD) * 100, 100);

  return (
    <div className="container py-6">
      {/* SEO Schema */}
      <TokenSchema token={token} price={price} marketCap={marketCap} />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://www.thehodl.fun' },
          { name: 'Explore', url: 'https://www.thehodl.fun' },
          { name: token.name, url: `https://www.thehodl.fun/token/${token.address}` },
        ]}
      />

      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Explore
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Token Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={`${token.name} (${token.symbol}) token logo`}
                    width={80}
                    height={80}
                    sizes="80px"
                    className="rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                    {token.symbol.slice(0, 2)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{token.name}</h1>
                    <Badge variant="secondary">{token.symbol}</Badge>
                    <Badge className={STATUS_COLORS[token.status]}>
                      {token.status === 'LISTED' ? 'Graduated' : token.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-sm text-muted-foreground">
                      {truncateAddress(token.address, 10, 8)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCopyAddress}
                      aria-label="Copy contract address"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Link
                      href={`${NETWORK.blockExplorer}/address/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="View on block explorer">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>

                  {token.metadata?.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                      {token.metadata.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Price Display */}
              <div className="mt-6 flex items-baseline gap-4">
                <span className="text-3xl font-bold font-mono">
                  {formatNumber(price, 8)} PUSH
                </span>
                <span
                  className={cn(
                    'text-lg font-medium',
                    token.priceChange24h >= 0 ? 'text-success' : 'text-destructive'
                  )}
                >
                  {formatPercentage(token.priceChange24h)}
                </span>
              </div>

              {/* Graduation Progress */}
              {token.status === 'TRADING' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Graduation Progress</span>
                    <span className="font-medium">{graduationProgress.toFixed(1)}%</span>
                  </div>
                  <Progress value={graduationProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(marketCap, 'PUSH')} / {formatCurrency(GRADUATION_THRESHOLD, 'PUSH')}{' '}
                    market cap goal
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={BarChart3}
              label="Market Cap"
              value={formatCurrency(marketCap, 'PUSH')}
            />
            <StatCard
              icon={TrendingUp}
              label="24h Volume"
              value={formatCurrency(volume, 'PUSH')}
            />
            <StatCard
              icon={Users}
              label="Holders"
              value={formatNumber(token.holders, 0)}
            />
            <StatCard
              icon={Clock}
              label="Created"
              value={formatRelativeTime(token.createdAt)}
            />
          </div>

          {/* ATH Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                All-Time Highs
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">ATH Price</p>
                <p className="text-lg font-mono font-medium">
                  {formatNumber(athPrice, 8)} PUSH
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ATH Market Cap</p>
                <p className="text-lg font-medium">{formatCurrency(athMarketCap, 'PUSH')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Price Chart */}
          <PriceChart tokenAddress={address} />

          {/* Trades, Holders & About Tabs */}
          <Tabs defaultValue="trades">
            <TabsList className="w-full">
              <TabsTrigger value="trades" className="flex-1">
                Trade History
              </TabsTrigger>
              <TabsTrigger value="holders" className="flex-1">
                Holders
              </TabsTrigger>
              <TabsTrigger value="about" className="flex-1">
                About
              </TabsTrigger>
            </TabsList>
            <TabsContent value="trades" className="mt-4">
              <TradesTable tokenAddress={address} />
            </TabsContent>
            <TabsContent value="holders" className="mt-4">
              <HoldersTable tokenAddress={address} />
            </TabsContent>
            <TabsContent value="about" className="mt-4">
              <AboutSection token={token} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Trading Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <TradingPanel token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoized StatCard to prevent unnecessary re-renders
const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
});

// Memoized AboutSection to prevent unnecessary re-renders
const AboutSection = memo(function AboutSection({ token }: { token: Token }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Description */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
          <p className="text-sm">
            {token.metadata?.description || 'No description provided.'}
          </p>
        </div>

        <Separator />

        {/* Token Details */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Token Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Contract Address</p>
              <code className="text-xs break-all">{token.address}</code>
            </div>
            <div>
              <p className="text-muted-foreground">Bonding Curve</p>
              <code className="text-xs break-all">{token.bondingCurveAddress}</code>
            </div>
            <div>
              <p className="text-muted-foreground">Creator</p>
              <code className="text-xs">{truncateAddress(token.creator, 10, 8)}</code>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{formatDate(token.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Trades</p>
              <p>{formatNumber(token.tradeCount, 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p>{token.status === 'LISTED' ? 'Graduated to DEX' : token.status}</p>
            </div>
          </div>
        </div>

        {/* Bonding Curve Info */}
        <Separator />
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Bonding Curve</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Real PUSH Reserve</p>
              <p className="font-mono">{formatNumber(formatFromWei(token.realNativeReserve), 4)} PUSH</p>
            </div>
            <div>
              <p className="text-muted-foreground">Real Token Reserve</p>
              <p className="font-mono">{formatNumber(formatFromWei(token.realTokenReserve), 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Virtual PUSH Reserve</p>
              <p className="font-mono">{formatNumber(formatFromWei(token.virtualNativeReserve), 4)} PUSH</p>
            </div>
            <div>
              <p className="text-muted-foreground">Virtual Token Reserve</p>
              <p className="font-mono">{formatNumber(formatFromWei(token.virtualTokenReserve), 0)}</p>
            </div>
          </div>
        </div>

        {/* Social Links */}
        {(token.metadata?.properties?.twitter || token.metadata?.properties?.telegram || token.metadata?.external_url) && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Links</h3>
              <div className="flex flex-wrap gap-2">
                {token.metadata?.external_url && (
                  <Link
                    href={token.metadata.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Website
                  </Link>
                )}
                {token.metadata?.properties?.twitter && (
                  <Link
                    href={token.metadata.properties.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Twitter
                  </Link>
                )}
                {token.metadata?.properties?.telegram && (
                  <Link
                    href={token.metadata.properties.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Telegram
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

export function TokenPageSkeleton() {
  return (
    <div className="container py-6">
      <Skeleton className="h-4 w-24 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Skeleton className="w-20 h-20 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <Skeleton className="h-10 w-48 mt-6" />
            </CardContent>
          </Card>
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export function TokenNotFound() {
  return (
    <div className="container py-16 text-center">
      <AlertTriangle className="h-16 w-16 text-warning mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Token Not Found</h1>
      <p className="text-muted-foreground mb-6">
        The token you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Button asChild>
        <Link href="/">Back to Explore</Link>
      </Button>
    </div>
  );
}
