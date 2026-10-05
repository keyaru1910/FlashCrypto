/**
 * Tiện ích tính toán các chỉ báo kỹ thuật (Technical Indicators)
 * Phục vụ biểu đồ phân tích kỹ thuật FlashCrypto
 */

import { UTCTimestamp } from 'lightweight-charts';
import { ChartCandle } from '../hooks/useCandleStream';

export interface IndicatorPoint {
  time: UTCTimestamp;
  value: number;
}

export interface BollingerBandsPoint {
  time: UTCTimestamp;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdPoint {
  time: UTCTimestamp;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Tính toán Đường trung bình động đơn giản (Simple Moving Average - SMA)
 * @param candles Danh sách nến
 * @param period Chu kỳ (ví dụ: 20, 50)
 */
export function calculateSMA(candles: ChartCandle[], period: number = 20): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (candles.length < period) return result;

  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;

    if (i >= period) {
      sum -= candles[i - period].close;
    }

    if (i >= period - 1) {
      const sma = sum / period;
      result.push({
        time: candles[i].time as UTCTimestamp,
        value: Number(sma.toFixed(4)),
      });
    }
  }

  return result;
}

/**
 * Tính toán Đường trung bình động hàm mũ (Exponential Moving Average - EMA)
 * @param candles Danh sách nến
 * @param period Chu kỳ (ví dụ: 9, 21, 200)
 */
export function calculateEMA(candles: ChartCandle[], period: number = 20): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (candles.length < period) return result;

  const multiplier = 2 / (period + 1);

  // Tính SMA ban đầu làm giá trị khởi điểm cho EMA
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += candles[i].close;
  }
  let prevEma = initialSum / period;

  result.push({
    time: candles[period - 1].time as UTCTimestamp,
    value: Number(prevEma.toFixed(4)),
  });

  for (let i = period; i < candles.length; i++) {
    const currentClose = candles[i].close;
    const currentEma = (currentClose - prevEma) * multiplier + prevEma;
    result.push({
      time: candles[i].time as UTCTimestamp,
      value: Number(currentEma.toFixed(4)),
    });
    prevEma = currentEma;
  }

  return result;
}

/**
 * Tính toán Dải Bollinger Bands (BB 20, 2)
 * @param candles Danh sách nến
 * @param period Chu kỳ (mặc định 20)
 * @param stdDevMultiplier Độ lệch chuẩn (mặc định 2)
 */
export function calculateBollingerBands(
  candles: ChartCandle[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBandsPoint[] {
  const result: BollingerBandsPoint[] = [];
  if (candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    const windowSlice = candles.slice(i - period + 1, i + 1);
    const mean = windowSlice.reduce((acc, c) => acc + c.close, 0) / period;

    const variance =
      windowSlice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = mean + stdDevMultiplier * stdDev;
    const lower = mean - stdDevMultiplier * stdDev;

    result.push({
      time: candles[i].time as UTCTimestamp,
      upper: Number(upper.toFixed(4)),
      middle: Number(mean.toFixed(4)),
      lower: Number(lower.toFixed(4)),
    });
  }

  return result;
}

/**
 * Tính toán Chỉ số sức mạnh tương đối (Relative Strength Index - RSI)
 * @param candles Danh sách nến
 * @param period Chu kỳ RSI (mặc định 14)
 */
export function calculateRSI(candles: ChartCandle[], period: number = 14): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (candles.length <= period) return result;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const difference = candles[i].close - candles[i - 1].close;
    if (difference >= 0) {
      gains.push(difference);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(difference));
    }
  }

  // Tính trung bình tăng/giảm chu kỳ đầu tiên
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  result.push({
    time: candles[period].time as UTCTimestamp,
    value: Number(rsi.toFixed(2)),
  });

  // Áp dụng kỹ thuật làm mượt Wilder's Smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    result.push({
      time: candles[i + 1].time as UTCTimestamp,
      value: Number(rsi.toFixed(2)),
    });
  }

  return result;
}

/**
 * Tính toán Phân kỳ hội tụ đường trung bình động (MACD 12, 26, 9)
 * @param candles Danh sách nến
 * @param fastPeriod Chu kỳ nhanh (12)
 * @param slowPeriod Chu kỳ chậm (26)
 * @param signalPeriod Chu kỳ đường tín hiệu (9)
 */
export function calculateMACD(
  candles: ChartCandle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdPoint[] {
  const result: MacdPoint[] = [];
  if (candles.length < slowPeriod + signalPeriod) return result;

  const fastEma = calculateEMA(candles, fastPeriod);
  const slowEma = calculateEMA(candles, slowPeriod);

  // Ghép nối hai đường EMA để tính đường MACD Line
  const slowMap = new Map<number, number>();
  slowEma.forEach((item) => slowMap.set(item.time as number, item.value));

  const macdLinePoints: { time: UTCTimestamp; value: number }[] = [];
  fastEma.forEach((fastItem) => {
    const slowVal = slowMap.get(fastItem.time as number);
    if (slowVal !== undefined) {
      macdLinePoints.push({
        time: fastItem.time,
        value: Number((fastItem.value - slowVal).toFixed(4)),
      });
    }
  });

  if (macdLinePoints.length < signalPeriod) return result;

  // Tính EMA 9 của MACD Line để ra Signal Line
  const multiplier = 2 / (signalPeriod + 1);
  let initialSignalSum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    initialSignalSum += macdLinePoints[i].value;
  }
  let prevSignal = initialSignalSum / signalPeriod;

  const firstMacd = macdLinePoints[signalPeriod - 1].value;
  result.push({
    time: macdLinePoints[signalPeriod - 1].time,
    macd: firstMacd,
    signal: Number(prevSignal.toFixed(4)),
    histogram: Number((firstMacd - prevSignal).toFixed(4)),
  });

  for (let i = signalPeriod; i < macdLinePoints.length; i++) {
    const currentMacd = macdLinePoints[i].value;
    const currentSignal = (currentMacd - prevSignal) * multiplier + prevSignal;
    const histogram = currentMacd - currentSignal;

    result.push({
      time: macdLinePoints[i].time,
      macd: currentMacd,
      signal: Number(currentSignal.toFixed(4)),
      histogram: Number(histogram.toFixed(4)),
    });

    prevSignal = currentSignal;
  }

  return result;
}
