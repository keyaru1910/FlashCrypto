import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { Kline } from '@flashcrypto/market-data';

/**
 * Service CandleAggregatorService: Lắng nghe stream nến từ Redis Pub/Sub và lưu trữ
 * các cây nến 1m đã hoàn thành (isClosed = true) vào cơ sở dữ liệu PostgreSQL.
 */
export class CandleAggregatorService {
  private redisSub: Redis;
  private isRunning = false;
  private savedCandlesCount = 0;

  constructor(redisUrl: string) {
    this.redisSub = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.redisSub.on('connect', () => {
      console.log('🕯️  [Candle Aggregator] Redis Subscriber đã kết nối.');
    });

    this.redisSub.on('error', (err) => {
      console.error('❌ [Candle Aggregator] Lỗi Redis Subscriber:', err.message);
    });
  }

  /**
   * Bắt đầu lắng nghe các kênh nến Redis
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Đăng ký pattern kline:*:1m để bắt toàn bộ nến 1 phút của tất cả các symbol
    await this.redisSub.psubscribe('kline:*:1m');
    console.log('✅ [Candle Aggregator] Đã subscribe pattern "kline:*:1m"');

    this.redisSub.on('pmessage', async (_pattern: string, channel: string, message: string) => {
      try {
        const kline: Kline = JSON.parse(message);

        // Chỉ lưu khi cây nến đã đóng (kline.isClosed === true)
        if (kline && kline.isClosed) {
          await this.saveCandle(kline);
        }
      } catch (err: any) {
        console.error(`❌ [Candle Aggregator] Lỗi xử lý kline từ channel ${channel}:`, err.message);
      }
    });
  }

  /**
   * Lưu hoặc cập nhật nến vào cơ sở dữ liệu (Upsert idempotent)
   */
  private async saveCandle(kline: Kline): Promise<void> {
    const symbol = kline.symbol.toUpperCase();
    const openTimeBigInt = BigInt(kline.openTime);

    try {
      await prisma.candle.upsert({
        where: {
          symbol_interval_openTime: {
            symbol,
            interval: kline.interval,
            openTime: openTimeBigInt,
          },
        },
        update: {
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
          volume: kline.volume,
        },
        create: {
          symbol,
          interval: kline.interval,
          openTime: openTimeBigInt,
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
          volume: kline.volume,
        },
      });

      this.savedCandlesCount++;
      const timeStr = new Date(kline.openTime).toLocaleTimeString('vi-VN');
      console.log(
        `💾 [Candle Saved] ${symbol} | Nến 1m [${timeStr}] | O: ${kline.open} H: ${kline.high} L: ${kline.low} C: ${kline.close} (Tổng đã lưu: ${this.savedCandlesCount})`
      );
    } catch (err: any) {
      console.error(`❌ [Candle Aggregator] Lỗi khi lưu nến ${symbol} vào Postgres:`, err.message);
    }
  }

  /**
   * Lấy số lượng nến đã lưu từ lúc khởi động
   */
  getSavedCount(): number {
    return this.savedCandlesCount;
  }

  /**
   * Dừng service an toàn
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.redisSub.punsubscribe('kline:*:1m');
    await this.redisSub.quit();
    console.log('👋 [Candle Aggregator] Đã dừng service.');
  }
}
