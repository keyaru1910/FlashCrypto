import { Router, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { RedisKeys } from '@flashcrypto/redis-keys';
import { BinanceProvider, Kline } from '@flashcrypto/market-data';

interface AggregatedCandle {
  time: number; // Unix timestamp tính bằng giây (dành cho Lightweight Charts)
  openTime: number; // Unix timestamp tính bằng mili-giây
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVAL_TO_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Gom (Rollup) danh sách nến 1m thành khung nến lớn hơn (5m, 15m, 1h, 1d, 1w)
 */
function aggregateCandles(rawCandles: any[], targetInterval: string): AggregatedCandle[] {
  const bucketMs = INTERVAL_TO_MS[targetInterval] || INTERVAL_TO_MS['1m'];
  const buckets: Map<number, AggregatedCandle> = new Map();

  for (const candle of rawCandles) {
    const rawTimeMs = Number(candle.openTime);
    const bucketTimeMs = Math.floor(rawTimeMs / bucketMs) * bucketMs;

    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    const volume = Number(candle.volume);

    const existing = buckets.get(bucketTimeMs);
    if (!existing) {
      buckets.set(bucketTimeMs, {
        time: Math.floor(bucketTimeMs / 1000),
        openTime: bucketTimeMs,
        open,
        high,
        low,
        close,
        volume,
      });
    } else {
      existing.high = Math.max(existing.high, high);
      existing.low = Math.min(existing.low, low);
      existing.close = close; // Nến mới hơn sẽ cập nhật giá đóng cửa
      existing.volume += volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.openTime - b.openTime);
}

export function createCandlesRouter(redisUrl: string): Router {
  const router = Router();
  const binanceProvider = new BinanceProvider();
  const redisCache = new Redis(redisUrl, { maxRetriesPerRequest: null });

  /**
   * GET /candles: Lấy dữ liệu lịch sử nến (hỗ trợ tới 10 năm từ 2017)
   * Query:
   *  - symbol: BTCUSDT (bắt buộc)
   *  - interval: 1m | 5m | 15m | 1h | 1d | 1w | 1M (mặc định: 1m)
   *  - from: start timestamp mili-giây
   *  - to: end timestamp mili-giây
   *  - limit: số lượng nến tối đa (mặc định 300, max 5000)
   */
  router.get('/candles', async (req: Request, res: Response) => {
    try {
      const symbol = (req.query.symbol as string)?.toUpperCase();
      if (!symbol) {
        return res.status(400).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Tham số symbol là bắt buộc (VD: symbol=BTCUSDT)' },
        });
      }

      const interval = (req.query.interval as string) || '1m';
      const defaultLimit = interval === '1d' || interval === '1w' || interval === '1M' ? 5000 : 300;
      const limit = Math.min(Math.max(Number(req.query.limit) || defaultLimit, 1), 5000);
      const to = req.query.to ? Number(req.query.to) : Date.now();
      const intervalMs = INTERVAL_TO_MS[interval] || INTERVAL_TO_MS['1m'];
      
      // Với khung 1d/1w/1M, nếu không truyền from thì mặc định lấy từ năm 2017 (tháng 07/2017 = 1500000000000)
      let from = req.query.from ? Number(req.query.from) : undefined;
      if (!from && (interval === '1d' || interval === '1w' || interval === '1M')) {
        from = 1500000000000; // 2017-07-14T02:40:00.000Z
      }

      const cacheKey = `cache:candles:${symbol}:${interval}:${limit}:${from || 0}`;
      
      // 1. Kiểm tra cache Redis
      try {
        const cached = await redisCache.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch {
        // Bỏ qua lỗi cache
      }

      let resultCandles: AggregatedCandle[] = [];

      // 2. Ưu tiên lấy trực tiếp từ Binance REST API với phân trang đa batch
      try {
        const klines: Kline[] = await binanceProvider.getHistory(
          symbol,
          interval,
          from,
          to,
          limit
        );

        if (klines && klines.length > 0) {
          resultCandles = klines.map((k) => ({
            time: Math.floor(k.openTime / 1000),
            openTime: k.openTime,
            open: Number(k.open),
            high: Number(k.high),
            low: Number(k.low),
            close: Number(k.close),
            volume: Number(k.volume),
          }));
        }
      } catch (err: any) {
        console.warn(`⚠️ [Candles Route] Không thể lấy trực tiếp từ Binance (${symbol} ${interval}):`, err.message);
      }

      // 3. Fallback: Nếu Binance lỗi hoặc không có mạng -> Lấy từ Postgres DB
      if (resultCandles.length === 0) {
        const dbFrom = from || to - limit * intervalMs * (interval === '1m' ? 1 : 1.2);
        const rawCandles = await prisma.candle.findMany({
          where: {
            symbol,
            interval: '1m',
            openTime: {
              gte: BigInt(Math.floor(dbFrom)),
              lte: BigInt(Math.floor(to)),
            },
          },
          orderBy: { openTime: 'asc' },
        });

        if (interval === '1m') {
          resultCandles = rawCandles.map((c) => ({
            time: Math.floor(Number(c.openTime) / 1000),
            openTime: Number(c.openTime),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume),
          }));
        } else {
          resultCandles = aggregateCandles(rawCandles, interval);
        }
      }

      const responsePayload = {
        data: resultCandles.slice(-limit),
        meta: {
          symbol,
          interval,
          count: Math.min(resultCandles.length, limit),
          from: from || (resultCandles.length > 0 ? resultCandles[0].openTime : 0),
          to,
          timestamp: Date.now(),
        },
        error: null,
      };

      // Lưu Redis Cache (ngắn hạn cho 1m, dài hơn cho 1d)
      try {
        const ttl = interval === '1m' ? 5 : interval === '1d' || interval === '1w' ? 120 : 20;
        await redisCache.setex(cacheKey, ttl, JSON.stringify(responsePayload));
      } catch {
        // Bỏ qua lỗi lưu cache
      }

      res.json(responsePayload);
    } catch (err: any) {
      console.error('Lỗi khi lấy dữ liệu nến:', err);
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: 'Lỗi máy chủ khi truy vấn lịch sử nến', details: err.message },
      });
    }
  });

  /**
   * GET /stream/candles: SSE Stream trực tiếp các cây nến đang chạy (kline) theo symbol
   */
  router.get('/stream/candles', async (req: Request, res: Response) => {
    const rawSymbol = req.query.symbol as string;
    if (!rawSymbol) {
      return res.status(400).json({ error: 'Thiếu query param symbol' });
    }

    const symbol = rawSymbol.toUpperCase();
    const interval = (req.query.interval as string) || '1m';

    // Cấu hình Header SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Khởi tạo Redis Subscriber riêng cho client SSE này
    const redisSub = new Redis(redisUrl, { maxRetriesPerRequest: null });
    const channelName = RedisKeys.klineChannel(symbol, '1m');

    await redisSub.subscribe(channelName);

    // Gửi message kết nối ban đầu
    res.write(`event: connected\ndata: ${JSON.stringify({ symbol, interval, connectedAt: Date.now() })}\n\n`);

    redisSub.on('message', (_ch: string, message: string) => {
      try {
        const kline: Kline = JSON.parse(message);
        const candleData = {
          time: Math.floor(kline.openTime / 1000),
          openTime: kline.openTime,
          open: Number(kline.open),
          high: Number(kline.high),
          low: Number(kline.low),
          close: Number(kline.close),
          volume: Number(kline.volume),
          isClosed: kline.isClosed,
        };

        res.write(`event: kline\ndata: ${JSON.stringify(candleData)}\n\n`);
      } catch {
        // Bỏ qua lỗi parse
      }
    });

    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', async () => {
      clearInterval(pingInterval);
      await redisSub.unsubscribe(channelName);
      await redisSub.quit();
    });
  });

  return router;
}
