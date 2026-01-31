'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, TrendingUp, Clock, ArrowRight, Loader2 } from 'lucide-react';
import type { Token } from '@/types';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/store/ui';
import { useTokenSearch, useTrendingTokens } from '@/queries/tokens';
import { useRecentSearches, type RecentSearch } from '@/hooks/use-recent-searches';
import { formatFromWei, formatPercentage, cn, getIPFSUrl } from '@/lib/utils';

export function SearchModal() {
  const router = useRouter();
  const { searchOpen, setSearchOpen, toggleSearchOpen } = useUIStore();
  const [query, setQuery] = useState('');

  // Lifted state to custom hook (patterns-lift-state rule)
  const { recentSearches, addRecentSearch } = useRecentSearches();

  const { data: searchResults, isLoading: isSearching } = useTokenSearch(
    query,
    { enabled: query.length >= 2 }
  );
  const { data: trendingTokens } = useTrendingTokens();

  // Navigate to token
  const handleSelect = useCallback(
    (token: Token | RecentSearch) => {
      addRecentSearch(token);
      setSearchOpen(false);
      setQuery('');
      router.push(`/token/${token.address}`);
    },
    [addRecentSearch, router, setSearchOpen]
  );

  // Keyboard shortcut - use stable toggle to avoid re-registering listener (client-event-listeners rule)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearchOpen();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearchOpen, setSearchOpen]);

  // Clear query when modal closes
  useEffect(() => {
    if (!searchOpen) {
      setQuery('');
    }
  }, [searchOpen]);

  const showSearchResults = query.length >= 2 && searchResults;
  const showRecent = !query && recentSearches.length > 0;
  const showTrending = !query && trendingTokens && trendingTokens.length > 0;

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search tokens by name or symbol..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12 text-base"
            autoFocus
          />
          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Results - use ternary for conditional rendering (rendering-conditional-render rule) */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {/* Search Results */}
          {showSearchResults ? (
            <div className="p-2">
              {searchResults.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No tokens found for &quot;{query}&quot;
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((token: Token) => (
                    <TokenItem
                      key={token.address}
                      token={token}
                      onClick={() => handleSelect(token)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Recent Searches */}
          {showRecent ? (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                Recent
              </div>
              <div className="space-y-1 mt-1">
                {recentSearches.map((token) => (
                  <RecentItem
                    key={token.address}
                    token={token}
                    onClick={() => handleSelect(token)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Trending Tokens */}
          {showTrending ? (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Trending
              </div>
              <div className="space-y-1 mt-1">
                {trendingTokens.slice(0, 5).map((token: Token) => (
                  <TokenItem
                    key={token.address}
                    token={token}
                    onClick={() => handleSelect(token)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Empty State */}
          {!showSearchResults && !showRecent && !showTrending ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Start typing to search tokens
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Esc</kbd>
              Close
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">⌘K</kbd>
            Toggle
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TokenItem({ token, onClick }: { token: Token; onClick: () => void }) {
  const imageUrl = token.metadata?.image ? getIPFSUrl(token.metadata.image) : null;
  const price = formatFromWei(token.price);
  const change = token.priceChange24h;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors text-left group"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${token.name} (${token.symbol}) token logo`}
          width={32}
          height={32}
          className="rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
          {token.symbol.slice(0, 2)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{token.name}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {token.symbol}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {price.toFixed(8)} PUSH
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-xs font-medium',
            change >= 0 ? 'text-success' : 'text-destructive'
          )}
        >
          {formatPercentage(change)}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

function RecentItem({ token, onClick }: { token: RecentSearch; onClick: () => void }) {
  const imageUrl = token.image ? getIPFSUrl(token.image) : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors text-left group"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${token.name} (${token.symbol}) token logo`}
          width={32}
          height={32}
          className="rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
          {token.symbol.slice(0, 2)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{token.name}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {token.symbol}
          </Badge>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
