'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, truncateAddress } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getRecentTrades, RecentTrade } from '@/lib/api/market';

interface TradingTransaction {
  type: 'buy' | 'sell';
  tokenAddress: string;
  userAddress: string;
  ethAmount: string;
  tokenAmount: string;
  price: string;
  blockNumber: number;
  timestamp: number;
  tokenSymbol?: string;
}

export const TradingActivityBanner = () => {
  const [transactions, setTransactions] = useState<TradingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecentTransactions = useCallback(async () => {
    try {
      // Fetch recent trades from backend API - much more efficient than RPC
      const response = await getRecentTrades(5);

      if (response.success && response.data?.trades) {
        const trades = response.data.trades;

        // Convert backend format to component format
        const formattedTransactions: TradingTransaction[] = trades.map((trade: RecentTrade) => ({
          type: trade.type,
          tokenAddress: trade.tokenAddress,
          userAddress: trade.userAddress,
          ethAmount: trade.ethAmount,
          tokenAmount: trade.tokenAmount,
          price: trade.price.toString(),
          blockNumber: trade.blockNumber,
          timestamp: new Date(trade.timestamp).getTime() / 1000,
          tokenSymbol: trade.tokenSymbol,
        }));

        setTransactions(formattedTransactions);
      }
      setIsLoading(false);
    } catch (error) {
      console.warn('Error fetching trading transactions:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentTransactions();
    // Refresh every 30 seconds - backend handles caching efficiently
    const interval = setInterval(fetchRecentTransactions, 30000);
    return () => clearInterval(interval);
  }, [fetchRecentTransactions]);

  if (isLoading || transactions.length === 0) {
    return null;
  }

  // Duplicate transactions for seamless infinite scroll
  const duplicatedTransactions = [...transactions, ...transactions];

  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden bg-card/30 border-b border-primary/20 py-2.5 mb-2 font-sans">
      <div className="flex items-center gap-3 animate-scroll">
        {duplicatedTransactions.map((tx, index) => (
          <div
            key={`${tx.blockNumber}-${index}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0"
          >
            {tx.type === 'buy' ? (
              <ArrowUp className="h-3 w-3 text-green-500" />
            ) : (
              <ArrowDown className="h-3 w-3 text-red-500" />
            )}
            <span className="text-xs font-medium text-foreground font-sans">
              {truncateAddress(tx.userAddress)}
            </span>
            <span className="text-xs text-muted-foreground font-sans">
              {tx.type === 'buy' ? 'bought' : 'sold'}
            </span>
            <Badge variant="secondary" className="text-xs px-2 py-0 h-5 bg-primary/20 border-primary/30 font-normal font-sans">
              <span className="font-mono">{formatCurrency(parseFloat(tx.tokenAmount))}</span> <span className="font-sans">{tx.tokenSymbol || 'TOKEN'}</span>
            </Badge>
            <span className="text-xs text-muted-foreground font-sans">for</span>
            <span className="text-xs font-semibold text-primary font-sans">
              {formatCurrency(parseFloat(tx.ethAmount))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

