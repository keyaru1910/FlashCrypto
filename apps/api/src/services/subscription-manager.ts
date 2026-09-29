import { Redis } from 'ioredis';
import { RedisKeys } from '@flashcrypto/redis-keys';
import { PriceTick } from '@flashcrypto/market-data';

export type ClientTickListener = (tick: PriceTick) => void;

/**
 * Lớp SubscriptionManager quản lý việc đăng ký kênh Redis Pub/Sub bằng cơ chế đếm tham chiếu (Reference Counting).
 * Chỉ subscribe Redis channel khi có ít nhất 1 client cần dữ liệu của symbol đó, và tự động hủy đăng ký khi không còn client nào.
 */
export class SubscriptionManager {
  private redisSub: Redis;
  // Lưu số lượng client đang theo dõi từng symbol: Map<Symbol, Set<ClientListener>>
  private symbolListeners: Map<string, Set<ClientTickListener>> = new Map();

  constructor(redisUrl: string) {
    this.redisSub = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.redisSub.on('message', (channel: string, message: string) => {
      this.handleRedisMessage(channel, message);
    });

    this.redisSub.on('connect', () => {
      console.log('📡 [SubscriptionManager] Redis Subscriber đã kết nối.');
    });

    this.redisSub.on('error', (err) => {
      console.error('❌ [SubscriptionManager] Lỗi Redis Subscriber:', err.message);
    });
  }

  /**
   * Đăng ký lắng nghe tick giá cho danh sách symbols
   * @param symbols Danh sách symbol cần theo dõi (VD: ['BTCUSDT', 'ETHUSDT'])
   * @param listener Hàm callback nhận tick giá của từng client
   */
  async subscribe(symbols: string[], listener: ClientTickListener): Promise<void> {
    const channelsToSubscribe: string[] = [];

    for (const rawSymbol of symbols) {
      const symbol = rawSymbol.toUpperCase();
      let listeners = this.symbolListeners.get(symbol);

      if (!listeners) {
        listeners = new Set();
        this.symbolListeners.set(symbol, listeners);
        // Lần đầu tiên có client theo dõi symbol này -> Subscribe Redis channel
        channelsToSubscribe.push(RedisKeys.tickChannel(symbol));
      }

      listeners.add(listener);
    }

    if (channelsToSubscribe.length > 0) {
      await this.redisSub.subscribe(...channelsToSubscribe);
    }
  }

  /**
   * Hủy đăng ký lắng nghe của client
   * @param symbols Danh sách symbol cần hủy
   * @param listener Callback của client cần gỡ bỏ
   */
  async unsubscribe(symbols: string[], listener: ClientTickListener): Promise<void> {
    const channelsToUnsubscribe: string[] = [];

    for (const rawSymbol of symbols) {
      const symbol = rawSymbol.toUpperCase();
      const listeners = this.symbolListeners.get(symbol);

      if (listeners) {
        listeners.delete(listener);

        // Nếu không còn client nào theo dõi symbol này -> Unsubscribe Redis channel
        if (listeners.size === 0) {
          this.symbolListeners.delete(symbol);
          channelsToUnsubscribe.push(RedisKeys.tickChannel(symbol));
        }
      }
    }

    if (channelsToUnsubscribe.length > 0) {
      await this.redisSub.unsubscribe(...channelsToUnsubscribe);
    }
  }

  /**
   * Đếm tổng số symbol đang được subscribe trên Redis
   */
  getActiveSubscriptionsCount(): number {
    return this.symbolListeners.size;
  }

  /**
   * Đóng kết nối Redis an toàn
   */
  async close(): Promise<void> {
    await this.redisSub.quit();
  }

  /**
   * Xử lý khi nhận message từ Redis channel
   */
  private handleRedisMessage(channel: string, message: string): void {
    try {
      const tick: PriceTick = JSON.parse(message);
      const symbol = tick.symbol.toUpperCase();
      const listeners = this.symbolListeners.get(symbol);

      if (listeners && listeners.size > 0) {
        for (const listener of listeners) {
          listener(tick);
        }
      }
    } catch (err) {
      // Bỏ qua gói tin không đúng định dạng
    }
  }
}
