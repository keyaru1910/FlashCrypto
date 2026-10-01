import 'dotenv/config';
import { prisma } from '@flashcrypto/db';
import { CandleAggregatorService } from './candle-aggregator.service.js';
import { BackfillService } from './backfill.service.js';
import { AlertEngineService } from './alert-engine.service.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const BINANCE_REST_URL = process.env.BINANCE_REST_URL || 'https://api.binance.com';

const FALLBACK_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'NEARUSDT', 'SUIUSDT', 'APTUSDT', 'OPUSDT', 'ARBUSDT',
  'LTCUSDT', 'TONUSDT', 'PEPEUSDT', 'SHIBUSDT', 'RENDERUSDT',
];

async function getActiveSymbols(): Promise<string[]> {
  try {
    const instruments = await prisma.instrument.findMany({
      where: { active: true },
      select: { symbol: true },
    });
    if (instruments.length > 0) {
      return instruments.map((i: { symbol: string }) => i.symbol);
    }
  } catch (error) {
    console.warn('⚠️ [Worker] Không thể đọc danh sách coin từ Postgres, sử dụng danh sách mặc định.', error);
  }
  return FALLBACK_SYMBOLS;
}

async function startWorkerService() {
  console.log('🚀 [Worker Service] Đang khởi động FlashCrypto Worker...');

  const symbols = await getActiveSymbols();
  console.log(`📋 [Worker Service] Quản lý nến cho ${symbols.length} cặp coin.`);

  // 1. Khởi tạo Backfill Service
  const backfillService = new BackfillService({
    restBaseUrl: BINANCE_REST_URL,
    defaultLimit: 500, // Tải 500 nến ban đầu (~8.3 tiếng)
  });

  // 2. Chạy backfill ban đầu để đảm bảo có sẵn dữ liệu nến lịch sử cho biểu đồ
  try {
    await backfillService.backfillAll(symbols);
  } catch (err: any) {
    console.error('⚠️ [Worker] Quá trình backfill gặp lỗi:', err.message);
  }

  // 3. Khởi tạo và kích hoạt Candle Aggregator Service
  const aggregatorService = new CandleAggregatorService(REDIS_URL);
  await aggregatorService.start();

  // 4. Khởi tạo và kích hoạt Price Alert Engine Service
  const alertEngine = new AlertEngineService(REDIS_URL);
  await alertEngine.start();

  // 5. Lên lịch định kỳ kiểm tra nến bị thiếu mỗi 15 phút (Đề phòng trường hợp mất gói tin ngắn hạn)
  const periodicBackfillTimer = setInterval(async () => {
    console.log('⏰ [Worker Service] Chạy kiểm tra bù nến định kỳ...');
    try {
      const currentSymbols = await getActiveSymbols();
      await backfillService.backfillAll(currentSymbols);
    } catch (err: any) {
      console.error('⚠️ [Worker Service] Lỗi khi chạy bù nến định kỳ:', err.message);
    }
  }, 15 * 60 * 1000);

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Nhận tín hiệu ${signal}. Đang tắt Worker Service...`);
    clearInterval(periodicBackfillTimer);
    await aggregatorService.stop();
    await alertEngine.stop();
    await prisma.$disconnect();
    console.log('👋 Worker Service đã dừng an toàn.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorkerService().catch((err) => {
  console.error('❌ Lỗi khởi động Worker Service:', err);
  process.exit(1);
});
