'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Activity,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Radio,
  Layers,
} from 'lucide-react';

interface MetricsData {
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

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBaseUrl?: string;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({
  isOpen,
  onClose,
  apiBaseUrl = 'http://localhost:4000',
}) => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiBaseUrl}/api/v1/metrics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setMetrics(json.data);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối tới máy chủ Metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchMetrics();

    if (!autoRefresh) return;
    const timer = setInterval(fetchMetrics, 3000);
    return () => clearInterval(timer);
  }, [isOpen, autoRefresh]);

  if (!isOpen) return null;

  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins}m ${s}s`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '750px',
          background: '#0d131f',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(6, 182, 212, 0.3)',
              }}
            >
              <Activity size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                Giám Sát Hệ Thống (System Observability)
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Metrics thời gian thực đo lường hiệu năng Ingest, API Gateway & Storage
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: autoRefresh ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: autoRefresh ? '1px solid var(--accent-indigo)' : '1px solid var(--border-color)',
                color: autoRefresh ? '#818cf8' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} className={loading && autoRefresh ? 'pulse-reconnecting' : ''} />
              <span>{autoRefresh ? 'Tự làm mới: Bật' : 'Tự làm mới: Tắt'}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {metrics && (
            <>
              {/* Row 1: KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                {/* Latency p95 */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    padding: '14px',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Độ trễ p95 Latency
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: metrics.sseGateway.p95TickAgeMs <= 500 ? 'var(--green-up)' : 'var(--red-down)' }}>
                    {metrics.sseGateway.p95TickAgeMs} ms
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Mục tiêu: &lt; 500ms
                  </div>
                </div>

                {/* Active SSE Connections */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    padding: '14px',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Kết nối SSE Live
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    {metrics.sseGateway.activePriceConnections}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Khách mở tab trực tiếp
                  </div>
                </div>

                {/* Ticks Delivered */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    padding: '14px',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Tổng Ticks Đã Phát
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a78bfa' }}>
                    {metrics.sseGateway.totalTicksDelivered.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Gói tin realtime
                  </div>
                </div>

                {/* Server Uptime */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    padding: '14px',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Thời Gian Chạy
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatUptime(metrics.server.uptimeSeconds)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Node.js {metrics.server.nodeVersion}
                  </div>
                </div>
              </div>

              {/* Row 2: Infrastructure & Storage Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Redis Box */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Radio size={16} color="#ef4444" />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Redis (In-Memory Hot Path)</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: metrics.redis.status === 'ready' ? 'var(--green-up)' : '#f87171',
                        background: 'rgba(34, 197, 94, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {metrics.redis.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Redis Ping Latency:</span>
                      <span style={{ fontWeight: 600 }}>{metrics.redis.pingMs} ms</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cached Symbols (prices hash):</span>
                      <span style={{ fontWeight: 600 }}>{metrics.redis.totalKeysInPricesHash ?? 0} symbols</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cơ chế Fan-out:</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Reference Counting</span>
                    </div>
                  </div>
                </div>

                {/* Postgres Box */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Database size={16} color="#3b82f6" />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>PostgreSQL (Cold Storage)</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: metrics.postgres.status === 'connected' ? 'var(--green-up)' : '#f87171',
                        background: 'rgba(34, 197, 94, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {metrics.postgres.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Lưu trữ nến (1m Candles):</span>
                      <span style={{ fontWeight: 600 }}>{metrics.postgres.totalCandles1m?.toLocaleString() ?? 0} nến</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tổng cảnh báo (Alerts):</span>
                      <span style={{ fontWeight: 600 }}>{metrics.postgres.totalAlerts ?? 0} quy tắc</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tổng người dùng (Users):</span>
                      <span style={{ fontWeight: 600 }}>{metrics.postgres.totalUsers ?? 0} tài khoản</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Resource Consumption */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Cpu size={16} color="var(--accent-indigo)" />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Tiêu Thụ Tài Nguyên Phần Cứng</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Node Heap Used:</span>
                    <span style={{ fontWeight: 600 }}>{metrics.server.memory.heapUsedMb} MB / {metrics.server.memory.heapTotalMb} MB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Process RSS:</span>
                    <span style={{ fontWeight: 600 }}>{metrics.server.memory.rssMb} MB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>CPU Cores:</span>
                    <span style={{ fontWeight: 600 }}>{metrics.server.cpuCores} Cores ({metrics.server.platform})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>System RAM:</span>
                    <span style={{ fontWeight: 600 }}>{metrics.server.memory.memoryUsagePercent}% đã dùng ({metrics.server.memory.systemFreeMb} MB rảnh)</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>Prometheus Exporter: <code style={{ color: 'var(--accent-cyan)' }}>/metrics?format=prometheus</code></span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              background: 'var(--accent-indigo)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
