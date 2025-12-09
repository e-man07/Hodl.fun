'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  TrendingUp,
  Coins,
  Users,
  Clock,
  BarChart3,
  RefreshCw,
  Loader2,
  Filter,
  SortAsc,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { DegenOnboardingModal } from '@/components/DegenOnboardingModal';
import { TradingActivityBanner } from '@/components/TradingActivityBanner';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useDebounce } from '@/hooks/useDebounce';
import { getIPFSImageUrl, createIPFSImageErrorHandler } from '@/utils/ipfsImage';

interface Token {
  address: string;
  name: string;
  symbol: string;
  description: string;
  price: number;
  marketCap: number;
  holders: number;
  createdAt: string;
  creator: string;
  reserveRatio: number;
  isTrading: boolean;
  logo?: string;
  currentSupply: number;
  totalSupply: number;
  reserveBalance: number;
}

// Trending Section with card-based design matching the provided design
const TrendingSection = ({ tokens, router }: { tokens: Token[]; router: ReturnType<typeof useRouter> }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const trendingTokens = tokens
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 6);

  // Auto-scroll animation for mobile
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    // Only auto-scroll on mobile (check if we're in horizontal scroll mode)
    const checkMobile = () => window.innerWidth < 768;

    let animationId: number;
    let scrollPosition = scrollContainer.scrollLeft;
    const scrollSpeed = 0.5; // pixels per frame

    const animate = () => {
      if (!checkMobile() || isPaused || !scrollContainer) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      scrollPosition += scrollSpeed;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

      // Reset to start when reaching the end
      if (scrollPosition >= maxScroll) {
        scrollPosition = 0;
      }

      scrollContainer.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    // Sync scroll position when user manually scrolls
    const handleScroll = () => {
      scrollPosition = scrollContainer.scrollLeft;
    };

    scrollContainer.addEventListener('scroll', handleScroll);

    return () => {
      cancelAnimationFrame(animationId);
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [isPaused]);

  // Format market cap for display (e.g., "4 ETH", "781.2 ETH")
  const formatMarketCap = (marketCap: number): string => {
    if (marketCap >= 1e9) {
      return `${(marketCap / 1e9).toFixed(1)} ETH`;
    }
    if (marketCap >= 1e6) {
      return `${(marketCap / 1e6).toFixed(1)} ETH`;
    }
    if (marketCap >= 1e3) {
      return `${(marketCap / 1e3).toFixed(1)} ETH`;
    }
    return `${marketCap.toFixed(2)} ETH`;
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Blinking purple arrow icon */}
          <TrendingUp className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-white font-bold text-xl">Trending Now</span>
          <span className="text-lg">🔥</span>
        </div>
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 pt-3 scrollbar-hide md:grid md:grid-cols-3 lg:grid-cols-6 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
        >
          {trendingTokens.map((token, index) => (
            <div
              key={token.address}
              className="group relative bg-card border border-border rounded-xl p-3 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 flex-shrink-0 w-[180px] md:w-auto"
              onClick={() => router.push(`/token/${token.address}`)}
            >
              {/* Card content: Image on left, Text on right */}
              <div className="flex items-center gap-3">
                {/* Token Image - Left side */}
                <div className="flex-shrink-0">
                  {token.logo ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-border group-hover:border-primary/30 transition-colors">
                      <Image
                        src={getIPFSImageUrl(token.logo)}
                        alt={token.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        onError={createIPFSImageErrorHandler(token.logo)}
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-border group-hover:border-primary/30 flex items-center justify-center text-primary font-bold text-xl transition-colors">
                      {token.symbol.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Token Info - Right side */}
                <div className="flex-1 min-w-0">
                  {/* Token Ticker Badge - Above token name */}
                  <Badge 
                    variant="secondary" 
                    className="bg-zinc-700/90 text-zinc-300 border-0 text-[10px] px-2 py-0.5 h-5 font-normal rounded-full mb-1.5 inline-block"
                  >
                    {token.symbol}
                  </Badge>
                  
                  {/* Token Name - Larger white font */}
                  <h3 className="font-bold text-base text-white group-hover:text-primary transition-colors truncate mb-1">
                    {token.name}
                  </h3>
                  
                  {/* Market Cap - Smaller purple font at bottom */}
                  <p className="text-xs font-medium whitespace-nowrap">
                    <span className="text-gray-400">MCap: </span>
                    <span className="text-primary">{formatMarketCap(token.marketCap)}</span>
                  </p>
                </div>
              </div>

              {/* Optional: Arrow button for last card (like in the image) */}
              {index === trendingTokens.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Could navigate to a "View All" page or scroll to see more
                  }}
                  className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="View more"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const HomePage = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'marketCap' | 'holders' | 'createdAt'>('marketCap');
  const [filterBy, setFilterBy] = useState<'all' | 'new' | 'trading'>('all');
  const [showRefreshNotification, setShowRefreshNotification] = useState(false);

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch real tokens from blockchain
  const {
    tokens,
    isLoading,
    isInitializing,
    error,
    refreshTokens,
    totalTokens,
    currentPage,
    totalPages,
    loadPage
  } = useMarketplace();

  // Removed auto-refresh to prevent random platform refreshes
  // Users can manually refresh using the refresh button if needed

  const filteredTokens = tokens
    .filter(token => {
      // Use debounced search query for better performance
      const matchesSearch = debouncedSearchQuery === '' ||
        token.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        token.symbol.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        token.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      switch (filterBy) {
        case 'new':
          return matchesSearch && new Date(token.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        case 'trading':
          return matchesSearch && token.isTrading;
        default:
          return matchesSearch;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'marketCap':
          return b.marketCap - a.marketCap;
        case 'holders':
          return b.holders - a.holders;
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });


  // Listen for token data changes and show notification
  useEffect(() => {
    const handleTokenDataChanged = () => {
      setShowRefreshNotification(true);
      setTimeout(() => {
        setShowRefreshNotification(false);
      }, 3000); // Hide notification after 3 seconds
    };

    window.addEventListener('tokenDataChanged', handleTokenDataChanged);

    return () => {
      window.removeEventListener('tokenDataChanged', handleTokenDataChanged);
    };
  }, []);

  const TokenCard = ({ token, index }: { token: Token; index: number }) => {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(() => setIsVisible(true), index * 100);
          }
        },
        { threshold: 0.1 }
      );

      const currentRef = cardRef.current;
      if (currentRef) {
        observer.observe(currentRef);
      }

      return () => {
        if (currentRef) {
          observer.unobserve(currentRef);
        }
      };
    }, [index]);

    return (
      <div
        ref={cardRef}
        className={`group cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-xl bg-black border-2 border-zinc-800 rounded-xl p-3 hover:border-primary/50 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        onClick={() => router.push(`/token/${token.address}`)}
      >
        {/* Large Token Image - IPFS or ticker initials */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-zinc-800 group-hover:border-primary/50 transition-colors">
          {token.logo && isVisible ? (
            <Image
              src={getIPFSImageUrl(token.logo)}
              alt={`${token.name} logo`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              unoptimized
              loading={index < 8 ? "eager" : "lazy"}
              priority={index < 4}
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              onError={createIPFSImageErrorHandler(token.logo)}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-4xl">
              {token.symbol.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Token Info */}
        <div className="mt-3 space-y-2">
          {/* Symbol Badge */}
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
            {token.symbol}
          </Badge>

          {/* Token Name */}
          <h3 className="font-bold text-white group-hover:text-primary transition-colors truncate">
            {token.name}
          </h3>

          {/* Description */}
          <p className="text-xs text-zinc-400 line-clamp-2">
            {token.description || 'No description available'}
          </p>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
            <span className="text-green-500 font-medium">+0%</span>
            <span>Vol {formatCurrency(token.marketCap * 0.1)}</span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {token.holders}
            </span>
          </div>

          {/* ATH Progress Bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-400">MC <span className="text-white font-semibold"> {formatCurrency(token.marketCap)}</span></span>
              <span className="text-zinc-400">ATH <span className="text-white font-semibold"> {formatCurrency(token.marketCap)}</span></span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <DegenOnboardingModal />
      <Navbar />
      <TradingActivityBanner />

      <div className="container mx-auto px-4 pt-4 pb-12">
        {/* Header - Degen Style */}
        <div className="mb-8">
          {/* Trending Now Section */}
          {!isInitializing && filteredTokens.length > 0 && (
            <TrendingSection tokens={filteredTokens} router={router} />
          )}

          {/* Loading/Error States */}
          {isInitializing && (
            <div className="flex flex-col items-center justify-center gap-3 mt-4">
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-lg font-medium">Loading tokens...</span>
              </div>
            </div>
          )}

          {!isInitializing && isLoading && (
            <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading page tokens...</span>
            </div>
          )}

          {/* Refresh Notification */}
          {showRefreshNotification && (
            <div className="flex items-center justify-center gap-2 mt-4 text-primary bg-primary/10 border border-primary/20 rounded-lg p-3 animate-in slide-in-from-top-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Updating market data after your transaction...</span>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <p><strong>Error loading tokens:</strong> {error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshTokens}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}

          {!isInitializing && !isLoading && !error && tokens.length === 0 && (
            <div className="mt-4 p-4 bg-muted/30 border border-border rounded-lg text-muted-foreground">
              <p>No tokens found on the marketplace yet. Be the first to launch a token!</p>
            </div>
          )}
        </div>

        {/* Compact Filters and Search */}
        {!isInitializing && (
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              {/* Search Bar */}
              <div className="relative flex-1 w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm border-primary/20 focus:border-primary/50"
                />
              </div>

              {/* Compact Filter Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterBy} onValueChange={(value) => setFilterBy(value as 'all' | 'new' | 'trading')}>
                  <SelectTrigger className="w-[120px] h-9 text-sm border-primary/20">
                    <Filter className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">✨ New</SelectItem>
                    <SelectItem value="trading">📈 Trading</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'marketCap' | 'holders' | 'createdAt')}>
                  <SelectTrigger className="w-[130px] h-9 text-sm border-primary/20">
                    <SortAsc className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketCap">Market Cap</SelectItem>
                    <SelectItem value="holders">Holders</SelectItem>
                    <SelectItem value="createdAt">Newest</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshTokens}
                  disabled={isLoading || isInitializing}
                  className="h-9 px-3 border-primary/20 hover:border-primary/50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading || isInitializing ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Compact Token Count */}
              <div className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                {filteredTokens.length} / {tokens.length}
                {totalTokens > tokens.length && (
                  <span className="text-muted-foreground/70"> ({totalTokens} total)</span>
                )}
              </div>
            </div>

            {/* Active Filters - Compact Badges */}
            {(debouncedSearchQuery || filterBy !== 'all') && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {debouncedSearchQuery && (
                  <Badge variant="secondary" className="text-xs h-6 px-2 bg-primary/10 border-primary/20 text-primary">
                    🔍 {debouncedSearchQuery}
                  </Badge>
                )}
                {filterBy !== 'all' && (
                  <Badge variant="secondary" className="text-xs h-6 px-2 bg-primary/10 border-primary/20 text-primary">
                    {filterBy === 'new' ? '✨ New' : filterBy === 'trading' ? '📈 Trading' : filterBy}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Token Grid */}
        {(isInitializing || isLoading) && tokens.length === 0 ? (
          // Skeleton loaders for token cards
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border-2 animate-pulse">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-full bg-muted/30" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-32 bg-muted/30 rounded" />
                        <div className="h-4 w-24 bg-muted/30 rounded" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-16 bg-muted/30 rounded" />
                      <div className="h-6 w-20 bg-muted/30 rounded" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 mb-4">
                    <div className="h-4 w-full bg-muted/30 rounded" />
                    <div className="h-4 w-3/4 bg-muted/30 rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-muted/10 rounded-lg">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="space-y-2">
                        <div className="h-3 w-16 bg-muted/30 rounded" />
                        <div className="h-5 w-20 bg-muted/30 rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="h-9 w-full bg-muted/30 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !isLoading && filteredTokens.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {filteredTokens.map((token, index) => (
                <TokenCard key={token.address} token={token} index={index} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-end mt-8">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => loadPage(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => loadPage(currentPage + 1)}
                    disabled={currentPage === totalPages || isLoading}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : !isInitializing && !isLoading ? (
          <Card className="text-center py-16 border-2 border-dashed border-border">
            <CardContent>
              <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">
                {tokens.length === 0 ? 'No tokens launched yet' : 'No tokens found'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {tokens.length === 0
                  ? 'Be the first to launch a token on our platform!'
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
              <div className="flex gap-2 justify-center">
                {tokens.length === 0 ? (
                  <Button asChild>
                    <a href="/launch">Launch Your Token</a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterBy('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Social Link */}
        <div className="mt-12 flex justify-center">
          <a
            href="https://x.com/thehodldotfun"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 fill-current"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-sm font-medium">Follow us on X</span>
          </a>
        </div>
      </div>

    </div>
  );
};

export default HomePage;

