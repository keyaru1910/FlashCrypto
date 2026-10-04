import { Router, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { MetricsCollector } from '../services/metrics.service.js';

export function createMetricsRouter(redisClient: Redis): Router {
  const router = Router();
  const collector = MetricsCollector.getInstance();

  /**
   * Endpoint /metrics - Hỗ trợ cả định dạng JSON (mặc định) và Prometheus text format
   * nếu client gửi header Accept: text/plain hoặc query ?format=prometheus
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    const isPrometheus =
      req.query.format === 'prometheus' ||
      req.headers.accept?.includes('text/plain');

    try {
      if (isPrometheus) {
        const text = await collector.getPrometheusFormat(redisClient);
        res.setHeader('Content-Type', 'text/plain; version=0.0.4');
        return res.send(text);
      }

      const metrics = await collector.getMetrics(redisClient);
      res.json({
        data: metrics,
        meta: {
          timestamp: Date.now(),
        },
        error: null,
      });
    } catch (err: any) {
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: err.message || 'Lỗi khi trích xuất metrics' },
      });
    }
  });

  return router;
}
