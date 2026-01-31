'use client';

import React, { useEffect, useRef, useState } from 'react';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  SeriesType,
} from 'lightweight-charts';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTokenPriceHistory } from '@/queries/tokens';
import { formatFromWei } from '@/lib/utils';
import type { PriceInterval, PriceCandle } from '@/types';

interface PriceChartProps {
  tokenAddress: string;
  className?: string;
}

type ChartType = 'candle' | 'line';

const INTERVALS: { label: string; value: PriceInterval }[] = [
  { label: '1m', value: 'ONE_MINUTE' },
  { label: '5m', value: 'FIVE_MINUTES' },
  { label: '15m', value: 'FIFTEEN_MINUTES' },
  { label: '1h', value: 'ONE_HOUR' },
  { label: '4h', value: 'FOUR_HOURS' },
  { label: '1D', value: 'ONE_DAY' },
];

// Chart colors matching our design system
const CHART_COLORS = {
  background: 'hsl(0, 0%, 7%)', // --card
  text: 'hsl(0, 0%, 60%)', // --muted-foreground
  grid: 'hsl(0, 0%, 15%)', // --border
  upColor: 'hsl(142, 70%, 45%)', // --success
  downColor: 'hsl(0, 72%, 51%)', // --destructive
  lineColor: 'hsl(292, 84%, 61%)', // --primary
};

export function PriceChart({ tokenAddress, className }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  const [interval, setInterval] = useState<PriceInterval>('ONE_HOUR');
  const [chartType, setChartType] = useState<ChartType>('candle');

  const { data: priceHistory, isLoading, error } = useTokenPriceHistory(tokenAddress, interval);

  // Initialize chart - dynamically import lightweight-charts (bundle-dynamic-imports rule)
  useEffect(() => {
    if (!containerRef.current) return;

    let chart: IChartApi | null = null;
    let mounted = true;

    // Dynamic import to code-split the ~100KB chart library
    import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode }) => {
      if (!mounted || !containerRef.current) return;

      chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: CHART_COLORS.background },
          textColor: CHART_COLORS.text,
        },
        grid: {
          vertLines: { color: CHART_COLORS.grid },
          horzLines: { color: CHART_COLORS.grid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            width: 1,
            color: CHART_COLORS.text,
            style: 2,
          },
          horzLine: {
            width: 1,
            color: CHART_COLORS.text,
            style: 2,
          },
        },
        rightPriceScale: {
          borderColor: CHART_COLORS.grid,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: CHART_COLORS.grid,
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      chartRef.current = chart;

      // Handle resize
      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      handleResize();
    });

    return () => {
      mounted = false;
      if (chart) {
        chart.remove();
      }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update series when chart type or data changes
  useEffect(() => {
    if (!chartRef.current || !priceHistory) return;

    // Dynamic import for series types (bundle-dynamic-imports rule)
    import('lightweight-charts').then(({ CandlestickSeries, LineSeries }) => {
      if (!chartRef.current || !priceHistory) return;

      // Remove existing series
      if (seriesRef.current) {
        chartRef.current.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }

      // Transform data
      const chartData = priceHistory.map((candle: PriceCandle) => {
        const time = (new Date(candle.timestamp).getTime() / 1000) as Time;
        const open = formatFromWei(candle.open);
        const high = formatFromWei(candle.high);
        const low = formatFromWei(candle.low);
        const close = formatFromWei(candle.close);

        if (chartType === 'candle') {
          return { time, open, high, low, close } as CandlestickData<Time>;
        }
        return { time, value: close } as LineData<Time>;
      });

      // Add new series (lightweight-charts v5.x API)
      if (chartType === 'candle') {
        const candleSeries = chartRef.current!.addSeries(CandlestickSeries, {
          upColor: CHART_COLORS.upColor,
          downColor: CHART_COLORS.downColor,
          borderUpColor: CHART_COLORS.upColor,
          borderDownColor: CHART_COLORS.downColor,
          wickUpColor: CHART_COLORS.upColor,
          wickDownColor: CHART_COLORS.downColor,
        });
        candleSeries.setData(chartData as CandlestickData<Time>[]);
        seriesRef.current = candleSeries;
      } else {
        const lineSeries = chartRef.current!.addSeries(LineSeries, {
          color: CHART_COLORS.lineColor,
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: CHART_COLORS.lineColor,
          crosshairMarkerBackgroundColor: CHART_COLORS.background,
        });
        lineSeries.setData(chartData as LineData<Time>[]);
        seriesRef.current = lineSeries;
      }

      // Fit content
      chartRef.current!.timeScale().fitContent();
    });
  }, [priceHistory, chartType]);

  return (
    <Card className={className}>
      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {/* Interval Tabs */}
        <Tabs value={interval} onValueChange={(v) => setInterval(v as PriceInterval)}>
          <TabsList className="h-8">
            {INTERVALS.map((i) => (
              <TabsTrigger key={i.value} value={i.value} className="text-xs px-2 h-6">
                {i.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Chart Type Toggle */}
        <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
          <TabsList className="h-8">
            <TabsTrigger value="candle" className="text-xs px-3 h-6">
              Candles
            </TabsTrigger>
            <TabsTrigger value="line" className="text-xs px-3 h-6">
              Line
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Chart Container */}
      <div className="relative h-[400px]">
        {/* Use ternary for conditional rendering (rendering-conditional-render rule) */}
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
            <p className="text-sm text-muted-foreground">Failed to load chart data</p>
          </div>
        ) : null}

        {!isLoading && !error && (!priceHistory || priceHistory.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
            <p className="text-sm text-muted-foreground">No price data available</p>
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />
      </div>
    </Card>
  );
}
