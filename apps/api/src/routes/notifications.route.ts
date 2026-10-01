import { Router, Response } from 'express';
import { Redis } from 'ioredis';
import { RedisKeys } from '@flashcrypto/redis-keys';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export function createNotificationsRouter(redisUrl: string): Router {
  const router = Router();

  /**
   * GET /me/stream: Server-Sent Events stream nhận thông báo cảnh báo giá tức thời cho user hiện tại
   */
  router.get('/me/stream', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const userChannel = RedisKeys.notificationChannel(userId);

    // Cấu hình Header SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const redisSub = new Redis(redisUrl, { maxRetriesPerRequest: null });
    await redisSub.subscribe(userChannel);

    // Gửi thông điệp kết nối thành công ban đầu
    res.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: Date.now() })}\n\n`);

    redisSub.on('message', (_channel: string, message: string) => {
      try {
        res.write(`event: alert\ndata: ${message}\n\n`);
      } catch {
        // Bỏ qua lỗi ghi
      }
    });

    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', async () => {
      clearInterval(pingInterval);
      await redisSub.unsubscribe(userChannel);
      await redisSub.quit();
    });
  });

  return router;
}
