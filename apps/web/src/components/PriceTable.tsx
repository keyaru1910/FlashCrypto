'use client';

import React, { useState, useMemo } from 'react';
import { Search, Star, ArrowUpRight, ArrowDownRight, Bell, Eye } from 'lucide-react';
import { CryptoPriceData } from '../hooks/useCryptoStream';

interface Instrument {
  symbol: string;
  base: string;
  quote: string;
  pricePrecision: number;
}

interface PriceTableProps {
  instruments: Instrument[];
  prices: Record<string, CryptoPriceData>;
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string;
  onOpenAlertModal?: (symbol: string, currentPrice: string) => void;
}

export const PriceTable: React.FC<PriceTableProps> = ({
  instruments,
  prices,
  onSelectSymbol,
  selectedSymbol,
  onOpenAlertModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WATCHLIST'>('ALL');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']));

  const toggleWatchlist = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  // Lọc và sắp xếp danh sách coin
  const filteredInstruments = useMemo(() => {
    return instruments.filter((inst) => {
      const matchesSearch =
        inst.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.base.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (filterTab === 'WATCHLIST') return watchlist.has(inst.symbol);
      return true;
    });
  }, [instruments, searchTerm, filterTab, watchlist]);

  return (
    <div className="glass-panel" style={{ padding: '24px', overflow: 'hidden' }}>
      {/* Header controls: Search & Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setFilterTab('ALL')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: filterTab === 'ALL' ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.05)',
              color: '#ffffff',
              transition: 'all 0.2s',
            }}
          >
            Tất cả ({instruments.length})
          </button>
          <button
            onClick={() => setFilterTab('WATCHLIST')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: filterTab === 'WATCHLIST' ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.05)',
              color: '#ffffff',
              transition: 'all 0.2s',
            }}
          >
            <Star size={14} fill={filterTab === 'WATCHLIST' ? '#f59e0b' : 'none'} color="#f59e0b" />
            Theo dõi ({watchlist.size})
          </button>
        </div>

        {/* Search input */}
        <div
          style={{
            position: 'relative',
            minWidth: '260px',
          }}
        >
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Tìm kiếm coin (BTC, ETH, SOL...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <th style={{ padding: '12px 16px', width: '40px' }}></th>
              <th style={{ padding: '12px 16px' }}>Cặp Coin</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Giá Real-time</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Khối Lượng 24h</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cập Nhật</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', width: '140px' }}>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {filteredInstruments.map((inst) => {
              const liveData = prices[inst.symbol];
              const isSelected = selectedSymbol === inst.symbol;
              const isFavorited = watchlist.has(inst.symbol);

              // Flash effect class
              let flashClass = '';
              if (liveData?.priceChangeDirection === 'UP') flashClass = 'flash-up';
              if (liveData?.priceChangeDirection === 'DOWN') flashClass = 'flash-down';

              const priceFormatted = liveData?.price
                ? parseFloat(liveData.price).toLocaleString('en-US', {
                    minimumFractionDigits: inst.pricePrecision,
                    maximumFractionDigits: inst.pricePrecision,
                  })
                : '---';

              const volumeFormatted = liveData?.volume24h
                ? parseFloat(liveData.volume24h).toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                  })
                : '---';

              const timeSinceUpdate = liveData?.lastUpdated
                ? `${Math.max(0, ((Date.now() - liveData.lastUpdated) / 1000).toFixed(1))}s trước`
                : '---';

              return (
                <tr
                  key={inst.symbol}
                  onClick={() => onSelectSymbol?.(inst.symbol)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Star Watchlist */}
                  <td style={{ padding: '14px 16px' }}>
                    <button
                      onClick={(e) => toggleWatchlist(inst.symbol, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Star
                        size={16}
                        fill={isFavorited ? '#f59e0b' : 'none'}
                        color={isFavorited ? '#f59e0b' : 'var(--text-muted)'}
                      />
                    </button>
                  </td>

                  {/* Symbol & Name */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{inst.base}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        /{inst.quote}
                      </span>
                    </div>
                  </td>

                  {/* Real-time Price with Flash Effect */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <span
                      key={`${inst.symbol}-${liveData?.price}`}
                      className={`mono-num ${flashClass}`}
                      style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        padding: '2px 6px',
                        display: 'inline-block',
                      }}
                    >
                      ${priceFormatted}
                    </span>
                  </td>

                  {/* 24h Volume */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    <span className="mono-num" style={{ fontSize: '0.85rem' }}>
                      {volumeFormatted}
                    </span>
                  </td>

                  {/* Time Since Update */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '0.75rem' }}>{timeSinceUpdate}</span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAlertModal?.(inst.symbol, liveData?.price || '0');
                        }}
                        title="Tạo cảnh báo giá"
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                        }}
                      >
                        <Bell size={13} color="var(--accent-cyan)" />
                        <span>Cảnh Báo</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
