import { prisma } from '@flashcrypto/db';
import { BinanceProvider, Kline } from '@flashcrypto/market-data';

/**
 * Script CLI Backfill Lịch Sử Nến từ năm 2017 đến nay
 * Cách dùng:
 *   npx tsx scripts/backfill-history.ts --symbol=BTCUSDT --interval=1d
 *   npx tsx scripts/backfill-history.ts --all --interval=1d
 */
async function runBackfill() {
  const args = process.argv.slice(2);
  const symbolArg = args.find((a) => a.startsWith('--symbol='))?.split('=')[1]?.toUpperCase();
  const intervalArg = args.find((a) => a.startsWith('--interval='))?.split('=')[1] || '1d';
  const isAll = args.includes('--all');

  const binanceProvider = new BinanceProvider();

  // Danh sách các cặp tiền cần backfill
  let targetSymbols: string[] = [];
  if (isAll) {
    const instruments = await prisma.instrument.findMany({ where: { active: true } });
    targetSymbols = instruments.map((i) => i.symbol);
  } else if (symbolArg) {
    targetSymbols = [symbolArg];
  } else {
    targetSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
  }

  console.log(`🚀 [Backfill] Bắt đầu tải lịch sử nến từ năm 2017...`);
  console.log(`📌 Danh sách coin: ${targetSymbols.join(', ')} | Khung nến: ${intervalArg}`);

  const startTime = 1500000000000; // Tháng 07/2017 (thời điểm Binance bắt đầu hoạt động)
  const endTime = Date.now();

  for (const sym of targetSymbols) {
    console.log(`\n⏳ [${sym}] Đang tải dữ liệu lịch sử từ Binance API...`);
    try {
      // Đảm bảo Instrument tồn tại trong DB
      await prisma.instrument.upsert({
        where: { symbol: sym },
        update: {},
        create: {
          symbol: sym,
          base: sym.replace('USDT', ''),
          quote: 'USDT',
          pricePrecision: 2,
          active: true,
        },
      });

      // Lấy toàn bộ nến (tối đa 10.000 nến cho 10 năm)
      const klines: Kline[] = await binanceProvider.getHistory(
        sym,
        intervalArg,
        startTime,
        endTime,
        10000
      );

      console.log(`📥 [${sym}] Đã nhận ${klines.length} cây nến từ Binance. Đang lưu vào cơ sở dữ liệu...`);

      if (klines.length > 0) {
        // Chia batch 500 nến để lưu vào DB an toàn
        const batchSize = 500;
        let savedCount = 0;

        for (let i = 0; i < klines.length; i += batchSize) {
          const chunk = klines.slice(i, i + batchSize);
          await prisma.candle.createMany({
            data: chunk.map((k) => ({
              symbol: sym,
              interval: intervalArg,
              openTime: BigInt(k.openTime),
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
              volume: k.volume,
            })),
            skipDuplicates: true,
          });
          savedCount += chunk.length;
        }

        console.log(`✅ [${sym}] Đã lưu thành công ${savedCount} cây nến [${intervalArg}] từ 2017 vào Database!`);
      }
    } catch (err: any) {
      console.error(`❌ [${sym}] Lỗi trong quá trình backfill:`, err.message);
    }
  }

  console.log('\n🎉 [Backfill] Hoàn tất quá trình tải và nạp dữ liệu lịch sử!');
  process.exit(0);
}

runBackfill().catch((err) => {
  console.error('Lỗi nghiêm trọng:', err);
  process.exit(1);
});
