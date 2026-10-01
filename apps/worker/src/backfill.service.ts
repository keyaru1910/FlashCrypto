import { prisma } from '@flashcrypto/db';
import { BinanceProvider, Kline } from '@flashcrypto/market-data';

export interface BackfillOptions {
  restBaseUrl?: string;
  defaultLimit?: number; // Mặc định 500 nến
}

/**
 * Service BackfillService: Tự động phát hiện và kéo bù (backfill) dữ liệu nến bị thiếu
 * từ Binance REST API khi worker khởi động hoặc sau khi khôi phục kết nối mạng.
 */
export class BackfillService {
  private provider: BinanceProvider;
  private defaultLimit: number;

  constructor(options?: BackfillOptions) {
    this.defaultLimit = options?.defaultLimit || 500;
    this.provider = new BinanceProvider({
      restBaseUrl: options?.restBaseUrl || process.env.BINANCE_REST_URL || 'https://api.binance.com',
    });
  }

  /**
   * Quét và bù nến cho danh sách symbol
   * @param symbols Danh sách các cặp coin cần kiểm tra
   */
  async backfillAll(symbols: string[]): Promise<void> {
    console.log(`🔄 [Backfill Service] Bắt đầu kiểm tra và bù nến cho ${symbols.length} cặp coin...`);
    const startTime = Date.now();
    let totalBackfilled = 0;

    for (const rawSymbol of symbols) {
      const symbol = rawSymbol.toUpperCase();
      try {
        const count = await this.backfillSymbol(symbol);
        totalBackfilled += count;
        // Nghỉ 100ms giữa các request để tránh chạm rate limit của Binance REST API
        await new Promise((res) => setTimeout(res, 100));
      } catch (err: any) {
        console.error(`⚠️ [Backfill Service] Lỗi khi bù nến cho ${symbol}:`, err.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ [Backfill Service] Hoàn tất quá trình backfill! Đã lưu tổng cộng ${totalBackfilled} nến trong ${elapsed}s.`
    );
  }

  /**
   * Kiểm tra và bù nến cho 1 symbol cụ thể
   * @param symbol Tên cặp coin (VD: BTCUSDT)
   */
  async backfillSymbol(symbol: string): Promise<number> {
    const now = Date.now();
    const interval = '1m';

    // 1. Tìm nến gần nhất đã có trong cơ sở dữ liệu
    const latestCandle = await prisma.candle.findFirst({
      where: { symbol, interval },
      orderBy: { openTime: 'desc' },
    });

    let fetchStartTime: number;
    let limit = this.defaultLimit;

    if (!latestCandle) {
      // Nếu chưa có nến nào trong DB -> Lấy 500 nến gần nhất (khoảng 8.3 giờ)
      fetchStartTime = now - limit * 60 * 1000;
      console.log(`📥 [Backfill] ${symbol}: Chưa có dữ liệu, đang tải ${limit} nến 1m gần nhất...`);
    } else {
      const latestOpenTime = Number(latestCandle.openTime);
      const gapMs = now - latestOpenTime;

      // Nếu khoảng trống nhỏ hơn 1.5 phút thì không cần bù
      if (gapMs < 90 * 1000) {
        return 0;
      }

      // Kéo từ thời điểm nến cuối cùng + 1 phút
      fetchStartTime = latestOpenTime + 60 * 1000;
      const missingMinutes = Math.min(Math.floor(gapMs / (60 * 1000)), 1000);
      limit = Math.max(missingMinutes, 1);
      console.log(
        `📥 [Backfill] ${symbol}: Phát hiện thiếu ${limit} nến từ ${new Date(fetchStartTime).toISOString()}...`
      );
    }

    // 2. Kéo nến từ Binance REST API
    const klines: Kline[] = await this.provider.getHistory(
      symbol,
      interval,
      fetchStartTime,
      now,
      limit
    );

    if (klines.length === 0) {
      return 0;
    }

    // 3. Lưu danh sách nến vào cơ sở dữ liệu Postgres (Lưu tuần tự hoặc batch upsert)
    let savedCount = 0;
    for (const kline of klines) {
      // Chỉ lưu những cây nến đã đóng hoặc nến trước thời điểm hiện tại 1 phút
      if (kline.openTime + 60 * 1000 <= now) {
        await prisma.candle.upsert({
          where: {
            symbol_interval_openTime: {
              symbol: kline.symbol,
              interval: kline.interval,
              openTime: BigInt(kline.openTime),
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
            symbol: kline.symbol,
            interval: kline.interval,
            openTime: BigInt(kline.openTime),
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
            volume: kline.volume,
          },
        });
        savedCount++;
      }
    }

    if (savedCount > 0) {
      console.log(`💾 [Backfill] ${symbol}: Đã bù thành công ${savedCount} nến vào Postgres.`);
    }

    return savedCount;
  }
}
