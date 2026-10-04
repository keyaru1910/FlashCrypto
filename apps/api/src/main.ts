import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { SubscriptionManager } from './services/subscription-manager.js';
import { createStreamRouter } from './routes/stream.route.js';
import { createInstrumentsRouter } from './routes/instruments.route.js';
import { createCandlesRouter } from './routes/candles.route.js';
import { createAuthRouter } from './routes/auth.route.js';
import { createAlertsRouter } from './routes/alerts.route.js';
import { createNotificationsRouter } from './routes/notifications.route.js';
import { createMetricsRouter } from './routes/metrics.route.js';

const PORT = Number(process.env.PORT) || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

const FALLBACK_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'NEARUSDT', 'SUIUSDT', 'APTUSDT', 'OPUSDT', 'ARBUSDT',
  'LTCUSDT', 'TONUSDT', 'PEPEUSDT', 'SHIBUSDT', 'RENDERUSDT',
];

async function getAllActiveSymbols(): Promise<string[]> {
  try {
    const items = await prisma.instrument.findMany({
      where: { active: true },
      select: { symbol: true },
    });
    if (items.length > 0) return items.map((i) => i.symbol);
  } catch {
    // Fallback nếu DB có sự cố
  }
  return FALLBACK_SYMBOLS;
}

async function startApiGateway() {
  const app = express();

  // Cấu hình Middleware
  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // Khởi tạo Redis client
  const redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const subscriptionManager = new SubscriptionManager(REDIS_URL);

  // Healthcheck & Metrics
  app.get('/health', async (req, res) => {
    try {
      const redisStatus = redisClient.status;
      const subsCount = subscriptionManager.getActiveSubscriptionsCount();

      res.json({
        status: 'ok',
        redis: redisStatus,
        activeSubscriptions: subsCount,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Đăng ký API Routes v1
  const apiV1Router = express.Router();
  apiV1Router.use('/', createInstrumentsRouter(redisClient));
  apiV1Router.use('/', createStreamRouter(redisClient, subscriptionManager, getAllActiveSymbols));
  apiV1Router.use('/', createCandlesRouter(REDIS_URL));
  apiV1Router.use('/', createAuthRouter());
  apiV1Router.use('/', createAlertsRouter(redisClient));
  apiV1Router.use('/', createNotificationsRouter(REDIS_URL));
  apiV1Router.use('/', createMetricsRouter(redisClient));

  app.use('/api/v1', apiV1Router);

  // Root endpoint /metrics trực tiếp cho Prometheus scraper
  app.use('/', createMetricsRouter(redisClient));

  // Khởi động server lắng nghe
  const server = app.listen(PORT, () => {
    console.log(`🚀 [API Gateway] Đang chạy tại cổng http://localhost:${PORT}`);
    console.log(`📡 [SSE Stream] Endpoint: http://localhost:${PORT}/api/v1/stream`);
    console.log(`📊 [Instruments] Endpoint: http://localhost:${PORT}/api/v1/instruments`);
    console.log(`🕯️  [Candles] Endpoint: http://localhost:${PORT}/api/v1/candles`);
    console.log(`🔐 [Auth] Endpoint: http://localhost:${PORT}/api/v1/auth/(login|register|me)`);
    console.log(`🔔 [Alerts] Endpoint: http://localhost:${PORT}/api/v1/alerts`);
    console.log(`📱 [User Notifications] Endpoint: http://localhost:${PORT}/api/v1/me/stream`);
    console.log(`📈 [Metrics] Endpoint: http://localhost:${PORT}/metrics & http://localhost:${PORT}/api/v1/metrics`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Nhận tín hiệu ${signal}. Đang đóng API Gateway...`);
    server.close();
    await subscriptionManager.close();
    await redisClient.quit();
    await prisma.$disconnect();
    console.log('👋 API Gateway đã dừng an toàn.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startApiGateway().catch((err) => {
  console.error('❌ Lỗi khi khởi động API Gateway:', err);
  process.exit(1);
});
