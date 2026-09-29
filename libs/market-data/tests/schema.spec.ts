import { PriceTickSchema, KlineSchema } from '../src/types.js';

describe('Market Data Zod Schemas Test', () => {
  it('nên parse đúng format PriceTick hợp lệ', () => {
    const rawData = {
      symbol: 'btcusdt',
      price: '64500.50',
      timestamp: 1727500000000,
      priceChangePercent24h: '3.45',
      volume24h: '12450.2',
    };

    const parsed = PriceTickSchema.parse(rawData);
    expect(parsed.symbol).toBe('BTCUSDT'); // Tự động uppercase
    expect(parsed.price).toBe('64500.50');
    expect(parsed.timestamp).toBe(1727500000000);
  });

  it('phải reject PriceTick khi price không phải định dạng số hợp lệ', () => {
    const invalidData = {
      symbol: 'BTCUSDT',
      price: 'invalid_price',
      timestamp: 1727500000000,
    };

    expect(() => PriceTickSchema.parse(invalidData)).toThrow();
  });

  it('nên parse đúng format Kline (Nến 1m) hợp lệ', () => {
    const rawKline = {
      symbol: 'ETHUSDT',
      interval: '1m',
      openTime: 1727500000000,
      closeTime: 1727500059999,
      open: '3450.00',
      high: '3460.00',
      low: '3448.50',
      close: '3455.20',
      volume: '150.75',
      isClosed: true,
    };

    const parsed = KlineSchema.parse(rawKline);
    expect(parsed.symbol).toBe('ETHUSDT');
    expect(parsed.isClosed).toBe(true);
    expect(parsed.open).toBe('3450.00');
  });
});
