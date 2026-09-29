'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface CryptoPriceData {
  symbol: string;
  price: string;
  previousPrice?: string;
  priceChangeDirection?: 'UP' | 'DOWN' | 'NONE';
  timestamp: number;
  volume24h?: string;
  priceChangePercent24h?: string;
  lastUpdated: number;
}

export type ConnectionStatus = 'LIVE' | 'STALE' | 'RECONNECTING' | 'DISCONNECTED';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useCryptoStream(symbols: string[] = []) {
  const [prices, setPrices] = useState<Record<string, CryptoPriceData>>({});
  const [status, setStatus] = useState<ConnectionStatus>('RECONNECTING');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [ticksPerSecond, setTicksPerSecond] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const staleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tickCounterRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(Date.now());

  // Reset stale timer
  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
    }
    // Nếu quá 3.5 giây không nhận được tick nào từ server thì đánh dấu STALE
    staleTimerRef.current = setTimeout(() => {
      setStatus((prev) => (prev === 'LIVE' ? 'STALE' : prev));
    }, 3500);
  }, []);

  // Đo lường tốc độ ticks/giây
  useEffect(() => {
    const interval = setInterval(() => {
      setTicksPerSecond(tickCounterRef.current);
      tickCounterRef.current = 0;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Kết nối SSE
  useEffect(() => {
    let isCancelled = false;

    const queryString = symbols.length > 0 ? `?symbols=${symbols.join(',')}` : '';
    const streamUrl = `${API_BASE_URL}/api/v1/stream${queryString}`;

    setStatus('RECONNECTING');

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!isCancelled) {
        setStatus('LIVE');
        resetStaleTimer();
      }
    };

    // Nhận snapshot ban đầu
    es.addEventListener('snapshot', (event: MessageEvent) => {
      if (isCancelled) return;
      try {
        const rawTicks: Array<{
          symbol: string;
          price: string;
          timestamp: number;
          volume24h?: string;
        }> = JSON.parse(event.data);

        setPrices((prev) => {
          const next = { ...prev };
          for (const t of rawTicks) {
            next[t.symbol] = {
              symbol: t.symbol,
              price: t.price,
              timestamp: t.timestamp,
              volume24h: t.volume24h,
              priceChangeDirection: 'NONE',
              lastUpdated: Date.now(),
            };
          }
          return next;
        });

        setStatus('LIVE');
        resetStaleTimer();
      } catch (err) {
        console.error('Lỗi parse snapshot SSE:', err);
      }
    });

    // Nhận delta batches từ conflation buffer
    es.addEventListener('delta', (event: MessageEvent) => {
      if (isCancelled) return;
      try {
        const deltaTicks: Array<{
          symbol: string;
          price: string;
          timestamp: number;
          volume24h?: string;
        }> = JSON.parse(event.data);

        const now = Date.now();
        tickCounterRef.current += deltaTicks.length;
        lastTickTimeRef.current = now;

        setPrices((prev) => {
          const next = { ...prev };

          for (const tick of deltaTicks) {
            const oldItem = prev[tick.symbol];
            let direction: 'UP' | 'DOWN' | 'NONE' = 'NONE';

            if (oldItem) {
              const oldVal = parseFloat(oldItem.price);
              const newVal = parseFloat(tick.price);
              if (newVal > oldVal) direction = 'UP';
              else if (newVal < oldVal) direction = 'DOWN';
            }

            // Tính ước lượng độ trễ từ thời điểm sàn gửi (ts) đến client
            if (tick.timestamp) {
              const currentLatency = Math.max(0, now - tick.timestamp);
              setLatencyMs(currentLatency);
            }

            next[tick.symbol] = {
              symbol: tick.symbol,
              price: tick.price,
              previousPrice: oldItem?.price,
              priceChangeDirection: direction,
              timestamp: tick.timestamp,
              volume24h: tick.volume24h || oldItem?.volume24h,
              lastUpdated: now,
            };
          }

          return next;
        });

        setStatus('LIVE');
        resetStaleTimer();
      } catch (err) {
        console.error('Lỗi parse delta SSE:', err);
      }
    });

    es.onerror = () => {
      if (!isCancelled) {
        setStatus('RECONNECTING');
      }
    };

    return () => {
      isCancelled = true;
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      es.close();
    };
  }, [symbols.join(','), resetStaleTimer]);

  return {
    prices,
    status,
    latencyMs,
    ticksPerSecond,
  };
}
