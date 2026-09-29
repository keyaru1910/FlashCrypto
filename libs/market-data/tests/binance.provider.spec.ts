import { BinanceProvider } from '../src/binance.provider.js';

describe('BinanceProvider Unit Test', () => {
  let provider: BinanceProvider;

  beforeEach(() => {
    provider = new BinanceProvider();
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  it('nên khởi tạo provider với tên Binance', () => {
    expect(provider.name).toBe('Binance');
  });

  it('nên gọi callback khi nhận tick hợp lệ', (done) => {
    provider.onTick((tick) => {
      expect(tick.symbol).toBe('BTCUSDT');
      expect(tick.price).toBe('65000.25');
      done();
    });

    // Giả lập nhận message từ Binance WebSocket
    const mockMessage = {
      data: {
        e: '24hrMiniTicker',
        E: 1727500000000,
        s: 'BTCUSDT',
        c: '65000.25',
        o: '64000.00',
        h: '65500.00',
        l: '63800.00',
        v: '1250.5',
      },
    };

    (provider as any).handleIncomingMessage(Buffer.from(JSON.stringify(mockMessage)));
  });

  it('nên gọi callback khi nhận nến kline hợp lệ', (done) => {
    provider.onKline((kline) => {
      expect(kline.symbol).toBe('ETHUSDT');
      expect(kline.interval).toBe('1m');
      expect(kline.close).toBe('3500.00');
      expect(kline.isClosed).toBe(true);
      done();
    });

    const mockKlineMessage = {
      data: {
        e: 'kline',
        E: 1727500000000,
        s: 'ETHUSDT',
        k: {
          t: 1727500000000,
          T: 1727500059999,
          s: 'ETHUSDT',
          i: '1m',
          o: '3480.00',
          c: '3500.00',
          h: '3510.00',
          l: '3475.00',
          v: '200.00',
          x: true,
        },
      },
    };

    (provider as any).handleIncomingMessage(Buffer.from(JSON.stringify(mockKlineMessage)));
  });
});
