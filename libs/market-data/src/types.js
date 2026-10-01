"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertStatus = exports.AlertChannel = exports.AlertDirection = exports.KlineSchema = exports.PriceTickSchema = void 0;
const zod_1 = require("zod");
/**
 * Schema cho dữ liệu Tick giá thị trường (miniTicker)
 * Sử dụng string cho các trường số liệu tài chính để tránh lỗi làm tròn số thực (float precision error).
 */
exports.PriceTickSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).transform((s) => s.toUpperCase()),
    price: zod_1.z.string().regex(/^\d+(\.\d+)?$/, 'Giá phải là định dạng số hợp lệ'),
    timestamp: zod_1.z.number().int().positive('Timestamp phải là số nguyên dương tính bằng mili-giây'),
    priceChangePercent24h: zod_1.z.string().optional(),
    volume24h: zod_1.z.string().optional(),
});
/**
 * Schema cho dữ liệu Nến (Kline / Candlestick)
 */
exports.KlineSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).transform((s) => s.toUpperCase()),
    interval: zod_1.z.string().default('1m'),
    openTime: zod_1.z.number().int().positive(),
    closeTime: zod_1.z.number().int().positive(),
    open: zod_1.z.string().regex(/^\d+(\.\d+)?$/),
    high: zod_1.z.string().regex(/^\d+(\.\d+)?$/),
    low: zod_1.z.string().regex(/^\d+(\.\d+)?$/),
    close: zod_1.z.string().regex(/^\d+(\.\d+)?$/),
    volume: zod_1.z.string().regex(/^\d+(\.\d+)?$/),
    isClosed: zod_1.z.boolean().describe('True nếu nến đã đóng khung thời gian'),
});
/**
 * Hướng cảnh báo giá
 */
var AlertDirection;
(function (AlertDirection) {
    AlertDirection["ABOVE"] = "ABOVE";
    AlertDirection["BELOW"] = "BELOW";
})(AlertDirection || (exports.AlertDirection = AlertDirection = {}));
/**
 * Kênh gửi thông báo
 */
var AlertChannel;
(function (AlertChannel) {
    AlertChannel["BROWSER"] = "BROWSER";
    AlertChannel["TELEGRAM"] = "TELEGRAM";
})(AlertChannel || (exports.AlertChannel = AlertChannel = {}));
/**
 * Trạng thái của Cảnh báo
 */
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["ACTIVE"] = "ACTIVE";
    AlertStatus["TRIGGERED"] = "TRIGGERED";
    AlertStatus["CANCELLED"] = "CANCELLED";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
//# sourceMappingURL=types.js.map