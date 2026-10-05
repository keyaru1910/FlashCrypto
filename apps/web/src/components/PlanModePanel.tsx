'use client';

import React, { useState } from 'react';
import {
  PositionSide,
  OrderType,
  SimulatedPosition,
  SimulatedOrder,
  SimulatedTradeHistory,
} from '../types/planMode';
import { usePlanMode } from '../hooks/usePlanMode';
import {
  TrendingUp,
  TrendingDown,
  RotateCcw,
  PlusCircle,
  XCircle,
  CheckCircle2,
  DollarSign,
  PieChart,
  History,
  Clock,
  ShieldAlert,
  Percent,
} from 'lucide-react';

interface PlanModePanelProps {
  symbol: string;
  currentPrice: number;
  planMode: ReturnType<typeof usePlanMode>;
}

export function PlanModePanel({ symbol, currentPrice, planMode }: PlanModePanelProps) {
  const {
    account,
    resetBalance,
    openMarketOrder,
    placeLimitOrder,
    cancelLimitOrder,
    closePosition,
    calculateTotalPortfolioValue,
  } = planMode;

  const [side, setSide] = useState<PositionSide>('LONG');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [marginInput, setMarginInput] = useState<string>('500');
  const [leverage, setLeverage] = useState<number>(10);
  const [limitPriceInput, setLimitPriceInput] = useState<string>(currentPrice > 0 ? currentPrice.toString() : '');
  const [enableTPSL, setEnableTPSL] = useState<boolean>(false);
  const [tpInput, setTpInput] = useState<string>('');
  const [slInput, setSlInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history' | 'stats'>('positions');

  // Modal reset số dư
  const [showResetModal, setShowResetModal] = useState(false);
  const [customResetAmount, setCustomResetAmount] = useState('10000');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { totalEquity, totalMarginInUse, totalUnrealizedPnL } = calculateTotalPortfolioValue();

  const handleOpenOrder = () => {
    const margin = parseFloat(marginInput);
    if (isNaN(margin) || margin <= 0) {
      setActionNotice({ type: 'error', text: 'Vui lòng nhập số tiền ký quỹ hợp lệ' });
      return;
    }

    const tp = tpInput ? parseFloat(tpInput) : undefined;
    const sl = slInput ? parseFloat(slInput) : undefined;

    if (orderType === 'MARKET') {
      if (currentPrice <= 0) {
        setActionNotice({ type: 'error', text: 'Chưa có giá thị trường thời gian thực' });
        return;
      }

      const res = openMarketOrder({
        symbol,
        side,
        margin,
        leverage,
        currentPrice,
        takeProfitPrice: enableTPSL ? tp : undefined,
        stopLossPrice: enableTPSL ? sl : undefined,
      });

      if (res.success) {
        setActionNotice({ type: 'success', text: `Đã khớp lệnh MARKET ${side} ${symbol} thành công!` });
      } else {
        setActionNotice({ type: 'error', text: res.message || 'Không thể mở vị thế' });
      }
    } else {
      const targetPrice = parseFloat(limitPriceInput);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        setActionNotice({ type: 'error', text: 'Vui lòng nhập giá đặt Limit hợp lệ' });
        return;
      }

      const res = placeLimitOrder({
        symbol,
        side,
        margin,
        leverage,
        targetPrice,
        takeProfitPrice: enableTPSL ? tp : undefined,
        stopLossPrice: enableTPSL ? sl : undefined,
      });

      if (res.success) {
        setActionNotice({ type: 'success', text: `Đã đặt lệnh LIMIT ${side} ${symbol} tại $${targetPrice} thành công!` });
      } else {
        setActionNotice({ type: 'error', text: res.message || 'Không thể đặt lệnh' });
      }
    }

    setTimeout(() => setActionNotice(null), 4000);
  };

  // Thống kê hiệu suất
  const totalTrades = account.history.length;
  const winTrades = account.history.filter((h) => h.pnl > 0).length;
  const lossTrades = account.history.filter((h) => h.pnl < 0).length;
  const winRate = totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalRealizedPnL = account.history.reduce((sum, h) => sum + h.pnl, 0);

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        background: '#0b0f19',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Top Banner Plan Mode */}
      <div
        style={{
          padding: '12px 20px',
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15))',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⚡ PLAN MODE</span>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Mô phỏng đầu tư & kiểm thử chiến lược không rủi ro
          </span>
        </div>

        {/* Portfolio Quick Balance Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Số dư khả dụng:</span>
            <div className="mono-num" style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
              ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tổng tài sản (Equity):</span>
            <div className="mono-num" style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-cyan)' }}>
              ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PnL tạm tính:</span>
            <div
              className="mono-num"
              style={{
                fontWeight: 800,
                fontSize: '0.95rem',
                color: totalUnrealizedPnL >= 0 ? 'var(--green-up)' : 'var(--red-down)',
              }}
            >
              {totalUnrealizedPnL >= 0 ? `+$${totalUnrealizedPnL.toFixed(2)}` : `-$${Math.abs(totalUnrealizedPnL).toFixed(2)}`}
            </div>
          </div>

          {/* Nút Reset / Nạp thêm tiền ảo */}
          <button
            onClick={() => setShowResetModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid var(--accent-indigo)',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <RotateCcw size={13} />
            <span>Nạp / Đặt lại vốn ảo</span>
          </button>
        </div>
      </div>

      {/* Thông báo thao tác */}
      {actionNotice && (
        <div
          style={{
            padding: '8px 20px',
            background: actionNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            borderBottom: `1px solid ${actionNotice.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: actionNotice.type === 'success' ? 'var(--green-up)' : 'var(--red-down)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {actionNotice.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Khu vực 2 Cột: Bảng Đặt Lệnh (Trái) và Danh Mục Vị Thế / Lịch Sử (Phải) */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: '340px' }}>
        {/* CỘT TRÁI: BẢNG ĐẶT LỆNH */}
        <div
          style={{
            padding: '16px',
            borderRight: '1px solid var(--border-color)',
            background: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Side Selector (LONG / SHORT) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => setSide('LONG')}
              style={{
                padding: '9px',
                borderRadius: '8px',
                border: 'none',
                background: side === 'LONG' ? 'var(--green-up)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <TrendingUp size={16} />
              <span>MUA / LONG</span>
            </button>
            <button
              onClick={() => setSide('SHORT')}
              style={{
                padding: '9px',
                borderRadius: '8px',
                border: 'none',
                background: side === 'SHORT' ? 'var(--red-down)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <TrendingDown size={16} />
              <span>BÁN / SHORT</span>
            </button>
          </div>

          {/* Order Type & Leverage Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            {/* Market / Limit */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid var(--border-color)',
              }}
            >
              <button
                onClick={() => setOrderType('MARKET')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  background: orderType === 'MARKET' ? 'var(--accent-indigo)' : 'transparent',
                  color: orderType === 'MARKET' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Market
              </button>
              <button
                onClick={() => setOrderType('LIMIT')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: 'none',
                  background: orderType === 'LIMIT' ? 'var(--accent-indigo)' : 'transparent',
                  color: orderType === 'LIMIT' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Limit
              </button>
            </div>

            {/* Leverage selector buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[1, 5, 10, 20, 50].map((lev) => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: leverage === lev ? 'var(--accent-cyan)' : 'transparent',
                    background: leverage === lev ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: leverage === lev ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          {/* Limit Price Input if Limit Order */}
          {orderType === 'LIMIT' && (
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Giá kích hoạt (USDT):
              </label>
              <input
                type="number"
                value={limitPriceInput}
                onChange={(e) => setLimitPriceInput(e.target.value)}
                placeholder={currentPrice.toString()}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Margin Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Vốn ký quỹ (Margin):</span>
              <span style={{ color: 'var(--text-muted)' }}>Khả dụng: ${account.balance.toFixed(0)}</span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
                placeholder="500"
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', right: '10px', top: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                USDT
              </span>
            </div>

            {/* Quick % buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '6px' }}>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const amount = (account.balance * pct) / 100;
                    setMarginInput(Math.floor(amount).toString());
                  }}
                  style={{
                    padding: '3px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* TP / SL Toggle & Inputs */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={enableTPSL}
                  onChange={(e) => setEnableTPSL(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Cài đặt Chốt lời (TP) / Cắt lỗ (SL)</span>
              </label>
            </div>

            {enableTPSL && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div>
                  <input
                    type="number"
                    placeholder="Giá TP (Chốt lời)"
                    value={tpInput}
                    onChange={(e) => setTpInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: 'var(--green-up)',
                      fontSize: '0.75rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Giá SL (Cắt lỗ)"
                    value={slInput}
                    onChange={(e) => setSlInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--red-down)',
                      fontSize: '0.75rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Khối lượng tổng vị thế ước tính */}
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.03)',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tổng vị thế (Notional):</span>
              <strong className="mono-num" style={{ color: '#fff' }}>
                ${((parseFloat(marginInput) || 0) * leverage).toLocaleString()} USDT
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Số lượng Coin:</span>
              <strong className="mono-num" style={{ color: '#fff' }}>
                {currentPrice > 0 ? (((parseFloat(marginInput) || 0) * leverage) / currentPrice).toFixed(4) : '0'}{' '}
                {symbol.replace('USDT', '')}
              </strong>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            onClick={handleOpenOrder}
            style={{
              marginTop: 'auto',
              padding: '11px',
              borderRadius: '8px',
              border: 'none',
              background:
                side === 'LONG'
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: side === 'LONG' ? '0 4px 16px rgba(16, 185, 129, 0.4)' : '0 4px 16px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            {orderType === 'MARKET' ? `VÀO LỆNH ${side} ${symbol}` : `ĐẶT LỆNH LIMIT ${side} ${symbol}`}
          </button>
        </div>

        {/* CỘT PHẢI: QUẢN LÝ DANH MỤC VỊ THẾ & HIỆU SUẤT */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Tabs Bar */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(15, 23, 42, 0.2)',
            }}
          >
            <button
              onClick={() => setActiveTab('positions')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'positions' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: activeTab === 'positions' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              }}
            >
              Vị thế đang mở ({account.positions.length})
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'orders' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: activeTab === 'orders' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              }}
            >
              Lệnh chờ ({account.orders.length})
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'history' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: activeTab === 'history' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              }}
            >
              Lịch sử lệnh ({account.history.length})
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'stats' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: activeTab === 'stats' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              }}
            >
              Hiệu suất Plan ({winRate}% Thắng)
            </button>
          </div>

          {/* Tab Contents */}
          <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', maxHeight: '300px' }}>
            {/* 1. Tab Vị Thế Đang Mở */}
            {activeTab === 'positions' && (
              <>
                {account.positions.length === 0 ? (
                  <div
                    style={{
                      height: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      gap: '8px',
                    }}
                  >
                    <DollarSign size={28} />
                    <span>Chưa có vị thế mô phỏng nào. Hãy chọn Long hoặc Short bên trái để trải nghiệm!</span>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px' }}>Cặp Coin</th>
                        <th style={{ padding: '8px' }}>Vị thế</th>
                        <th style={{ padding: '8px' }}>Ký quỹ / Đòn bẩy</th>
                        <th style={{ padding: '8px' }}>Giá vào</th>
                        <th style={{ padding: '8px' }}>Giá thanh lý</th>
                        <th style={{ padding: '8px' }}>PnL & ROI (%)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.positions.map((pos) => {
                        const priceNow = pos.symbol === symbol && currentPrice > 0 ? currentPrice : pos.entryPrice;
                        const pnl =
                          pos.side === 'LONG'
                            ? (priceNow - pos.entryPrice) * pos.amount
                            : (pos.entryPrice - priceNow) * pos.amount;
                        const roi = (pnl / pos.margin) * 100;
                        const isUp = pnl >= 0;

                        return (
                          <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '8px', fontWeight: 700 }}>{pos.symbol}</td>
                            <td style={{ padding: '8px' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: pos.side === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: pos.side === 'LONG' ? 'var(--green-up)' : 'var(--red-down)',
                                }}
                              >
                                {pos.side}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>
                              ${pos.margin.toFixed(0)} ({pos.leverage}x)
                            </td>
                            <td style={{ padding: '8px' }} className="mono-num">
                              ${pos.entryPrice.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px', color: '#f59e0b' }} className="mono-num">
                              ${pos.liquidationPrice.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px' }}>
                              <span
                                className="mono-num"
                                style={{ fontWeight: 800, color: isUp ? 'var(--green-up)' : 'var(--red-down)' }}
                              >
                                {isUp ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`} ({roi.toFixed(2)}%)
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button
                                onClick={() => closePosition(pos.id, priceNow, 'MANUAL')}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: 'var(--red-down)',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Đóng vị thế
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* 2. Tab Lệnh Chờ (Limit Orders) */}
            {activeTab === 'orders' && (
              <>
                {account.orders.length === 0 ? (
                  <div
                    style={{
                      height: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      gap: '8px',
                    }}
                  >
                    <Clock size={28} />
                    <span>Không có lệnh chờ Limit nào đang active.</span>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px' }}>Cặp Coin</th>
                        <th style={{ padding: '8px' }}>Loại</th>
                        <th style={{ padding: '8px' }}>Giá đặt Limit</th>
                        <th style={{ padding: '8px' }}>Ký quỹ</th>
                        <th style={{ padding: '8px' }}>Đòn bẩy</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Hủy lệnh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.orders.map((ord) => (
                        <tr key={ord.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '8px', fontWeight: 700 }}>{ord.symbol}</td>
                          <td style={{ padding: '8px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                background: ord.side === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: ord.side === 'LONG' ? 'var(--green-up)' : 'var(--red-down)',
                              }}
                            >
                              {ord.side}
                            </span>
                          </td>
                          <td style={{ padding: '8px' }} className="mono-num">
                            ${ord.targetPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '8px' }}>${ord.margin.toFixed(0)}</td>
                          <td style={{ padding: '8px' }}>{ord.leverage}x</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            <button
                              onClick={() => cancelLimitOrder(ord.id)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                            >
                              Hủy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* 3. Tab Lịch Sử Lệnh Đã Đóng */}
            {activeTab === 'history' && (
              <>
                {account.history.length === 0 ? (
                  <div
                    style={{
                      height: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      gap: '8px',
                    }}
                  >
                    <History size={28} />
                    <span>Chưa có lịch sử giao dịch mô phỏng nào.</span>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px' }}>Cặp Coin</th>
                        <th style={{ padding: '8px' }}>Side</th>
                        <th style={{ padding: '8px' }}>Giá vào / Giá đóng</th>
                        <th style={{ padding: '8px' }}>Ký quỹ</th>
                        <th style={{ padding: '8px' }}>Lãi/Lỗ ròng (USDT)</th>
                        <th style={{ padding: '8px' }}>ROI (%)</th>
                        <th style={{ padding: '8px' }}>Lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.history.map((hist) => {
                        const isWin = hist.pnl >= 0;
                        return (
                          <tr key={hist.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '8px', fontWeight: 700 }}>{hist.symbol}</td>
                            <td style={{ padding: '8px' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: hist.side === 'LONG' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: hist.side === 'LONG' ? 'var(--green-up)' : 'var(--red-down)',
                                }}
                              >
                                {hist.side}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }} className="mono-num">
                              ${hist.entryPrice.toFixed(2)} → ${hist.closePrice.toFixed(2)}
                            </td>
                            <td style={{ padding: '8px' }}>${hist.margin.toFixed(0)} ({hist.leverage}x)</td>
                            <td style={{ padding: '8px' }} className="mono-num">
                              <strong style={{ color: isWin ? 'var(--green-up)' : 'var(--red-down)' }}>
                                {isWin ? `+$${hist.pnl.toFixed(2)}` : `-$${Math.abs(hist.pnl).toFixed(2)}`}
                              </strong>
                            </td>
                            <td style={{ padding: '8px' }} className="mono-num">
                              <span style={{ color: isWin ? 'var(--green-up)' : 'var(--red-down)' }}>
                                {hist.roiPercent.toFixed(2)}%
                              </span>
                            </td>
                            <td style={{ padding: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {hist.closeReason === 'TAKE_PROFIT'
                                ? '🎯 Chốt lời (TP)'
                                : hist.closeReason === 'STOP_LOSS'
                                ? '🛑 Cắt lỗ (SL)'
                                : hist.closeReason === 'LIQUIDATION'
                                ? '💥 Thanh lý'
                                : 'Thủ công'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* 4. Tab Phân Tích Hiệu Suất */}
            {activeTab === 'stats' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '10px 0' }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tổng số lệnh đã đóng</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                    {totalTrades}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Thắng: {winTrades} | Thua: {lossTrades}
                  </span>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tỷ lệ thắng (Win Rate)</span>
                  <div
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: Number(winRate) >= 50 ? 'var(--green-up)' : 'var(--red-down)',
                      marginTop: '4px',
                    }}
                  >
                    {winRate}%
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Mục tiêu tối thiểu: {'>'} 50%
                  </span>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tổng Lãi/Lỗ Thực Nhận</span>
                  <div
                    className="mono-num"
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: totalRealizedPnL >= 0 ? 'var(--green-up)' : 'var(--red-down)',
                      marginTop: '4px',
                    }}
                  >
                    {totalRealizedPnL >= 0 ? `+$${totalRealizedPnL.toFixed(2)}` : `-$${Math.abs(totalRealizedPnL).toFixed(2)}`}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>USDT</span>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ký quỹ đang dùng</span>
                  <div className="mono-num" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>
                    ${totalMarginInUse.toFixed(2)}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Chiếm {((totalMarginInUse / Math.max(1, totalEquity)) * 100).toFixed(1)}% vốn
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nạp thêm / Reset Số Dư Ảo */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
          }}
        >
          <div
            style={{
              width: '420px',
              padding: '24px',
              background: '#0f172a',
              borderRadius: '16px',
              border: '1px solid var(--accent-indigo)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                🔄 Đặt Lại / Nạp Số Dư Demo
              </h3>
              <button
                onClick={() => setShowResetModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Bạn có thể nạp thêm hoặc thiết lập số dư USDT ảo không giới hạn số lần để thoải mái luyện tập.
            </p>

            {/* Preset buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {['1000', '10000', '50000', '100000'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCustomResetAmount(amt)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: customResetAmount === amt ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                >
                  ${parseInt(amt).toLocaleString()}
                </button>
              ))}
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Hoặc nhập số tiền tùy ý (USDT):
              </label>
              <input
                type="number"
                value={customResetAmount}
                onChange={(e) => setCustomResetAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  const amt = parseFloat(customResetAmount) || 10000;
                  resetBalance(amt, true);
                  setShowResetModal(false);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
              >
                Cộng thêm vào số dư
              </button>
              <button
                onClick={() => {
                  const amt = parseFloat(customResetAmount) || 10000;
                  resetBalance(amt, false);
                  setShowResetModal(false);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Đặt lại toàn bộ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
