'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  UTCTimestamp,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { useCandleStream, CandleInterval, ChartCandle } from '../hooks/useCandleStream';
import {
  Maximize2,
  Minimize2,
  BarChart2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const isChartReadyRef = useRef<boolean>(false);

  // Hook nhận nến lịch sử và nến live với buffer & merge
  const { candles, isLoading, streamConnected, error } = useCandleStream({
    symbol,
    interval,
    onRealtimeUpdate: (candle) => {
      // Chỉ cập nhật real-time khi biểu đồ đã hoàn tất nạp dữ liệu lịch sử ban đầu
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
        // Tránh unhandled runtime exception khi chart đang chuyển đổi symbol/timeframe
        console.warn('Bỏ qua lỗi cập nhật nến live:', err);
      }
    },
  });

  // 1. Khởi tạo Chart
  useEffect(() => {
    if (!containerRef.current) return;

    // Xóa chart cũ nếu có
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
      priceScaleId: '', // Hiển thị đè lên trục chính với scaleMargins riêng
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Lắng nghe sự kiện hover chuột để hiển thị thanh O-H-L-C-V
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

    // Xử lý co giãn kích thước màn hình với ResizeObserver
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

  // 2. Nạp dữ liệu nến vào Chart khi tải xong lịch sử (Chỉ nạp 1 lần duy nhất khi đổi coin hoặc timeframe)
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const currentKey = `${symbol}_${interval}`;
    
    // Nếu chưa nạp hoặc vừa đổi symbol/interval thì mới setData và định vị lại viewport
    if (lastLoadedKeyRef.current !== currentKey) {
      lastLoadedKeyRef.current = currentKey;

      // Đảm bảo dữ liệu được sắp xếp theo thời gian tăng dần và loại bỏ trùng lặp
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
        isChartReadyRef.current = true;

        // Cài đặt khoảng cách nến tiêu chuẩn và cuộn tới thời gian mới nhất (không dùng fitContent để tránh nén 3000 nến thành 1 vệt)
        chartRef.current?.timeScale().applyOptions({
          barSpacing: 8,
          minBarSpacing: 0.5,
          rightOffset: 12,
        });
        chartRef.current?.timeScale().scrollToRealTime();
      } catch (err) {
        console.error('Lỗi khi nạp dữ liệu ban đầu vào chart:', err);
      }
    }
  }, [candles, symbol, interval]);

  // Reset tracking key khi đổi symbol hoặc interval
  useEffect(() => {
    lastLoadedKeyRef.current = '';
    isChartReadyRef.current = false;
  }, [symbol, interval]);

  // 3. Ẩn/hiện Volume Series
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({
        visible: showVolume,
      });
    }
  }, [showVolume]);

  const intervals: CandleInterval[] = ['1m', '5m', '15m', '1h', '1d', '1w'];

  // Cây nến hiển thị trên header: ưu tiên cây nến đang hover, nếu không có thì lấy cây nến cuối cùng
  const latestCandle = candles[candles.length - 1];
  const activeDisplayCandle = hoveredCandle || latestCandle;

  // Tính phần trăm biến động của cây nến đang hiển thị
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
        height: isFullscreen ? '100vh' : '560px',
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
      {/* Chart Top Toolbar */}
      <div
        style={{
          padding: '14px 20px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                color: '#fff',
              }}
            >
              {symbol.slice(0, 3)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.5px' }}>
                  {symbol}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
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
          </div>

          {/* Live Price display */}
          {currentPrice && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                className="mono-num"
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: isPositive ? 'var(--green-up)' : 'var(--red-down)',
                }}
              >
                ${Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              {priceChange24h && (
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: Number(priceChange24h) >= 0 ? 'var(--green-up)' : 'var(--red-down)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  {Number(priceChange24h) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
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
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
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

        {/* Right: Actions & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Stream Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '20px',
              background: streamConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${streamConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: streamConnected ? 'var(--green-up)' : '#f59e0b',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: streamConnected ? 'var(--green-up)' : '#f59e0b',
                boxShadow: streamConnected ? '0 0 8px #10b981' : 'none',
              }}
            />
            {streamConnected ? 'Live Nến' : 'Đang kết nối...'}
          </div>

          {/* Toggle Volume button */}
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
            <BarChart2 size={15} />
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

          {/* Fullscreen button */}
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
            padding: '8px 20px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            Thời gian: <strong style={{ color: '#fff' }}>{new Date(activeDisplayCandle.openTime).toLocaleString('vi-VN')}</strong>
          </span>
          <span>
            O:{' '}
            <strong className="mono-num" style={{ color: '#fff' }}>
              {activeDisplayCandle.open.toFixed(2)}
            </strong>
          </span>
          <span>
            H:{' '}
            <strong className="mono-num" style={{ color: 'var(--green-up)' }}>
              {activeDisplayCandle.high.toFixed(2)}
            </strong>
          </span>
          <span>
            L:{' '}
            <strong className="mono-num" style={{ color: 'var(--red-down)' }}>
              {activeDisplayCandle.low.toFixed(2)}
            </strong>
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
          {showVolume && activeDisplayCandle.volume !== undefined && (
            <span>
              Vol:{' '}
              <strong className="mono-num" style={{ color: '#cbd5e1' }}>
                {activeDisplayCandle.volume.toFixed(2)}
              </strong>
            </span>
          )}
        </div>
      )}

      {/* Chart Canvas Area */}
      <div style={{ position: 'relative', flex: 1, width: '100%', minHeight: 0 }}>
        {/* Loading Spinner */}
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
              zIndex: 10,
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
              Đang tải dữ liệu nến & buffer stream...
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(11, 15, 25, 0.8)',
              zIndex: 10,
              color: 'var(--red-down)',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Lightweight Charts Canvas Target */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
