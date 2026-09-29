import { Router, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { RedisKeys } from '@flashcrypto/redis-keys';
import { PriceTick } from '@flashcrypto/market-data';
import { SubscriptionManager } from '../services/subscription-manager.js';
import { ClientSession } from '../services/client-session.js';

export function createStreamRouter(
  redisClient: Redis,
  subscriptionManager: SubscriptionManager,
  allActiveSymbols: () => Promise<string[]>
): Router {
  const router = Router();

  // Biến đếm tổng số kết nối SSE đang mở
  let activeClientsCount = 0;

  router.get('/stream', async (req: Request, res: Response) => {
    // 1. Phân tích danh sách symbol được yêu cầu
    const requestedSymbolsParam = req.query.symbols as string | undefined;
    let symbolsToSubscribe: string[] = [];

    if (requestedSymbolsParam && requestedSymbolsParam.trim().length > 0) {
      symbolsToSubscribe = requestedSymbolsParam
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);
    } else {
      // Nếu không truyền symbol, mặc định theo dõi toàn bộ các cặp coin
      symbolsToSubscribe = await allActiveSymbols();
    }

    // 2. Thiết lập HTTP headers cho Server-Sent Events (SSE) và chống buffer trên Reverse Proxy
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Yêu cầu Nginx không buffer gói tin SSE
    res.flushHeaders();

    activeClientsCount++;
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session = new ClientSession(clientId, res, symbolsToSubscribe, 250);

    // 3. Lấy Snapshot giá mới nhất từ Redis Hash `prices`
    try {
      const allPrices = await redisClient.hgetall(RedisKeys.PRICES_HASH);
      const snapshotTicks: PriceTick[] = [];

      for (const symbol of symbolsToSubscribe) {
        const rawJson = allPrices[symbol];
        if (rawJson) {
          try {
            const data = JSON.parse(rawJson);
            snapshotTicks.push({
              symbol,
              price: data.p,
              timestamp: data.ts,
              volume24h: data.v24h,
            });
          } catch {
            // Bỏ qua lỗi parse
          }
        }
      }

      // Gửi snapshot tức thì xuống client
      session.sendSnapshot(snapshotTicks);
    } catch (err) {
      console.error('Lỗi khi lấy snapshot giá từ Redis:', err);
    }

    // 4. Đăng ký client vào SubscriptionManager
    const tickListener = (tick: PriceTick) => {
      session.pushTick(tick);
    };

    await subscriptionManager.subscribe(symbolsToSubscribe, tickListener);

    // 5. Gửi Ping định kỳ giữ kết nối sống (Keep-alive)
    const pingInterval = setInterval(() => {
      session.sendPing();
    }, 15000);

    // 6. Xử lý khi Client ngắt kết nối (đóng tab, chuyển trang, mất mạng)
    req.on('close', async () => {
      activeClientsCount = Math.max(0, activeClientsCount - 1);
      clearInterval(pingInterval);
      session.close();
      await subscriptionManager.unsubscribe(symbolsToSubscribe, tickListener);
    });
  });

  return router;
}
