'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { ExternalLink, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTokenHolders } from '@/queries/tokens';
import { formatNumber, formatFromWei, truncateAddress } from '@/lib/utils';
import { NETWORK } from '@/lib/contracts/config';
import type { TokenHolder } from '@/types';

// Hoist crown colors outside component to avoid recreation on every render
const CROWN_COLORS = ['text-yellow-500', 'text-gray-400', 'text-orange-500'] as const;

interface HoldersTableProps {
  tokenAddress: string;
}

export function HoldersTable({ tokenAddress }: HoldersTableProps) {
  const { data, isLoading } = useTokenHolders(tokenAddress);
  const holders = data?.data || [];

  if (isLoading) {
    return <HoldersTableSkeleton />;
  }

  if (holders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">No holders yet</div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium w-12">#</th>
            <th className="px-4 py-3 font-medium">Address</th>
            <th className="px-4 py-3 font-medium text-right">Balance</th>
            <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
              Share
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holders.map((holder, index) => (
            <HolderRow key={holder.holderAddress} holder={holder} rank={index} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Memoized HolderRow to prevent unnecessary re-renders
const HolderRow = memo(function HolderRow({
  holder,
  rank,
}: {
  holder: TokenHolder;
  rank: number;
}) {
  const balance = formatFromWei(holder.balance);
  const isTop = rank < 3;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {isTop ? (
            <Crown className={`h-4 w-4 ${CROWN_COLORS[rank]}`} />
          ) : (
            rank + 1
          )}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`${NETWORK.blockExplorer}/address/${holder.holderAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:text-primary inline-flex items-center gap-1"
        >
          {truncateAddress(holder.holderAddress, 8, 6)}
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm">
          {formatNumber(balance, 2)}
        </span>
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        <div className="flex items-center justify-end gap-2">
          <Progress value={holder.percentage} className="w-16 h-2" />
          <span className="text-sm text-muted-foreground w-12 text-right">
            {holder.percentage.toFixed(1)}%
          </span>
        </div>
      </td>
    </tr>
  );
});

function HoldersTableSkeleton() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-border">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-2 w-16" />
        </div>
      ))}
    </div>
  );
}
