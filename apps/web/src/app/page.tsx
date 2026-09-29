'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { MarketStats } from '../components/MarketStats';
import { PriceTable } from '../components/PriceTable';
import { useCryptoStream } from '../hooks/useCryptoStream';
import { Bell, X, Check, ShieldAlert } from 'lucide-react';

interface Instrument {
  symbol: string;
  base: string;
  quote: string;
  pricePrecision: number;
}

const DEFAULT_INSTRUMENTS: Instrument[] = [
  { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', pricePrecision: 5 },
  { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'DOTUSDT', base: 'DOT', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'LINKUSDT', base: 'LINK', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'NEARUSDT', base: 'NEAR', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'SUIUSDT', base: 'SUI', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'APTUSDT', base: 'APT', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'OPUSDT', base: 'OP', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'ARBUSDT', base: 'ARB', quote: 'USDT', pricePrecision: 4 },
  { symbol: 'LTCUSDT', base: 'LTC', quote: 'USDT', pricePrecision: 2 },
  { symbol: 'TONUSDT', base: 'TON', quote: 'USDT', pricePrecision: 3 },
  { symbol: 'PEPEUSDT', base: 'PEPE', quote: 'USDT', pricePrecision: 8 },
  { symbol: 'SHIBUSDT', base: 'SHIB', quote: 'USDT', pricePrecision: 8 },
  { symbol: 'RENDERUSDT', base: 'RENDER', quote: 'USDT', pricePrecision: 3 },
];

export default function DashboardPage() {
  const [instruments, setInstruments] = useState<Instrument[]>(DEFAULT_INSTRUMENTS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');

  // Modal alert
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertSymbol, setAlertSymbol] = useState('BTCUSDT');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [alertSuccessToast, setAlertSuccessToast] = useState(false);

  const { prices, status, latencyMs, ticksPerSecond } = useCryptoStream();

  // Tải danh sách instruments từ API
  useEffect(() => {
    const fetchInstruments = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/api/v1/instruments`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setInstruments(json.data);
          }
        }
      } catch (err) {
        console.warn('Dùng danh sách instruments mặc định:', err);
      }
    };

    fetchInstruments();
  }, []);

  const handleOpenAlertModal = (symbol: string, currentPrice: string) => {
    setAlertSymbol(symbol);
    setAlertPrice(currentPrice);
    setAlertModalOpen(true);
  };

  const handleSaveAlert = () => {
    // Đã lưu alert (sẽ kết nối API ở Phase 4)
    setAlertModalOpen(false);
    setAlertSuccessToast(true);
    setTimeout(() => setAlertSuccessToast(false), 3000);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Header
        status={status}
        latencyMs={latencyMs}
        ticksPerSecond={ticksPerSecond}
        activeCount={instruments.length}
      />

      {/* Main Content */}
      <main style={{ flex: 1, padding: '28px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Market Quick Stats */}
        <MarketStats prices={prices} />

        {/* Real-time Price Table */}
        <PriceTable
          instruments={instruments}
          prices={prices}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          onOpenAlertModal={handleOpenAlertModal}
        />
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '24px 32px',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
        }}
      >
        <p>FlashCrypto ⚡ — Hệ thống Bảng giá Real-time & Cảnh báo Tức thời. Powered by Next.js & Server-Sent Events (SSE).</p>
      </footer>

      {/* Modal Cảnh báo Giá (Alert Creation Modal) */}
      {alertModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '28px',
              background: '#111827',
              border: '1px solid var(--border-highlight)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={20} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Đặt Cảnh Báo Giá</h3>
              </div>
              <button
                onClick={() => setAlertModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Cặp Coin
                </label>
                <input
                  type="text"
                  disabled
                  value={alertSymbol}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Điều Kiện Kích Hoạt
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => setAlertDirection('ABOVE')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: alertDirection === 'ABOVE' ? 'var(--green-up-bg)' : 'rgba(255, 255, 255, 0.05)',
                      color: alertDirection === 'ABOVE' ? 'var(--green-up)' : 'var(--text-secondary)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: alertDirection === 'ABOVE' ? 'var(--green-up)' : 'transparent',
                    }}
                  >
                    Giá vượt lên trên (≥)
                  </button>
                  <button
                    onClick={() => setAlertDirection('BELOW')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: alertDirection === 'BELOW' ? 'var(--red-down-bg)' : 'rgba(255, 255, 255, 0.05)',
                      color: alertDirection === 'BELOW' ? 'var(--red-down)' : 'var(--text-secondary)',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: alertDirection === 'BELOW' ? 'var(--red-down)' : 'transparent',
                    }}
                  >
                    Giá rơi xuống dưới (≤)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Ngưỡng Giá Kích Hoạt (USD)
                </label>
                <input
                  type="text"
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  placeholder="Nhập giá muốn nhận cảnh báo..."
                  className="mono-num"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  onClick={() => setAlertModalOpen(false)}
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
                  onClick={handleSaveAlert}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--accent-indigo)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  }}
                >
                  Tạo Cảnh Báo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo tạo cảnh báo thành công */}
      {alertSuccessToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '32px',
            right: '32px',
            padding: '14px 20px',
            borderRadius: '10px',
            background: '#10b981',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
            zIndex: 200,
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <Check size={18} />
          <span>Đã lưu cảnh báo giá thành công!</span>
        </div>
      )}
    </div>
  );
}
