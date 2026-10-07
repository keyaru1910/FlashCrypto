'use client';

import React, { useState, useEffect } from 'react';

interface CoinIconProps {
  symbol?: string; // e.g. "BTCUSDT" or "BTC"
  size?: number;   // size in px, default 28
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Danh sách logo cục bộ được người dùng cung cấp trong thư mục /logo coin/
 */
const LOCAL_COIN_LOGOS: Record<string, string> = {
  BTC: '/logo%20coin/bitcoin_logo.jpg',
  ETH: '/logo%20coin/ETH_logo.jpg',
  SOL: '/logo%20coin/Solana_logo.jpg',
  BNB: '/logo%20coin/bnb_logo.jpg',
  XRP: '/logo%20coin/Xrp_logo.jpg',
  ADA: '/logo%20coin/ada_logo.jpg',
  DOGE: '/logo%20coin/doge_logo.jpg',
  AVAX: '/logo%20coin/avax_logo.jpg',
  DOT: '/logo%20coin/dot_logo.jpg',
  LINK: '/logo%20coin/link_logo.jpg',
  NEAR: '/logo%20coin/near_logo.jpg',
  SUI: '/logo%20coin/SUI_logo.jpg',
  APT: '/logo%20coin/apt_logo.jpg',
  OP: '/logo%20coin/op_logo.jpg',
  ARB: '/logo%20coin/arb_logo.jpg',
  LTC: '/logo%20coin/ltc_logo.jpg',
  TON: '/logo%20coin/Ton_logo.jpg',
  RENDER: '/logo%20coin/render_logo.jpg',
  RNDR: '/logo%20coin/render_logo.jpg',
};

/**
 * Trích xuất mã base chuẩn từ cặp giao dịch (VD: BNBUSDT -> BNB, BTCUSDT -> BTC)
 */
export function parseCoinBase(symbol: string = 'BTC'): string {
  if (!symbol) return 'BTC';
  const clean = symbol.trim().toUpperCase();
  // Xóa đuôi quote tiền tệ nếu có
  const base = clean.replace(/(USDT|BUSD|USDC|EUR|USD)$/i, '');
  return base || clean;
}

/**
 * Render Vector SVG chuẩn nhận diện thương hiệu của từng đồng coin (chạy offline / fallback 100% chuẩn)
 */
function renderCoinSvg(base: string, size: number) {
  switch (base) {
    case 'BNB':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#F3BA2F" />
          <path
            d="M16 7L19.5 10.5L16 14L12.5 10.5L16 7ZM21.5 12.5L25 16L21.5 19.5L18 16L21.5 12.5ZM10.5 12.5L14 16L10.5 19.5L7 16L10.5 12.5ZM16 18L19.5 21.5L16 25L12.5 21.5L16 18ZM16 14.2L17.8 16L16 17.8L14.2 16L16 14.2Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'BTC':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#F7931A" />
          <path
            d="M22.5 14C22.5 12.5 21.5 11.8 19.8 11.5V9H18V11.4H16.2V9H14.4V11.4H11V13.2H12.8C13.5 13.2 13.8 13.5 13.8 14V19C13.8 19.5 13.5 19.8 12.8 19.8H11V21.6H14.4V24H16.2V21.6H18V24H19.8V21.6C22 21.3 23.2 20.2 23.2 18.2C23.2 16.8 22.4 15.8 21 15.4C22 14.9 22.5 14.3 22.5 14ZM16.2 13.2H18.5C19.5 13.2 20.2 13.6 20.2 14.6C20.2 15.6 19.5 16 18.5 16H16.2V13.2ZM18.8 19.8H16.2V17H18.8C20 17 20.8 17.5 20.8 18.4C20.8 19.3 20 19.8 18.8 19.8Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'ETH':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#627EEA" />
          <path d="M16 6L9.5 16.8L16 20.6L22.5 16.8L16 6Z" fill="#FFFFFF" fillOpacity="0.85" />
          <path d="M16 20.6L9.5 16.8L16 26L22.5 16.8L16 20.6Z" fill="#FFFFFF" fillOpacity="0.6" />
          <path d="M16 6V20.6L22.5 16.8L16 6Z" fill="#FFFFFF" />
          <path d="M16 20.6V26L22.5 16.8L16 20.6Z" fill="#FFFFFF" fillOpacity="0.8" />
        </svg>
      );

    case 'SOL':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="solGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00FFA3" />
              <stop offset="100%" stopColor="#DC1FFF" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="16" fill="#14141E" />
          <path
            d="M8.5 20.8L11.5 18H23.5L20.5 20.8H8.5ZM8.5 14.9L11.5 12.1H23.5L20.5 14.9H8.5ZM11.5 9H23.5L20.5 11.8H8.5L11.5 9Z"
            fill="url(#solGrad)"
          />
        </svg>
      );

    case 'DOGE':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#C2A633" />
          <path
            d="M12 9H17.5C21 9 23.5 11.5 23.5 16C23.5 20.5 21 23 17.5 23H12V9ZM15 11.5V14.5H19V17H15V20.5H17.2C19.2 20.5 20.8 19 20.8 16C20.8 13 19.2 11.5 17.2 11.5H15Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'XRP':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#23292F" />
          <path
            d="M23 9L19.5 12.5C18.5 13.5 17 14 16 14C15 14 13.5 13.5 12.5 12.5L9 9H7L11.5 13.5C13 15 14.5 15.5 16 15.5C17.5 15.5 19 15 20.5 13.5L25 9H23ZM9 23L12.5 19.5C13.5 18.5 15 18 16 18C17 18 18.5 18.5 19.5 19.5L23 23H25L20.5 18.5C19 17 17.5 16.5 16 16.5C14.5 16.5 13 17 11.5 18.5L7 23H9Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'ADA':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#0033AD" />
          <circle cx="16" cy="16" r="3" fill="#FFFFFF" />
          <circle cx="16" cy="8.5" r="1.5" fill="#FFFFFF" />
          <circle cx="16" cy="23.5" r="1.5" fill="#FFFFFF" />
          <circle cx="8.5" cy="16" r="1.5" fill="#FFFFFF" />
          <circle cx="23.5" cy="16" r="1.5" fill="#FFFFFF" />
          <circle cx="11" cy="11" r="1.2" fill="#FFFFFF" />
          <circle cx="21" cy="21" r="1.2" fill="#FFFFFF" />
          <circle cx="11" cy="21" r="1.2" fill="#FFFFFF" />
          <circle cx="21" cy="11" r="1.2" fill="#FFFFFF" />
        </svg>
      );

    case 'AVAX':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#E84142" />
          <path
            d="M17.5 9.5C16.8 8.3 15.2 8.3 14.5 9.5L8.2 20.8C7.5 22 8.3 23.5 9.7 23.5H22.3C23.7 23.5 24.5 22 23.8 20.8L17.5 9.5ZM16 13L20.2 21H11.8L16 13Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'DOT':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#E6007A" />
          <ellipse cx="16" cy="13" rx="5.5" ry="4" fill="#FFFFFF" />
          <circle cx="16" cy="22" r="2.2" fill="#FFFFFF" />
        </svg>
      );

    case 'LINK':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#375BD2" />
          <path
            d="M16 8L10 11.5V18.5L16 22L22 18.5V11.5L16 8ZM19.5 17L16 19L12.5 17V13L16 11L19.5 13V17Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'NEAR':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#111827" />
          <path
            d="M11 9H13.8L18.8 17.5V9H21V23H18.2L13.2 14.5V23H11V9Z"
            fill="#5F8AFA"
          />
        </svg>
      );

    case 'SUI':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#4DA2FF" />
          <path
            d="M16 8C16 8 10 16 10 19.5C10 22.8 12.7 25.5 16 25.5C19.3 25.5 22 22.8 22 19.5C22 16 16 8 16 8ZM16 23C14.3 23 13 21.7 13 20C13 18.2 14.8 15 16 13C17.2 15 19 18.2 19 20C19 21.7 17.7 23 16 23Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'APT':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#1E293B" />
          <path
            d="M16 7L8 23H11.5L16 14L20.5 23H24L16 7ZM13 18H19L16 12L13 18Z"
            fill="#2ED8A7"
          />
        </svg>
      );

    case 'OP':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#FF0420" />
          <circle cx="13" cy="16" r="4.5" stroke="#FFFFFF" strokeWidth="2.5" />
          <path
            d="M19 11.5H22C23.5 11.5 24.5 12.5 24.5 14C24.5 15.5 23.5 16.5 22 16.5H19V20.5"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'ARB':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#28A0F0" />
          <path
            d="M16 7.5L8.5 20.5H12L16 13.5L20 20.5H23.5L16 7.5ZM13.8 22H18.2L16 18.2L13.8 22Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'LTC':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#345D9D" />
          <path
            d="M13 9H15.5V18.5H20.5V21H11.5L13 15.5H11.5L12 13.5H13.5L14 11.5H12L12.5 9.5H14.5L13 9Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'TON':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#0088CC" />
          <path
            d="M16 7.5L8 12.5L16 25L24 12.5L16 7.5ZM16 10.5L21.5 13.5L16 22L10.5 13.5L16 10.5Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'PEPE':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#42A832" />
          <circle cx="12" cy="13" r="3.5" fill="#FFFFFF" />
          <circle cx="20" cy="13" r="3.5" fill="#FFFFFF" />
          <circle cx="12" cy="13" r="1.5" fill="#000000" />
          <circle cx="20" cy="13" r="1.5" fill="#000000" />
          <path
            d="M10 20C12 22 20 22 22 20"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'SHIB':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#FF6000" />
          <path
            d="M9 10L12 16L16 13L20 16L23 10L20 22H12L9 10Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'RENDER':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="16" fill="#E51B24" />
          <circle cx="16" cy="16" r="6" stroke="#FFFFFF" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="2.5" fill="#FFFFFF" />
        </svg>
      );

    default:
      return null;
  }
}

export const CoinIcon: React.FC<CoinIconProps> = ({
  symbol = 'BTC',
  size = 28,
  className = '',
  style = {},
}) => {
  const base = parseCoinBase(symbol);
  const [loadStep, setLoadStep] = useState<number>(0);

  // Khi prop symbol thay đổi, reset lại trạng thái tải ảnh
  useEffect(() => {
    setLoadStep(0);
  }, [symbol, base]);

  // Ưu tiên 1: Logo cục bộ do người dùng cung cấp
  const localLogo = LOCAL_COIN_LOGOS[base];
  // Ưu tiên 2: CoinCap CDN
  const coinCapUrl = `https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`;

  // Xác định nguồn ảnh theo từng bước
  let currentSrc: string | null = null;
  if (loadStep === 0 && localLogo) {
    currentSrc = localLogo;
  } else if (loadStep <= 1) {
    currentSrc = coinCapUrl;
  } else {
    currentSrc = null;
  }

  // Kiểm tra SVG nội bộ
  const internalSvg = renderCoinSvg(base, size);

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.05)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
        flexShrink: 0,
        position: 'relative',
        ...style,
      }}
    >
      {currentSrc ? (
        <img
          key={`${base}-${currentSrc}`}
          src={currentSrc}
          alt={`${base} logo`}
          onError={() => setLoadStep((prev) => prev + 1)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            display: 'block',
          }}
          loading="eager"
        />
      ) : internalSvg ? (
        internalSvg
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${Math.max(8, Math.floor(size * 0.38))}px`,
            fontWeight: 800,
            color: '#ffffff',
          }}
        >
          {base.slice(0, 3)}
        </div>
      )}
    </div>
  );
};
