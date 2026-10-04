'use client';

import React from 'react';
import { Zap, Activity, Wifi, RefreshCw, Bell, User, LogOut, LogIn } from 'lucide-react';
import { ConnectionStatus } from '../hooks/useCryptoStream';
import { UserProfile } from '../hooks/useAuth';

interface HeaderProps {
  status: ConnectionStatus;
  latencyMs: number;
  ticksPerSecond: number;
  activeCount: number;
  user: UserProfile | null;
  activeAlertsCount?: number;
  onOpenAuthModal: () => void;
  onOpenAlertsDrawer: () => void;
  onOpenSystemStatus?: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  latencyMs,
  ticksPerSecond,
  activeCount,
  user,
  activeAlertsCount = 0,
  onOpenAuthModal,
  onOpenAlertsDrawer,
  onOpenSystemStatus,
  onLogout,
}) => {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(10, 14, 23, 0.85)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 0 25px rgba(99, 102, 241, 0.4)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img
            src="/favicon.png"
            alt="FlashCrypto Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: 'scale(1.75)',
              filter: 'brightness(1.25) contrast(1.15) drop-shadow(0 0 8px rgba(6, 182, 212, 0.7))',
            }}
          />
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

      {/* Center: Telemetry Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

        {/* System Observability / Metrics Button */}
        {onOpenSystemStatus && (
          <button
            onClick={onOpenSystemStatus}
            title="Xem Metrics & Tình trạng hệ thống"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818cf8',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Zap size={14} />
            <span>Hệ Thống</span>
          </button>
        )}
      </div>

      {/* Right: User Profile & Alerts Drawer Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Bell button with active alerts count */}
            <button
              onClick={onOpenAlertsDrawer}
              title="Danh sách cảnh báo của tôi"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Bell size={18} />
              {activeAlertsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: 'var(--accent-indigo)',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(99, 102, 241, 0.6)',
                  }}
                >
                  {activeAlertsCount}
                </span>
              )}
            </button>

            {/* User chip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--accent-indigo)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#fff',
                }}
              >
                {user.email.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email.split('@')[0]}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              title="Đăng xuất"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                cursor: 'pointer',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuthModal}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'var(--accent-indigo)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
          >
            <LogIn size={16} />
            <span>Đăng Nhập</span>
          </button>
        )}
      </div>
    </header>
  );
};
