import { Router, Response } from 'express';
import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { RedisKeys } from '@flashcrypto/redis-keys';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export function createAlertsRouter(redisClient: Redis): Router {
  const router = Router();

  /**
   * GET /alerts: Lấy toàn bộ danh sách cảnh báo của người dùng hiện tại
   */
  router.get('/alerts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const alerts = await prisma.alert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const formattedAlerts = alerts.map((a) => ({
        id: a.id,
        symbol: a.symbol,
        direction: a.direction,
        threshold: a.threshold.toString(),
        status: a.status,
        channel: a.channel,
        createdAt: a.createdAt,
        triggeredAt: a.triggeredAt,
      }));

      res.json({
        data: formattedAlerts,
        meta: {
          total: formattedAlerts.length,
          timestamp: Date.now(),
        },
        error: null,
      });
    } catch (err: any) {
      console.error('Lỗi khi lấy danh sách cảnh báo:', err);
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: 'Không thể tải danh sách cảnh báo', details: err.message },
      });
    }
  });

  /**
   * POST /alerts: Tạo cảnh báo giá mới
   * Body:
   *  - symbol: BTCUSDT
   *  - direction: 'ABOVE' | 'BELOW'
   *  - threshold: number | string
   *  - channel?: 'BROWSER' | 'TELEGRAM'
   */
  router.post('/alerts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { symbol, direction, threshold, channel } = req.body;

      if (!symbol || !direction || threshold === undefined) {
        return res.status(400).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Thiếu thông tin cảnh báo: symbol, direction, threshold là bắt buộc.' },
        });
      }

      const formattedSymbol = String(symbol).toUpperCase().trim();
      const thresholdNum = parseFloat(String(threshold));

      if (isNaN(thresholdNum) || thresholdNum <= 0) {
        return res.status(400).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Ngưỡng giá (threshold) phải là số dương hợp lệ.' },
        });
      }

      if (direction !== 'ABOVE' && direction !== 'BELOW') {
        return res.status(400).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Direction phải là ABOVE (vượt lên) hoặc BELOW (rơi xuống).' },
        });
      }

      const chosenChannel = channel === 'TELEGRAM' ? 'TELEGRAM' : 'BROWSER';

      // 1. Lưu alert vào cơ sở dữ liệu PostgreSQL
      const alert = await prisma.alert.create({
        data: {
          userId,
          symbol: formattedSymbol,
          direction,
          threshold: thresholdNum,
          status: 'ACTIVE',
          channel: chosenChannel,
        },
      });

      // 2. Thêm ngay lập tức vào Redis Sorted Set để Alert Engine bắt đầu giám sát
      const setKey =
        direction === 'ABOVE'
          ? RedisKeys.alertAboveSet(formattedSymbol)
          : RedisKeys.alertBelowSet(formattedSymbol);

      await redisClient.zadd(setKey, thresholdNum, alert.id);

      console.log(
        `🔔 [Alert Created] User: ${userId} | ${formattedSymbol} | ${direction} $${thresholdNum} -> Đã nạp vào Redis key "${setKey}"`
      );

      res.status(201).json({
        data: {
          id: alert.id,
          symbol: alert.symbol,
          direction: alert.direction,
          threshold: alert.threshold.toString(),
          status: alert.status,
          channel: alert.channel,
          createdAt: alert.createdAt,
        },
        meta: { timestamp: Date.now() },
        error: null,
      });
    } catch (err: any) {
      console.error('Lỗi khi tạo cảnh báo:', err);
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: 'Không thể tạo cảnh báo', details: err.message },
      });
    }
  });

  /**
   * DELETE /alerts/:id: Hủy cảnh báo giá
   */
  router.delete('/alerts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const id = String(req.params.id);

      const alert = await prisma.alert.findUnique({
        where: { id },
      });

      if (!alert) {
        return res.status(404).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Không tìm thấy cảnh báo này.' },
        });
      }

      if (alert.userId !== userId) {
        return res.status(403).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Bạn không có quyền thao tác trên cảnh báo này.' },
        });
      }

      // 1. Cập nhật status thành CANCELLED trong Postgres
      await prisma.alert.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // 2. Gỡ bỏ khỏi cả 2 Sorted Sets trong Redis
      const aboveKey = RedisKeys.alertAboveSet(alert.symbol);
      const belowKey = RedisKeys.alertBelowSet(alert.symbol);

      await Promise.all([
        redisClient.zrem(aboveKey, alert.id),
        redisClient.zrem(belowKey, alert.id),
      ]);

      console.log(`🗑️ [Alert Cancelled] ID: ${alert.id} | Symbol: ${alert.symbol}`);

      res.json({
        data: {
          id: alert.id,
          status: 'CANCELLED',
          message: 'Đã hủy cảnh báo thành công.',
        },
        meta: { timestamp: Date.now() },
        error: null,
      });
    } catch (err: any) {
      console.error('Lỗi khi hủy cảnh báo:', err);
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: 'Không thể hủy cảnh báo', details: err.message },
      });
    }
  });

  return router;
}
