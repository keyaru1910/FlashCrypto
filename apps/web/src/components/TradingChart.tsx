'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  UTCTimestamp,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { useCandleStream, CandleInterval, ChartCandle } from '../hooks/useCandleStream';
import { DrawingOverlay } from './DrawingOverlay';
import { DrawingToolType, DrawingElement } from '../types/drawing';
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
} from '../utils/indicators';
import {
  Maximize2,
  Minimize2,
  BarChart2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  MousePointer,
  Slash,
  Minus,
  ArrowUpRight,
  Square,
  Percent,
  Edit3,
  Type,
  Ruler,
  Target,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface TradingChartProps {
  symbol: string;
  currentPrice?: string;
  priceChange24h?: string;
  volume24h?: string;
  onOpenAlertModal?: (symbol: string, price: string) => void;
}

export function TradingChart({
  symbol,
  currentPrice,
  priceChange24h,
  volume24h,
  onOpenAlertModal,
}: TradingChartProps) {
  const [interval, setInterval] = useState<CandleInterval>('1m');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [hoveredCandle, setHoveredCandle] = useState<ChartCandle | null>(null);

  // Trạng thái Công Cụ Vẽ (Drawing Tools)
  const [selectedTool, setSelectedTool] = useState<DrawingToolType>('cursor');
  const [drawings, setDrawings] = useState<DrawingElement[]>([]);

  // Trạng thái Bật/Tắt Chỉ Báo Kỹ Thuật (Indicators)
  const [showSMA20, setShowSMA20] = useState<boolean>(false);
  const [showEMA200, setShowEMA200] = useState<boolean>(false);
  const [showBollinger, setShowBollinger] = useState<boolean>(false);
  const [showRSI, setShowRSI] = useState<boolean>(false);
  const [showMACD, setShowMACD] = useState<boolean>(false);
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Refs cho các Indicator Series
  const sma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const isChartReadyRef = useRef<boolean>(false);

  // Tải danh sách hình vẽ đã lưu trong LocalStorage theo từng coin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`flashcrypto_drawings_${symbol}`);
        if (saved) {
          setDrawings(JSON.parse(saved));
        } else {
          setDrawings([]);
        }
      } catch (err) {
        console.warn('Không thể nạp hình vẽ từ LocalStorage:', err);
      }
    }
  }, [symbol]);

  // Lưu danh sách hình vẽ vào LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`flashcrypto_drawings_${symbol}`, JSON.stringify(drawings));
      } catch (err) {
        console.warn('Không thể lưu hình vẽ vào LocalStorage:', err);
      }
    }
  }, [drawings, symbol]);

  // Hook nhận nến lịch sử và nến live với buffer & merge
  const { candles, isLoading, streamConnected, error } = useCandleStream({
    symbol,
    interval,
    onRealtimeUpdate: (candle) => {
      if (!isChartReadyRef.current) return;

      try {
        if (candlestickSeriesRef.current) {
          candlestickSeriesRef.current.update({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });
        }

        if (volumeSeriesRef.current) {
          const isUp = candle.close >= candle.open;
          volumeSeriesRef.current.update({
            time: candle.time as UTCTimestamp,
            value: candle.volume,
            color: isUp ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
          });
        }
      } catch (err) {
        console.warn('Bỏ qua lỗi cập nhật nến live:', err);
      }
    },
  });

  // 1. Khởi tạo Chart chính
  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#4f46e5',
        },
        horzLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#4f46e5',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 1.5,
        rightOffset: 12,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Thêm chuỗi nến Candlestick
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Thêm chuỗi khối lượng giao dịch (Volume Histogram)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#10b98144',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Thêm SMA 20 Series
    const sma20 = chart.addSeries(LineSeries, {
      color: '#eab308',
      lineWidth: 2,
      title: 'SMA 20',
      visible: false,
    });

    // Thêm EMA 200 Series
    const ema200 = chart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
      title: 'EMA 200',
      visible: false,
    });

    // Thêm Bollinger Bands Series
    const bbUpper = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      title: 'BB Upper',
      visible: false,
    });
    const bbMiddle = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      title: 'BB Mid',
      visible: false,
    });
    const bbLower = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      title: 'BB Lower',
      visible: false,
    });

    // Thêm RSI Series (ở scale riêng)
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      priceScaleId: 'rsi_scale',
      title: 'RSI 14',
      visible: false,
    });
    rsiSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0,
      },
    });

    // Thêm MACD Series
    const macdSeries = chart.addSeries(LineSeries, {
      color: '#0284c7',
      lineWidth: 1,
      priceScaleId: 'macd_scale',
      title: 'MACD',
      visible: false,
    });
    const macdSignal = chart.addSeries(LineSeries, {
      color: '#f43f5e',
      lineWidth: 1,
      priceScaleId: 'macd_scale',
      title: 'Signal',
      visible: false,
    });
    const macdHist = chart.addSeries(HistogramSeries, {
      color: '#10b981',
      priceScaleId: 'macd_scale',
      title: 'Hist',
      visible: false,
    });
    macdSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    sma20SeriesRef.current = sma20;
    ema200SeriesRef.current = ema200;
    bbUpperSeriesRef.current = bbUpper;
    bbMiddleSeriesRef.current = bbMiddle;
    bbLowerSeriesRef.current = bbLower;
    rsiSeriesRef.current = rsiSeries;
    macdSeriesRef.current = macdSeries;
    macdSignalSeriesRef.current = macdSignal;
    macdHistSeriesRef.current = macdHist;

    // Crosshair hover tracking
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }

      const candlePoint = param.seriesData.get(candlestickSeries) as any;
      const volumePoint = param.seriesData.get(volumeSeries) as any;

      if (candlePoint) {
        setHoveredCandle({
          time: Number(param.time),
          openTime: Number(param.time) * 1000,
          open: candlePoint.open,
          high: candlePoint.high,
          low: candlePoint.low,
          close: candlePoint.close,
          volume: volumePoint ? volumePoint.value : 0,
        });
      }
    });

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      isChartReadyRef.current = false;
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  const lastLoadedKeyRef = useRef<string>('');

  // 2. Nạp dữ liệu nến & Tính toán toàn bộ Indicators
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const currentKey = `${symbol}_${interval}`;

    if (lastLoadedKeyRef.current !== currentKey) {
      lastLoadedKeyRef.current = currentKey;

      const uniqueMap = new Map<number, ChartCandle>();
      for (const c of candles) {
        uniqueMap.set(c.time, c);
      }
      const sortedCandles = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);

      const candleData = sortedCandles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const volumeData = sortedCandles.map((c) => {
        const isUp = c.close >= c.open;
        return {
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: isUp ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
        };
      });

      try {
        candlestickSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

        // Cập nhật Indicators
        const smaData = calculateSMA(sortedCandles, 20);
        sma20SeriesRef.current?.setData(smaData);

        const emaData = calculateEMA(sortedCandles, 200);
        ema200SeriesRef.current?.setData(emaData);

        const bbData = calculateBollingerBands(sortedCandles, 20, 2);
        bbUpperSeriesRef.current?.setData(bbData.map((d) => ({ time: d.time, value: d.upper })));
        bbMiddleSeriesRef.current?.setData(bbData.map((d) => ({ time: d.time, value: d.middle })));
        bbLowerSeriesRef.current?.setData(bbData.map((d) => ({ time: d.time, value: d.lower })));

        const rsiData = calculateRSI(sortedCandles, 14);
        rsiSeriesRef.current?.setData(rsiData);

        const macdData = calculateMACD(sortedCandles, 12, 26, 9);
        macdSeriesRef.current?.setData(macdData.map((d) => ({ time: d.time, value: d.macd })));
        macdSignalSeriesRef.current?.setData(macdData.map((d) => ({ time: d.time, value: d.signal })));
        macdHistSeriesRef.current?.setData(
          macdData.map((d) => ({
            time: d.time,
            value: d.histogram,
            color: d.histogram >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
          }))
        );

        isChartReadyRef.current = true;

        chartRef.current?.timeScale().applyOptions({
          barSpacing: 8,
          minBarSpacing: 0.5,
          rightOffset: 12,
        });
        chartRef.current?.timeScale().scrollToRealTime();
      } catch (err) {
        console.error('Lỗi khi nạp dữ liệu nến & indicators:', err);
      }
    }
  }, [candles, symbol, interval]);

  // Cập nhật hiển thị Indicators khi user toggle
  useEffect(() => {
    sma20SeriesRef.current?.applyOptions({ visible: showSMA20 });
    ema200SeriesRef.current?.applyOptions({ visible: showEMA200 });
    bbUpperSeriesRef.current?.applyOptions({ visible: showBollinger });
    bbMiddleSeriesRef.current?.applyOptions({ visible: showBollinger });
    bbLowerSeriesRef.current?.applyOptions({ visible: showBollinger });
    rsiSeriesRef.current?.applyOptions({ visible: showRSI });
    macdSeriesRef.current?.applyOptions({ visible: showMACD });
    macdSignalSeriesRef.current?.applyOptions({ visible: showMACD });
    macdHistSeriesRef.current?.applyOptions({ visible: showMACD });
  }, [showSMA20, showEMA200, showBollinger, showRSI, showMACD]);

  // Reset tracking key khi đổi coin
  useEffect(() => {
    lastLoadedKeyRef.current = '';
    isChartReadyRef.current = false;
  }, [symbol, interval]);

  // Ẩn/hiện Volume
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

  const intervals: CandleInterval[] = ['1m', '5m', '15m', '1h', '1d', '1w'];

  const latestCandle = candles[candles.length - 1];
  const activeDisplayCandle = hoveredCandle || latestCandle;

  const candleChangePct =
    activeDisplayCandle && activeDisplayCandle.open > 0
      ? (((activeDisplayCandle.close - activeDisplayCandle.open) / activeDisplayCandle.open) * 100).toFixed(2)
      : '0.00';
  const isPositive = Number(candleChangePct) >= 0;

  return (
    <div
      className={`trading-chart-card glass-panel ${isFullscreen ? 'chart-fullscreen' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isFullscreen ? '100vh' : '620px',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        borderRadius: isFullscreen ? 0 : '16px',
        background: '#0b0f19',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : '0 12px 32px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        {/* Left: Coin Info & Live Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.8rem',
                color: '#fff',
              }}
            >
              {symbol.slice(0, 3)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                {symbol}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                SPOT
              </span>
            </div>
          </div>

          {/* Live Price */}
          {currentPrice && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                className="mono-num"
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: isPositive ? 'var(--green-up)' : 'var(--red-down)',
                }}
              >
                ${Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              {priceChange24h && (
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: Number(priceChange24h) >= 0 ? 'var(--green-up)' : 'var(--red-down)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  {Number(priceChange24h) >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {Number(priceChange24h) > 0 ? `+${priceChange24h}%` : `${priceChange24h}%`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: Timeframe Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            gap: '2px',
          }}
        >
          {intervals.map((intv) => (
            <button
              key={intv}
              onClick={() => setInterval(intv)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: interval === intv ? 'var(--accent-indigo)' : 'transparent',
                color: interval === intv ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: interval === intv ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none',
              }}
            >
              {intv}
            </button>
          ))}
        </div>

        {/* Right: Indicators Menu, Volume & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Indicators Toggle Menu Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIndicatorMenuOpen(!indicatorMenuOpen)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: indicatorMenuOpen ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              <Sparkles size={14} color="var(--accent-cyan)" />
              <span>Chỉ báo</span>
            </button>

            {indicatorMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '210px',
                  background: '#0f172a',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                  padding: '8px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: showSMA20 ? '#eab308' : 'var(--text-secondary)',
                    background: showSMA20 ? 'rgba(234, 179, 8, 0.1)' : 'transparent',
                  }}
                >
                  <span>SMA 20</span>
                  <input
                    type="checkbox"
                    checked={showSMA20}
                    onChange={(e) => setShowSMA20(e.target.checked)}
                  />
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: showEMA200 ? '#a855f7' : 'var(--text-secondary)',
                    background: showEMA200 ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                  }}
                >
                  <span>EMA 200</span>
                  <input
                    type="checkbox"
                    checked={showEMA200}
                    onChange={(e) => setShowEMA200(e.target.checked)}
                  />
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: showBollinger ? '#06b6d4' : 'var(--text-secondary)',
                    background: showBollinger ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                  }}
                >
                  <span>Bollinger Bands (20, 2)</span>
                  <input
                    type="checkbox"
                    checked={showBollinger}
                    onChange={(e) => setShowBollinger(e.target.checked)}
                  />
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: showRSI ? '#f97316' : 'var(--text-secondary)',
                    background: showRSI ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                  }}
                >
                  <span>RSI (14)</span>
                  <input
                    type="checkbox"
                    checked={showRSI}
                    onChange={(e) => setShowRSI(e.target.checked)}
                  />
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: showMACD ? '#0284c7' : 'var(--text-secondary)',
                    background: showMACD ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                  }}
                >
                  <span>MACD (12, 26, 9)</span>
                  <input
                    type="checkbox"
                    checked={showMACD}
                    onChange={(e) => setShowMACD(e.target.checked)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Toggle Volume */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            title="Bật/tắt biểu đồ Volume"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: showVolume ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: showVolume ? 'var(--accent-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <BarChart2 size={14} />
            <span>Vol</span>
          </button>

          {/* Reset Chart Fit View */}
          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            title="Căn chỉnh biểu đồ vừa khung"
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* OHLCV Bar Overlay */}
      {activeDisplayCandle && (
        <div
          style={{
            padding: '6px 18px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            Nến: <strong style={{ color: '#fff' }}>{new Date(activeDisplayCandle.openTime).toLocaleString('vi-VN')}</strong>
          </span>
          <span>
            O: <strong className="mono-num" style={{ color: '#fff' }}>{activeDisplayCandle.open.toFixed(2)}</strong>
          </span>
          <span>
            H: <strong className="mono-num" style={{ color: 'var(--green-up)' }}>{activeDisplayCandle.high.toFixed(2)}</strong>
          </span>
          <span>
            L: <strong className="mono-num" style={{ color: 'var(--red-down)' }}>{activeDisplayCandle.low.toFixed(2)}</strong>
          </span>
          <span>
            C:{' '}
            <strong
              className="mono-num"
              style={{
                color: activeDisplayCandle.close >= activeDisplayCandle.open ? 'var(--green-up)' : 'var(--red-down)',
              }}
            >
              {activeDisplayCandle.close.toFixed(2)}
            </strong>
          </span>
          <span>
            Biến động:{' '}
            <strong
              className="mono-num"
              style={{ color: isPositive ? 'var(--green-up)' : 'var(--red-down)' }}
            >
              {isPositive ? `+${candleChangePct}%` : `${candleChangePct}%`}
            </strong>
          </span>
        </div>
      )}

      {/* Khu vực Chính: Thanh Công Cụ Vẽ (Trái) + Canvas Biểu Đồ (Phải) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Left Side Drawing Toolbar */}
        <div
          style={{
            width: '46px',
            borderRight: '1px solid var(--border-color)',
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 4px',
            gap: '6px',
            zIndex: 10,
          }}
        >
          {/* Cursor */}
          <button
            onClick={() => setSelectedTool('cursor')}
            title="Con trỏ chuột (Mặc định)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'cursor' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'cursor' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MousePointer size={16} />
          </button>

          {/* Trendline */}
          <button
            onClick={() => setSelectedTool('trendline')}
            title="Đường xu hướng (Trendline)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'trendline' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'trendline' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Slash size={16} />
          </button>

          {/* Horizontal Line */}
          <button
            onClick={() => setSelectedTool('horizontal')}
            title="Đường giá ngang (Hỗ trợ / Kháng cự)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'horizontal' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'horizontal' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Minus size={16} />
          </button>

          {/* Ray */}
          <button
            onClick={() => setSelectedTool('ray')}
            title="Tia xu hướng (Ray line)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'ray' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'ray' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowUpRight size={16} />
          </button>

          {/* Rectangle Box */}
          <button
            onClick={() => setSelectedTool('rectangle')}
            title="Vùng giá hình hộp (Order Block / Demand-Supply)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'rectangle' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'rectangle' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Square size={16} />
          </button>

          {/* Fibonacci Retracement */}
          <button
            onClick={() => setSelectedTool('fibonacci')}
            title="Thoái lui Fibonacci (0.236, 0.382, 0.5, 0.618, 0.786)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'fibonacci' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'fibonacci' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Percent size={15} />
          </button>

          {/* Ruler Measure */}
          <button
            onClick={() => setSelectedTool('measure')}
            title="Thước đo khoảng giá & % biến động & số nến"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'measure' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'measure' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ruler size={16} />
          </button>

          {/* Long Position R:R */}
          <button
            onClick={() => setSelectedTool('long_position')}
            title="Vị thế Long (Risk/Reward Box)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'long_position' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'long_position' ? '#fff' : 'var(--green-up)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Target size={16} />
          </button>

          {/* Freehand Brush */}
          <button
            onClick={() => setSelectedTool('brush')}
            title="Bút vẽ tự do (Brush)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'brush' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'brush' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Edit3 size={15} />
          </button>

          {/* Text */}
          <button
            onClick={() => setSelectedTool('text')}
            title="Ghi chú chữ (Text annotation)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: selectedTool === 'text' ? 'var(--accent-indigo)' : 'transparent',
              color: selectedTool === 'text' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Type size={16} />
          </button>

          <div style={{ width: '24px', height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

          {/* Clear Drawings */}
          <button
            onClick={() => {
              if (drawings.length > 0 && confirm('Bạn có muốn xóa toàn bộ hình vẽ trên biểu đồ?')) {
                setDrawings([]);
              }
            }}
            title="Xóa toàn bộ hình vẽ"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Chart Canvas Area & Drawing Overlay */}
        <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%' }}>
          {isLoading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(11, 15, 25, 0.75)',
                zIndex: 15,
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid rgba(99, 102, 241, 0.2)',
                  borderTopColor: 'var(--accent-indigo)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Đang nạp dữ liệu nến & indicators...
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(11, 15, 25, 0.8)',
                zIndex: 15,
                color: 'var(--red-down)',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Lớp Canvas Vẽ Kỹ Thuật (Drawing Overlay) */}
          <DrawingOverlay
            chart={chartRef.current}
            series={candlestickSeriesRef.current}
            symbol={symbol}
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            candles={candles}
            drawings={drawings}
            setDrawings={setDrawings}
          />

          {/* Lightweight Charts Target Container */}
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}
