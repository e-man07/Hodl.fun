'use client';

import React, { memo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Wallet, TrendingUp, TrendingDown, Coins, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWallet } from '@/hooks/use-wallet';
import { useUserPortfolio, useUserHoldings, useUserTrades, useUserCreatedTokens } from '@/queries/users';
import { useCreatorFees } from '@/queries/contracts';
import { useClaimFees } from '@/mutations/use-claim-fees';
import { AlertsSection } from '@/components/dashboard/alerts-section';
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatFromWei,
  formatRelativeTime,
  getIPFSUrl,
  cn,
} from '@/lib/utils';
import type { Token, UserHolding, TokenTrade, TokenStatus } from '@/types';

// Hoist constants outside component to avoid recreation on every render
const STATUS_COLORS: Record<TokenStatus, string> = {
  TRADING: 'bg-success/10 text-success border-success/20',
  LOCKED: 'bg-warning/10 text-warning border-warning/20',
  LISTED: 'bg-primary/10 text-primary border-primary/20',
};

export function DashboardContent() {
  const { isConnected, address, connect } = useWallet();

  if (!isConnected || !address) {
    return <ConnectWalletPrompt connect={connect} />;
  }

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your portfolio and track performance
        </p>
      </div>

      <div className="grid gap-6">
        <PortfolioSummary address={address} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="holdings">
              <TabsList>
                <TabsTrigger value="holdings">Holdings</TabsTrigger>
                <TabsTrigger value="trades">Trade History</TabsTrigger>
                <TabsTrigger value="created">Created Tokens</TabsTrigger>
              </TabsList>
              <TabsContent value="holdings" className="mt-6">
                <HoldingsSection address={address} />
              </TabsContent>
              <TabsContent value="trades" className="mt-6">
                <TradesSection address={address} />
              </TabsContent>
              <TabsContent value="created" className="mt-6">
                <CreatedTokensSection address={address} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1">
            <AlertsSection />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectWalletPrompt({ connect }: { connect: () => void }) {
  return (
    <div className="container py-16 text-center">
      <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
      <p className="text-muted-foreground mb-6">
        Connect your wallet to view your portfolio and trade history
      </p>
      <Button onClick={connect} size="lg">
        Connect Wallet
      </Button>
    </div>
  );
}

function PortfolioSummary({ address }: { address: string }) {
  const { data: portfolio, isLoading } = useUserPortfolio(address);
  const { data: creatorFeesWei, isLoading: isLoadingFees } = useCreatorFees(address);
  const claimFees = useClaimFees();

  // All hooks must be called before any early returns (React rules of hooks)
  const handleClaimFees = useCallback(async () => {
    try {
      await claimFees.mutateAsync();
      toast.success('Fees claimed successfully!');
    } catch {
      toast.error('Failed to claim fees');
    }
  }, [claimFees]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!portfolio) {
    return null;
  }

  const totalValue = formatFromWei(portfolio.totalValueNative);
  const totalInvested = formatFromWei(portfolio.totalInvestedNative);
  const unrealizedPnl = formatFromWei(portfolio.unrealizedPnlNative);
  const realizedPnl = formatFromWei(portfolio.realizedPnlNative);
  const totalPnl = unrealizedPnl + realizedPnl;
  const pnlPercentage = portfolio.pnlPercentage;
  const creatorFees = creatorFeesWei ? formatFromWei(creatorFeesWei) : 0;
  const hasClaimableFees = creatorFees > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">Portfolio Value</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalValue, 'PUSH')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {portfolio.holdings.length} positions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Coins className="h-4 w-4" />
            <span className="text-sm">Total Invested</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(totalInvested, 'PUSH')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            {totalPnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm">Total P&L</span>
          </div>
          <p
            className={cn(
              'text-2xl font-bold',
              totalPnl >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {formatCurrency(totalPnl, 'PUSH')}
          </p>
          <p
            className={cn(
              'text-xs mt-1',
              pnlPercentage >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {formatPercentage(pnlPercentage)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Coins className="h-4 w-4" />
            <span className="text-sm">Creator Fees</span>
          </div>
          {isLoadingFees ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold">{formatCurrency(creatorFees, 'PUSH')}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={handleClaimFees}
            disabled={claimFees.isPending || !hasClaimableFees}
          >
            {claimFees.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Claim Fees'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function HoldingsSection({ address }: { address: string }) {
  const { data, isLoading } = useUserHoldings(address);
  const holdings = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card className="py-16 text-center">
        <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No holdings yet</h3>
        <p className="text-muted-foreground mb-4">
          Start trading to build your portfolio
        </p>
        <Button asChild>
          <Link href="/">Explore Tokens</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium text-right">Balance</th>
            <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
              Value
            </th>
            <th className="px-4 py-3 font-medium text-right hidden md:table-cell">
              Avg Price
            </th>
            <th className="px-4 py-3 font-medium text-right">P&L</th>
            <th className="px-4 py-3 font-medium text-center hidden lg:table-cell">
              Trade
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((holding) => (
            <HoldingRow key={holding.tokenAddress} holding={holding} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Memoized HoldingRow to prevent unnecessary re-renders
const HoldingRow = memo(function HoldingRow({ holding }: { holding: UserHolding }) {
  const balance = formatFromWei(holding.balance);
  const value = formatFromWei(holding.currentValue);
  const avgPrice = formatFromWei(holding.averageBuyPrice);
  const pnl = formatFromWei(holding.unrealizedPnl);
  const imageUrl = holding.token.metadata?.image
    ? getIPFSUrl(holding.token.metadata.image)
    : null;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/token/${holding.tokenAddress}`}
          className="flex items-center gap-3 hover:text-primary"
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={holding.token.name}
              width={36}
              height={36}
              sizes="36px"
              className="rounded-lg object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {holding.token.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <p className="font-medium">{holding.token.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {holding.token.symbol}
              </p>
              {holding.isCreator && (
                <Badge variant="outline" className="text-xs">
                  Creator
                </Badge>
              )}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">
        {formatNumber(balance, 2)}
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        {formatCurrency(value, 'PUSH')}
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-sm text-muted-foreground">
        {formatNumber(avgPrice, 8)}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={cn(
            'font-medium',
            pnl >= 0 ? 'text-success' : 'text-destructive'
          )}
        >
          {formatCurrency(pnl, 'PUSH')}
        </span>
        <p
          className={cn(
            'text-xs',
            holding.pnlPercentage >= 0 ? 'text-success' : 'text-destructive'
          )}
        >
          {formatPercentage(holding.pnlPercentage)}
        </p>
      </td>
      <td className="px-4 py-3 text-center hidden lg:table-cell">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-success hover:text-success hover:bg-success/10"
            asChild
          >
            <Link href={`/token/${holding.tokenAddress}?action=buy`}>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            asChild
          >
            <Link href={`/token/${holding.tokenAddress}?action=sell`}>
              <ArrowDownRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </td>
    </tr>
  );
});

function TradesSection({ address }: { address: string }) {
  const { data, isLoading } = useUserTrades(address);
  const trades = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <Card className="py-16 text-center">
        <p className="text-muted-foreground">No trades yet</p>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium text-right">Amount</th>
            <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
              Price
            </th>
            <th className="px-4 py-3 font-medium text-right">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Memoized TradeRow to prevent unnecessary re-renders
const TradeRow = memo(function TradeRow({ trade }: { trade: TokenTrade }) {
  const isBuy = trade.type === 'BUY' || trade.type === 'CREATE';
  const amount = isBuy
    ? formatFromWei(trade.amountTokenOut)
    : formatFromWei(trade.amountTokenIn);
  const price = formatFromWei(trade.price);
  const imageUrl = trade.token?.metadata?.image
    ? getIPFSUrl(trade.token.metadata.image)
    : null;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/token/${trade.tokenAddress}`}
          className="flex items-center gap-3 hover:text-primary"
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={trade.token?.name || ''}
              width={32}
              height={32}
              sizes="32px"
              className="rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {trade.token?.symbol?.slice(0, 2) || '??'}
            </div>
          )}
          <span className="font-medium">{trade.token?.symbol || 'Unknown'}</span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={cn(
            isBuy
              ? 'text-success border-success/30'
              : 'text-destructive border-destructive/30'
          )}
        >
          {trade.type}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm">
        {formatNumber(amount, 4)}
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-sm text-muted-foreground">
        {formatNumber(price, 8)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
        {formatRelativeTime(trade.timestamp)}
      </td>
    </tr>
  );
});

function CreatedTokensSection({ address }: { address: string }) {
  const { data, isLoading } = useUserCreatedTokens(address);
  const tokens = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <Card className="py-16 text-center">
        <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No tokens created yet</h3>
        <p className="text-muted-foreground mb-4">
          Launch your first token and earn creator fees
        </p>
        <Button asChild>
          <Link href="/launch">Launch Token</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
              Price
            </th>
            <th className="px-4 py-3 font-medium text-right">Market Cap</th>
            <th className="px-4 py-3 font-medium text-right hidden md:table-cell">
              Holders
            </th>
            <th className="px-4 py-3 font-medium text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tokens.map((token) => (
            <CreatedTokenRow key={token.address} token={token} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Memoized CreatedTokenRow to prevent unnecessary re-renders
const CreatedTokenRow = memo(function CreatedTokenRow({ token }: { token: Token }) {
  const price = formatFromWei(token.price);
  const marketCap = formatFromWei(token.marketCap);
  const imageUrl = token.metadata?.image
    ? getIPFSUrl(token.metadata.image)
    : null;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link
          href={`/token/${token.address}`}
          className="flex items-center gap-3 hover:text-primary"
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${token.name} (${token.symbol}) token logo`}
              width={36}
              height={36}
              sizes="36px"
              className="rounded-lg object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {token.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <p className="font-medium">{token.name}</p>
            <p className="text-xs text-muted-foreground">
              {token.symbol}
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-sm">
        {formatNumber(price, 8)}
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {formatCurrency(marketCap, 'PUSH')}
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">
        {formatNumber(token.holders, 0)}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge
          variant="outline"
          className={cn('text-xs', STATUS_COLORS[token.status])}
        >
          {token.status === 'LISTED' ? 'Graduated' : token.status}
        </Badge>
      </td>
    </tr>
  );
});

export function DashboardPageSkeleton() {
  return (
    <div className="container py-6">
      <div className="mb-8">
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-10 w-72 mb-6" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}
