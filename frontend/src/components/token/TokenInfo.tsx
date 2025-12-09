'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, Users, Coins, BarChart3, Calendar, Wallet, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface TokenInfoProps {
  tokenData: {
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
    currentSupply: number;
    totalSupply: number;
    reserveBalance: number;
  };
}

export const TokenInfo: React.FC<TokenInfoProps> = ({ tokenData }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">Token Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Market Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              Market Cap
            </div>
            <div className="text-sm sm:text-base font-semibold">{formatCurrency(tokenData.marketCap)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              Holders
            </div>
            <div className="text-sm sm:text-base font-semibold">{formatNumber(tokenData.holders)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="w-3 h-3" />
              Current Supply
            </div>
            <div className="text-sm sm:text-base font-semibold">{formatNumber(tokenData.currentSupply)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="w-3 h-3" />
              Reserve Ratio
            </div>
            <div className="text-sm sm:text-base font-semibold">{tokenData.reserveRatio}%</div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Total Supply</span>
            <span className="text-xs sm:text-sm font-medium">{formatNumber(tokenData.totalSupply)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Reserve Balance</span>
            <span className="text-xs sm:text-sm font-medium">{formatCurrency(tokenData.reserveBalance)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Created
            </span>
            <span className="text-xs sm:text-sm font-medium">{formatDate(tokenData.createdAt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Wallet className="w-3 h-3" />
              Creator
            </span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {formatAddress(tokenData.creator)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                asChild
              >
                <a
                  href={`https://donut.push.network/address/${tokenData.creator}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Contract Address */}
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Contract Address</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {formatAddress(tokenData.address)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                asChild
              >
                <a
                  href={`https://donut.push.network/address/${tokenData.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

