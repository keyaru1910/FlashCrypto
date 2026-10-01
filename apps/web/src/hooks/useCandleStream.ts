import { useState, useEffect, useRef, useCallback } from 'react';

export interface ChartCandle {
  time: number; // Unix timestamp tính bằng giây
  openTime: number; // Unix timestamp tính bằng mili-giây
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed?: boolean;
}

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '1d';

const INTERVAL_MS: Record<CandleInterval, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

interface UseCandleStreamOptions {
  symbol: string;
  interval: CandleInterval;
  limit?: number;
  onRealtimeUpdate?: (candle: ChartCandle) => void;
}

export function useCandleStream({
  symbol,
  interval,
  limit = 300,
  onRealtimeUpdate,
}: UseCandleStreamOptions) {
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [streamConnected, setStreamConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventBufferRef = useRef<ChartCandle[]>([]);
  const isHistoryLoadedRef = useRef<boolean>(false);
  const currentCandlesRef = useRef<ChartCandle[]>([]);

  // Giữ callback mới nhất để tránh stale closure
  const onRealtimeUpdateRef = useRef(onRealtimeUpdate);
  onRealtimeUpdateRef.current = onRealtimeUpdate;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  /**
   * Áp dụng một cây nến live vào danh sách nến hiện tại
   */
  const applyLiveCandle = useCallback(
    (liveCandle: ChartCandle) => {
      const bucketMs = INTERVAL_MS[interval] || 60 * 1000;
      const bucketTimeMs = Math.floor(liveCandle.openTime / bucketMs) * bucketMs;
      const bucketTimeSec = Math.floor(bucketTimeMs / 1000);

      const currentList = [...currentCandlesRef.current];
      if (currentList.length === 0) {
        const initialCandle: ChartCandle = {
          time: bucketTimeSec,
          openTime: bucketTimeMs,
          open: liveCandle.open,
          high: liveCandle.high,
          low: liveCandle.low,
          close: liveCandle.close,
          volume: liveCandle.volume,
        };
        currentList.push(initialCandle);
        currentCandlesRef.current = currentList;
        setCandles(currentList);
        if (onRealtimeUpdateRef.current) {
          onRealtimeUpdateRef.current(initialCandle);
        }
        return;
      }

      const lastCandle = currentList[currentList.length - 1];

      if (interval === '1m') {
        if (liveCandle.time === lastCandle.time) {
          // Cập nhật cây nến hiện tại
          const updated: ChartCandle = {
            ...lastCandle,
            high: Math.max(lastCandle.high, liveCandle.high),
            low: Math.min(lastCandle.low, liveCandle.low),
            close: liveCandle.close,
            volume: liveCandle.volume,
            isClosed: liveCandle.isClosed,
          };
          currentList[currentList.length - 1] = updated;
          currentCandlesRef.current = currentList;
          setCandles(currentList);
          if (onRealtimeUpdateRef.current) {
            onRealtimeUpdateRef.current(updated);
          }
        } else if (liveCandle.time > lastCandle.time) {
          // Nến 1m mới bắt đầu
          const newCandle: ChartCandle = {
            time: liveCandle.time,
            openTime: liveCandle.openTime,
            open: liveCandle.open,
            high: liveCandle.high,
            low: liveCandle.low,
            close: liveCandle.close,
            volume: liveCandle.volume,
            isClosed: liveCandle.isClosed,
          };
          currentList.push(newCandle);
          currentCandlesRef.current = currentList;
          setCandles(currentList);
          if (onRealtimeUpdateRef.current) {
            onRealtimeUpdateRef.current(newCandle);
          }
        }
      } else {
        // Đối với khung nến lớn hơn (5m, 15m, 1h, 1d)
        if (bucketTimeSec === lastCandle.time) {
          const updated: ChartCandle = {
            ...lastCandle,
            high: Math.max(lastCandle.high, liveCandle.high),
            low: Math.min(lastCandle.low, liveCandle.low),
            close: liveCandle.close,
            volume: lastCandle.volume + (liveCandle.isClosed ? liveCandle.volume : 0),
          };
          currentList[currentList.length - 1] = updated;
          currentCandlesRef.current = currentList;
          setCandles(currentList);
          if (onRealtimeUpdateRef.current) {
            onRealtimeUpdateRef.current(updated);
          }
        } else if (bucketTimeSec > lastCandle.time) {
          const newBucketCandle: ChartCandle = {
            time: bucketTimeSec,
            openTime: bucketTimeMs,
            open: liveCandle.open,
            high: liveCandle.high,
            low: liveCandle.low,
            close: liveCandle.close,
            volume: liveCandle.volume,
          };
          currentList.push(newBucketCandle);
          currentCandlesRef.current = currentList;
          setCandles(currentList);
          if (onRealtimeUpdateRef.current) {
            onRealtimeUpdateRef.current(newBucketCandle);
          }
        }
      }
    },
    [interval]
  );

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);
    isHistoryLoadedRef.current = false;
    eventBufferRef.current = [];
    currentCandlesRef.current = [];
    setCandles([]);

    // 1. Mở SSE Stream để lắng nghe nến live ngay lập tức
    const sseUrl = `${apiUrl}/api/v1/stream/candles?symbol=${symbol.toUpperCase()}&interval=1m`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      if (!isCancelled) setStreamConnected(true);
    });

    es.addEventListener('kline', (event) => {
      try {
        const liveCandle: ChartCandle = JSON.parse(event.data);

        if (!isHistoryLoadedRef.current) {
          // Khi REST history chưa xong -> Đưa vào buffer để merge sau
          eventBufferRef.current.push(liveCandle);
        } else {
          // Lịch sử đã tải xong -> Áp dụng trực tiếp
          applyLiveCandle(liveCandle);
        }
      } catch (err) {
        console.error('Lỗi khi phân tích kline từ SSE:', err);
      }
    });

    es.onerror = () => {
      if (!isCancelled) setStreamConnected(false);
    };

    // 2. Gọi REST API lấy lịch sử nến
    const fetchHistory = async () => {
      try {
        const res = await fetch(
          `${apiUrl}/api/v1/candles?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
        );

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const json = await res.json();
        if (isCancelled) return;

        let historicalCandles: ChartCandle[] = json.data || [];

        // 3. Tiến hành MERGE BUFFER với Lịch Sử
        currentCandlesRef.current = historicalCandles;
        isHistoryLoadedRef.current = true;
        setCandles(historicalCandles);
        setIsLoading(false);

        // Áp dụng các sự kiện trong buffer nhận được trong lúc tải lịch sử
        if (eventBufferRef.current.length > 0) {
          const buffer = [...eventBufferRef.current];
          eventBufferRef.current = [];

          for (const bufferedCandle of buffer) {
            applyLiveCandle(bufferedCandle);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Không thể tải lịch sử nến');
          setIsLoading(false);
        }
      }
    };

    fetchHistory();

    // Dọn dẹp khi unmount hoặc khi đổi symbol / interval
    return () => {
      isCancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [symbol, interval, limit, apiUrl, applyLiveCandle]);

  return {
    candles,
    isLoading,
    streamConnected,
    error,
  };
}
