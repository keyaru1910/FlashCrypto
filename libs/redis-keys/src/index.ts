/**
 * Module quản lý định dạng các Redis Key và Pub/Sub Channel dùng chung trong toàn bộ hệ thống FlashCrypto.
 */

export const RedisKeys = {
  /**
   * Hash lưu trữ giá mới nhất của tất cả các cặp coin: field là symbol, value là JSON { p, ts, chg24h }
   */
  PRICES_HASH: 'prices',

  /**
   * Channel Pub/Sub thông báo tick giá mới theo symbol
   * @param symbol Tên cặp coin (VD: BTCUSDT)
   */
  tickChannel(symbol: string): string {
    return `tick:${symbol.toUpperCase()}`;
  },

  /**
   * Channel Pub/Sub thông báo nến đang chạy theo khung thời gian
   * @param symbol Tên cặp coin (VD: BTCUSDT)
   * @param interval Khung nến (VD: 1m, 5m, 1h)
   */
  klineChannel(symbol: string, interval = '1m'): string {
    return `kline:${symbol.toUpperCase()}:${interval}`;
  },

  /**
   * Sorted Set lưu các cảnh báo khi giá vượt lên trên ngưỡng (above)
   * Score: Ngưỡng giá (threshold)
   * Member: alertId
   * @param symbol Tên cặp coin (VD: BTCUSDT)
   */
  alertAboveSet(symbol: string): string {
    return `alerts:${symbol.toUpperCase()}:above`;
  },

  /**
   * Sorted Set lưu các cảnh báo khi giá rơi xuống dưới ngưỡng (below)
   * Score: Ngưỡng giá (threshold)
   * Member: alertId
   * @param symbol Tên cặp coin (VD: BTCUSDT)
   */
  alertBelowSet(symbol: string): string {
    return `alerts:${symbol.toUpperCase()}:below`;
  },

  /**
   * Khóa phân tán (Distributed Lock) phục vụ chế độ Ingest Active-Standby
   */
  INGEST_LEADER_LOCK: 'lock:ingest',
} as const;
