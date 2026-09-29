import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_INSTRUMENTS = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', pricePrecision: 5 },
  { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'DOTUSDT', base: 'DOT', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'NEARUSDT', base: 'NEAR', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'SUIUSDT', base: 'SUI', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'APTUSDT', base: 'APT', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'OPUSDT', base: 'OP', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'ARBUSDT', base: 'ARB', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'LTCUSDT', base: 'LTC', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'TONUSDT', base: 'TON', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'PEPEUSDT', base: 'PEPE', quote: 'USDT', pricePrecision: 8 },
  { symbol: 'SHIBUSDT', base: 'SHIB', quote: 'USDT', pricePrecision: 8 },
  { symbol: 'RENDERUSDT', base: 'RENDER', quote: 'USDT', pricePrecision: 3 },
];

async function main() {
  console.log('Bắt đầu khởi tạo dữ liệu 20 cặp coin mẫu...');

  for (const item of DEFAULT_INSTRUMENTS) {
    await prisma.instrument.upsert({
      where: { symbol: item.symbol },
      update: {
        base: item.base,
        quote: item.quote,
        pricePrecision: item.pricePrecision,
        active: true,
      },
      create: {
        symbol: item.symbol,
        base: item.base,
        quote: item.quote,
        pricePrecision: item.pricePrecision,
        active: true,
      },
    });
  }

  console.log(`Đã khởi tạo thành công ${DEFAULT_INSTRUMENTS.length} cặp coin vào PostgreSQL.`);
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
