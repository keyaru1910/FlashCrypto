import WebSocket from 'ws';
import {
  MarketDataProvider,
  TickCallback,
  KlineCallback,
  StatusCallback,
} from './provider.interface.js';
import { PriceTick, Kline, PriceTickSchema, KlineSchema } from './types.js';

export interface BinanceProviderOptions {
  wsBaseUrl?: string; // Mặc định: wss://stream.binance.com:9443
  restBaseUrl?: string; // Mặc định: https://api.binance.com
  reconnectBaseDelayMs?: number; // Độ trễ cơ sở khi reconnect (mặc định 1000ms)
  maxReconnectDelayMs?: number; // Độ trễ tối đa (mặc định 30000ms)
  pingIntervalMs?: number; // Chu kỳ ping kiểm tra kết nối sống (mặc định 30000ms)
}

/**
 * Lớp BinanceProvider chịu trách nhiệm kết nối đến WebSocket và REST API của sàn Binance,
 * chuẩn hóa dữ liệu tick giá và nến (kline), tự động phục hồi kết nối (auto-reconnect)
 * khi gặp sự cố mạng.
 */
export class BinanceProvider implements MarketDataProvider {
  readonly name = 'Binance';

  private wsUrl: string;
  private restUrl: string;
  private reconnectBaseDelayMs: number;
  private maxReconnectDelayMs: number;
  private pingIntervalMs: number;

  private ws: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private isExplicitlyClosed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;

  // Danh sách callbacks
  private tickCallbacks: Set<TickCallback> = new Set();
  private klineCallbacks: Set<KlineCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();

  constructor(options?: BinanceProviderOptions) {
    this.wsUrl = options?.wsBaseUrl || 'wss://stream.binance.com:9443';
    this.restUrl = options?.restBaseUrl || 'https://api.binance.com';
    this.reconnectBaseDelayMs = options?.reconnectBaseDelayMs || 1000;
    this.maxReconnectDelayMs = options?.maxReconnectDelayMs || 30000;
    this.pingIntervalMs = options?.pingIntervalMs || 30000;
  }

  /**
   * Khởi tạo kết nối WebSocket đến Binance Combined Stream
   */
  async connect(): Promise<void> {
    this.isExplicitlyClosed = false;
    this.clearTimers();

    return new Promise((resolve) => {
      this.emitStatus('RECONNECTING');

      // Tạo URL combined stream nếu đã có symbol đăng ký từ trước
      const streams = this.buildStreamList();
      const connectionUrl =
        streams.length > 0
          ? `${this.wsUrl}/stream?streams=${streams.join('/')}`
          : `${this.wsUrl}/ws`;

      try {
        this.ws = new WebSocket(connectionUrl);

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emitStatus('CONNECTED');

          // Nếu có symbol, gửi lệnh subscribe để đảm bảo
          if (this.subscribedSymbols.size > 0 && streams.length === 0) {
            this.sendSubscriptionPayload(Array.from(this.subscribedSymbols));
          }

          resolve();
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          this.handleIncomingMessage(data);
        });

        this.ws.on('ping', () => {
          // Phản hồi pong khi Binance gửi ping
          this.ws?.pong();
        });

        this.ws.on('error', (error: Error) => {
          this.emitStatus('ERROR', error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.clearHeartbeat();
          if (!this.isExplicitlyClosed) {
            this.emitStatus('DISCONNECTED');
            this.scheduleReconnect();
          }
          resolve();
        });
      } catch (err) {
        this.emitStatus('ERROR', err instanceof Error ? err : new Error(String(err)));
        this.scheduleReconnect();
        resolve();
      }
    });
  }

  /**
   * Ngắt kết nối chủ động
   */
  async disconnect(): Promise<void> {
    this.isExplicitlyClosed = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.emitStatus('DISCONNECTED');
  }

  /**
   * Đăng ký thêm danh sách các cặp coin
   */
  async subscribe(symbols: string[]): Promise<void> {
    const formattedSymbols = symbols.map((s) => s.toUpperCase());
    let hasNew = false;

    for (const sym of formattedSymbols) {
      if (!this.subscribedSymbols.has(sym)) {
        this.subscribedSymbols.add(sym);
        hasNew = true;
      }
    }

    if (hasNew && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscriptionPayload(formattedSymbols);
    }
  }

  /**
   * Hủy đăng ký danh sách các cặp coin
   */
  async unsubscribe(symbols: string[]): Promise<void> {
    const formattedSymbols = symbols.map((s) => s.toUpperCase());
    const streamsToUnsub: string[] = [];

    for (const sym of formattedSymbols) {
      this.subscribedSymbols.delete(sym);
      streamsToUnsub.push(`${sym.toLowerCase()}@miniTicker`);
      streamsToUnsub.push(`${sym.toLowerCase()}@kline_1m`);
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && streamsToUnsub.length > 0) {
      const payload = {
        method: 'UNSUBSCRIBE',
        params: streamsToUnsub,
        id: Date.now(),
      };
      this.ws.send(JSON.stringify(payload));
    }
  }

  onTick(callback: TickCallback): void {
    this.tickCallbacks.add(callback);
  }

  onKline(callback: KlineCallback): void {
    this.klineCallbacks.add(callback);
  }

  onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.add(callback);
  }

  /**
   * Lấy lịch sử nến từ Binance REST API để lấp khoảng trống (backfill gap)
   */
  async getHistory(
    symbol: string,
    interval = '1m',
    startTime: number,
    endTime?: number,
    limit = 500
  ): Promise<Kline[]> {
    const url = new URL(`${this.restUrl}/api/v3/klines`);
    url.searchParams.set('symbol', symbol.toUpperCase());
    url.searchParams.set('interval', interval);
    url.searchParams.set('startTime', startTime.toString());
    if (endTime) {
      url.searchParams.set('endTime', endTime.toString());
    }
    url.searchParams.set('limit', limit.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Lỗi khi gọi Binance REST API klines: ${response.status} ${response.statusText}`);
    }

    const rawKlines = (await response.json()) as any[];

    return rawKlines.map((item) => ({
      symbol: symbol.toUpperCase(),
      interval,
      openTime: Number(item[0]),
      open: String(item[1]),
      high: String(item[2]),
      low: String(item[3]),
      close: String(item[4]),
      volume: String(item[5]),
      closeTime: Number(item[6]),
      isClosed: true,
    }));
  }

  /**
   * Tạo danh sách tên stream từ danh sách symbol đã đăng ký
   */
  private buildStreamList(): string[] {
    const streams: string[] = [];
    for (const sym of this.subscribedSymbols) {
      const lower = sym.toLowerCase();
      streams.push(`${lower}@miniTicker`);
      streams.push(`${lower}@kline_1m`);
    }
    return streams;
  }

  /**
   * Gửi gói tin subscribe qua WebSocket frame
   */
  private sendSubscriptionPayload(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const streams: string[] = [];
    for (const sym of symbols) {
      const lower = sym.toLowerCase();
      streams.push(`${lower}@miniTicker`);
      streams.push(`${lower}@kline_1m`);
    }

    if (streams.length === 0) return;

    const payload = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    };
    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Xử lý gói tin thô nhận từ Binance WebSocket
   */
  private handleIncomingMessage(rawData: WebSocket.RawData): void {
    try {
      const text = rawData.toString();
      const message = JSON.parse(text);

      // Nếu là response của SUBSCRIBE/UNSUBSCRIBE
      if (message.result === null && message.id) {
        return;
      }

      // Đối với Combined Stream: data nằm trong message.data
      const payload = message.data || message;
      const eventType = payload.e;

      if (eventType === '24hrMiniTicker') {
        // Chuẩn hóa dữ liệu Tick
        const parsedTick = PriceTickSchema.safeParse({
          symbol: payload.s,
          price: payload.c,
          timestamp: payload.E,
          volume24h: payload.v,
        });

        if (parsedTick.success) {
          for (const cb of this.tickCallbacks) {
            cb(parsedTick.data);
          }
        }
      } else if (eventType === 'kline') {
        const k = payload.k;
        if (!k) return;

        // Chuẩn hóa dữ liệu Nến
        const parsedKline = KlineSchema.safeParse({
          symbol: payload.s || k.s,
          interval: k.i,
          openTime: k.t,
          closeTime: k.T,
          open: k.o,
          high: k.h,
          low: k.l,
          close: k.c,
          volume: k.v,
          isClosed: Boolean(k.x),
        });

        if (parsedKline.success) {
          for (const cb of this.klineCallbacks) {
            cb(parsedKline.data);
          }
        }
      }
    } catch (err) {
      // Bỏ qua gói tin không đúng định dạng JSON
    }
  }

  /**
   * Cơ chế tự động kết nối lại (Exponential backoff kèm jitter)
   */
  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Tính toán độ trễ: min(baseDelay * 2^(attempts-1), maxDelay) + jitter ngẫu nhiên 0-1000ms
    const exponentialDelay = Math.min(
      this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelayMs
    );
    const jitter = Math.floor(Math.random() * 1000);
    const delay = exponentialDelay + jitter;

    this.emitStatus('RECONNECTING');

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  /**
   * Bắt đầu gửi ping định kỳ để giữ kết nối sống (Keep-alive heartbeat)
   */
  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.pingIntervalMs);
  }

  private clearHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emitStatus(
    status: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR',
    error?: Error
  ): void {
    for (const cb of this.statusCallbacks) {
      cb(status, error);
    }
  }
}
