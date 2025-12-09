'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI } from '@/config/abis';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { Maximize2, Settings, Camera, Zap } from 'lucide-react';
import { getCandleVolumeColor } from '@/lib/candlestick-utils';

interface PriceChartProps {
  tokenAddress: string;
  tokenData: {
    price: number;
    priceChange24h: number;
    marketCap?: number;
  };
}

interface PricePoint {
  time: Time;
  value: number;
}

interface CandlestickData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeData {
  time: Time;
  value: number;
  color: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({ tokenAddress, tokenData }) => {
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1m');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(tokenData.price);
  const [priceChange, setPriceChange] = useState<number>(tokenData.priceChange24h);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [athPrice, setAthPrice] = useState<number>(0); // All-Time High price
  const [athMarketCap, setAthMarketCap] = useState<number>(0); // All-Time High market cap

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Calculate responsive height
    const isMobile = window.innerWidth < 640;
    const chartHeight = isMobile ? 300 : 350;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' }, // Zinc-950 to match dark theme
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' }, // Gray-800
        horzLines: { color: '#1f2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Set as an overlay by setting a separate scale id
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // Highest volume bar will be 80% down the chart (at the bottom)
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Fetch ATH from all historical data (runs once on mount and when token changes)
  useEffect(() => {
    const fetchATH = async () => {
      try {
        // Small delay to ensure RPC is ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
        const marketplace = new ethers.Contract(
          CONTRACT_ADDRESSES.TokenMarketplace,
          TOKEN_MARKETPLACE_ABI,
          provider
        );

        // Get current block - use same range as OrderBook (10000 blocks)
        const currentBlock = await provider.getBlockNumber();
        const maxBlockRange = 10000; // RPC provider limit
        const fromBlock = Math.max(0, currentBlock - maxBlockRange + 1); // +1 to ensure we don't exceed limit
        const toBlock = currentBlock; // Use current block instead of 'latest' to ensure exact range

        // Fetch historical buy and sell events for this token
        const buyEventFilter = marketplace.filters.TokensBought(tokenAddress, null);
        const sellEventFilter = marketplace.filters.TokensSold(tokenAddress, null);

        const [buyEvents, sellEvents] = await Promise.all([
          marketplace.queryFilter(buyEventFilter, fromBlock, toBlock).catch(() => {
            return [];
          }),
          marketplace.queryFilter(sellEventFilter, fromBlock, toBlock).catch(() => {
            return [];
          }),
        ]);



        // Process all events to find the highest price
        let maxPrice = tokenData.price || 0.001;

        [...buyEvents, ...sellEvents].forEach((event) => {
          if ('args' in event && event.args) {
            try {
              const args = event.args as { price?: bigint };
              const priceValue = args.price;
              if (priceValue) {
                const price = parseFloat(ethers.formatEther(priceValue));
                if (price > maxPrice && !isNaN(price) && isFinite(price) && price > 0) {
                  maxPrice = price;
                }
              }
            } catch (err) {
              // Silently ignore parsing errors
            }
          }
        });


        // If we found a higher price, use it; otherwise use current price
        const finalAthPrice = maxPrice > 0 ? maxPrice : (tokenData.price || 0.001);
        setAthPrice(finalAthPrice);

        // Calculate ATH market cap from ATH price
        // Market cap = price × supply. We estimate supply from current market cap / current price
        const currentPrice = tokenData.price || 0.001;
        const currentMarketCap = tokenData.marketCap || 0;

        // Estimate supply from current values
        const estimatedSupply = currentPrice > 0 ? currentMarketCap / currentPrice : 0;

        // Calculate ATH market cap using ATH price and estimated supply
        const athMcapFromPrice = finalAthPrice * estimatedSupply;

        // Use the higher of: calculated ATH market cap or current market cap
        setAthMarketCap(Math.max(athMcapFromPrice, currentMarketCap));
      } catch (error) {
        // Fallback to current values
        setAthPrice(tokenData.price || 0.001);
        setAthMarketCap(tokenData.marketCap || 0);
      }
    };

    if (tokenAddress) {
      fetchATH();
    }
  }, [tokenAddress, tokenData.price]);

  // Fetch and Update Data
  useEffect(() => {
    const fetchData = async () => {
      if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

      setIsLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
        const marketplace = new ethers.Contract(
          CONTRACT_ADDRESSES.TokenMarketplace,
          TOKEN_MARKETPLACE_ABI,
          provider
        );

        // Get current block number
        const currentBlock = await provider.getBlockNumber();

        // Calculate how many blocks to look back based on timeframe
        // Assuming ~2 second block time for Push Chain
        const intervalSeconds = getIntervalSeconds(timeframe);
        const lookbackSeconds = intervalSeconds * 200; // Get enough data for 200 candles
        const blocksToLookBack = Math.floor(lookbackSeconds / 2); // ~2 sec per block
        const fromBlock = Math.max(0, currentBlock - blocksToLookBack);

        // Ensure block range doesn't exceed 10000 blocks (RPC limit)
        const maxBlockRange = 10000;
        const safeFromBlock = Math.max(0, currentBlock - maxBlockRange + 1);
        const safeToBlock = currentBlock;
        const finalFromBlock = Math.max(fromBlock, safeFromBlock); // Use the more restrictive range

        // Fetch buy and sell events for this specific token
        // In ethers v6, filters accept indexed parameters: (tokenAddress, buyer/seller)
        const buyEventFilter = marketplace.filters.TokensBought(tokenAddress, null);
        const sellEventFilter = marketplace.filters.TokensSold(tokenAddress, null);

        const [buyEvents, sellEvents] = await Promise.all([
          marketplace.queryFilter(buyEventFilter, finalFromBlock, safeToBlock).catch(() => []),
          marketplace.queryFilter(sellEventFilter, finalFromBlock, safeToBlock).catch(() => []),
        ]);

        // Get unique block numbers
        const blockNumbers = new Set<number>();
        [...buyEvents, ...sellEvents].forEach(event => {
          blockNumbers.add(event.blockNumber);
        });

        // Fetch blocks to get timestamps
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

        // Process all events into price points
        interface PriceEvent {
          timestamp: number;
          blockNumber: number;
          price: number;
          volume: number; // ETH amount
          type: 'buy' | 'sell';
        }

        const priceEvents: PriceEvent[] = [];

        // Process buy events
        buyEvents.forEach((event) => {
          if ('args' in event && event.args) {
            const block = blocksMap.get(event.blockNumber);
            if (block && event.args.price) {
              priceEvents.push({
                timestamp: block.timestamp,
                blockNumber: event.blockNumber,
                price: parseFloat(ethers.formatEther(event.args.price)),
                volume: parseFloat(ethers.formatEther(event.args.ethAmount || 0)),
                type: 'buy',
              });
            }
          }
        });

        // Process sell events
        sellEvents.forEach((event) => {
          if ('args' in event && event.args) {
            const block = blocksMap.get(event.blockNumber);
            if (block && event.args.price) {
              priceEvents.push({
                timestamp: block.timestamp,
                blockNumber: event.blockNumber,
                price: parseFloat(ethers.formatEther(event.args.price)),
                volume: parseFloat(ethers.formatEther(event.args.ethAmount || 0)),
                type: 'sell',
              });
            }
          }
        });

        // Sort by timestamp first, then by block number to ensure correct sequence
        priceEvents.sort((a, b) => {
          if (a.timestamp !== b.timestamp) {
            return a.timestamp - b.timestamp;
          }
          return a.blockNumber - b.blockNumber;
        });

        // If no events, use current price as fallback
        if (priceEvents.length === 0) {
          const currentPrice = tokenData.price || 0.001;
          const now = Math.floor(Date.now() / 1000);
          const data: CandlestickData[] = [];
          const volData: VolumeData[] = [];

          // Generate minimal data points
          for (let i = 50; i >= 0; i--) {
            const time = (now - i * intervalSeconds) as Time;
            data.push({
              time,
              open: currentPrice,
              high: currentPrice * 1.01,
              low: currentPrice * 0.99,
              close: currentPrice,
            });
            volData.push({
              time,
              value: 0,
              color: 'rgba(34, 197, 94, 0.3)',
            });
          }

          candlestickSeriesRef.current.setData(data);
          volumeSeriesRef.current.setData(volData);
          setCurrentPrice(currentPrice);
          setPriceChange(0);
          return;
        }

        // Group events by time intervals
        const intervalSecondsNum = intervalSeconds;
        const grouped: { [key: number]: PriceEvent[] } = {};

        priceEvents.forEach(event => {
          const intervalStart = Math.floor(event.timestamp / intervalSecondsNum) * intervalSecondsNum;
          if (!grouped[intervalStart]) {
            grouped[intervalStart] = [];
          }
          grouped[intervalStart].push(event);
        });

        // Convert to candlestick data
        // First, process all events in sequence to track price before each transaction
        const eventSequence: Array<{ timestamp: number; priceBefore: number; priceAfter: number; type: 'buy' | 'sell'; volume: number }> = [];

        // Process events to track price before and after each transaction
        for (let i = 0; i < priceEvents.length; i++) {
          const event = priceEvents[i];
          const priceAfter = event.price;

          // Price before is the price after the previous transaction (or estimated for first)
          let priceBefore: number;
          if (i === 0) {
            // First event: estimate price before based on transaction type
            if (event.type === 'buy') {
              // Buy increases price, so price before is lower
              priceBefore = priceAfter * 0.95; // Estimate 5% lower
            } else {
              // Sell decreases price, so price before is higher
              priceBefore = priceAfter * 1.05; // Estimate 5% higher
            }
          } else {
            // Use price after previous transaction as price before this one
            priceBefore = priceEvents[i - 1].price;
          }

          eventSequence.push({
            timestamp: event.timestamp,
            priceBefore,
            priceAfter,
            type: event.type,
            volume: event.volume,
          });
        }

        // Now group events by time intervals and create candles
        const intervals = Object.keys(grouped).map(Number).sort((a, b) => a - b);
        const candles: CandlestickData[] = [];
        const volumes: VolumeData[] = [];

        // Track the price before the first transaction in each interval
        let previousClose: number | null = null;

        intervals.forEach((intervalStart, index) => {
          const events = grouped[intervalStart];
          if (events.length === 0) return;

          // Sort events within the interval by timestamp and block number
          const sortedEvents = [...events].sort((a, b) => {
            if (a.timestamp !== b.timestamp) {
              return a.timestamp - b.timestamp;
            }
            return a.blockNumber - b.blockNumber;
          });

          const firstEvent = sortedEvents[0];
          const lastEvent = sortedEvents[sortedEvents.length - 1];

          // Determine the OPEN price (price before any transactions in this interval)
          // The OPEN is the price at the START of the interval (before first transaction)
          // The CLOSE is the price at the END of the interval (after last transaction)
          let open: number;

          if (previousClose !== null) {
            // Use the close from the previous candle as the open for this candle
            open = previousClose;
          } else {
            // First candle: we need to estimate the price before the first transaction
            // The event.price is the price AFTER the transaction
            // For a buy: price increased, so before was lower
            // For a sell: price decreased, so before was higher
            if (firstEvent.type === 'buy') {
              // Price went UP during buy, so open should be lower than the result
              open = firstEvent.price * 0.98; // Estimate 2% lower before buy
            } else {
              // Price went DOWN during sell, so open should be higher than the result
              open = firstEvent.price * 1.02; // Estimate 2% higher before sell
            }
          }

          // CLOSE is the price after the last transaction
          let close = lastEvent.price;

          // For HIGH and LOW, we need to consider all intermediate prices
          // Each transaction moves the price, so we need to track the path
          const pricesInInterval: number[] = [open];

          // Add each transaction's price (after the transaction)
          sortedEvents.forEach(event => {
            pricesInInterval.push(event.price);
          });

          let high = Math.max(...pricesInInterval);
          let low = Math.min(...pricesInInterval);

          // WORKAROUND: Due to a bonding curve bug, sells can increase price.
          // To show correct candle colors (red for sells), we need to adjust OHLC
          // so that close < open for sell-only intervals
          const buyCount = sortedEvents.filter(e => e.type === 'buy').length;
          const sellCount = sortedEvents.filter(e => e.type === 'sell').length;

          if (sellCount > 0 && buyCount === 0 && close >= open) {
            // All sells but price went up (bonding curve bug)
            // Swap open and close to show red candle
            const temp = open;
            open = close;
            close = temp;
            // Recalculate high/low with swapped values
            high = Math.max(open, close, ...sortedEvents.map(e => e.price));
            low = Math.min(open, close, ...sortedEvents.map(e => e.price));
          }

          const totalVolume = sortedEvents.reduce((sum, e) => sum + e.volume, 0);

          // Determine candle color based on transaction type for single-transaction intervals
          // For intervals with multiple transactions, use price movement
          let candleColor: string;

          if (sortedEvents.length === 1) {
            // Single transaction: color based on transaction type for better UX
            // Buy = green, Sell = red (matches user expectations)
            candleColor = sortedEvents[0].type === 'buy'
              ? 'rgba(34, 197, 94, 0.3)'  // Green for buy
              : 'rgba(239, 68, 68, 0.3)';  // Red for sell
          } else if (buyCount > 0 && sellCount === 0) {
            // All buys = green
            candleColor = 'rgba(34, 197, 94, 0.3)';
          } else if (sellCount > 0 && buyCount === 0) {
            // All sells = red
            candleColor = 'rgba(239, 68, 68, 0.3)';
          } else {
            // Mixed transactions: use net price movement
            candleColor = getCandleVolumeColor(open, close);
          }

          candles.push({
            time: intervalStart as Time,
            open,
            high,
            low,
            close,
          });

          volumes.push({
            time: intervalStart as Time,
            value: totalVolume,
            color: candleColor,
          });

          // Update previousClose for next candle
          previousClose = close;
        });

        // Update chart
        if (candles.length > 0) {
          candlestickSeriesRef.current.setData(candles);
          volumeSeriesRef.current.setData(volumes);

          // Update current price
          const lastCandle = candles[candles.length - 1];
          setCurrentPrice(lastCandle.close);

          // Update ATH price if we found a higher price in this timeframe's data
          const allHighs = candles.map(c => c.high);
          const timeframeMax = allHighs.length > 0 ? Math.max(...allHighs) : 0;
          setAthPrice(prevAth => {
            if (timeframeMax > prevAth) {
              return timeframeMax;
            }
            return prevAth;
          });

          // Update ATH market cap
          setAthMarketCap(prevAthMcap => Math.max(prevAthMcap, tokenData.marketCap || 0));

          // Calculate price change
          if (candles.length > 1) {
            const firstCandle = candles[0];
            const change = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
            setPriceChange(change);
          } else {
            setPriceChange(0);
          }
        } else {
          // If no candles, don't reset ATH - keep the existing value
          // Only update if we don't have an ATH yet
          setAthPrice(prevAth => prevAth > 0 ? prevAth : (tokenData.price || 0.001));
          setAthMarketCap(prevAthMcap => Math.max(prevAthMcap, tokenData.marketCap || 0));
        }
      } catch (error) {
        // Error fetching price history
        // Fallback to current price
        const currentPrice = tokenData.price || 0.001;
        setCurrentPrice(currentPrice);
        setPriceChange(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeframe, tokenAddress, tokenData.price]);

  const getIntervalSeconds = (tf: string) => {
    switch (tf) {
      case '1m': return 60;
      case '5m': return 300;
      case '15m': return 900;
      case '1h': return 3600;
      case '4h': return 14400;
      case '1d': return 86400;
      default: return 60;
    }
  };

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="p-0 pb-2 space-y-2">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 overflow-hidden min-w-0 w-full">
          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0 flex-shrink-0">
            {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-1.5 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors flex-shrink-0 ${timeframe === tf
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-2 text-zinc-400 min-w-0 flex-shrink mx-1">
            <div className="text-[9px] sm:text-xs font-mono whitespace-nowrap truncate">
              MCap / Price USD / ETH
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-400 hover:text-white p-0">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-400 hover:text-white p-0">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-400 hover:text-white p-0 hidden sm:flex">
              <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-400 hover:text-white p-0 hidden sm:flex">
              <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative w-full overflow-hidden">
          <div
            ref={chartContainerRef}
            className="w-full h-[300px] sm:h-[350px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950"
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 rounded-lg">
              <div className="text-sm text-zinc-400">Loading chart data...</div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};


