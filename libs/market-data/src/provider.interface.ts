import { PriceTick, Kline } from './types.js';

export type TickCallback = (tick: PriceTick) => void;
export type KlineCallback = (kline: Kline) => void;
export type StatusCallback = (status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR', error?: Error) => void;

/**
 * Interface chuẩn cho các nhà cung cấp dữ liệu thị trường (Binance, OKX, Coinbase, MockProvider,...)
 */
export interface MarketDataProvider {
  /**
   * Tên định danh của sàn / nhà cung cấp dữ liệu
   */
  readonly name: string;

  /**
   * Khởi tạo và kết nối WebSocket
   */
  connect(): Promise<void>;

  /**
   * Ngắt kết nối an toàn
   */
  disconnect(): Promise<void>;

  /**
   * Đăng ký danh sách các cặp coin cần nhận dữ liệu
   * @param symbols Danh sách symbol (VD: ['BTCUSDT', 'ETHUSDT'])
   */
  subscribe(symbols: string[]): Promise<void>;

  /**
   * Hủy đăng ký các cặp coin
   * @param symbols Danh sách symbol
   */
  unsubscribe(symbols: string[]): Promise<void>;

  /**
   * Lắng nghe sự kiện tick giá
   */
  onTick(callback: TickCallback): void;

  /**
   * Lắng nghe sự kiện nến (kline)
   */
  onKline(callback: KlineCallback): void;

  /**
   * Lắng nghe trạng thái kết nối mạng
   */
  onStatusChange(callback: StatusCallback): void;

  /**
   * Lấy lịch sử nến qua REST API để backfill nến bị thiếu khi reconnect
   */
  getHistory(symbol: string, interval: string, startTime: number, endTime?: number, limit?: number): Promise<Kline[]>;
}
