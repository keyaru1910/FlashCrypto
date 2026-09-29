import { z } from 'zod';

/**
 * Schema cho dữ liệu Tick giá thị trường (miniTicker)
 * Sử dụng string cho các trường số liệu tài chính để tránh lỗi làm tròn số thực (float precision error).
 */
export const PriceTickSchema = z.object({
  symbol: z.string().min(1).transform((s) => s.toUpperCase()),
  price: z.string().regex(/^\d+(\.\d+)?$/, 'Giá phải là định dạng số hợp lệ'),
  timestamp: z.number().int().positive('Timestamp phải là số nguyên dương tính bằng mili-giây'),
  priceChangePercent24h: z.string().optional(),
  volume24h: z.string().optional(),
});

export type PriceTick = z.infer<typeof PriceTickSchema>;

/**
 * Schema cho dữ liệu Nến (Kline / Candlestick)
 */
export const KlineSchema = z.object({
  symbol: z.string().min(1).transform((s) => s.toUpperCase()),
  interval: z.string().default('1m'),
  openTime: z.number().int().positive(),
  closeTime: z.number().int().positive(),
  open: z.string().regex(/^\d+(\.\d+)?$/),
  high: z.string().regex(/^\d+(\.\d+)?$/),
  low: z.string().regex(/^\d+(\.\d+)?$/),
  close: z.string().regex(/^\d+(\.\d+)?$/),
  volume: z.string().regex(/^\d+(\.\d+)?$/),
  isClosed: z.boolean().describe('True nếu nến đã đóng khung thời gian'),
});

export type Kline = z.infer<typeof KlineSchema>;

/**
 * Hướng cảnh báo giá
 */
export enum AlertDirection {
  ABOVE = 'ABOVE', // Giá tăng vượt qua ngưỡng
  BELOW = 'BELOW', // Giá giảm xuống dưới ngưỡng
}

/**
 * Kênh gửi thông báo
 */
export enum AlertChannel {
  BROWSER = 'BROWSER', // Web in-app SSE notification
  TELEGRAM = 'TELEGRAM', // Telegram bot
}

/**
 * Trạng thái của Cảnh báo
 */
export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  TRIGGERED = 'TRIGGERED',
  CANCELLED = 'CANCELLED',
}
