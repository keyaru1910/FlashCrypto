"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceProvider = void 0;
const ws_1 = __importDefault(require("ws"));
const types_js_1 = require("./types.js");
/**
 * Lớp BinanceProvider chịu trách nhiệm kết nối đến WebSocket và REST API của sàn Binance,
 * chuẩn hóa dữ liệu tick giá và nến (kline), tự động phục hồi kết nối (auto-reconnect)
 * khi gặp sự cố mạng.
 */
class BinanceProvider {
    name = 'Binance';
    wsUrl;
    restUrl;
    reconnectBaseDelayMs;
    maxReconnectDelayMs;
    pingIntervalMs;
    ws = null;
    subscribedSymbols = new Set();
    isExplicitlyClosed = false;
    reconnectAttempts = 0;
    reconnectTimer = null;
    pingTimer = null;
    // Danh sách callbacks
    tickCallbacks = new Set();
    klineCallbacks = new Set();
    statusCallbacks = new Set();
    constructor(options) {
        this.wsUrl = options?.wsBaseUrl || 'wss://stream.binance.com:9443';
        this.restUrl = options?.restBaseUrl || 'https://api.binance.com';
        this.reconnectBaseDelayMs = options?.reconnectBaseDelayMs || 1000;
        this.maxReconnectDelayMs = options?.maxReconnectDelayMs || 30000;
        this.pingIntervalMs = options?.pingIntervalMs || 30000;
    }
    /**
     * Khởi tạo kết nối WebSocket đến Binance Combined Stream
     */
    async connect() {
        this.isExplicitlyClosed = false;
        this.clearTimers();
        return new Promise((resolve) => {
            this.emitStatus('RECONNECTING');
            // Tạo URL combined stream nếu đã có symbol đăng ký từ trước
            const streams = this.buildStreamList();
            const connectionUrl = streams.length > 0
                ? `${this.wsUrl}/stream?streams=${streams.join('/')}`
                : `${this.wsUrl}/ws`;
            try {
                this.ws = new ws_1.default(connectionUrl);
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
                this.ws.on('message', (data) => {
                    this.handleIncomingMessage(data);
                });
                this.ws.on('ping', () => {
                    // Phản hồi pong khi Binance gửi ping
                    this.ws?.pong();
                });
                this.ws.on('error', (error) => {
                    this.emitStatus('ERROR', error);
                });
                this.ws.on('close', (code, reason) => {
                    this.clearHeartbeat();
                    if (!this.isExplicitlyClosed) {
                        this.emitStatus('DISCONNECTED');
                        this.scheduleReconnect();
                    }
                    resolve();
                });
            }
            catch (err) {
                this.emitStatus('ERROR', err instanceof Error ? err : new Error(String(err)));
                this.scheduleReconnect();
                resolve();
            }
        });
    }
    /**
     * Ngắt kết nối chủ động
     */
    async disconnect() {
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
    async subscribe(symbols) {
        const formattedSymbols = symbols.map((s) => s.toUpperCase());
        let hasNew = false;
        for (const sym of formattedSymbols) {
            if (!this.subscribedSymbols.has(sym)) {
                this.subscribedSymbols.add(sym);
                hasNew = true;
            }
        }
        if (hasNew && this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.sendSubscriptionPayload(formattedSymbols);
        }
    }
    /**
     * Hủy đăng ký danh sách các cặp coin
     */
    async unsubscribe(symbols) {
        const formattedSymbols = symbols.map((s) => s.toUpperCase());
        const streamsToUnsub = [];
        for (const sym of formattedSymbols) {
            this.subscribedSymbols.delete(sym);
            streamsToUnsub.push(`${sym.toLowerCase()}@miniTicker`);
            streamsToUnsub.push(`${sym.toLowerCase()}@kline_1m`);
        }
        if (this.ws && this.ws.readyState === ws_1.default.OPEN && streamsToUnsub.length > 0) {
            const payload = {
                method: 'UNSUBSCRIBE',
                params: streamsToUnsub,
                id: Date.now(),
            };
            this.ws.send(JSON.stringify(payload));
        }
    }
    onTick(callback) {
        this.tickCallbacks.add(callback);
    }
    onKline(callback) {
        this.klineCallbacks.add(callback);
    }
    onStatusChange(callback) {
        this.statusCallbacks.add(callback);
    }
    /**
     * Lấy lịch sử nến từ Binance REST API để lấp khoảng trống (backfill gap)
     */
    async getHistory(symbol, interval = '1m', startTime, endTime, limit = 500) {
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
        const rawKlines = (await response.json());
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
    buildStreamList() {
        const streams = [];
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
    sendSubscriptionPayload(symbols) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN)
            return;
        const streams = [];
        for (const sym of symbols) {
            const lower = sym.toLowerCase();
            streams.push(`${lower}@miniTicker`);
            streams.push(`${lower}@kline_1m`);
        }
        if (streams.length === 0)
            return;
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
    handleIncomingMessage(rawData) {
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
                const parsedTick = types_js_1.PriceTickSchema.safeParse({
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
            }
            else if (eventType === 'kline') {
                const k = payload.k;
                if (!k)
                    return;
                // Chuẩn hóa dữ liệu Nến
                const parsedKline = types_js_1.KlineSchema.safeParse({
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
        }
        catch (err) {
            // Bỏ qua gói tin không đúng định dạng JSON
        }
    }
    /**
     * Cơ chế tự động kết nối lại (Exponential backoff kèm jitter)
     */
    scheduleReconnect() {
        if (this.isExplicitlyClosed || this.reconnectTimer)
            return;
        this.reconnectAttempts++;
        // Tính toán độ trễ: min(baseDelay * 2^(attempts-1), maxDelay) + jitter ngẫu nhiên 0-1000ms
        const exponentialDelay = Math.min(this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelayMs);
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
    startHeartbeat() {
        this.clearHeartbeat();
        this.pingTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                this.ws.ping();
            }
        }, this.pingIntervalMs);
    }
    clearHeartbeat() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    clearTimers() {
        this.clearHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    emitStatus(status, error) {
        for (const cb of this.statusCallbacks) {
            cb(status, error);
        }
    }
}
exports.BinanceProvider = BinanceProvider;
//# sourceMappingURL=binance.provider.js.map