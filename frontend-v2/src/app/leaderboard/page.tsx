'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp, TrendingDown, BarChart3, Clock, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useTopGainers,
  useTopLosers,
  useTopVolume,
  useNewestTokens,
  useGraduatedTokens,
} from '@/queries/leaderboard';
import { useLeaderboardState } from '@/hooks/use-url-state';
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatFromWei,
  getIPFSUrl,
  cn,
} from '@/lib/utils';
import type { LeaderboardEntry } from '@/types';

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardContent />
    </Suspense>
  );
}

function LeaderboardContent() {
  const { tab, setTab } = useLeaderboardState();

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top performing tokens on Hodl.fun
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="gainers" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Gainers</span>
          </TabsTrigger>
          <TabsTrigger value="losers" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            <span className="hidden sm:inline">Losers</span>
          </TabsTrigger>
          <TabsTrigger value="volume" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Volume</span>
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">New</span>
          </TabsTrigger>
          <TabsTrigger value="graduated" className="gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Graduated</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gainers">
          <GainersTab />
        </TabsContent>
        <TabsContent value="losers">
          <LosersTab />
        </TabsContent>
        <TabsContent value="volume">
          <VolumeTab />
        </TabsContent>
        <TabsContent value="new">
          <NewTab />
        </TabsContent>
        <TabsContent value="graduated">
          <GraduatedTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GainersTab() {
  const { data, isLoading } = useTopGainers();
  return (
    <LeaderboardTable
      entries={data || []}
      isLoading={isLoading}
      valueLabel="24h Change"
      formatValue={(e) => formatPercentage(e.priceChange24h)}
      valueClassName={(e) => (e.priceChange24h >= 0 ? 'text-success' : 'text-destructive')}
    />
  );
}

function LosersTab() {
  const { data, isLoading } = useTopLosers();
  return (
    <LeaderboardTable
      entries={data || []}
      isLoading={isLoading}
      valueLabel="24h Change"
      formatValue={(e) => formatPercentage(e.priceChange24h)}
      valueClassName={(e) => (e.priceChange24h >= 0 ? 'text-success' : 'text-destructive')}
    />
  );
}

function VolumeTab() {
  const { data, isLoading } = useTopVolume();
  return (
    <LeaderboardTable
      entries={data || []}
      isLoading={isLoading}
      valueLabel="24h Volume"
      formatValue={(e) => formatCurrency(formatFromWei(e.volume24h), 'PUSH')}
    />
  );
}

function NewTab() {
  const { data, isLoading } = useNewestTokens();
  return (
    <LeaderboardTable
      entries={data || []}
      isLoading={isLoading}
      valueLabel="Market Cap"
      formatValue={(e) => formatCurrency(formatFromWei(e.marketCap), 'PUSH')}
    />
  );
}

function GraduatedTab() {
  const { data, isLoading } = useGraduatedTokens();
  return (
    <LeaderboardTable
      entries={data || []}
      isLoading={isLoading}
      valueLabel="Market Cap"
      formatValue={(e) => formatCurrency(formatFromWei(e.marketCap), 'PUSH')}
    />
  );
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  valueLabel: string;
  formatValue: (entry: LeaderboardEntry) => string;
  valueClassName?: (entry: LeaderboardEntry) => string;
}

function LeaderboardTable({
  entries,
  isLoading,
  valueLabel,
  formatValue,
  valueClassName,
}: LeaderboardTableProps) {
  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <Card className="py-16 text-center">
        <p className="text-muted-foreground">No tokens found</p>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium w-12">#</th>
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
              Price
            </th>
            <th className="px-4 py-3 font-medium text-right">{valueLabel}</th>
            <th className="px-4 py-3 font-medium text-right hidden md:table-cell">
              Market Cap
            </th>
            <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">
              Holders
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry, index) => {
            const imageUrl = entry.metadata?.image
              ? getIPFSUrl(entry.metadata.image)
              : null;
            const price = formatFromWei(entry.price);
            const marketCap = formatFromWei(entry.marketCap);

            return (
              <tr
                key={entry.tokenAddress}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <RankBadge rank={index + 1} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/token/${entry.tokenAddress}`}
                    className="flex items-center gap-3 hover:text-primary"
                  >
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={`${entry.name} (${entry.symbol}) token logo`}
                        width={36}
                        height={36}
                        className="rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {entry.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.symbol}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-sm">
                  {formatNumber(price, 6)}
                </td>
                <td className={cn('px-4 py-3 text-right font-medium', valueClassName?.(entry))}>
                  {formatValue(entry)}
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  {formatCurrency(marketCap, 'PUSH')}
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">
                  {formatNumber(entry.holders, 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">1</Badge>;
  }
  if (rank === 2) {
    return <Badge className="bg-gray-400/20 text-gray-400 border-gray-400/30">2</Badge>;
  }
  if (rank === 3) {
    return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">3</Badge>;
  }
  return <span className="text-sm text-muted-foreground">{rank}</span>;
}

function LeaderboardSkeleton() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-border">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 hidden md:block" />
        </div>
      ))}
    </div>
  );
}
