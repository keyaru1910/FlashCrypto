import { Response } from 'express';
import { PriceTick } from '@flashcrypto/market-data';
import { MetricsCollector } from './metrics.service.js';

/**
 * Lớp ClientSession quản lý một kết nối SSE của client, thực hiện cơ chế Conflation Buffer:
 * gom các tick giá trong cửa sổ thời gian (250ms) và chỉ gửi tick mới nhất của mỗi symbol
 * nhằm tối ưu băng thông và giảm tải CPU cho trình duyệt.
 */
export class ClientSession {
  readonly id: string;
  private res: Response;
  private subscribedSymbols: Set<string>;
  private pendingTicks: Map<string, PriceTick> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushIntervalMs: number;
  private isClosed = false;

  constructor(id: string, res: Response, symbols: string[], flushIntervalMs = 250) {
    this.id = id;
    this.res = res;
    this.subscribedSymbols = new Set(symbols.map((s) => s.toUpperCase()));
    this.flushIntervalMs = flushIntervalMs;

    this.startConflationTimer();
  }

  /**
   * Gửi snapshot giá tức thời ngay khi client vừa mở kết nối SSE
   */
  sendSnapshot(ticks: PriceTick[]): void {
    if (this.isClosed) return;
    this.writeSseEvent('snapshot', ticks);
  }

  /**
   * Nhận tick giá mới và đưa vào bộ nhớ đệm conflation
   */
  pushTick(tick: PriceTick): void {
    if (this.isClosed) return;
    const symbol = tick.symbol.toUpperCase();
    if (this.subscribedSymbols.has(symbol)) {
      // Chỉ lưu tick mới nhất cho mỗi symbol trong cửa sổ hiện tại (Conflation)
      this.pendingTicks.set(symbol, tick);
    }
  }

  /**
   * Gửi gói tin ping định kỳ để giữ kết nối SSE không bị ngắt qua Proxy
   */
  sendPing(): void {
    if (this.isClosed) return;
    try {
      this.res.write(': ping\n\n');
    } catch {
      this.close();
    }
  }

  /**
   * Đóng session và dọn dẹp bộ nhớ
   */
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.pendingTicks.clear();
  }

  /**
   * Khởi chạy timer định kỳ flush buffer gửi xuống client
   */
  private startConflationTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.isClosed) return;

      if (this.pendingTicks.size > 0) {
        const batch = Array.from(this.pendingTicks.values());
        this.pendingTicks.clear();
        this.writeSseEvent('delta', batch);

        // Ghi nhận chỉ số độ trễ tick vào MetricsCollector
        if (batch.length > 0) {
          const latestTick = batch[batch.length - 1];
          MetricsCollector.getInstance().recordTickDelivery(latestTick.timestamp, batch.length);
        }
      }
    }, this.flushIntervalMs);
  }

  /**
   * Ghi gói tin SSE chuẩn định dạng Server-Sent Events
   */
  private writeSseEvent(event: string, data: any): void {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      this.res.write(payload);
    } catch {
      this.close();
    }
  }
}
