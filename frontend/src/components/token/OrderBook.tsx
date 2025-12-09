'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI } from '@/config/abis';

interface OrderBookProps {
  tokenAddress: string;
}

interface Order {
  price: number;
  amount: number;
  total: number;
}

interface OrderWithBlock extends Order {
  blockNumber: number;
  transactionHash: string;
}

export const OrderBook: React.FC<OrderBookProps> = ({ tokenAddress }) => {
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [seenTransactions, setSeenTransactions] = useState<Set<string>>(new Set());
  const [buyOrdersWithBlock, setBuyOrdersWithBlock] = useState<OrderWithBlock[]>([]);
  const [sellOrdersWithBlock, setSellOrdersWithBlock] = useState<OrderWithBlock[]>([]);

  useEffect(() => {
    // Reset state when token address changes
    setBuyOrders([]);
    setSellOrders([]);
    setBuyOrdersWithBlock([]);
    setSellOrdersWithBlock([]);
    setSeenTransactions(new Set());
    setIsLoading(true);
    setIsInitialLoad(true);
    
    fetchOrderBook(true); // Initial load
    const interval = setInterval(() => fetchOrderBook(false), 10000); // Background refresh every 10 seconds
    return () => clearInterval(interval);
  }, [tokenAddress]);

  const fetchOrderBook = async (isInitial = false) => {
    try {
      // Only show loading state on initial load
      if (isInitial) {
        setIsLoading(true);
        setSeenTransactions(new Set()); // Reset seen transactions on initial load
      }
      
      // Get current price from contract
      const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
      const marketplace = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      const price = await marketplace.getCurrentPrice(tokenAddress);
      const priceFormatted = parseFloat(ethers.formatEther(price));
      setCurrentPrice(priceFormatted);

      // Fetch marketplace events directly - these represent actual buy/sell orders
      const buyEventFilter = marketplace.filters.TokensBought(tokenAddress, null);
      const sellEventFilter = marketplace.filters.TokensSold(tokenAddress, null);

      // Get recent events (last 10000 blocks for performance - RPC limit is 10000 blocks)
      const currentBlock = await provider.getBlockNumber();
      const maxBlockRange = 10000; // RPC provider limit
      const fromBlock = Math.max(0, currentBlock - maxBlockRange + 1); // +1 to ensure we don't exceed limit
      const toBlock = currentBlock; // Use current block instead of 'latest' to ensure exact range

      const [buyEvents, sellEvents] = await Promise.all([
        marketplace.queryFilter(buyEventFilter, fromBlock, toBlock).catch(() => {
          return [];
        }),
        marketplace.queryFilter(sellEventFilter, fromBlock, toBlock).catch(() => {
          return [];
        }),
      ]);

      // Process buy events into individual orders with block number and transaction hash
      const buyOrdersList: OrderWithBlock[] = [];
      for (const event of buyEvents) {
        if ('args' in event && event.args) {
          try {
            // TokensBought: tokenAddress (indexed), buyer (indexed), ethAmount, tokenAmount, price
            const priceValue = event.args.price;
            const tokenAmountValue = event.args.tokenAmount;
            const txHash = event.transactionHash.toLowerCase();

            // Skip if we've already seen this transaction (unless it's initial load)
            if (!isInitial && seenTransactions.has(txHash)) {
              continue;
            }

            if (priceValue && tokenAmountValue) {
              const price = parseFloat(ethers.formatEther(priceValue));
              const tokenAmount = parseFloat(ethers.formatEther(tokenAmountValue));
              
              buyOrdersList.push({
                price,
                amount: tokenAmount,
                total: price * tokenAmount,
                blockNumber: event.blockNumber,
                transactionHash: txHash,
              });
            }
          } catch (err) {
            // Error processing buy event
          }
        }
      }

      // Process sell events into individual orders with block number and transaction hash
      const sellOrdersList: OrderWithBlock[] = [];
      for (const event of sellEvents) {
        if ('args' in event && event.args) {
          try {
            // TokensSold: tokenAddress (indexed), seller (indexed), tokenAmount, ethAmount, price
            const priceValue = event.args.price;
            const tokenAmountValue = event.args.tokenAmount;
            const txHash = event.transactionHash.toLowerCase();

            // Skip if we've already seen this transaction (unless it's initial load)
            if (!isInitial && seenTransactions.has(txHash)) {
              continue;
            }

            if (priceValue && tokenAmountValue) {
              const price = parseFloat(ethers.formatEther(priceValue));
              const tokenAmount = parseFloat(ethers.formatEther(tokenAmountValue));
              
              sellOrdersList.push({
                price,
                amount: tokenAmount,
                total: price * tokenAmount,
                blockNumber: event.blockNumber,
                transactionHash: txHash,
              });
            }
          } catch (err) {
            // Error processing sell event
          }
        }
      }

      if (isInitial) {
        // Initial load: Get 5 most recent transactions
        // Sort by block number descending (most recent first)
        buyOrdersList.sort((a, b) => b.blockNumber - a.blockNumber);
        sellOrdersList.sort((a, b) => b.blockNumber - a.blockNumber);

        const recentBuyOrders = buyOrdersList.slice(0, 5);
        const recentSellOrders = sellOrdersList.slice(0, 5);

        // Store orders with block numbers for future merges
        setBuyOrdersWithBlock(recentBuyOrders);
        setSellOrdersWithBlock(recentSellOrders);

        // Sort by price for display (buy: highest first, sell: lowest first)
        recentBuyOrders.sort((a, b) => b.price - a.price);
        recentSellOrders.sort((a, b) => a.price - b.price);

        // Track seen transactions
        const newSeenTransactions = new Set<string>();
        recentBuyOrders.forEach(order => newSeenTransactions.add(order.transactionHash));
        recentSellOrders.forEach(order => newSeenTransactions.add(order.transactionHash));
        setSeenTransactions(newSeenTransactions);

        // Remove blockNumber and transactionHash before setting state
        const buyOrdersFinal = recentBuyOrders.map(({ blockNumber, transactionHash, ...order }) => order);
        const sellOrdersFinal = recentSellOrders.map(({ blockNumber, transactionHash, ...order }) => order);

        setBuyOrders(buyOrdersFinal);
        setSellOrders(sellOrdersFinal);
      } else {
        // Background refresh: Only add new transactions
        if (buyOrdersList.length > 0 || sellOrdersList.length > 0) {
          // Merge new orders with existing ones (preserving block numbers)
          setBuyOrdersWithBlock(prevBuyOrders => {
            // Combine existing and new, remove duplicates by transaction hash
            const combined = [...prevBuyOrders];
            buyOrdersList.forEach(newOrder => {
              const exists = combined.find(o => o.transactionHash === newOrder.transactionHash);
              if (!exists) {
                combined.push(newOrder);
              }
            });

            // Sort by block number descending (most recent first)
            combined.sort((a, b) => b.blockNumber - a.blockNumber);
            
            // Take top 5 most recent
            const top5 = combined.slice(0, 5);
            
            // Sort by price for display (buy: highest first)
            top5.sort((a, b) => b.price - a.price);

            // Update seen transactions
            setSeenTransactions(prevSeen => {
              const newSeen = new Set(prevSeen);
              buyOrdersList.forEach(order => newSeen.add(order.transactionHash));
              return newSeen;
            });

            // Update display orders
            const buyOrdersFinal = top5.map(({ blockNumber, transactionHash, ...order }) => order);
            setBuyOrders(buyOrdersFinal);

            return top5;
          });

          setSellOrdersWithBlock(prevSellOrders => {
            // Combine existing and new, remove duplicates by transaction hash
            const combined = [...prevSellOrders];
            sellOrdersList.forEach(newOrder => {
              const exists = combined.find(o => o.transactionHash === newOrder.transactionHash);
              if (!exists) {
                combined.push(newOrder);
              }
            });

            // Sort by block number descending (most recent first)
            combined.sort((a, b) => b.blockNumber - a.blockNumber);
            
            // Take top 5 most recent
            const top5 = combined.slice(0, 5);
            
            // Sort by price for display (sell: lowest first)
            top5.sort((a, b) => a.price - b.price);

            // Update seen transactions
            setSeenTransactions(prevSeen => {
              const newSeen = new Set(prevSeen);
              sellOrdersList.forEach(order => newSeen.add(order.transactionHash));
              return newSeen;
            });

            // Update display orders
            const sellOrdersFinal = top5.map(({ blockNumber, transactionHash, ...order }) => order);
            setSellOrders(sellOrdersFinal);

            return top5;
          });
        }
      }

      // Mark initial load as complete
      if (isInitial) {
        setIsInitialLoad(false);
      }
    } catch (error) {
      // Error fetching order book
      // Only set empty arrays on initial load error
      if (isInitial) {
        setBuyOrders([]);
        setSellOrders([]);
      }
    } finally {
      // Only update loading state on initial load
      if (isInitial) {
        setIsLoading(false);
      }
    }
  };

  const OrderRow = ({ order, type }: { order: Order; type: 'buy' | 'sell' }) => (
    <div className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded text-sm">
      <div className={`flex-1 text-right ${type === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
        {formatCurrency(order.price)}
      </div>
      <div className="flex-1 text-right text-muted-foreground">
        {formatNumber(order.amount)}
      </div>
      <div className="flex-1 text-right text-muted-foreground">
        {formatCurrency(order.total)}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Book</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading order book...
          </div>
        ) : (
          <Tabs defaultValue="combined" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
              <TabsTrigger value="combined">All</TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="space-y-2 mt-4">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-2 border-b">
                <div className="text-right">Price</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Total</div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {buyOrders.length > 0 ? (
                  buyOrders.map((order, index) => (
                    <OrderRow key={index} order={order} type="buy" />
                  ))
                ) : (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No buy orders
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sell" className="space-y-2 mt-4">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-2 border-b">
                <div className="text-right">Price</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Total</div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {sellOrders.length > 0 ? (
                  sellOrders.map((order, index) => (
                    <OrderRow key={index} order={order} type="sell" />
                  ))
                ) : (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No sell orders
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="combined" className="space-y-2 mt-4">
              {/* Current Price Indicator */}
              {currentPrice > 0 && (
                <div className="text-center py-2 bg-primary/10 rounded mb-2">
                  <div className="text-xs text-muted-foreground mb-1">Current Price</div>
                  <div className="text-lg font-bold text-primary">
                    {formatCurrency(currentPrice)}
                  </div>
                </div>
              )}

              {/* Sell Orders (above current price) */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <div className="text-xs font-semibold text-red-500">Sell Orders</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-2 border-b">
                  <div className="text-right">Price</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Total</div>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {sellOrders.slice(0, 5).map((order, index) => (
                    <OrderRow key={`sell-${index}`} order={order} type="sell" />
                  ))}
                </div>
              </div>

              {/* Buy Orders (below current price) */}
              <div>
                <div className="flex items-center gap-2 mb-2 mt-4">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <div className="text-xs font-semibold text-green-500">Buy Orders</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pb-2 border-b">
                  <div className="text-right">Price</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Total</div>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {buyOrders.slice(0, 5).map((order, index) => (
                    <OrderRow key={`buy-${index}`} order={order} type="buy" />
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

