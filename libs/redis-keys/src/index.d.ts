/**
 * Module quản lý định dạng các Redis Key và Pub/Sub Channel dùng chung trong toàn bộ hệ thống FlashCrypto.
 */
export declare const RedisKeys: {
    /**
     * Hash lưu trữ giá mới nhất của tất cả các cặp coin: field là symbol, value là JSON { p, ts, chg24h }
     */
    readonly PRICES_HASH: "prices";
    /**
     * Channel Pub/Sub thông báo tick giá mới theo symbol
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     */
    readonly tickChannel: (symbol: string) => string;
    /**
     * Channel Pub/Sub thông báo nến đang chạy theo khung thời gian
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     * @param interval Khung nến (VD: 1m, 5m, 1h)
     */
    readonly klineChannel: (symbol: string, interval?: string) => string;
    /**
     * Sorted Set lưu các cảnh báo khi giá vượt lên trên ngưỡng (above)
     * Score: Ngưỡng giá (threshold)
     * Member: alertId
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     */
    readonly alertAboveSet: (symbol: string) => string;
    /**
     * Sorted Set lưu các cảnh báo khi giá rơi xuống dưới ngưỡng (below)
     * Score: Ngưỡng giá (threshold)
     * Member: alertId
     * @param symbol Tên cặp coin (VD: BTCUSDT)
     */
    readonly alertBelowSet: (symbol: string) => string;
    /**
     * Khóa phân tán (Distributed Lock) phục vụ chế độ Ingest Active-Standby
     */
    readonly INGEST_LEADER_LOCK: "lock:ingest";
};
//# sourceMappingURL=index.d.ts.map