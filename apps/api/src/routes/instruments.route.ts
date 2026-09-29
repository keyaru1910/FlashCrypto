import { Router, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { RedisKeys } from '@flashcrypto/redis-keys';

export function createInstrumentsRouter(redisClient: Redis): Router {
  const router = Router();

  /**
   * API lấy danh sách các cặp coin đang được giao dịch
   */
  router.get('/instruments', async (req: Request, res: Response) => {
    try {
      const instruments = await prisma.instrument.findMany({
        where: { active: true },
        orderBy: { symbol: 'asc' },
      });

      res.json({
        data: instruments,
        meta: {
          total: instruments.length,
          timestamp: Date.now(),
        },
        error: null,
      });
    } catch (err: any) {
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: {
          message: 'Không thể tải danh sách coin',
          details: err.message,
        },
      });
    }
  });

  /**
   * API lấy snapshot toàn bộ giá mới nhất của các coin từ Redis
   */
  router.get('/prices', async (req: Request, res: Response) => {
    try {
      const allPricesRaw = await redisClient.hgetall(RedisKeys.PRICES_HASH);
      const parsedPrices: Record<string, { price: string; timestamp: number; volume24h?: string }> = {};

      for (const [symbol, jsonStr] of Object.entries(allPricesRaw)) {
        try {
          const item = JSON.parse(jsonStr);
          parsedPrices[symbol] = {
            price: item.p,
            timestamp: item.ts,
            volume24h: item.v24h,
          };
        } catch {
          // Bỏ qua nếu dữ liệu không chuẩn
        }
      }

      res.json({
        data: parsedPrices,
        meta: {
          total: Object.keys(parsedPrices).length,
          timestamp: Date.now(),
        },
        error: null,
      });
    } catch (err: any) {
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: {
          message: 'Không thể tải bảng giá mới nhất',
          details: err.message,
        },
      });
    }
  });

  return router;
}
