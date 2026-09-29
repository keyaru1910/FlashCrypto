import 'dotenv/config';
import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { BinanceProvider, PriceTick, Kline } from '@flashcrypto/market-data';
import { RedisKeys } from '@flashcrypto/redis-keys';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const BINANCE_WS_URL = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443';
const BINANCE_REST_URL = process.env.BINANCE_REST_URL || 'https://api.binance.com';

const FALLBACK_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'NEARUSDT', 'SUIUSDT', 'APTUSDT', 'OPUSDT', 'ARBUSDT',
  'LTCUSDT', 'TONUSDT', 'PEPEUSDT', 'SHIBUSDT', 'RENDERUSDT',
];

/**
 * Hàm lấy danh sách các cặp coin đang kích hoạt (active) từ Postgres hoặc danh sách fallback
 */
async function getActiveSymbols(): Promise<string[]> {
  try {
    const instruments = await prisma.instrument.findMany({
      where: { active: true },
      select: { symbol: true },
    });
    if (instruments.length > 0) {
      return instruments.map((i) => i.symbol);
    }
  } catch (error) {
    console.warn('⚠️ Không thể đọc danh sách coin từ Postgres, sử dụng danh sách mặc định.', error);
  }
  return FALLBACK_SYMBOLS;
}

async function startIngestService() {
  console.log('🚀 [Ingest Service] Đang khởi động...');

  // 1. Khởi tạo kết nối Redis
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  redis.on('connect', () => {
    console.log('✅ [Redis] Đã kết nối thành công tới Redis:', REDIS_URL);
  });

  redis.on('error', (err) => {
    console.error('❌ [Redis] Lỗi kết nối Redis:', err.message);
  });

  // 2. Lấy danh sách symbols cần theo dõi
  const symbols = await getActiveSymbols();
  console.log(`📋 [Ingest Service] Đang theo dõi ${symbols.length} cặp coin:`, symbols.join(', '));

  // 3. Khởi tạo Binance Provider
  const provider = new BinanceProvider({
    wsBaseUrl: BINANCE_WS_URL,
    restBaseUrl: BINANCE_REST_URL,
    reconnectBaseDelayMs: 1000,
    maxReconnectDelayMs: 30000,
  });

  // Biến đếm thống kê lưu lượng (metrics)
  let ticksReceived = 0;
  let klinesReceived = 0;

  // Lắng nghe sự kiện trạng thái kết nối
  provider.onStatusChange((status, error) => {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    if (status === 'CONNECTED') {
      console.log(`🟢 [${timestamp}] [Binance WS] Kết nối thành công tới sàn Binance.`);
    } else if (status === 'RECONNECTING') {
      console.warn(`🟡 [${timestamp}] [Binance WS] Đang thử kết nối lại...`);
    } else if (status === 'DISCONNECTED') {
      console.warn(`🔴 [${timestamp}] [Binance WS] Mất kết nối tới sàn Binance.`);
    } else if (status === 'ERROR') {
      console.error(`💥 [${timestamp}] [Binance WS] Gặp sự cố:`, error?.message);
    }
  });

  // 4. Xử lý Tick giá mới
  provider.onTick(async (tick: PriceTick) => {
    ticksReceived++;

    // Lưu trạng thái giá mới nhất vào Redis Hash `prices`
    const pricePayload = JSON.stringify({
      p: tick.price,
      ts: tick.timestamp,
      v24h: tick.volume24h,
    });

    try {
      // Pipeline để thực hiện hset và publish đồng thời, tối ưu round-trip time (RTT)
      const pipeline = redis.pipeline();
      pipeline.hset(RedisKeys.PRICES_HASH, tick.symbol, pricePayload);
      pipeline.publish(RedisKeys.tickChannel(tick.symbol), JSON.stringify(tick));
      await pipeline.exec();
    } catch (err) {
      console.error(`Lỗi khi ghi tick vào Redis cho ${tick.symbol}:`, err);
    }
  });

  // 5. Xử lý Nến (Kline)
  provider.onKline(async (kline: Kline) => {
    klinesReceived++;

    try {
      // Publish dữ liệu nến vào channel `kline:{symbol}:{interval}`
      await redis.publish(
        RedisKeys.klineChannel(kline.symbol, kline.interval),
        JSON.stringify(kline)
      );
    } catch (err) {
      console.error(`Lỗi khi publish kline vào Redis cho ${kline.symbol}:`, err);
    }
  });

  // 6. Đăng ký symbols và bắt đầu kết nối
  await provider.subscribe(symbols);
  await provider.connect();

  // 7. Thống kê lưu lượng mỗi 10 giây
  const statsInterval = setInterval(() => {
    console.log(
      `📊 [Thống kê 10s] Ticks nhận: ${ticksReceived} (${(ticksReceived / 10).toFixed(1)} tick/s) | Nến klines: ${klinesReceived}`
    );
    ticksReceived = 0;
    klinesReceived = 0;
  }, 10000);

  // 8. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Nhận tín hiệu ${signal}. Đang đóng Ingest Service...`);
    clearInterval(statsInterval);
    await provider.disconnect();
    await redis.quit();
    await prisma.$disconnect();
    console.log('👋 Ingest Service đã dừng an toàn.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startIngestService().catch((err) => {
  console.error('❌ Lỗi khởi động Ingest Service:', err);
  process.exit(1);
});
