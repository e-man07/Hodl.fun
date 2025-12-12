'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, ExternalLink, TrendingUp, Copy, Check } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { formatCurrency } from '@/lib/utils';
import { getIPFSImageUrl, createIPFSImageErrorHandler } from '@/utils/ipfsImage';
import { getToken, getTokenHolderCount } from '@/lib/api/tokens';
import { PriceChart } from '@/components/token/PriceChart';
import { TokenInfo } from '@/components/token/TokenInfo';
import { TokenTradingPanel } from '@/components/token/TokenTradingPanel';
import { OrderBook } from '@/components/token/OrderBook';
import { TradingActivityBanner } from '@/components/TradingActivityBanner';
import { TokenTradeModal } from '@/components/TokenTradeModal';

interface TokenData {
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
  metadataURI?: string;
}

export default function TokenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tokenAddress = params.address as string;

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

  const fetchTokenData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch token data from backend API (much faster than RPC)
      const [tokenResponse, holderCountResponse] = await Promise.all([
        getToken(tokenAddress),
        getTokenHolderCount(tokenAddress).catch(() => ({ success: false, data: { holderCount: 0 } })),
      ]);

      if (!tokenResponse.success || !tokenResponse.data) {
        throw new Error('Token not found');
      }

      const backendToken = tokenResponse.data;

      // Parse supply values (backend returns formatted strings)
      const currentSupply = parseFloat(backendToken.currentSupply) || 0;
      const totalSupply = parseFloat(backendToken.totalSupply) || 0;
      const reserveBalance = parseFloat(backendToken.reserveBalance) || 0;

      // Get holder count - prefer backend, fallback to Push API
      let holders = holderCountResponse.success ? holderCountResponse.data.holderCount : 0;
      if (holders === 0) {
        // Fallback to Push Donut API
        try {
          const response = await fetch(
            `https://donut.push.network/api/v2/tokens/${tokenAddress}/counters`,
            {
              headers: {
                'accept': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            holders = parseInt(data.token_holders_count || '0', 10);
          }
        } catch {
          // Error fetching holder count from API
        }
      }

      const token: TokenData = {
        address: tokenAddress,
        name: backendToken.name,
        symbol: backendToken.symbol,
        description: backendToken.description || 'No description available',
        price: backendToken.price,
        priceChange24h: backendToken.priceChange24h || 0,
        marketCap: backendToken.marketCap,
        volume24h: backendToken.volume24h || 0,
        holders,
        createdAt: backendToken.createdAt,
        creator: backendToken.creator,
        reserveRatio: backendToken.reserveRatio / 10000, // Convert from basis points (500000 = 50%)
        isTrading: backendToken.tradingEnabled,
        logo: backendToken.logo,
        currentSupply,
        totalSupply,
        reserveBalance,
        metadataURI: undefined, // Backend handles metadata internally
      };

      setTokenData(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load token data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tokenAddress) {
      fetchTokenData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress]);

  const copyAddress = () => {
    navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading token data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Token Not Found</h2>
                <p className="text-muted-foreground mb-6">
                  {error || 'The token you are looking for does not exist.'}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go Back
                  </Button>
                  <Button asChild>
                    <Link href="/">Go to Marketplace</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <TradingActivityBanner />

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 pb-24 lg:pb-6 max-w-full overflow-x-hidden">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Header Section - Compact */}
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full overflow-x-hidden">
          {/* Left Column - Header, Market Cap, Chart and Info */}
          <div className="lg:col-span-2 space-y-3 min-w-0 w-full order-1 lg:order-1">
            {/* Token Header */}
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {tokenData.logo ? (
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-primary/20 flex-shrink-0">
                      <Image
                        src={getIPFSImageUrl(tokenData.logo)}
                        alt={tokenData.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const handler = createIPFSImageErrorHandler(tokenData.logo || '');
                          handler(e);
                          const target = e.target as HTMLImageElement;
                          if (target.style.display === 'none') {
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 border border-primary flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">${tokenData.symbol.slice(0, 2)}</div>`;
                            }
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 border border-primary flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {tokenData.symbol.slice(0, 2)}
                  </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-xl font-bold truncate mb-1">{tokenData.name}</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm text-muted-foreground">{tokenData.symbol}</span>
                      {tokenData.isTrading ? (
                        <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 h-4">
                          <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                          Trading
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-primary/15 text-primary/90 border-primary/30 text-[10px] px-1.5 py-0 h-4">
                          Bonding
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <div className="text-xs text-muted-foreground mb-0.5">Current Price</div>
                  <div className="text-xl sm:text-2xl font-bold text-primary whitespace-nowrap">
                    {formatCurrency(tokenData.price)}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 break-words">{tokenData.description}</p>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-muted-foreground">Contract:</span>
                  <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded break-all">
                    {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 flex-shrink-0"
                    onClick={copyAddress}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 flex-shrink-0"
                    asChild
                  >
                    <a
                      href={`https://donut.push.network/address/${tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </Card>

            {/* Market Cap & ATH Section - Compact */}
            <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-lg sm:text-xl font-bold text-white">
                      {formatCurrency(tokenData.marketCap || 0)}
                    </span>
                    <span className="text-xs text-green-500">
                      +0.00%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">ATH</div>
                    <div className="text-sm font-medium text-white whitespace-nowrap">
                      {formatCurrency(tokenData.marketCap || 0)}
                    </div>
                  </div>
                  {/* Compact Progress Bar */}
                  <div className="w-24 sm:w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-300"
                      style={{
                        width: '100%'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Price Chart */}
            <PriceChart tokenAddress={tokenAddress} tokenData={tokenData} />

            {/* Token Information - Hidden on mobile, shown on desktop */}
            <div className="hidden lg:block">
              <TokenInfo tokenData={tokenData} />
            </div>
          </div>

          {/* Right Column - Trading and Order Book */}
          <div className="space-y-4 sm:space-y-6 min-w-0 w-full order-2 lg:order-2">
            {/* Trading Panel - Hidden on mobile, aligned to top with Token Header */}
            <div className="hidden lg:block">
              <TokenTradingPanel tokenData={tokenData} />
            </div>

            {/* Order Book */}
            <OrderBook tokenAddress={tokenAddress} />
          </div>

          {/* Token Information - Mobile only, shown after Order Book */}
          <div className="lg:hidden order-3">
            <TokenInfo tokenData={tokenData} />
          </div>
        </div>
      </div>

      {/* Sticky Trade Now Button - Mobile Only */}
      <div className="lg:hidden fixed bottom-4 left-0 right-0 z-50 px-4 flex justify-center pointer-events-none">
        <Button
          className="w-[85%] max-w-[320px] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold py-3.5 text-sm rounded-xl shadow-2xl shadow-primary/30 transition-all duration-200 active:scale-[0.98] pointer-events-auto"
          onClick={() => setIsTradeModalOpen(true)}
        >
          Trade Now
        </Button>
      </div>

      {/* Trade Modal - Mobile */}
      {tokenData && (
        <TokenTradeModal
          isOpen={isTradeModalOpen}
          onClose={() => setIsTradeModalOpen(false)}
          token={{
            address: tokenData.address,
            name: tokenData.name,
            symbol: tokenData.symbol,
            logo: tokenData.logo,
            price: tokenData.price,
            reserveRatio: tokenData.reserveRatio,
          }}
        />
      )}
    </div>
  );
}

