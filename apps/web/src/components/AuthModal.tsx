'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, Send, Sparkles, LogIn, UserPlus } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (email: string, pass: string, telegram?: string) => Promise<{ success: boolean; error?: string }>;
  onQuickDemo: () => Promise<{ success: boolean; error?: string }>;
}

export function AuthModal({ isOpen, onClose, onLogin, onRegister, onQuickDemo }: AuthModalProps) {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    if (tab === 'LOGIN') {
      const res = await onLogin(email, password);
      setIsSubmitting(false);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Đăng nhập thất bại');
      }
    } else {
      const res = await onRegister(email, password, telegramChatId);
      setIsSubmitting(false);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Đăng ký thất bại');
      }
    }
  };

  const handleQuickDemo = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await onQuickDemo();
    setIsSubmitting(false);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Không thể tạo tài khoản demo');
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
          maxWidth: '420px',
          padding: '28px',
          background: '#0f172a',
          border: '1px solid var(--border-highlight)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} color="var(--accent-indigo)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              {tab === 'LOGIN' ? 'Đăng Nhập Tài Khoản' : 'Tạo Tài Khoản Mới'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switch */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '20px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('LOGIN');
              setErrorMsg(null);
            }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: tab === 'LOGIN' ? 'var(--accent-indigo)' : 'transparent',
              color: tab === 'LOGIN' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Đăng Nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('REGISTER');
              setErrorMsg(null);
            }}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: tab === 'REGISTER' ? 'var(--accent-indigo)' : 'transparent',
              color: tab === 'REGISTER' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            Đăng Ký
          </button>
        </div>

        {/* Quick Demo button */}
        <button
          type="button"
          onClick={handleQuickDemo}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '10px 14px',
            marginBottom: '18px',
            borderRadius: '10px',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            background: 'rgba(6, 182, 212, 0.1)',
            color: 'var(--accent-cyan)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <Sparkles size={16} />
          <span>⚡ Dùng thử nhanh (1-Click Demo)</span>
        </button>

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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Địa chỉ Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            </div>
          </div>

          {tab === 'REGISTER' && (
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Telegram Chat ID (Tùy chọn)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="VD: 123456789"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <Send size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: '6px',
              padding: '12px',
              borderRadius: '8px',
              background: 'var(--accent-indigo)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            {isSubmitting ? (
              <span>Đang xử lý...</span>
            ) : tab === 'LOGIN' ? (
              <>
                <LogIn size={18} />
                <span>Đăng Nhập</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Tạo Tài Khoản</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
