'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Loader2
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import { useMarketplace } from '@/hooks/useMarketplace';
import { TokenTradeModal } from '@/components/TokenTradeModal';

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
      const matchesSearch = token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          token.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      
      switch (filterBy) {
        case 'trending':
          return matchesSearch && token.priceChange24h > 0;
        case 'new':
          return matchesSearch && new Date(token.createdAt) > new Date('2024-01-15');
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
    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {token.logo ? (
              <div className="relative w-12 h-12">
                <Image
                  src={token.logo.startsWith('ipfs://') 
                    ? `https://ipfs.io/ipfs/${token.logo.replace('ipfs://', '')}` 
                    : token.logo
                  }
                  alt={`${token.name} logo`}
                  width={48}
                  height={48}
                  className="rounded-full object-cover border-2 border-border"
                  onError={(e) => {
                    // Fallback to text avatar if image fails to load
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold">${token.symbol.slice(0, 2)}</div>`;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold">
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div>
              <CardTitle className="text-lg group-hover:text-primary transition-colors">
                {token.name}
              </CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <span>{token.symbol}</span>
                {token.isTrading ? (
                  <Badge variant="secondary" className="text-xs">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Trading
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Bonding
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(token.price)}</p>
            <p className={`text-sm flex items-center ${
              token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {token.priceChange24h >= 0 ? (
                <ArrowUpRight className="w-3 h-3 mr-1" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-1" />
              )}
              {formatPercentage(Math.abs(token.priceChange24h))}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {token.description}
        </p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Market Cap</p>
            <p className="font-medium">{formatCurrency(token.marketCap)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">24h Volume</p>
            <p className="font-medium">{formatCurrency(token.volume24h)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Holders</p>
            <p className="font-medium">{formatNumber(token.holders)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Reserve Ratio</p>
            <p className="font-medium">{token.reserveRatio}%</p>
          </div>
        </div>
        
        <div className="flex space-x-2 mt-4">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => handleOpenTradeModal(token)}
          >
            Trade
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            <BarChart3 className="w-4 h-4 mr-1" />
            Chart
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
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Token <span className="gradient-text">Marketplace</span>
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshTokens}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover and trade tokens with automated liquidity through bonding curves.
          </p>
          
          {/* Loading/Error States */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading tokens from blockchain...</span>
            </div>
          )}

          {/* Refresh Notification */}
          {showRefreshNotification && (
            <div className="flex items-center justify-center gap-2 mt-4 text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Updating market data after your transaction...</span>
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
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
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              <p>No tokens found on the marketplace yet. Be the first to launch a token!</p>
            </div>
          )}
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Coins className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{marketStats.totalTokens}</p>
              <p className="text-sm text-muted-foreground">Total Tokens</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{formatCurrency(marketStats.totalMarketCap)}</p>
              <p className="text-sm text-muted-foreground">Market Cap</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{formatCurrency(marketStats.totalVolume24h)}</p>
              <p className="text-sm text-muted-foreground">24h Volume</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{formatNumber(marketStats.activeTraders)}</p>
              <p className="text-sm text-muted-foreground">Active Traders</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search tokens by name or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as 'all' | 'trending' | 'new' | 'trading')}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Tokens</option>
              <option value="trending">Trending</option>
              <option value="new">New</option>
              <option value="trading">Trading</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'marketCap' | 'volume24h' | 'priceChange24h' | 'createdAt')}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="marketCap">Market Cap</option>
              <option value="volume24h">Volume</option>
              <option value="priceChange24h">Price Change</option>
              <option value="createdAt">Newest</option>
            </select>
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
          <Card className="text-center py-12">
            <CardContent>
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                {realTokens.length === 0 ? 'No tokens launched yet' : 'No tokens found'}
              </h3>
              <p className="text-muted-foreground mb-4">
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
