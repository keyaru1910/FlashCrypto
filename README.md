# FlashCrypto ⚡

Real-time Crypto Price & Candlestick Dashboard với hệ thống Cảnh báo Giá (Price Alert Engine).

## 🚀 Tính năng chính
- **Bảng giá Real-time (Phase 1 & 2):** Cập nhật tức thì 20+ cặp coin qua Server-Sent Events (SSE) với độ trễ thấp (< 500ms p95), cơ chế Conflation & Reference Counting subscription.
- **Biểu đồ Nến mượt mà (Phase 3):** Tích hợp TradingView Lightweight Charts, hỗ trợ đa khung thời gian (`1m`, `5m`, `15m`, `1h`, `1d`), volume histogram, tooltip OHLCV và cơ chế **Buffer & Merge** chống trùng lặp nến khi tải lịch sử.
- **Worker & Backfill Tự Phục Hồi:** Tự động phát hiện và kéo bù nến bị thiếu từ Binance REST API khi khởi động hoặc sau khi reconnect, lưu nến đóng vào Postgres.
- **Price Alert Engine $O(\log N)$ (Phase 4):** Hệ thống cảnh báo giá hiệu năng cao sử dụng Redis Sorted Sets (`alerts:{symbol}:above`, `alerts:{symbol}:below`), thuật toán sở hữu nguyên tử `ZREM` chống race condition và bắn trùng lặp khi chạy cụm đa worker.
- **Thông báo đa kênh Real-time:** Đẩy thông báo tức thời qua Web In-app SSE (`/api/v1/me/stream`) và Telegram Bot.
- **Tài khoản & Xác thực:** JWT Authentication, hỗ trợ Đăng nhập, Đăng ký và chế độ 1-Click Demo trải nghiệm nhanh.

## 🏗️ Kiến trúc hệ thống
Chi tiết kế hoạch và System Design xem tại [FlashCrypto_Plan.md](./FlashCrypto_Plan.md).

## 🛠️ Hướng dẫn khởi chạy hệ thống

### 1. Khởi động Cơ sở hạ tầng (Postgres & Redis)
```bash
docker compose up -d
npm run db:push
npm run db:seed
```

### 2. Chạy các tiến trình (Micro-services trong Monorepo)
Mở từng terminal riêng biệt để chạy các process:

- **Ingest Service:** Kết nối Binance WebSocket, chuẩn hóa tick & kline đẩy vào Redis:
  ```bash
  npm run ingest:dev
  ```

- **Worker Service:** Quét bù nến (Backfill), Lưu nến đóng (Candle Aggregator) & Chạy Price Alert Engine:
  ```bash
  npm run worker:dev
  ```

- **API Gateway:** Cung cấp REST endpoints (`/api/v1/instruments`, `/api/v1/candles`, `/api/v1/auth/*`, `/api/v1/alerts`) & SSE Streams (`/api/v1/stream`, `/api/v1/stream/candles`, `/api/v1/me/stream`):
  ```bash
  npm run api:dev
  ```

- **Web Frontend (Next.js Dashboard):**
  ```bash
  npm run web:dev
  ```
  Truy cập ứng dụng tại: `http://localhost:3000`
