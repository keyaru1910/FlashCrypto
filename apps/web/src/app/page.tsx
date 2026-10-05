'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '../components/Header';
import { MarketStats } from '../components/MarketStats';
import { PriceTable } from '../components/PriceTable';
import { AuthModal } from '../components/AuthModal';
import { CreateAlertModal } from '../components/CreateAlertModal';
import { MyAlertsDrawer } from '../components/MyAlertsDrawer';
import { LiveAlertToast } from '../components/LiveAlertToast';
import { SystemStatusModal } from '../components/SystemStatusModal';
import { PlanModePanel } from '../components/PlanModePanel';
import { useCryptoStream } from '../hooks/useCryptoStream';
import { useAuth } from '../hooks/useAuth';
import { useAlerts } from '../hooks/useAlerts';
import { useUserNotifications, TriggeredAlertNotification } from '../hooks/useUserNotifications';
import { usePlanMode } from '../hooks/usePlanMode';
import { BarChart3, Check, Zap, Sparkles } from 'lucide-react';

// Dynamic import TradingChart để tránh lỗi SSR liên quan đến Canvas của Lightweight Charts
const TradingChart = dynamic(
  () => import('../components/TradingChart').then((mod) => mod.TradingChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="glass-panel"
        style={{
          height: '620px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '16px',
          background: '#0b0f19',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: 'var(--accent-indigo)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Đang khởi tạo TradingView Chart & Drawing Tools...
        </span>
      </div>
    ),
  }
);

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
  const [showPlanMode, setShowPlanMode] = useState<boolean>(true);

  // Modal states
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [createAlertModalOpen, setCreateAlertModalOpen] = useState(false);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [systemStatusOpen, setSystemStatusOpen] = useState(false);
  const [targetAlertSymbol, setTargetAlertSymbol] = useState('BTCUSDT');
  const [targetAlertPrice, setTargetAlertPrice] = useState('');
  const [alertSuccessToast, setAlertSuccessToast] = useState(false);

  // Live triggered notification pop-up state
  const [activeTriggeredNotification, setActiveTriggeredNotification] =
    useState<TriggeredAlertNotification | null>(null);

  // 1. Auth Hook
  const { user, token, login, register, quickDemoLogin, logout } = useAuth();

  // 2. Crypto Prices Live Stream Hook
  const { prices, status, latencyMs, ticksPerSecond } = useCryptoStream();

  // 3. Plan Mode / Paper Trading Hook
  const planMode = usePlanMode(prices);

  // 4. Alerts Management Hook
  const { alerts, isLoading: alertsLoading, createAlert, deleteAlert, fetchAlerts } = useAlerts(token);

  // 5. User In-app Notification SSE Stream Hook
  const handleAlertReceived = useCallback(
    (notification: TriggeredAlertNotification) => {
      setActiveTriggeredNotification(notification);
      fetchAlerts();
    },
    [fetchAlerts]
  );

  useUserNotifications(token, handleAlertReceived);

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
    setTargetAlertSymbol(symbol);
    setTargetAlertPrice(currentPrice);
    setCreateAlertModalOpen(true);
  };

  const handleSubmitAlert = async (params: {
    symbol: string;
    direction: 'ABOVE' | 'BELOW';
    threshold: number | string;
    channel?: 'BROWSER' | 'TELEGRAM';
  }) => {
    const res = await createAlert(params);
    if (res.success) {
      setAlertSuccessToast(true);
      setTimeout(() => setAlertSuccessToast(false), 3000);
    }
    return res;
  };

  // Thông tin giá của symbol đang chọn
  const selectedPriceData = prices[selectedSymbol];
  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const currentPriceNumeric = selectedPriceData?.price ? parseFloat(selectedPriceData.price) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Header
        status={status}
        latencyMs={latencyMs}
        ticksPerSecond={ticksPerSecond}
        activeCount={instruments.length}
        user={user}
        activeAlertsCount={activeAlertsCount}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenAlertsDrawer={() => setAlertsDrawerOpen(true)}
        onOpenSystemStatus={() => setSystemStatusOpen(true)}
        onLogout={logout}
      />

      {/* Main Content */}
      <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Market Quick Stats */}
        <MarketStats prices={prices} />

        {/* Real-time Candlestick Chart & Drawing Tools Section */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart3 size={20} color="var(--accent-indigo)" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Biểu Đồ Kỹ Thuật & Công Cụ Vẽ</h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700,
                }}
              >
                {selectedSymbol}
              </span>

              {/* Nút Bật/Tắt Plan Mode */}
              <button
                onClick={() => setShowPlanMode(!showPlanMode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: showPlanMode
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(6, 182, 212, 0.3))'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${showPlanMode ? 'var(--accent-indigo)' : 'var(--border-color)'}`,
                  color: showPlanMode ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Zap size={14} color={showPlanMode ? '#06b6d4' : 'var(--text-muted)'} />
                <span>{showPlanMode ? 'Plan Mode (Đang mở)' : 'Bật Plan Mode'}</span>
              </button>
            </div>

            {/* Quick symbol selector */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'].map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: selectedSymbol === sym ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: selectedSymbol === sym ? 'var(--accent-indigo)' : 'var(--border-color)',
                    color: selectedSymbol === sym ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sym.replace('USDT', '')}
                </button>
              ))}
            </div>
          </div>

          <TradingChart
            symbol={selectedSymbol}
            currentPrice={selectedPriceData?.price}
            priceChange24h={selectedPriceData?.priceChangePercent24h}
            volume24h={selectedPriceData?.volume24h}
            onOpenAlertModal={handleOpenAlertModal}
          />
        </div>

        {/* Plan Mode Simulation Trading Terminal Section */}
        {showPlanMode && (
          <div style={{ marginBottom: '28px' }}>
            <PlanModePanel
              symbol={selectedSymbol}
              currentPrice={currentPriceNumeric}
              planMode={planMode}
            />
          </div>
        )}

        {/* Real-time Price Table */}
        <div style={{ marginBottom: '32px' }}>
          <PriceTable
            instruments={instruments}
            prices={prices}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            onOpenAlertModal={handleOpenAlertModal}
          />
        </div>
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
        <p>FlashCrypto ⚡ — Nền tảng phân tích kỹ thuật, vẽ biểu đồ và đầu tư thử nghiệm (Plan Mode) không giới hạn.</p>
      </footer>

      {/* 1. Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLogin={login}
        onRegister={register}
        onQuickDemo={quickDemoLogin}
      />

      {/* 2. Create Alert Modal */}
      <CreateAlertModal
        isOpen={createAlertModalOpen}
        onClose={() => setCreateAlertModalOpen(false)}
        symbol={targetAlertSymbol}
        initialPrice={targetAlertPrice}
        isLoggedIn={Boolean(user)}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onSubmitAlert={handleSubmitAlert}
      />

      {/* 3. My Alerts Drawer */}
      <MyAlertsDrawer
        isOpen={alertsDrawerOpen}
        onClose={() => setAlertsDrawerOpen(false)}
        alerts={alerts}
        isLoading={alertsLoading}
        onDeleteAlert={deleteAlert}
        onOpenCreateModal={() => {
          setTargetAlertSymbol(selectedSymbol);
          setTargetAlertPrice(selectedPriceData?.price || '');
          setCreateAlertModalOpen(true);
        }}
      />

      {/* 4. Live Triggered Alert Toast */}
      <LiveAlertToast
        notification={activeTriggeredNotification}
        onClose={() => setActiveTriggeredNotification(null)}
      />

      {/* 5. System Observability & Metrics Modal */}
      <SystemStatusModal
        isOpen={systemStatusOpen}
        onClose={() => setSystemStatusOpen(false)}
      />

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
          <span>Đã kích hoạt cảnh báo giá vào hệ thống Redis!</span>
        </div>
      )}
    </div>
  );
}
