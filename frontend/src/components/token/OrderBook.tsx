'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getTokenTrades, getToken } from '@/lib/api/tokens';

interface OrderBookProps {
  tokenAddress: string;
}

interface Order {
  price: number;
  amount: number;
  total: number;
}

export const OrderBook: React.FC<OrderBookProps> = ({ tokenAddress }) => {
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  const fetchOrderBook = useCallback(async () => {
    try {
      // Fetch trades and current price from backend API
      const [tradesResponse, tokenResponse] = await Promise.all([
        getTokenTrades(tokenAddress, 1, 20), // Get last 20 trades
        getToken(tokenAddress), // Get current price
      ]);

      if (tokenResponse.success && tokenResponse.data) {
        setCurrentPrice(tokenResponse.data.price);
      }

      if (tradesResponse.success && tradesResponse.data) {
        const trades = tradesResponse.data;

        // Separate buy and sell orders
        const buyOrdersList: Order[] = [];
        const sellOrdersList: Order[] = [];

        for (const trade of trades) {
          // amountIn/amountOut are in wei format, need to convert
          const amountIn = parseFloat(trade.amountIn) / 1e18;
          const amountOut = parseFloat(trade.amountOut) / 1e18;

          if (trade.type === 'BUY') {
            // BUY: amountIn is ETH spent, amountOut is tokens received
            buyOrdersList.push({
              price: trade.price,
              amount: amountOut,
              total: amountIn,
            });
          } else if (trade.type === 'SELL') {
            // SELL: amountIn is tokens sold, amountOut is ETH received
            sellOrdersList.push({
              price: trade.price,
              amount: amountIn,
              total: amountOut,
            });
          }
        }

        // Sort by price (buy: highest first, sell: lowest first)
        buyOrdersList.sort((a, b) => b.price - a.price);
        sellOrdersList.sort((a, b) => a.price - b.price);

        // Take top 5 of each
        setBuyOrders(buyOrdersList.slice(0, 5));
        setSellOrders(sellOrdersList.slice(0, 5));
      }
    } catch (error) {
      console.warn('Error fetching order book:', error);
      setBuyOrders([]);
      setSellOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    // Reset state when token address changes
    setBuyOrders([]);
    setSellOrders([]);
    setIsLoading(true);

    fetchOrderBook();
    // Refresh every 30 seconds (backend data is cached, so more frequent polling is fine)
    const interval = setInterval(fetchOrderBook, 30000);
    return () => clearInterval(interval);
  }, [tokenAddress, fetchOrderBook]);

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

