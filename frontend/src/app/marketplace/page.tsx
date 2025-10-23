'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Coins,
  Users,
  Clock,
  ExternalLink,
  BarChart3,
  RefreshCw,
  Loader2,
  Filter,
  SortAsc
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useDebounce } from '@/hooks/useDebounce';
import { TokenTradeModal } from '@/components/TokenTradeModal';
import { getIPFSImageUrl } from '@/utils/ipfsImage';

interface Token {
  address: string;
  name: string;
  symbol: string;
  description: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
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

const MarketplacePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'marketCap' | 'volume24h' | 'priceChange24h' | 'createdAt'>('marketCap');
  const [filterBy, setFilterBy] = useState<'all' | 'trending' | 'new' | 'trading'>('all');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [showRefreshNotification, setShowRefreshNotification] = useState(false);
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Fetch real tokens from blockchain
  const { tokens: realTokens, isLoading, error, refreshTokens } = useMarketplace();

  // Mock data for fallback - will be replaced by real data
  const mockTokens: Token[] = [
    // Fallback data - only shown if no real tokens are available
    {
      address: '0x0000000000000000000000000000000000000000',
      name: 'No Tokens Found',
      symbol: 'EMPTY',
      description: 'No tokens have been created yet. Be the first to launch a token!',
      price: 0,
      priceChange24h: 0,
      marketCap: 0,
      volume24h: 0,
      holders: 0,
      createdAt: new Date().toISOString().split('T')[0],
      creator: '0x0000000000000000000000000000000000000000',
      reserveRatio: 0,
      isTrading: false,
      currentSupply: 0,
      totalSupply: 0,
      reserveBalance: 0
    }
  ];

  // Use real tokens if available, otherwise use mock data
  const tokensToDisplay = realTokens.length > 0 ? realTokens : (isLoading ? [] : mockTokens);
  
  const filteredTokens = tokensToDisplay
    .filter(token => {
      // Use debounced search query for better performance
      const matchesSearch = debouncedSearchQuery === '' || 
                          token.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                          token.symbol.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                          token.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      switch (filterBy) {
        case 'trending':
          return matchesSearch && token.priceChange24h > 5; // At least 5% gain
        case 'new':
          return matchesSearch && new Date(token.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        case 'trading':
          return matchesSearch && token.isTrading && token.volume24h > 0;
        default:
          return matchesSearch && token.address !== '0x0000000000000000000000000000000000000000'; // Filter out mock data
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'marketCap':
          return b.marketCap - a.marketCap;
        case 'volume24h':
          return b.volume24h - a.volume24h;
        case 'priceChange24h':
          return b.priceChange24h - a.priceChange24h;
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  const marketStats = {
    totalTokens: tokensToDisplay.length,
    totalMarketCap: tokensToDisplay.reduce((sum, token) => sum + token.marketCap, 0),
    totalVolume24h: tokensToDisplay.reduce((sum, token) => sum + token.volume24h, 0),
    activeTraders: tokensToDisplay.reduce((sum, token) => sum + token.holders, 0)
  };

  const handleOpenTradeModal = (token: Token) => {
    setSelectedToken(token);
    setIsTradeModalOpen(true);
  };

  const handleCloseTradeModal = () => {
    setIsTradeModalOpen(false);
  };

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

  const TokenCard = ({ token }: { token: Token }) => (
    <Card className="hover:shadow-lg hover:border-primary/50 transition-all duration-300 cursor-pointer group border-2 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {token.logo ? (
              <div className="relative w-12 h-12 flex-shrink-0 overflow-hidden rounded-full">
                <Image
                  src={getIPFSImageUrl(token.logo)}
                  alt={`${token.name} logo`}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover border-2 border-border rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold text-sm">${token.symbol.slice(0, 2)}</div>`;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-12 h-12 flex-shrink-0 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold text-sm">
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">
                {token.name}
              </CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <span className="font-mono text-xs">{token.symbol}</span>
                {token.isTrading ? (
                  <Badge variant="default" className="text-xs bg-primary/10 text-primary border-primary/20">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Trading
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Bonding
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          
          {/* Price Section */}
          <div className="text-right flex-shrink-0 ml-3">
            <p className="text-lg font-bold">{formatCurrency(token.price)}</p>
            <div className={`text-sm flex items-center justify-end ${
              token.priceChange24h >= 0 ? 'text-primary' : 'text-destructive'
            }`}>
              {token.priceChange24h >= 0 ? (
                <ArrowUpRight className="w-3 h-3 mr-1" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-1" />
              )}
              <span className="font-medium">
                {token.priceChange24h >= 0 ? '+' : ''}{formatPercentage(token.priceChange24h)}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
          {token.description}
        </p>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4 p-3 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Market Cap</p>
            <p className="font-semibold">{formatCurrency(token.marketCap)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">24h Volume</p>
            <p className="font-semibold">{formatCurrency(token.volume24h)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Holders</p>
            <p className="font-semibold">{formatNumber(token.holders)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Reserve Ratio</p>
            <p className="font-semibold">{token.reserveRatio}%</p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            className="flex-1 h-9"
            onClick={() => handleOpenTradeModal(token)}
          >
            <Coins className="w-4 h-4 mr-2" />
            Trade
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-9">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-8">
            <Badge variant="secondary" className="mb-6 px-4 py-2">
              <BarChart3 className="mr-2 h-4 w-4" />
              Professional Trading Platform
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-6 sm:text-5xl">
              Token <span className="text-primary">Marketplace</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Discover and trade tokens with automated liquidity through bonding curves. 
              Professional-grade trading platform built on Push Chain.
            </p>
          </div>
          
          {/* Loading/Error States */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading tokens from blockchain...</span>
            </div>
          )}

          {/* Refresh Notification */}
          {showRefreshNotification && (
            <div className="flex items-center justify-center gap-2 mt-4 text-primary bg-primary/10 border border-primary/20 rounded-lg p-3">
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
          
          {!isLoading && !error && realTokens.length === 0 && (
            <div className="mt-4 p-4 bg-muted/30 border border-border rounded-lg text-muted-foreground">
              <p>No tokens found on the marketplace yet. Be the first to launch a token!</p>
            </div>
          )}
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 hover:border-primary/20 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{marketStats.totalTokens}</p>
              <p className="text-sm text-muted-foreground">Total Tokens</p>
            </CardContent>
          </Card>
          
          <Card className="border-2 hover:border-primary/20 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(marketStats.totalMarketCap)}</p>
              <p className="text-sm text-muted-foreground">Market Cap</p>
            </CardContent>
          </Card>
          
          <Card className="border-2 hover:border-primary/20 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <BarChart3 className="h-6 w-6 text-accent-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(marketStats.totalVolume24h)}</p>
              <p className="text-sm text-muted-foreground">24h Volume</p>
            </CardContent>
          </Card>
          
          <Card className="border-2 hover:border-primary/20 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(marketStats.activeTraders)}</p>
              <p className="text-sm text-muted-foreground">Active Traders</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Filters and Search */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search tokens by name, symbol, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            
            {/* Filter Controls */}
            <div className="flex flex-wrap gap-2">
              <Select value={filterBy} onValueChange={(value) => setFilterBy(value as 'all' | 'trending' | 'new' | 'trading')}>
                <SelectTrigger className="w-[140px] h-10">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tokens</SelectItem>
                  <SelectItem value="trending">🔥 Trending</SelectItem>
                  <SelectItem value="new">✨ New</SelectItem>
                  <SelectItem value="trading">📈 Trading</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'marketCap' | 'volume24h' | 'priceChange24h' | 'createdAt')}>
                <SelectTrigger className="w-[140px] h-10">
                  <SortAsc className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketCap">Market Cap</SelectItem>
                  <SelectItem value="volume24h">Volume</SelectItem>
                  <SelectItem value="priceChange24h">Price Change</SelectItem>
                  <SelectItem value="createdAt">Newest</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm" onClick={refreshTokens} disabled={isLoading} className="h-10">
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Filter Summary */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Showing {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}</span>
            {debouncedSearchQuery && (
              <Badge variant="secondary" className="text-xs">
                Search: &ldquo;{debouncedSearchQuery}&rdquo;
              </Badge>
            )}
            {filterBy !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                Filter: {filterBy === 'trending' ? '🔥 Trending' : 
                        filterBy === 'new' ? '✨ New' : 
                        filterBy === 'trading' ? '📈 Trading' : filterBy}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              Sort: {sortBy === 'marketCap' ? 'Market Cap' :
                    sortBy === 'volume24h' ? 'Volume' :
                    sortBy === 'priceChange24h' ? 'Price Change' : 'Newest'}
            </Badge>
          </div>
        </div>

        {/* Token Grid */}
        {!isLoading && filteredTokens.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTokens.map((token) => (
              <TokenCard key={token.address} token={token} />
            ))}
          </div>
        ) : !isLoading ? (
          <Card className="text-center py-16 border-2 border-dashed border-border">
            <CardContent>
              <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">
                {realTokens.length === 0 ? 'No tokens launched yet' : 'No tokens found'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {realTokens.length === 0 
                  ? 'Be the first to launch a token on our platform!' 
                  : 'Try adjusting your search or filter criteria'
                }
              </p>
              <div className="flex gap-2 justify-center">
                {realTokens.length === 0 ? (
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

        {/* CTA Section */}
        <div className="mt-16">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-0">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">
                Ready to Launch Your Own Token?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Join the growing ecosystem of token creators. Launch your token with automated 
                marketplace listing and bonding curve liquidity in just a few clicks.
              </p>
              <Button size="lg" asChild>
                <a href="/launch">
                  Launch Your Token
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trading Modal */}
      {selectedToken && (
        <TokenTradeModal
          isOpen={isTradeModalOpen}
          onClose={handleCloseTradeModal}
          token={selectedToken}
        />
      )}
    </div>
  );
};

export default MarketplacePage;
