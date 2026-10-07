/**
 * Định nghĩa cấu trúc dữ liệu cho công cụ vẽ và đo lường trên biểu đồ FlashCrypto
 */

export type DrawingToolType =
  | 'cursor'
  | 'trendline'
  | 'ray'
  | 'horizontal'
  | 'rectangle'
  | 'fibonacci'
  | 'brush'
  | 'text'
  | 'measure'
  | 'long_position'
  | 'short_position'
  | 'eraser';

export interface ChartPoint {
  time: number; // Unix timestamp tính bằng giây
  price: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface DrawingElement {
  id: string;
  type: DrawingToolType;
  symbol: string;
  color: string;
  lineWidth: number;
  points: ChartPoint[]; // Tọa độ gắn liền với dữ liệu biểu đồ (time, price)
  text?: string;
  extraData?: {
    stopLossPrice?: number;
    takeProfitPrice?: number;
    riskRewardRatio?: number;
    brushPoints?: ChartPoint[];
    fontSize?: number;
  };
}

export interface MeasurementResult {
  barsCount: number;
  timeDiffSeconds: number;
  priceStart: number;
  priceEnd: number;
  priceDelta: number;
  percentChange: number;
}
