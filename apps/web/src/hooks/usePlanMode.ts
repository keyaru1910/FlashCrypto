import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlanModeAccount,
  SimulatedPosition,
  SimulatedOrder,
  SimulatedTradeHistory,
  PositionSide,
  CloseReason,
} from '../types/planMode';
import { CryptoPriceData } from './useCryptoStream';

const STORAGE_KEY = 'flashcrypto_plan_mode_account_v1';
const DEFAULT_INITIAL_BALANCE = 10000; // 10,000 USDT ảo ban đầu

export function usePlanMode(realtimePrices: Record<string, CryptoPriceData>) {
  const [isPlanModeActive, setIsPlanModeActive] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [account, setAccount] = useState<PlanModeAccount>({
    balance: DEFAULT_INITIAL_BALANCE,
    initialBalance: DEFAULT_INITIAL_BALANCE,
    positions: [],
    orders: [],
    history: [],
  });

  // Tải dữ liệu từ LocalStorage sau khi component mounted trên client để tránh lỗi Hydration Mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAccount(JSON.parse(saved));
      }
    } catch (err) {
      console.warn('Không thể đọc dữ liệu Plan Mode từ LocalStorage:', err);
    }
    setIsLoaded(true);
  }, []);

  // Tự động lưu trữ vào LocalStorage khi account thay đổi (chỉ lưu sau khi đã nạp dữ liệu ban đầu)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } catch (err) {
      console.warn('Lỗi lưu Plan Mode vào LocalStorage:', err);
    }
  }, [account, isLoaded]);

  /**
   * Nạp thêm tiền hoặc Đặt lại số dư không giới hạn
   * @param newBalance Số tiền USDT muốn reset hoặc nạp
   * @param keepPositions Có giữ lại các vị thế đang mở hay xóa sạch
   */
  const resetBalance = useCallback((newBalance: number = 10000, keepPositions: boolean = false) => {
    setAccount((prev) => ({
      balance: newBalance,
      initialBalance: newBalance,
      positions: keepPositions ? prev.positions : [],
      orders: keepPositions ? prev.orders : [],
      history: keepPositions ? prev.history : [],
    }));
  }, []);

  /**
   * Tính toán giá thanh lý (Liquidation Price) ước tính
   */
  const calculateLiquidationPrice = (
    side: PositionSide,
    entryPrice: number,
    leverage: number
  ): number => {
    const maintenanceMarginRatio = 0.005; // 0.5%
    if (side === 'LONG') {
      return entryPrice * (1 - 1 / leverage + maintenanceMarginRatio);
    } else {
      return entryPrice * (1 + 1 / leverage - maintenanceMarginRatio);
    }
  };

  /**
   * Đặt Lệnh Thị Trường (Market Order) - Khớp lệnh ngay lập tức
   */
  const openMarketOrder = useCallback(
    (params: {
      symbol: string;
      side: PositionSide;
      margin: number;
      leverage: number;
      currentPrice: number;
      takeProfitPrice?: number;
      stopLossPrice?: number;
    }) => {
      const { symbol, side, margin, leverage, currentPrice, takeProfitPrice, stopLossPrice } = params;

      if (margin <= 0 || currentPrice <= 0) {
        return { success: false, message: 'Số tiền ký quỹ hoặc giá không hợp lệ' };
      }

      if (account.balance < margin) {
        return { success: false, message: 'Số dư khả dụng không đủ để mở vị thế này' };
      }

      const positionSizeUsdt = margin * leverage;
      const amount = positionSizeUsdt / currentPrice;
      const liquidationPrice = calculateLiquidationPrice(side, currentPrice, leverage);

      const newPosition: SimulatedPosition = {
        id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        symbol,
        side,
        entryPrice: currentPrice,
        amount,
        margin,
        leverage,
        takeProfitPrice,
        stopLossPrice,
        liquidationPrice,
        openTime: Date.now(),
        updatedTime: Date.now(),
      };

      setAccount((prev) => ({
        ...prev,
        balance: Number((prev.balance - margin).toFixed(2)),
        positions: [newPosition, ...prev.positions],
      }));

      return { success: true, position: newPosition };
    },
    [account.balance]
  );

  /**
   * Đặt Lệnh Giới Hạn (Limit Order) - Chờ giá thị trường chạm mốc để khớp
   */
  const placeLimitOrder = useCallback(
    (params: {
      symbol: string;
      side: PositionSide;
      margin: number;
      leverage: number;
      targetPrice: number;
      takeProfitPrice?: number;
      stopLossPrice?: number;
    }) => {
      const { symbol, side, margin, leverage, targetPrice, takeProfitPrice, stopLossPrice } = params;

      if (margin <= 0 || targetPrice <= 0) {
        return { success: false, message: 'Thông số lệnh không hợp lệ' };
      }

      if (account.balance < margin) {
        return { success: false, message: 'Số dư khả dụng không đủ để đặt lệnh này' };
      }

      const newOrder: SimulatedOrder = {
        id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        symbol,
        side,
        orderType: 'LIMIT',
        targetPrice,
        margin,
        leverage,
        takeProfitPrice,
        stopLossPrice,
        createdAt: Date.now(),
      };

      setAccount((prev) => ({
        ...prev,
        balance: Number((prev.balance - margin).toFixed(2)),
        orders: [newOrder, ...prev.orders],
      }));

      return { success: true, order: newOrder };
    },
    [account.balance]
  );

  /**
   * Hủy Lệnh Chờ (Cancel Limit Order) - Hoàn lại ký quỹ về số dư
   */
  const cancelLimitOrder = useCallback((orderId: string) => {
    setAccount((prev) => {
      const targetOrder = prev.orders.find((o) => o.id === orderId);
      if (!targetOrder) return prev;

      return {
        ...prev,
        balance: Number((prev.balance + targetOrder.margin).toFixed(2)),
        orders: prev.orders.filter((o) => o.id !== orderId),
      };
    });
  }, []);

  /**
   * Đóng vị thế (Close Position) - Tính toán Lãi/Lỗ ròng và cập nhật lịch sử
   */
  const closePosition = useCallback(
    (positionId: string, closePrice: number, reason: CloseReason = 'MANUAL') => {
      setAccount((prev) => {
        const position = prev.positions.find((p) => p.id === positionId);
        if (!position) return prev;

        let pnl = 0;
        const totalSize = position.amount * position.entryPrice;

        if (position.side === 'LONG') {
          pnl = (closePrice - position.entryPrice) * position.amount;
        } else {
          pnl = (position.entryPrice - closePrice) * position.amount;
        }

        const roiPercent = (pnl / position.margin) * 100;
        const returnedCapital = Math.max(0, position.margin + pnl);

        const historyItem: SimulatedTradeHistory = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          symbol: position.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          closePrice,
          amount: position.amount,
          margin: position.margin,
          leverage: position.leverage,
          pnl: Number(pnl.toFixed(2)),
          roiPercent: Number(roiPercent.toFixed(2)),
          closeReason: reason,
          openTime: position.openTime,
          closeTime: Date.now(),
        };

        return {
          ...prev,
          balance: Number((prev.balance + returnedCapital).toFixed(2)),
          positions: prev.positions.filter((p) => p.id !== positionId),
          history: [historyItem, ...prev.history],
        };
      });
    },
    []
  );

  /**
   * Tự động kiểm tra khớp lệnh Limit và kiểm tra TP/SL/Thanh lý theo thời gian thực
   */
  useEffect(() => {
    if (!realtimePrices || Object.keys(realtimePrices).length === 0) return;

    setAccount((prev) => {
      let isUpdated = false;
      let nextBalance = prev.balance;
      let nextPositions = [...prev.positions];
      let nextOrders = [...prev.orders];
      let nextHistory = [...prev.history];

      // 1. Kiểm tra khớp các lệnh Limit Orders
      const remainingOrders: SimulatedOrder[] = [];
      for (const order of nextOrders) {
        const priceInfo = realtimePrices[order.symbol];
        if (!priceInfo) {
          remainingOrders.push(order);
          continue;
        }

        const currentPrice = parseFloat(priceInfo.price);
        let triggered = false;

        // Long Limit khớp khi giá thị trường <= giá đặt
        if (order.side === 'LONG' && currentPrice <= order.targetPrice) {
          triggered = true;
        }
        // Short Limit khớp khi giá thị trường >= giá đặt
        if (order.side === 'SHORT' && currentPrice >= order.targetPrice) {
          triggered = true;
        }

        if (triggered) {
          isUpdated = true;
          const positionSizeUsdt = order.margin * order.leverage;
          const amount = positionSizeUsdt / currentPrice;
          const liquidationPrice = calculateLiquidationPrice(order.side, currentPrice, order.leverage);

          const newPosition: SimulatedPosition = {
            id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            symbol: order.symbol,
            side: order.side,
            entryPrice: currentPrice,
            amount,
            margin: order.margin,
            leverage: order.leverage,
            takeProfitPrice: order.takeProfitPrice,
            stopLossPrice: order.stopLossPrice,
            liquidationPrice,
            openTime: Date.now(),
            updatedTime: Date.now(),
          };

          nextPositions.unshift(newPosition);
        } else {
          remainingOrders.push(order);
        }
      }
      nextOrders = remainingOrders;

      // 2. Kiểm tra Take Profit, Stop Loss và Thanh lý cho các Positions đang mở
      const remainingPositions: SimulatedPosition[] = [];
      for (const pos of nextPositions) {
        const priceInfo = realtimePrices[pos.symbol];
        if (!priceInfo) {
          remainingPositions.push(pos);
          continue;
        }

        const currentPrice = parseFloat(priceInfo.price);
        let shouldClose = false;
        let reason: CloseReason = 'MANUAL';

        if (pos.side === 'LONG') {
          // Kiểm tra chốt lời
          if (pos.takeProfitPrice && currentPrice >= pos.takeProfitPrice) {
            shouldClose = true;
            reason = 'TAKE_PROFIT';
          }
          // Kiểm tra cắt lỗ
          else if (pos.stopLossPrice && currentPrice <= pos.stopLossPrice) {
            shouldClose = true;
            reason = 'STOP_LOSS';
          }
          // Kiểm tra thanh lý
          else if (currentPrice <= pos.liquidationPrice) {
            shouldClose = true;
            reason = 'LIQUIDATION';
          }
        } else {
          // SHORT
          if (pos.takeProfitPrice && currentPrice <= pos.takeProfitPrice) {
            shouldClose = true;
            reason = 'TAKE_PROFIT';
          } else if (pos.stopLossPrice && currentPrice >= pos.stopLossPrice) {
            shouldClose = true;
            reason = 'STOP_LOSS';
          } else if (currentPrice >= pos.liquidationPrice) {
            shouldClose = true;
            reason = 'LIQUIDATION';
          }
        }

        if (shouldClose) {
          isUpdated = true;
          let pnl = 0;
          if (pos.side === 'LONG') {
            pnl = (currentPrice - pos.entryPrice) * pos.amount;
          } else {
            pnl = (pos.entryPrice - currentPrice) * pos.amount;
          }

          if (reason === 'LIQUIDATION') {
            pnl = -pos.margin; // Mất toàn bộ ký quỹ khi thanh lý
          }

          const roiPercent = (pnl / pos.margin) * 100;
          const returnedCapital = Math.max(0, pos.margin + pnl);

          nextBalance = Number((nextBalance + returnedCapital).toFixed(2));
          nextHistory.unshift({
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            symbol: pos.symbol,
            side: pos.side,
            entryPrice: pos.entryPrice,
            closePrice: currentPrice,
            amount: pos.amount,
            margin: pos.margin,
            leverage: pos.leverage,
            pnl: Number(pnl.toFixed(2)),
            roiPercent: Number(roiPercent.toFixed(2)),
            closeReason: reason,
            openTime: pos.openTime,
            closeTime: Date.now(),
          });
        } else {
          remainingPositions.push(pos);
        }
      }
      nextPositions = remainingPositions;

      if (!isUpdated) return prev;

      return {
        ...prev,
        balance: nextBalance,
        positions: nextPositions,
        orders: nextOrders,
        history: nextHistory,
      };
    });
  }, [realtimePrices]);

  /**
   * Tính toán PnL tạm tính và Tổng tài sản thực tế theo thời gian thực
   */
  const calculateTotalPortfolioValue = useCallback(() => {
    let totalUnrealizedPnL = 0;
    let totalMarginInUse = 0;

    account.positions.forEach((pos) => {
      totalMarginInUse += pos.margin;
      const priceInfo = realtimePrices[pos.symbol];
      if (priceInfo) {
        const currentPrice = parseFloat(priceInfo.price);
        const pnl =
          pos.side === 'LONG'
            ? (currentPrice - pos.entryPrice) * pos.amount
            : (pos.entryPrice - currentPrice) * pos.amount;
        totalUnrealizedPnL += pnl;
      }
    });

    const totalEquity = account.balance + totalMarginInUse + totalUnrealizedPnL;

    return {
      totalEquity: Number(totalEquity.toFixed(2)),
      totalMarginInUse: Number(totalMarginInUse.toFixed(2)),
      totalUnrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
    };
  }, [account, realtimePrices]);

  return {
    isPlanModeActive,
    setIsPlanModeActive,
    account,
    resetBalance,
    openMarketOrder,
    placeLimitOrder,
    cancelLimitOrder,
    closePosition,
    calculateTotalPortfolioValue,
  };
}
