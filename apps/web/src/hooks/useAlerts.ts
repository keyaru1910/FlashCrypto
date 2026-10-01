'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AlertItem {
  id: string;
  symbol: string;
  direction: 'ABOVE' | 'BELOW';
  threshold: string;
  status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';
  channel: 'BROWSER' | 'TELEGRAM';
  createdAt: string;
  triggeredAt?: string | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useAlerts(token: string | null) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!token) {
      setAlerts([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/alerts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.data) {
        setAlerts(json.data);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách cảnh báo');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = async (params: {
    symbol: string;
    direction: 'ABOVE' | 'BELOW';
    threshold: number | string;
    channel?: 'BROWSER' | 'TELEGRAM';
  }): Promise<{ success: boolean; data?: AlertItem; error?: string }> => {
    if (!token) {
      return { success: false, error: 'Vui lòng đăng nhập để đặt cảnh báo' };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error?.message || 'Tạo cảnh báo không thành công' };
      }

      const newAlert: AlertItem = json.data;
      setAlerts((prev) => [newAlert, ...prev]);
      return { success: true, data: newAlert };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi tạo cảnh báo' };
    }
  };

  const deleteAlert = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Chưa đăng nhập' };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/alerts/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error?.message || 'Không thể hủy cảnh báo' };
      }

      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'CANCELLED' as const } : a))
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi khi hủy cảnh báo' };
    }
  };

  return {
    alerts,
    isLoading,
    error,
    fetchAlerts,
    createAlert,
    deleteAlert,
  };
}
