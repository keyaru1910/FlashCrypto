'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import {
  DrawingToolType,
  DrawingElement,
  ChartPoint,
  PixelPoint,
  MeasurementResult,
} from '../types/drawing';
import { ChartCandle } from '../hooks/useCandleStream';

interface DrawingOverlayProps {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  symbol: string;
  selectedTool: DrawingToolType;
  setSelectedTool: (tool: DrawingToolType) => void;
  candles: ChartCandle[];
  drawings: DrawingElement[];
  setDrawings: React.Dispatch<React.SetStateAction<DrawingElement[]>>;
}

const FIBONACCI_LEVELS = [
  { level: 0, color: '#94a3b8', label: '0.0% (Đáy/Đỉnh)' },
  { level: 0.236, color: '#06b6d4', label: '23.6%' },
  { level: 0.382, color: '#3b82f6', label: '38.2%' },
  { level: 0.5, color: '#10b981', label: '50.0% (Cân bằng)' },
  { level: 0.618, color: '#f59e0b', label: '61.8% (Tỷ lệ Vàng)' },
  { level: 0.786, color: '#ec4899', label: '78.6%' },
  { level: 1.0, color: '#ef4444', label: '100.0% (Đỉnh/Đáy)' },
];

/**
 * Tính khoảng cách từ 1 điểm đến 1 đoạn thẳng
 */
function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function DrawingOverlay({
  chart,
  series,
  symbol,
  selectedTool,
  setSelectedTool,
  candles,
  drawings,
  setDrawings,
}: DrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<ChartPoint[]>([]);
  const [previewPoint, setPreviewPoint] = useState<ChartPoint | null>(null);
  const [brushStroke, setBrushStroke] = useState<ChartPoint[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number; point: ChartPoint } | null>(null);
  const [textValue, setTextValue] = useState('');

  // Vị trí con trỏ Cục Tẩy (Eraser Cursor Position)
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);
  const [isErasing, setIsErasing] = useState(false);

  // Chuyển đổi từ Pixel (X, Y) sang Tọa độ Nến/Giá (Time, Price)
  const pixelToChartPoint = useCallback(
    (x: number, y: number): ChartPoint | null => {
      if (!chart || !series || candles.length === 0) return null;

      const timeScale = chart.timeScale();
      const time = timeScale.coordinateToTime(x) as number | null;
      const price = series.coordinateToPrice(y) as number | null;

      if (price === null) return null;

      let validTime = time;
      if (!validTime) {
        validTime = candles[candles.length - 1].time;
      }

      return {
        time: Number(validTime),
        price: Number(price.toFixed(4)),
      };
    },
    [chart, series, candles]
  );

  // Chuyển đổi từ Tọa độ Nến/Giá sang Tọa độ Pixel (X, Y)
  const chartPointToPixel = useCallback(
    (point: ChartPoint): PixelPoint | null => {
      if (!chart || !series) return null;

      const timeScale = chart.timeScale();
      const x = timeScale.timeToCoordinate(point.time as any);
      const y = series.priceToCoordinate(point.price);

      if (x === null || y === null) return null;

      return { x, y };
    },
    [chart, series]
  );

  /**
   * Tính toán kết quả đo lường (Measurement Tool)
   */
  const calculateMeasurement = (p1: ChartPoint, p2: ChartPoint): MeasurementResult => {
    const timeStart = Math.min(p1.time, p2.time);
    const timeEnd = Math.max(p1.time, p2.time);
    const timeDiffSeconds = timeEnd - timeStart;

    const barsCount = candles.filter((c) => c.time >= timeStart && c.time <= timeEnd).length || 1;
    const priceStart = p1.price;
    const priceEnd = p2.price;
    const priceDelta = priceEnd - priceStart;
    const percentChange = priceStart > 0 ? (priceDelta / priceStart) * 100 : 0;

    return {
      barsCount,
      timeDiffSeconds,
      priceStart,
      priceEnd,
      priceDelta,
      percentChange,
    };
  };

  /**
   * Thuật toán Tẩy Xóa (Eraser Engine):
   * Quét và xóa các phần tử hoặc các nét vẽ nhỏ nằm trong bán kính tẩy
   */
  const eraseAtPixel = useCallback(
    (mouseX: number, mouseY: number, radius = 16) => {
      setDrawings((prev) => {
        let hasChanges = false;
        const nextDrawings: DrawingElement[] = [];

        for (const elem of prev) {
          if (elem.symbol !== symbol) {
            nextDrawings.push(elem);
            continue;
          }

          // 1. Tẩy từng phần nhỏ của nét cọ vẽ (Brush)
          if (elem.type === 'brush') {
            const rawPts = elem.extraData?.brushPoints || elem.points;
            const remainingPts: ChartPoint[] = [];

            let removedCount = 0;
            for (const pt of rawPts) {
              const pix = chartPointToPixel(pt);
              if (pix && Math.hypot(pix.x - mouseX, pix.y - mouseY) <= radius) {
                removedCount++;
              } else {
                remainingPts.push(pt);
              }
            }

            if (removedCount > 0) {
              hasChanges = true;
              if (remainingPts.length >= 2) {
                nextDrawings.push({
                  ...elem,
                  points: [remainingPts[0]],
                  extraData: { ...elem.extraData, brushPoints: remainingPts },
                });
              }
              // Nếu nét cọ bị xóa hết điểm thì bỏ qua không thêm vào nextDrawings
              continue;
            } else {
              nextDrawings.push(elem);
              continue;
            }
          }

          // 2. Tẩy đường xu hướng (Trendline) hoặc Tia (Ray)
          if (elem.type === 'trendline' || elem.type === 'ray') {
            if (elem.points.length >= 2) {
              const p1 = chartPointToPixel(elem.points[0]);
              const p2 = chartPointToPixel(elem.points[1]);
              if (p1 && p2) {
                const dist = distanceToSegment(mouseX, mouseY, p1.x, p1.y, p2.x, p2.y);
                if (dist <= radius) {
                  hasChanges = true;
                  continue; // Xóa hình này
                }
              }
            }
          }

          // 3. Tẩy đường giá ngang (Horizontal Line)
          if (elem.type === 'horizontal' && elem.points.length >= 1) {
            const p = chartPointToPixel(elem.points[0]);
            if (p && Math.abs(mouseY - p.y) <= radius) {
              hasChanges = true;
              continue;
            }
          }

          // 4. Tẩy hình hộp chữ nhật (Rectangle)
          if (elem.type === 'rectangle' && elem.points.length >= 2) {
            const p1 = chartPointToPixel(elem.points[0]);
            const p2 = chartPointToPixel(elem.points[1]);
            if (p1 && p2) {
              const minX = Math.min(p1.x, p2.x);
              const maxX = Math.max(p1.x, p2.x);
              const minY = Math.min(p1.y, p2.y);
              const maxY = Math.max(p1.y, p2.y);

              if (
                mouseX >= minX - radius &&
                mouseX <= maxX + radius &&
                mouseY >= minY - radius &&
                mouseY <= maxY + radius
              ) {
                hasChanges = true;
                continue;
              }
            }
          }

          // 5. Tẩy Fibonacci
          if (elem.type === 'fibonacci' && elem.points.length >= 2) {
            const p1 = chartPointToPixel(elem.points[0]);
            const p2 = chartPointToPixel(elem.points[1]);
            if (p1 && p2) {
              const priceDiff = elem.points[1].price - elem.points[0].price;
              let isHit = false;

              for (const fib of FIBONACCI_LEVELS) {
                const fibPrice = elem.points[0].price + priceDiff * fib.level;
                const fibPixel = chartPointToPixel({ time: elem.points[0].time, price: fibPrice });
                if (fibPixel && Math.abs(mouseY - fibPixel.y) <= radius) {
                  isHit = true;
                  break;
                }
              }

              if (isHit) {
                hasChanges = true;
                continue;
              }
            }
          }

          // 6. Tẩy Thước đo (Measure) hoặc Vị thế (Long / Short Position) hoặc Ghi chú chữ (Text)
          if (
            elem.type === 'measure' ||
            elem.type === 'long_position' ||
            elem.type === 'short_position' ||
            elem.type === 'text'
          ) {
            if (elem.points.length >= 1) {
              const p = chartPointToPixel(elem.points[0]);
              if (p && Math.hypot(p.x - mouseX, p.y - mouseY) <= radius * 2.5) {
                hasChanges = true;
                continue;
              }
            }
          }

          nextDrawings.push(elem);
        }

        return hasChanges ? nextDrawings : prev;
      });
    },
    [symbol, chartPointToPixel]
  );

  /**
   * Xử lý vẽ lại toàn bộ Canvas
   */
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Vẽ các hình đã lưu
    const symbolDrawings = drawings.filter((d) => d.symbol === symbol);

    symbolDrawings.forEach((elem) => {
      const isSelected = elem.id === selectedDrawingId;

      switch (elem.type) {
        case 'trendline':
        case 'ray': {
          if (elem.points.length < 2) break;
          const p1 = chartPointToPixel(elem.points[0]);
          const p2 = chartPointToPixel(elem.points[1]);
          if (!p1 || !p2) break;

          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = isSelected ? '#a855f7' : elem.color;
          ctx.lineWidth = isSelected ? elem.lineWidth + 1 : elem.lineWidth;

          if (elem.type === 'ray') {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            if (dx !== 0) {
              const slope = dy / dx;
              const targetX = canvas.width;
              const targetY = p1.y + slope * (targetX - p1.x);
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(targetX, targetY);
            } else {
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
            }
          } else {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
          ctx.stroke();

          ctx.fillStyle = isSelected ? '#a855f7' : elem.color;
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
          ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'horizontal': {
          if (elem.points.length < 1) break;
          const p = chartPointToPixel(elem.points[0]);
          if (!p) break;

          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = isSelected ? '#a855f7' : elem.color;
          ctx.lineWidth = elem.lineWidth;
          ctx.setLineDash([4, 4]);
          ctx.moveTo(0, p.y);
          ctx.lineTo(canvas.width, p.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = elem.color;
          ctx.font = '11px Inter, sans-serif';
          const priceLabel = ` ${elem.points[0].price.toFixed(2)} `;
          const textWidth = ctx.measureText(priceLabel).width;
          ctx.fillRect(canvas.width - textWidth - 10, p.y - 10, textWidth + 8, 20);
          ctx.fillStyle = '#0f172a';
          ctx.fillText(priceLabel, canvas.width - textWidth - 6, p.y + 4);
          ctx.restore();
          break;
        }

        case 'rectangle': {
          if (elem.points.length < 2) break;
          const p1 = chartPointToPixel(elem.points[0]);
          const p2 = chartPointToPixel(elem.points[1]);
          if (!p1 || !p2) break;

          const minX = Math.min(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const width = Math.abs(p2.x - p1.x);
          const height = Math.abs(p2.y - p1.y);

          ctx.save();
          ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
          ctx.fillRect(minX, minY, width, height);
          ctx.strokeStyle = isSelected ? '#a855f7' : elem.color;
          ctx.lineWidth = elem.lineWidth;
          ctx.strokeRect(minX, minY, width, height);
          ctx.restore();
          break;
        }

        case 'fibonacci': {
          if (elem.points.length < 2) break;
          const p1 = chartPointToPixel(elem.points[0]);
          const p2 = chartPointToPixel(elem.points[1]);
          if (!p1 || !p2) break;

          const priceDiff = elem.points[1].price - elem.points[0].price;
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(canvas.width - 20, Math.max(p1.x, p2.x));

          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.setLineDash([2, 2]);
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.setLineDash([]);

          FIBONACCI_LEVELS.forEach((fib) => {
            const fibPrice = elem.points[0].price + priceDiff * fib.level;
            const fibPixel = chartPointToPixel({ time: elem.points[0].time, price: fibPrice });
            if (!fibPixel) return;

            ctx.beginPath();
            ctx.strokeStyle = fib.color;
            ctx.lineWidth = 1.2;
            ctx.moveTo(minX, fibPixel.y);
            ctx.lineTo(maxX, fibPixel.y);
            ctx.stroke();

            ctx.fillStyle = fib.color;
            ctx.font = '10px Inter, sans-serif';
            ctx.fillText(`${fib.label}: ${fibPrice.toFixed(2)}`, minX + 8, fibPixel.y - 4);
          });
          ctx.restore();
          break;
        }

        case 'brush': {
          const brushPts = elem.extraData?.brushPoints || elem.points;
          if (brushPts.length < 2) break;

          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = isSelected ? '#a855f7' : elem.color;
          ctx.lineWidth = elem.lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          let isStarted = false;
          brushPts.forEach((pt) => {
            const pix = chartPointToPixel(pt);
            if (pix) {
              if (!isStarted) {
                ctx.moveTo(pix.x, pix.y);
                isStarted = true;
              } else {
                ctx.lineTo(pix.x, pix.y);
              }
            }
          });
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'text': {
          if (elem.points.length < 1 || !elem.text) break;
          const p = chartPointToPixel(elem.points[0]);
          if (!p) break;

          ctx.save();
          ctx.font = '600 13px Inter, sans-serif';
          const padding = 6;
          const textMetrics = ctx.measureText(elem.text);
          const boxWidth = textMetrics.width + padding * 2;
          const boxHeight = 24;

          ctx.fillStyle = isSelected ? '#4c1d95' : 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = elem.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(p.x, p.y - boxHeight / 2, boxWidth, boxHeight, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(elem.text, p.x + padding, p.y + 4);
          ctx.restore();
          break;
        }

        case 'measure': {
          if (elem.points.length < 2) break;
          const p1 = chartPointToPixel(elem.points[0]);
          const p2 = chartPointToPixel(elem.points[1]);
          if (!p1 || !p2) break;

          const meas = calculateMeasurement(elem.points[0], elem.points[1]);
          const isUp = meas.priceDelta >= 0;

          ctx.save();
          const minX = Math.min(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const width = Math.abs(p2.x - p1.x);
          const height = Math.abs(p2.y - p1.y);

          ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
          ctx.fillRect(minX, minY, width, height);

          ctx.strokeStyle = isUp ? '#10b981' : '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(minX, minY, width, height);

          const centerX = (p1.x + p2.x) / 2;
          const centerY = (p1.y + p2.y) / 2;

          const infoBoxWidth = 170;
          const infoBoxHeight = 56;

          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = isUp ? '#10b981' : '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(
            centerX - infoBoxWidth / 2,
            centerY - infoBoxHeight / 2,
            infoBoxWidth,
            infoBoxHeight,
            8
          );
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillStyle = isUp ? '#10b981' : '#ef4444';
          ctx.fillText(
            `${isUp ? '+' : ''}${meas.percentChange.toFixed(2)}%  (${meas.priceDelta.toFixed(2)} $)`,
            centerX - infoBoxWidth / 2 + 10,
            centerY - infoBoxHeight / 2 + 20
          );

          ctx.font = '11px Inter, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(
            `📊 ${meas.barsCount} nến  •  ${(meas.timeDiffSeconds / 3600).toFixed(1)}h`,
            centerX - infoBoxWidth / 2 + 10,
            centerY - infoBoxHeight / 2 + 40
          );
          ctx.restore();
          break;
        }

        case 'long_position':
        case 'short_position': {
          if (elem.points.length < 2) break;
          const isLong = elem.type === 'long_position';
          const pEntry = chartPointToPixel(elem.points[0]);
          const pTarget = chartPointToPixel(elem.points[1]);
          if (!pEntry || !pTarget) break;

          const entryPrice = elem.points[0].price;
          const targetPrice = elem.points[1].price;
          const diff = Math.abs(targetPrice - entryPrice);

          const stopPrice = isLong ? entryPrice - diff / 2 : entryPrice + diff / 2;
          const pStop = chartPointToPixel({ time: elem.points[0].time, price: stopPrice });
          if (!pStop) break;

          const boxWidth = 140;
          const startX = pEntry.x;

          ctx.save();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.strokeStyle = '#10b981';
          const tpMinY = Math.min(pEntry.y, pTarget.y);
          const tpHeight = Math.abs(pEntry.y - pTarget.y);
          ctx.fillRect(startX, tpMinY, boxWidth, tpHeight);
          ctx.strokeRect(startX, tpMinY, boxWidth, tpHeight);

          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.strokeStyle = '#ef4444';
          const slMinY = Math.min(pEntry.y, pStop.y);
          const slHeight = Math.abs(pEntry.y - pStop.y);
          ctx.fillRect(startX, slMinY, boxWidth, slHeight);
          ctx.strokeRect(startX, slMinY, boxWidth, slHeight);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(`R:R = 2.00 (${isLong ? 'LONG' : 'SHORT'})`, startX + 10, pEntry.y - 4);
          ctx.restore();
          break;
        }
      }
    });

    // 2. Vẽ hình ĐANG VẼ DỞ DANG (Live Preview)
    if (isDrawing && currentPoints.length > 0 && previewPoint) {
      const p1 = chartPointToPixel(currentPoints[0]);
      const p2 = chartPointToPixel(previewPoint);

      if (p1 && p2) {
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);

        if (selectedTool === 'trendline' || selectedTool === 'ray') {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        } else if (selectedTool === 'rectangle') {
          const minX = Math.min(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
          ctx.fillRect(minX, minY, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
          ctx.strokeRect(minX, minY, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
        } else if (selectedTool === 'fibonacci') {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        } else if (selectedTool === 'measure') {
          const meas = calculateMeasurement(currentPoints[0], previewPoint);
          const isUp = meas.priceDelta >= 0;
          ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
          ctx.fillRect(
            Math.min(p1.x, p2.x),
            Math.min(p1.y, p2.y),
            Math.abs(p2.x - p1.x),
            Math.abs(p2.y - p1.y)
          );
        }
        ctx.restore();
      }
    }

    // 3. Vẽ nét cọ vẽ trực tiếp
    if (isDrawing && selectedTool === 'brush' && brushStroke.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let isStarted = false;
      brushStroke.forEach((pt) => {
        const pix = chartPointToPixel(pt);
        if (pix) {
          if (!isStarted) {
            ctx.moveTo(pix.x, pix.y);
            isStarted = true;
          } else {
            ctx.lineTo(pix.x, pix.y);
          }
        }
      });
      ctx.stroke();
      ctx.restore();
    }

    // 4. Vẽ Vòng Tròn Con Trỏ Cục Tẩy (Eraser Ring Indicator)
    if (selectedTool === 'eraser' && eraserPos) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(eraserPos.x, eraserPos.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = isErasing ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.15)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Dấu X nhỏ ở giữa tâm cục tẩy
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      const xSize = 4;
      ctx.beginPath();
      ctx.moveTo(eraserPos.x - xSize, eraserPos.y - xSize);
      ctx.lineTo(eraserPos.x + xSize, eraserPos.y + xSize);
      ctx.moveTo(eraserPos.x + xSize, eraserPos.y - xSize);
      ctx.lineTo(eraserPos.x - xSize, eraserPos.y + xSize);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    chart,
    series,
    symbol,
    drawings,
    selectedDrawingId,
    isDrawing,
    currentPoints,
    previewPoint,
    brushStroke,
    selectedTool,
    eraserPos,
    isErasing,
    chartPointToPixel,
  ]);

  // Lắng nghe sự kiện di chuyển và zoom của biểu đồ
  useEffect(() => {
    if (!chart) return;

    const handleTimeScaleChange = () => {
      requestAnimationFrame(redrawCanvas);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleTimeScaleChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleTimeScaleChange);
    };
  }, [chart, redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Xử lý sự kiện Chuột (Mouse Events)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // XỬ LÝ CỤC TẨY (Eraser Tool)
    if (selectedTool === 'eraser') {
      setIsErasing(true);
      eraseAtPixel(x, y, 16);
      return;
    }

    if (selectedTool === 'cursor') {
      let foundId: string | null = null;
      for (const elem of drawings.filter((d) => d.symbol === symbol)) {
        if (elem.points.length > 0) {
          const p = chartPointToPixel(elem.points[0]);
          if (p && Math.hypot(p.x - x, p.y - y) < 25) {
            foundId = elem.id;
            break;
          }
        }
      }
      setSelectedDrawingId(foundId);
      return;
    }

    const pt = pixelToChartPoint(x, y);
    if (!pt) return;

    if (selectedTool === 'horizontal') {
      const newElem: DrawingElement = {
        id: `draw_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: 'horizontal',
        symbol,
        color: '#f59e0b',
        lineWidth: 1.5,
        points: [pt],
      };
      setDrawings((prev) => [...prev, newElem]);
      setSelectedTool('cursor');
      return;
    }

    if (selectedTool === 'text') {
      setTextInputPos({ x, y, point: pt });
      setTextValue('');
      return;
    }

    if (selectedTool === 'brush') {
      setIsDrawing(true);
      setBrushStroke([pt]);
      return;
    }

    // Các công cụ 2 điểm
    if (!isDrawing) {
      setIsDrawing(true);
      setCurrentPoints([pt]);
      setPreviewPoint(pt);
    } else {
      const completedPoints = [...currentPoints, pt];
      const newElem: DrawingElement = {
        id: `draw_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: selectedTool,
        symbol,
        color:
          selectedTool === 'measure'
            ? '#10b981'
            : selectedTool === 'rectangle'
            ? '#6366f1'
            : '#38bdf8',
        lineWidth: 1.8,
        points: completedPoints,
      };

      setDrawings((prev) => [...prev, newElem]);
      setIsDrawing(false);
      setCurrentPoints([]);
      setPreviewPoint(null);
      setSelectedTool('cursor');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Cập nhật vị trí Cục Tẩy & Tẩy liên tục khi đang kéo chuột
    if (selectedTool === 'eraser') {
      setEraserPos({ x, y });
      if (isErasing) {
        eraseAtPixel(x, y, 16);
      }
      requestAnimationFrame(redrawCanvas);
      return;
    }

    if (!isDrawing) return;

    const pt = pixelToChartPoint(x, y);
    if (!pt) return;

    if (selectedTool === 'brush') {
      setBrushStroke((prev) => [...prev, pt]);
      requestAnimationFrame(redrawCanvas);
      return;
    }

    setPreviewPoint(pt);
    requestAnimationFrame(redrawCanvas);
  };

  const handleMouseUp = () => {
    if (selectedTool === 'eraser') {
      setIsErasing(false);
      return;
    }

    if (selectedTool === 'brush' && isDrawing) {
      if (brushStroke.length > 1) {
        const newElem: DrawingElement = {
          id: `draw_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: 'brush',
          symbol,
          color: '#06b6d4',
          lineWidth: 2,
          points: [brushStroke[0]],
          extraData: { brushPoints: brushStroke },
        };
        setDrawings((prev) => [...prev, newElem]);
      }
      setIsDrawing(false);
      setBrushStroke([]);
      setSelectedTool('cursor');
    }
  };

  const handleMouseLeave = () => {
    if (selectedTool === 'eraser') {
      setEraserPos(null);
      setIsErasing(false);
      requestAnimationFrame(redrawCanvas);
    }
  };

  const handleSaveText = () => {
    if (textInputPos && textValue.trim()) {
      const newElem: DrawingElement = {
        id: `draw_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: 'text',
        symbol,
        color: '#6366f1',
        lineWidth: 1,
        points: [textInputPos.point],
        text: textValue.trim(),
      };
      setDrawings((prev) => [...prev, newElem]);
    }
    setTextInputPos(null);
    setTextValue('');
    setSelectedTool('cursor');
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: selectedTool === 'cursor' && !selectedDrawingId ? 'none' : 'auto',
          cursor: selectedTool === 'cursor' ? 'default' : selectedTool === 'eraser' ? 'none' : 'crosshair',
          zIndex: 5,
        }}
      />

      {/* Modal nhập chữ cho công cụ Text */}
      {textInputPos && (
        <div
          style={{
            position: 'absolute',
            left: `${textInputPos.x}px`,
            top: `${textInputPos.y}px`,
            zIndex: 20,
            background: '#0f172a',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid var(--accent-indigo)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            gap: '8px',
          }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Nhập ghi chú nến/vùng giá..."
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveText();
              if (e.key === 'Escape') setTextInputPos(null);
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              width: '200px',
            }}
          />
          <button
            onClick={handleSaveText}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'var(--accent-indigo)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            Lưu
          </button>
        </div>
      )}
    </>
  );
}
