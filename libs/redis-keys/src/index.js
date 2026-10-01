"use strict";
/**
 * Module quản lý định dạng các Redis Key và Pub/Sub Channel dùng chung trong toàn bộ hệ thống FlashCrypto.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisKeys = void 0;
exports.RedisKeys = {
    /**
     * Hash lưu trữ giá mới nhất của tất cả các cặp coin: field là symbol, value là JSON { p, ts, chg24h }
     */
    PRICES_HASH: 'prices',
    /**
     * Channel Pub/Sub thông báo tick giá mới theo symbol
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     */
    tickChannel(symbol) {
        return `tick:${symbol.toUpperCase()}`;
    },
    /**
     * Channel Pub/Sub thông báo nến đang chạy theo khung thời gian
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     * @param interval Khung nến (VD: 1m, 5m, 1h)
     */
    klineChannel(symbol, interval = '1m') {
        return `kline:${symbol.toUpperCase()}:${interval}`;
    },
    /**
     * Sorted Set lưu các cảnh báo khi giá vượt lên trên ngưỡng (above)
     * Score: Ngưỡng giá (threshold)
     * Member: alertId
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     */
    alertAboveSet(symbol) {
        return `alerts:${symbol.toUpperCase()}:above`;
    },
    /**
     * Sorted Set lưu các cảnh báo khi giá rơi xuống dưới ngưỡng (below)
     * Score: Ngưỡng giá (threshold)
     * Member: alertId
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     */
    alertBelowSet(symbol) {
        return `alerts:${symbol.toUpperCase()}:below`;
    },
    /**
     * Khóa phân tán (Distributed Lock) phục vụ chế độ Ingest Active-Standby
     */
    INGEST_LEADER_LOCK: 'lock:ingest',
};
//# sourceMappingURL=index.js.map