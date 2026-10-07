'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Flame, BarChart3 } from 'lucide-react';
import { CryptoPriceData } from '../hooks/useCryptoStream';
import { CoinIcon } from './CoinIcon';

interface MarketStatsProps {
  prices: Record<string, CryptoPriceData>;
}

export const MarketStats: React.FC<MarketStatsProps> = ({ prices }) => {
  const priceList = Object.values(prices);

  // Tính toán Top Volume
  const sortedByVolume = [...priceList].sort((a, b) => {
    const volA = parseFloat(a.volume24h || '0');
    const volB = parseFloat(b.volume24h || '0');
    return volB - volA;
  });

  const topVolumeCoin = sortedByVolume[0];
  const btcPrice = prices['BTCUSDT']?.price;
  const ethPrice = prices['ETHUSDT']?.price;
  const solPrice = prices['SOLUSDT']?.price;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}
    >
      {/* Thẻ 1: Bitcoin */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CoinIcon symbol="BTC" size={24} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Bitcoin (BTC/USDT)
            </span>
          </div>
          <div
            style={{
              padding: '5px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
            }}
          >
            <Flame size={15} />
          </div>
        </div>
        <div className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          {btcPrice ? `$${parseFloat(btcPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '---'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Real-time ticker stream
        </div>
      </div>

      {/* Thẻ 2: Ethereum */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CoinIcon symbol="ETH" size={24} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Ethereum (ETH/USDT)
            </span>
          </div>
          <div
            style={{
              padding: '5px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#6366f1',
            }}
          >
            <TrendingUp size={15} />
          </div>
        </div>
        <div className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          {ethPrice ? `$${parseFloat(ethPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '---'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Real-time ticker stream
        </div>
      </div>

      {/* Thẻ 3: Solana */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CoinIcon symbol="SOL" size={24} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Solana (SOL/USDT)
            </span>
          </div>
          <div
            style={{
              padding: '5px',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.1)',
              color: '#06b6d4',
            }}
          >
            <TrendingUp size={15} />
          </div>
        </div>
        <div className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          {solPrice ? `$${parseFloat(solPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '---'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Real-time ticker stream
        </div>
      </div>

      {/* Thẻ 4: Tổng số Coins & Top Volume */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {topVolumeCoin && <CoinIcon symbol={topVolumeCoin.symbol} size={24} />}
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Cặp Coin Đang Stream
            </span>
          </div>
          <div
            style={{
              padding: '5px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
            }}
          >
            <BarChart3 size={15} />
          </div>
        </div>
        <div className="mono-num" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
          {priceList.length} / 20 Cặp
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {topVolumeCoin ? `Top Vol 24h: ${topVolumeCoin.symbol}` : 'Đang tải dữ liệu...'}
        </div>
      </div>
    </div>
  );
};
