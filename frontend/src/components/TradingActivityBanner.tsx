'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI } from '@/config/abis';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, truncateAddress } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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

// Helper function to remove ETH prefix from token symbols
const stripETHPrefix = (symbol: string): string => {
  if (!symbol) return 'TOKEN';
  
  const cleaned = symbol.trim();
  if (!cleaned) return 'TOKEN';
  
  // Convert to uppercase for case-insensitive comparison
  const upperSymbol = cleaned.toUpperCase();
  
  // Remove "ETH " prefix (with space) - e.g., "ETH PUFF" -> "PUFF"
  if (upperSymbol.startsWith('ETH ') && cleaned.length > 4) {
    return cleaned.substring(4).trim() || 'TOKEN';
  }
  
  // Remove "ETH" prefix (without space) - e.g., "ETHPUFF" -> "PUFF", "ethpuff" -> "puff"
  // Only remove if there are characters after "ETH" (don't remove if symbol is just "ETH")
  if (upperSymbol.startsWith('ETH') && cleaned.length > 3 && upperSymbol !== 'ETH') {
    return cleaned.substring(3).trim() || 'TOKEN';
  }
  
  return cleaned;
};

export const TradingActivityBanner = () => {
  const [transactions, setTransactions] = useState<TradingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecentTransactions = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      // Get current block number
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 5000); // Last ~5k blocks (reduced for performance)

      // Fetch both buy and sell events (limit to recent ones)
      const [buyEvents, sellEvents] = await Promise.all([
        marketplaceContract.queryFilter(
          marketplaceContract.filters.TokensBought(),
          fromBlock,
          'latest'
        ).catch(() => []),
        marketplaceContract.queryFilter(
          marketplaceContract.filters.TokensSold(),
          fromBlock,
          'latest'
        ).catch(() => [])
      ]);

      // Get latest 20 events from each type, then get blocks in batch
      const recentBuyEvents = buyEvents.slice(-20);
      const recentSellEvents = sellEvents.slice(-20);

      // Get unique block numbers to minimize RPC calls
      const blockNumbers = new Set([
        ...recentBuyEvents.map(e => e.blockNumber),
        ...recentSellEvents.map(e => e.blockNumber)
      ]);
      
      // Fetch blocks in parallel
      const blocksMap = new Map<number, ethers.Block>();
      await Promise.all(
        Array.from(blockNumbers).map(async (blockNum) => {
          try {
            const block = await provider.getBlock(blockNum);
            if (block) blocksMap.set(blockNum, block);
          } catch {
            // Ignore errors
          }
        })
      );

      // Process buy events
      const buyTransactions: TradingTransaction[] = recentBuyEvents
        .filter((event): event is ethers.EventLog => 'args' in event)
        .map((event) => {
          const block = blocksMap.get(event.blockNumber);
          return {
            type: 'buy' as const,
            tokenAddress: event.args?.tokenAddress || '',
            userAddress: event.args?.buyer || '',
            ethAmount: ethers.formatEther(event.args?.ethAmount || 0),
            tokenAmount: ethers.formatEther(event.args?.tokenAmount || 0),
            price: ethers.formatEther(event.args?.price || 0),
            blockNumber: event.blockNumber,
            timestamp: block?.timestamp || 0,
          };
        });

      // Process sell events
      const sellTransactions: TradingTransaction[] = recentSellEvents
        .filter((event): event is ethers.EventLog => 'args' in event)
        .map((event) => {
          const block = blocksMap.get(event.blockNumber);
          return {
            type: 'sell' as const,
            tokenAddress: event.args?.tokenAddress || '',
            userAddress: event.args?.seller || '',
            ethAmount: ethers.formatEther(event.args?.ethAmount || 0),
            tokenAmount: ethers.formatEther(event.args?.tokenAmount || 0),
            price: ethers.formatEther(event.args?.price || 0),
            blockNumber: event.blockNumber,
            timestamp: block?.timestamp || 0,
          };
        });

      // Combine and sort by block number (most recent first)
      const allTransactions = [...buyTransactions, ...sellTransactions]
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .slice(0, 5);

      // Fetch token symbols for display
      const transactionsWithSymbols = await Promise.all(
        allTransactions.map(async (tx) => {
          try {
            const tokenContract = new ethers.Contract(
              tx.tokenAddress,
              ['function symbol() view returns (string)'],
              provider
            );
            const symbol = await tokenContract.symbol();
            // Remove "ETH" prefix from token symbols (e.g., "ETHPUFF" -> "PUFF", "ethpuff" -> "puff")
            const cleanedSymbol = stripETHPrefix(symbol);
            return { ...tx, tokenSymbol: cleanedSymbol };
          } catch {
            return { ...tx, tokenSymbol: 'TOKEN' };
          }
        })
      );

      setTransactions(transactionsWithSymbols);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching trading transactions:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentTransactions();
    // Refresh every 60 seconds to avoid rate limiting
    const interval = setInterval(fetchRecentTransactions, 60000);
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

