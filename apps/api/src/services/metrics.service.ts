import os from 'os';
import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';

export interface SystemMetrics {
  server: {
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    cpuCores: number;
    memory: {
      rssMb: number;
      heapTotalMb: number;
      heapUsedMb: number;
      externalMb: number;
      systemFreeMb: number;
      systemTotalMb: number;
      memoryUsagePercent: number;
    };
  };
  sseGateway: {
    activePriceConnections: number;
    activeNotificationConnections: number;
    totalConnectionsServed: number;
    totalTicksDelivered: number;
    averageTickAgeMs: number;
    p95TickAgeMs: number;
    lastTickReceivedAt: number | null;
  };
  redis: {
    status: string;
    pingMs: number;
    totalKeysInPricesHash?: number;
  };
  postgres: {
    status: string;
    totalCandles1m?: number;
    totalAlerts?: number;
    totalUsers?: number;
  };
}

/**
 * Lớp MetricsCollector thu thập và tính toán các chỉ số vận hành (Observability & Healthcheck)
 * cho toàn bộ hệ thống FlashCrypto API Gateway & Worker.
 */
export class MetricsCollector {
  private static instance: MetricsCollector;

  private activePriceConnections = 0;
  private activeNotificationConnections = 0;
  private totalConnectionsServed = 0;
  private totalTicksDelivered = 0;
  private recentTickAges: number[] = [];
  private lastTickReceivedAt: number | null = null;
  private maxHistorySamples = 200;

  private constructor() {}

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // Quản lý số kết nối SSE Price Stream
  onClientConnected(): void {
    this.activePriceConnections++;
    this.totalConnectionsServed++;
  }

  onClientDisconnected(): void {
    this.activePriceConnections = Math.max(0, this.activePriceConnections - 1);
  }

  // Quản lý số kết nối SSE Notification Stream
  onNotificationConnected(): void {
    this.activeNotificationConnections++;
  }

  onNotificationDisconnected(): void {
    this.activeNotificationConnections = Math.max(0, this.activeNotificationConnections - 1);
  }

  // Ghi nhận tick giá được chuyển tiếp
  recordTickDelivery(tickTimestamp: number, count = 1): void {
    this.totalTicksDelivered += count;
    this.lastTickReceivedAt = Date.now();

    const now = Date.now();
    const ageMs = Math.max(0, now - tickTimestamp);

    this.recentTickAges.push(ageMs);
    if (this.recentTickAges.length > this.maxHistorySamples) {
      this.recentTickAges.shift();
    }
  }

  /**
   * Tính toán độ trễ trung bình và p95 (95th percentile latency)
   */
  private calculateLatencyMetrics(): { averageTickAgeMs: number; p95TickAgeMs: number } {
    if (this.recentTickAges.length === 0) {
      return { averageTickAgeMs: 0, p95TickAgeMs: 0 };
    }

    const sum = this.recentTickAges.reduce((acc, val) => acc + val, 0);
    const avg = Math.round(sum / this.recentTickAges.length);

    const sorted = [...this.recentTickAges].sort((a, b) => a - b);
    const p95Index = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * 0.95)
    );
    const p95 = sorted[p95Index];

    return { averageTickAgeMs: avg, p95TickAgeMs: p95 };
  }

  /**
   * Tổng hợp toàn bộ số liệu hệ thống dưới dạng JSON
   */
  async getMetrics(redisClient: Redis): Promise<SystemMetrics> {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const { averageTickAgeMs, p95TickAgeMs } = this.calculateLatencyMetrics();

    // Kiểm tra Redis
    let redisStatus = redisClient.status;
    let redisPingMs = 0;
    let totalKeysInPricesHash = 0;
    try {
      const pingStart = Date.now();
      await redisClient.ping();
      redisPingMs = Date.now() - pingStart;
      totalKeysInPricesHash = await redisClient.hlen('prices');
    } catch {
      redisStatus = 'error';
    }

    // Kiểm tra Postgres
    let pgStatus = 'connected';
    let totalCandles1m = 0;
    let totalAlerts = 0;
    let totalUsers = 0;
    try {
      [totalCandles1m, totalAlerts, totalUsers] = await Promise.all([
        prisma.candle.count({ where: { interval: '1m' } }),
        prisma.alert.count(),
        prisma.user.count(),
      ]);
    } catch {
      pgStatus = 'error';
    }

    return {
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        cpuCores: os.cpus().length,
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          externalMb: Math.round(mem.external / 1024 / 1024),
          systemFreeMb: Math.round(freeMem / 1024 / 1024),
          systemTotalMb: Math.round(totalMem / 1024 / 1024),
          memoryUsagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        },
      },
      sseGateway: {
        activePriceConnections: this.activePriceConnections,
        activeNotificationConnections: this.activeNotificationConnections,
        totalConnectionsServed: this.totalConnectionsServed,
        totalTicksDelivered: this.totalTicksDelivered,
        averageTickAgeMs,
        p95TickAgeMs,
        lastTickReceivedAt: this.lastTickReceivedAt,
      },
      redis: {
        status: redisStatus,
        pingMs: redisPingMs,
        totalKeysInPricesHash,
      },
      postgres: {
        status: pgStatus,
        totalCandles1m,
        totalAlerts,
        totalUsers,
      },
    };
  }

  /**
   * Định dạng metrics theo chuẩn Prometheus Text Format
   */
  async getPrometheusFormat(redisClient: Redis): Promise<string> {
    const data = await this.getMetrics(redisClient);

    return [
      `# HELP flashcrypto_active_sse_connections Số kết nối SSE giá đang mở`,
      `# TYPE flashcrypto_active_sse_connections gauge`,
      `flashcrypto_active_sse_connections ${data.sseGateway.activePriceConnections}`,
      ``,
      `# HELP flashcrypto_active_notification_connections Số kết nối SSE thông báo đang mở`,
      `# TYPE flashcrypto_active_notification_connections gauge`,
      `flashcrypto_active_notification_connections ${data.sseGateway.activeNotificationConnections}`,
      ``,
      `# HELP flashcrypto_total_connections_served Tổng số lượt kết nối đã phục vụ`,
      `# TYPE flashcrypto_total_connections_served counter`,
      `flashcrypto_total_connections_served ${data.sseGateway.totalConnectionsServed}`,
      ``,
      `# HELP flashcrypto_total_ticks_delivered Tổng số tick giá đã gửi xuống client`,
      `# TYPE flashcrypto_total_ticks_delivered counter`,
      `flashcrypto_total_ticks_delivered ${data.sseGateway.totalTicksDelivered}`,
      ``,
      `# HELP flashcrypto_tick_latency_p95_ms Độ trễ p95 từ lúc sàn phát tick đến gateway`,
      `# TYPE flashcrypto_tick_latency_p95_ms gauge`,
      `flashcrypto_tick_latency_p95_ms ${data.sseGateway.p95TickAgeMs}`,
      ``,
      `# HELP flashcrypto_memory_heap_used_mb Bộ nhớ Heap đang dùng (MB)`,
      `# TYPE flashcrypto_memory_heap_used_mb gauge`,
      `flashcrypto_memory_heap_used_mb ${data.server.memory.heapUsedMb}`,
      ``,
      `# HELP flashcrypto_redis_ping_ms Độ trễ phản hồi Redis ping (ms)`,
      `# TYPE flashcrypto_redis_ping_ms gauge`,
      `flashcrypto_redis_ping_ms ${data.redis.pingMs}`,
    ].join('\n');
  }
}
