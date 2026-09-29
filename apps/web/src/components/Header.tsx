'use client';

import React from 'react';
import { Zap, Activity, Wifi, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../hooks/useCryptoStream';

interface HeaderProps {
  status: ConnectionStatus;
  latencyMs: number;
  ticksPerSecond: number;
  activeCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  latencyMs,
  ticksPerSecond,
  activeCount,
}) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 32px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(10, 14, 23, 0.8)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Zap size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Flash<span style={{ color: 'var(--accent-cyan)' }}>Crypto</span>
            </h1>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              REAL-TIME SSE
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            High-throughput Streaming & Price Alert Engine
          </p>
        </div>
      </div>

      {/* Connection & Telemetry Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Ticks Rate */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem',
          }}
        >
          <Activity size={14} color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-secondary)' }}>Lưu lượng:</span>
          <span className="mono-num" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {ticksPerSecond} tick/s
          </span>
        </div>

        {/* Latency */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem',
          }}
        >
          <Wifi size={14} color="var(--accent-indigo)" />
          <span style={{ color: 'var(--text-secondary)' }}>Độ trễ:</span>
          <span
            className="mono-num"
            style={{
              fontWeight: 700,
              color: latencyMs < 500 ? 'var(--green-up)' : 'var(--red-down)',
            }}
          >
            {latencyMs > 0 ? `${latencyMs}ms` : '< 100ms'}
          </span>
        </div>

        {/* Connection Status Badge */}
        {status === 'LIVE' && (
          <div className="status-badge status-live">
            <span className="pulse-dot pulse-live"></span>
            <span>LIVE STREAM</span>
          </div>
        )}

        {status === 'STALE' && (
          <div className="status-badge status-stale">
            <span className="pulse-dot pulse-stale"></span>
            <span>DATA STALE</span>
          </div>
        )}

        {status === 'RECONNECTING' && (
          <div className="status-badge status-reconnecting">
            <RefreshCw size={12} className="pulse-reconnecting" />
            <span>CONNECTING...</span>
          </div>
        )}
      </div>
    </header>
  );
};
