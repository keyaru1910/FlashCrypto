'use client';

import React, { useState } from 'react';
import { AlertItem } from '../hooks/useAlerts';
import { X, Bell, Trash2, CheckCircle, Clock, AlertTriangle, Send, Monitor, Plus } from 'lucide-react';
import { CoinIcon } from './CoinIcon';

interface MyAlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertItem[];
  isLoading: boolean;
  onDeleteAlert: (id: string) => Promise<{ success: boolean; error?: string }>;
  onOpenCreateModal: () => void;
}

export function MyAlertsDrawer({
  isOpen,
  onClose,
  alerts,
  isLoading,
  onDeleteAlert,
  onOpenCreateModal,
}: MyAlertsDrawerProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'TRIGGERED'>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter((a) => {
    if (activeTab === 'ACTIVE') return a.status === 'ACTIVE';
    if (activeTab === 'TRIGGERED') return a.status === 'TRIGGERED';
    return true;
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDeleteAlert(id);
    setDeletingId(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          background: '#0d1322',
          borderLeft: '1px solid var(--border-highlight)',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
          animation: 'slideInRight 0.25s ease-out',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.7)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-indigo)',
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Cảnh Báo Của Tôi</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {alerts.filter((a) => a.status === 'ACTIVE').length} cảnh báo đang hoạt động
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab filters & Create button */}
        <div
          style={{
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px' }}>
            {(['ALL', 'ACTIVE', 'TRIGGERED'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: activeTab === t ? 'var(--accent-indigo)' : 'transparent',
                  color: activeTab === t ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {t === 'ALL' ? 'Tất cả' : t === 'ACTIVE' ? 'Đang chạy' : 'Đã nổ'}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenCreateModal();
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--accent-indigo)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Plus size={14} />
            <span>Tạo Cảnh Báo</span>
          </button>
        </div>

        {/* Alerts List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Đang tải danh sách cảnh báo...
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Bell size={36} color="var(--text-muted)" style={{ opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem' }}>Chưa có cảnh báo nào trong mục này.</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isAbove = alert.direction === 'ABOVE';
              const isActive = alert.status === 'ACTIVE';
              const isTriggered = alert.status === 'TRIGGERED';

              return (
                <div
                  key={alert.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid',
                    borderColor: isTriggered
                      ? 'rgba(16, 185, 129, 0.3)'
                      : isActive
                      ? 'var(--border-color)'
                      : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CoinIcon symbol={alert.symbol} size={20} />
                      <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{alert.symbol}</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: isAbove ? 'var(--green-up-bg)' : 'var(--red-down-bg)',
                          color: isAbove ? 'var(--green-up)' : 'var(--red-down)',
                        }}
                      >
                        {isAbove ? 'Giá ≥' : 'Giá ≤'} ${Number(alert.threshold).toLocaleString('en-US')}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isActive && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: 'var(--accent-cyan)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Clock size={11} />
                          <span>Đang theo dõi</span>
                        </span>
                      )}
                      {isTriggered && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            background: 'var(--green-up-bg)',
                            color: 'var(--green-up)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle size={11} />
                          <span>Đã kích hoạt</span>
                        </span>
                      )}
                      {alert.status === 'CANCELLED' && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Đã hủy</span>
                      )}

                      {/* Delete / Cancel button */}
                      {isActive && (
                        <button
                          onClick={() => handleDelete(alert.id)}
                          disabled={deletingId === alert.id}
                          title="Hủy cảnh báo này"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Channel & Time info */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {alert.channel === 'TELEGRAM' ? (
                        <>
                          <Send size={12} color="#06b6d4" />
                          <span>Telegram Bot</span>
                        </>
                      ) : (
                        <>
                          <Monitor size={12} color="var(--accent-indigo)" />
                          <span>Web In-App</span>
                        </>
                      )}
                    </div>

                    <span>
                      {isTriggered && alert.triggeredAt
                        ? `Kích hoạt: ${new Date(alert.triggeredAt).toLocaleTimeString('vi-VN')}`
                        : `Tạo lúc: ${new Date(alert.createdAt).toLocaleDateString('vi-VN')}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
