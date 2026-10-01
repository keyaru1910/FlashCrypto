import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlashCrypto — Real-time Crypto Price & Alert Dashboard',
  description:
    'Real-time Crypto Price & Candlestick Streaming Dashboard with high-performance $O(\\log N)$ price alert engine.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
