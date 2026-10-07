'use client';

import React, { useState, useEffect } from 'react';
import { X, Bell, Send, Monitor, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { CoinIcon } from './CoinIcon';

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  initialPrice?: string;
  isLoggedIn: boolean;
  onOpenAuthModal: () => void;
  onSubmitAlert: (params: {
    symbol: string;
    direction: 'ABOVE' | 'BELOW';
    threshold: number | string;
    channel?: 'BROWSER' | 'TELEGRAM';
  }) => Promise<{ success: boolean; error?: string }>;
}

export function CreateAlertModal({
  isOpen,
  onClose,
  symbol,
  initialPrice = '',
  isLoggedIn,
  onOpenAuthModal,
  onSubmitAlert,
}: CreateAlertModalProps) {
  const [direction, setDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [threshold, setThreshold] = useState<string>('');
  const [channel, setChannel] = useState<'BROWSER' | 'TELEGRAM'>('BROWSER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrice) {
      setThreshold(initialPrice);
    }
  }, [initialPrice, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isLoggedIn) {
      onClose();
      onOpenAuthModal();
      return;
    }

    const priceNum = parseFloat(threshold);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Vui lòng nhập mức giá hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    const res = await onSubmitAlert({
      symbol,
      direction,
      threshold: priceNum,
      channel,
    });
    setIsSubmitting(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Không thể tạo cảnh báo');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '28px',
          background: '#0f172a',
          border: '1px solid var(--border-highlight)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Tạo Cảnh Báo Giá Tức Thời</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {!isLoggedIn && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
              Bạn cần đăng nhập để lưu và nhận thông báo cảnh báo.
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuthModal();
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'var(--accent-indigo)',
                border: 'none',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Đăng nhập ngay
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Symbol */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Cặp Giao Dịch
            </label>
            <div
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontWeight: 800,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <CoinIcon symbol={symbol} size={24} />
              <span>{symbol}</span>
            </div>
          </div>

          {/* Direction */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Điều Kiện Kích Hoạt
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDirection('ABOVE')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: '1px solid',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: direction === 'ABOVE' ? 'var(--green-up-bg)' : 'rgba(255, 255, 255, 0.04)',
                  color: direction === 'ABOVE' ? 'var(--green-up)' : 'var(--text-secondary)',
                  borderColor: direction === 'ABOVE' ? 'var(--green-up)' : 'transparent',
                }}
              >
                <TrendingUp size={16} />
                <span>Giá vượt lên (≥)</span>
              </button>

              <button
                type="button"
                onClick={() => setDirection('BELOW')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  border: '1px solid',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: direction === 'BELOW' ? 'var(--red-down-bg)' : 'rgba(255, 255, 255, 0.04)',
                  color: direction === 'BELOW' ? 'var(--red-down)' : 'var(--text-secondary)',
                  borderColor: direction === 'BELOW' ? 'var(--red-down)' : 'transparent',
                }}
              >
                <TrendingDown size={16} />
                <span>Giá rơi xuống (≤)</span>
              </button>
            </div>
          </div>

          {/* Threshold Price */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Mức Giá Ngưỡng (USD)
            </label>
            <input
              type="text"
              required
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Nhập mức giá bạn muốn bắt cảnh báo..."
              className="mono-num"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '1.1rem',
                fontWeight: 800,
                outline: 'none',
              }}
            />
          </div>

          {/* Notification Channel */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Kênh Nhận Thông Báo
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setChannel('BROWSER')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: channel === 'BROWSER' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: channel === 'BROWSER' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  borderColor: channel === 'BROWSER' ? 'var(--accent-indigo)' : 'transparent',
                }}
              >
                <Monitor size={15} />
                <span>Web In-App</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('TELEGRAM')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: channel === 'TELEGRAM' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: channel === 'TELEGRAM' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  borderColor: channel === 'TELEGRAM' ? 'var(--accent-cyan)' : 'transparent',
                }}
              >
                <Send size={15} />
                <span>Telegram Bot</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 1.5,
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--accent-indigo)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={16} />
              <span>{isSubmitting ? 'Đang kích hoạt...' : 'Kích Hoạt Cảnh Báo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
