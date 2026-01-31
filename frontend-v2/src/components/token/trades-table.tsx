'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { ExternalLink, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTokenTrades } from '@/queries/tokens';
import {
  formatNumber,
  formatFromWei,
  formatRelativeTime,
  truncateAddress,
  cn,
} from '@/lib/utils';
import { NETWORK } from '@/lib/contracts/config';
import type { TokenTrade } from '@/types';

interface TradesTableProps {
  tokenAddress: string;
}

export function TradesTable({ tokenAddress }: TradesTableProps) {
  const { data, isLoading } = useTokenTrades(tokenAddress);
  const trades = data?.data || [];

  if (isLoading) {
    return <TradesTableSkeleton />;
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No trades yet
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">Price</th>
            <th className="px-4 py-3 font-medium hidden md:table-cell">Trader</th>
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
  const amountIn = isBuy
    ? formatFromWei(trade.amountNativeIn)
    : formatFromWei(trade.amountTokenIn);
  const amountOut = isBuy
    ? formatFromWei(trade.amountTokenOut)
    : formatFromWei(trade.amountNativeOut);
  const price = formatFromWei(trade.price);

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <Badge
          variant="outline"
          className={cn(
            'gap-1',
            isBuy
              ? 'text-success border-success/30'
              : 'text-destructive border-destructive/30'
          )}
        >
          {isBuy ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {trade.type}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {formatNumber(amountOut, 4)}{' '}
            <span className="text-muted-foreground">
              {isBuy ? 'tokens' : 'PUSH'}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            for {formatNumber(amountIn, 4)} {isBuy ? 'PUSH' : 'tokens'}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell font-mono text-sm">
        {formatNumber(price, 8)}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <Link
          href={`${NETWORK.blockExplorer}/address/${trade.userAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          {truncateAddress(trade.userAddress)}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`${NETWORK.blockExplorer}/tx/${trade.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          {formatRelativeTime(trade.timestamp)}
        </Link>
      </td>
    </tr>
  );
});

function TradesTableSkeleton() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-border">
          <Skeleton className="h-6 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
