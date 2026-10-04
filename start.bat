@echo off
chcp 65001 > nul
echo ========================================================
echo  🚀 FlashCrypto - Khởi Động Toàn Bộ Hệ Thống (1-Click)
echo ========================================================
echo.

echo [1/4] Đang khởi động Database Postgres và Redis qua Docker...
docker compose up -d

echo [2/4] Đang đồng bộ Schema Database...
call npm run db:push

echo [3/4] Đang kiểm tra và giải phóng cổng 3000, 4000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000 "') do taskkill /f /pid %%a >nul 2>&1

echo [4/4] Đang khởi chạy 4 Micro-services (Ingest, Worker, API, Web)...
echo.
echo - Web Dashboard: http://localhost:3000
echo - API Gateway:   http://localhost:4000
echo.
call npm run dev
