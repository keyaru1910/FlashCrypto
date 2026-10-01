import { MarketDataProvider, TickCallback, KlineCallback, StatusCallback } from './provider.interface.js';
import { Kline } from './types.js';
export interface BinanceProviderOptions {
    wsBaseUrl?: string;
    restBaseUrl?: string;
    reconnectBaseDelayMs?: number;
    maxReconnectDelayMs?: number;
    pingIntervalMs?: number;
}
/**
 * Lớp BinanceProvider chịu trách nhiệm kết nối đến WebSocket và REST API của sàn Binance,
 * chuẩn hóa dữ liệu tick giá và nến (kline), tự động phục hồi kết nối (auto-reconnect)
 * khi gặp sự cố mạng.
 */
export declare class BinanceProvider implements MarketDataProvider {
    readonly name = "Binance";
    private wsUrl;
    private restUrl;
    private reconnectBaseDelayMs;
    private maxReconnectDelayMs;
    private pingIntervalMs;
    private ws;
    private subscribedSymbols;
    private isExplicitlyClosed;
    private reconnectAttempts;
    private reconnectTimer;
    private pingTimer;
    private tickCallbacks;
    private klineCallbacks;
    private statusCallbacks;
    constructor(options?: BinanceProviderOptions);
    /**
     * Khởi tạo kết nối WebSocket đến Binance Combined Stream
     */
    connect(): Promise<void>;
    /**
     * Ngắt kết nối chủ động
     */
    disconnect(): Promise<void>;
    /**
     * Đăng ký thêm danh sách các cặp coin
     */
    subscribe(symbols: string[]): Promise<void>;
    /**
     * Hủy đăng ký danh sách các cặp coin
     */
    unsubscribe(symbols: string[]): Promise<void>;
    onTick(callback: TickCallback): void;
    onKline(callback: KlineCallback): void;
    onStatusChange(callback: StatusCallback): void;
    /**
     * Lấy lịch sử nến từ Binance REST API để lấp khoảng trống (backfill gap)
     */
    getHistory(symbol: string, interval: string | undefined, startTime: number, endTime?: number, limit?: number): Promise<Kline[]>;
    /**
     * Tạo danh sách tên stream từ danh sách symbol đã đăng ký
     */
    private buildStreamList;
    /**
     * Gửi gói tin subscribe qua WebSocket frame
     */
    private sendSubscriptionPayload;
    /**
     * Xử lý gói tin thô nhận từ Binance WebSocket
     */
    private handleIncomingMessage;
    /**
     * Cơ chế tự động kết nối lại (Exponential backoff kèm jitter)
     */
    private scheduleReconnect;
    /**
     * Bắt đầu gửi ping định kỳ để giữ kết nối sống (Keep-alive heartbeat)
     */
    private startHeartbeat;
    private clearHeartbeat;
    private clearTimers;
    private emitStatus;
}
//# sourceMappingURL=binance.provider.d.ts.map