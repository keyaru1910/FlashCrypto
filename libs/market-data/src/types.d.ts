import { z } from 'zod';
/**
 * Schema cho dữ liệu Tick giá thị trường (miniTicker)
 * Sử dụng string cho các trường số liệu tài chính để tránh lỗi làm tròn số thực (float precision error).
 */
export declare const PriceTickSchema: z.ZodObject<{
    symbol: z.ZodEffects<z.ZodString, string, string>;
    price: z.ZodString;
    timestamp: z.ZodNumber;
    priceChangePercent24h: z.ZodOptional<z.ZodString>;
    volume24h: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    price: string;
    timestamp: number;
    priceChangePercent24h?: string | undefined;
    volume24h?: string | undefined;
}, {
    symbol: string;
    price: string;
    timestamp: number;
    priceChangePercent24h?: string | undefined;
    volume24h?: string | undefined;
}>;
export type PriceTick = z.infer<typeof PriceTickSchema>;
/**
 * Schema cho dữ liệu Nến (Kline / Candlestick)
 */
export declare const KlineSchema: z.ZodObject<{
    symbol: z.ZodEffects<z.ZodString, string, string>;
    interval: z.ZodDefault<z.ZodString>;
    openTime: z.ZodNumber;
    closeTime: z.ZodNumber;
    open: z.ZodString;
    high: z.ZodString;
    low: z.ZodString;
    close: z.ZodString;
    volume: z.ZodString;
    isClosed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    interval: string;
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    isClosed: boolean;
}, {
    symbol: string;
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    isClosed: boolean;
    interval?: string | undefined;
}>;
export type Kline = z.infer<typeof KlineSchema>;
/**
 * Hướng cảnh báo giá
 */
export declare enum AlertDirection {
    ABOVE = "ABOVE",// Giá tăng vượt qua ngưỡng
    BELOW = "BELOW"
}
/**
 * Kênh gửi thông báo
 */
export declare enum AlertChannel {
    BROWSER = "BROWSER",// Web in-app SSE notification
    TELEGRAM = "TELEGRAM"
}
/**
 * Trạng thái của Cảnh báo
 */
export declare enum AlertStatus {
    ACTIVE = "ACTIVE",
    TRIGGERED = "TRIGGERED",
    CANCELLED = "CANCELLED"
}
//# sourceMappingURL=types.d.ts.map