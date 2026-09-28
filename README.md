# FlashCrypto ⚡

Real-time Crypto Price & Candlestick Dashboard với hệ thống Cảnh báo Giá (Price Alert Engine).

## 🚀 Tính năng chính
- **Bảng giá Real-time:** Cập nhật tức thì 20+ cặp coin qua Server-Sent Events (SSE) với độ trễ thấp (< 500ms p95).
- **Biểu đồ Nến mượt mà:** Sử dụng TradingView Lightweight Charts, hỗ trợ merge buffer giữa nến lịch sử và nến live.
- **Alert Engine $O(\log N)$:** Hệ thống cảnh báo giá hiệu năng cao sử dụng Redis Sorted Sets.
- **Thông báo đa kênh:** Web In-app notification & Telegram Bot.
- **Khả năng tự phục hồi (Resilience):** Tự động reconnect WebSocket sàn, backfill nến bị thiếu, hot-path không phụ thuộc Postgres.

## 🏗️ Kiến trúc hệ thống
Chi tiết kế hoạch và System Design xem tại [FlashCrypto_Plan.md](./FlashCrypto_Plan.md).
