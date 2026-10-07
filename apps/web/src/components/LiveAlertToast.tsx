'use client';

import React from 'react';
import { TriggeredAlertNotification } from '../hooks/useUserNotifications';
import { BellRing, X, TrendingUp, TrendingDown } from 'lucide-react';
import { CoinIcon } from './CoinIcon';

interface LiveAlertToastProps {
  notification: TriggeredAlertNotification | null;
  onClose: () => void;
}

export function LiveAlertToast({ notification, onClose }: LiveAlertToastProps) {
  if (!notification) return null;

  const isAbove = notification.direction === 'ABOVE';

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        maxWidth: '400px',
        width: 'calc(100vw - 48px)',
        background: '#0f172a',
        border: '1px solid #6366f1',
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.4)',
        animation: 'slideInTop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              animation: 'pulse 1.2s infinite',
            }}
          >
            <BellRing size={16} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>
            CẢNH BÁO GIÁ ĐÃ KÍCH HOẠT!
          </span>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CoinIcon symbol={notification.symbol} size={24} />
          <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.5px' }}>
            {notification.symbol}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="mono-num"
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: isAbove ? 'var(--green-up)' : 'var(--red-down)',
            }}
          >
            ${Number(notification.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          {isAbove ? <TrendingUp size={18} color="var(--green-up)" /> : <TrendingDown size={18} color="var(--red-down)" />}
        </div>
      </div>

      <div
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '6px 10px',
          borderRadius: '6px',
        }}
      >
        Điều kiện: Giá {isAbove ? 'vượt lên trên (≥)' : 'rơi xuống dưới (≤)'} <strong>${Number(notification.threshold).toLocaleString('en-US')}</strong>
      </div>
    </div>
  );
}
