'use client';

import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTokens, useTrendingTokens } from '@/queries/tokens';
import { useTokenFiltersState, type SortBy } from '@/hooks/use-url-state';
import { useDebounce } from '@/hooks/use-debounce';
import { usePrefetchToken } from '@/hooks/use-prefetch-token';
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatFromWei,
  getIPFSUrl,
  cn,
} from '@/lib/utils';
import type { Token, TokenStatus } from '@/types';

// Hoist constant outside component to avoid recreation on every render
const STATUS_COLORS: Record<TokenStatus, string> = {
  TRADING: 'bg-success/10 text-success border-success/20',
  LOCKED: 'bg-warning/10 text-warning border-warning/20',
  LISTED: 'bg-primary/10 text-primary border-primary/20',
};

export function HomeContent() {
  const {
    page,
    status,
    sortBy,
    search,
    setPage,
    setStatus,
    setSortBy,
    setSearch,
  } = useTokenFiltersState();

  // Local state for immediate input feedback
  const [searchInput, setSearchInput] = useState(search);

  // Debounce the search to prevent excessive API calls
  const debouncedSearch = useDebounce(searchInput, 400);

  // Sync debounced value to URL state
  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      setPage(1);
    }
  }, [debouncedSearch, search, setSearch, setPage]);

  const { data: trendingData, isLoading: trendingLoading } = useTrendingTokens();

  // Memoize filters object to prevent unnecessary query cache misses
  const filters = useMemo(
    () => ({
      page,
      limit: 20,
      status: status || undefined,
      sortBy,
      sortOrder: 'desc' as const,
      search: search || undefined,
    }),
    [page, status, sortBy, search]
  );

  const {
    data: tokensData,
    isLoading: tokensLoading,
    isFetching,
  } = useTokens(filters);

  const tokens = tokensData?.data || [];
  const pagination = tokensData?.pagination;
  const trending = trendingData?.slice(0, 6) || [];

  // Memoize handlers to prevent recreation on every render
  const handleStatusChange = useCallback(
    (v: string) => {
      setStatus(v === 'all' ? null : (v as TokenStatus));
      setPage(1);
    },
    [setStatus, setPage]
  );

  const handleSortChange = useCallback(
    (v: string) => {
      setSortBy(v as SortBy);
      setPage(1);
    },
    [setSortBy, setPage]
  );

  const handlePrevPage = useCallback(() => setPage((p) => p - 1), [setPage]);
  const handleNextPage = useCallback(() => setPage((p) => p + 1), [setPage]);

  return (
    <div className="container py-6">
      {/* Page Header with H1 for SEO */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore Tokens</h1>
        <p className="text-muted-foreground">
          Discover and trade tokens on Push Chain with bonding curve mechanics
        </p>
      </header>

      {/* Trending Section */}
      {!trendingLoading && trending.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Trending</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {trending.map((token) => (
              <TrendingCard key={token.address} token={token} />
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search - uses local state for immediate feedback */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <Select value={status || 'all'} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="TRADING">Trading</SelectItem>
              <SelectItem value="LOCKED">Locked</SelectItem>
              <SelectItem value="LISTED">Graduated</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="marketCap">Market Cap</SelectItem>
              <SelectItem value="volume24h">24h Volume</SelectItem>
              <SelectItem value="priceChange24h">24h Change</SelectItem>
              <SelectItem value="holders">Holders</SelectItem>
              <SelectItem value="createdAt">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Token Table */}
      <section>
        {tokensLoading ? (
          <TokenTableSkeleton />
        ) : tokens.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="text-left text-sm text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Token</th>
                    <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
                      Price
                    </th>
                    <th className="px-4 py-3 font-medium text-right hidden md:table-cell">
                      24h
                    </th>
                    <th className="px-4 py-3 font-medium text-right">Market Cap</th>
                    <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">
                      Volume
                    </th>
                    <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">
                      Holders
                    </th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tokens.map((token) => (
                    <TokenRow key={token.address} token={token} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrevPage}
                    disabled={!pagination.hasPrev || isFetching}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextPage}
                    disabled={!pagination.hasNext || isFetching}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// Memoized TrendingCard with prefetch on hover
const TrendingCard = memo(function TrendingCard({ token }: { token: Token }) {
  const { prefetchToken } = usePrefetchToken();
  const marketCap = formatFromWei(token.marketCap);
  const imageUrl = token.metadata?.image ? getIPFSUrl(token.metadata.image) : null;

  const handleMouseEnter = useCallback(() => {
    prefetchToken(token.address);
  }, [prefetchToken, token.address]);

  return (
    <Link href={`/token/${token.address}`} onMouseEnter={handleMouseEnter}>
      <Card className="p-3 hover:border-primary/50 transition-colors cursor-pointer">
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={`${token.name} (${token.symbol}) token logo`}
              width={40}
              height={40}
              sizes="40px"
              className="rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
              {token.symbol.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{token.name}</p>
            <p className="text-xs text-muted-foreground">{token.symbol}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">MC</span>
          <span className="text-primary font-medium">
            {formatCurrency(marketCap, 'PUSH')}
          </span>
        </div>
      </Card>
    </Link>
  );
});

// Memoized TokenRow with prefetch on hover
const TokenRow = memo(function TokenRow({ token }: { token: Token }) {
  const router = useRouter();
  const { prefetchToken } = usePrefetchToken();
  const price = formatFromWei(token.price);
  const marketCap = formatFromWei(token.marketCap);
  const volume = formatFromWei(token.volume24h);
  const imageUrl = token.metadata?.image ? getIPFSUrl(token.metadata.image) : null;

  const handleMouseEnter = useCallback(() => {
    prefetchToken(token.address);
  }, [prefetchToken, token.address]);

  const handleClick = useCallback(() => {
    router.push(`/token/${token.address}`);
  }, [router, token.address]);

  return (
    <tr
      className="hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
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
          <div className="min-w-0">
            <p className="font-medium truncate">{token.name}</p>
            <p className="text-xs text-muted-foreground">{token.symbol}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-sm">
        {formatNumber(price, 6)}
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span
          className={cn(
            'text-sm font-medium',
            token.priceChange24h >= 0 ? 'text-success' : 'text-destructive'
          )}
        >
          {formatPercentage(token.priceChange24h)}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {formatCurrency(marketCap, 'PUSH')}
      </td>
      <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">
        {formatCurrency(volume, 'PUSH')}
      </td>
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        <div className="flex items-center justify-end gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{formatNumber(token.holders, 0)}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[token.status])}>
          {token.status === 'LISTED' ? 'Graduated' : token.status}
        </Badge>
      </td>
    </tr>
  );
});

function TokenTableSkeleton() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-border">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 hidden md:block" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <Card className="py-16 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {search ? 'No tokens found' : 'No tokens launched yet'}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {search
          ? 'Try adjusting your search or filters'
          : 'Be the first to launch a token on our platform!'}
      </p>
      {!search && (
        <Button asChild>
          <Link href="/launch">Launch Your Token</Link>
        </Button>
      )}
    </Card>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="container py-6">
      {/* Trending skeleton */}
      <section className="mb-8">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </section>

      {/* Filters skeleton */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[160px]" />
        </div>
      </section>

      {/* Table skeleton */}
      <TokenTableSkeleton />
    </div>
  );
}
