/**
 * Định nghĩa cấu trúc dữ liệu cho Chế độ Đầu tư Thử Nghiệm (Plan Mode / Paper Trading)
 */

export type PositionSide = 'LONG' | 'SHORT';
export type OrderType = 'MARKET' | 'LIMIT';
export type CloseReason = 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATION';

export interface SimulatedPosition {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  amount: number; // Khối lượng tài sản (Coin)
  margin: number; // Số vốn ký quỹ (USDT)
  leverage: number; // Đòn bẩy (1x -> 50x)
  takeProfitPrice?: number;
  stopLossPrice?: number;
  liquidationPrice: number;
  openTime: number; // Timestamp ms
  updatedTime: number;
}

export interface SimulatedOrder {
  id: string;
  symbol: string;
  side: PositionSide;
  orderType: 'LIMIT';
  targetPrice: number;
  margin: number;
  leverage: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  createdAt: number;
}

export interface SimulatedTradeHistory {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  closePrice: number;
  amount: number;
  margin: number;
  leverage: number;
  pnl: number; // Lãi/Lỗ ròng (USDT)
  roiPercent: number; // % Lợi nhuận trên vốn ký quỹ
  closeReason: CloseReason;
  openTime: number;
  closeTime: number;
}

export interface PlanModeAccount {
  balance: number; // Số dư khả dụng (USDT)
  initialBalance: number;
  positions: SimulatedPosition[];
  orders: SimulatedOrder[];
  history: SimulatedTradeHistory[];
}
