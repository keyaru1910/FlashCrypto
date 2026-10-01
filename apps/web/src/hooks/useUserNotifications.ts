'use client';

import { useState, useEffect, useRef } from 'react';

export interface TriggeredAlertNotification {
  type: string;
  id: string;
  symbol: string;
  direction: 'ABOVE' | 'BELOW';
  threshold: string;
  currentPrice: string;
  triggeredAt: number;
  channel: 'BROWSER' | 'TELEGRAM';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useUserNotifications(token: string | null, onAlertReceived?: (alert: TriggeredAlertNotification) => void) {
  const [notifications, setNotifications] = useState<TriggeredAlertNotification[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const onAlertReceivedRef = useRef(onAlertReceived);
  onAlertReceivedRef.current = onAlertReceived;

  useEffect(() => {
    if (!token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const sseUrl = `${API_BASE_URL}/api/v1/me/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setIsConnected(true);
    });

    es.addEventListener('alert', (event) => {
      try {
        const alertData: TriggeredAlertNotification = JSON.parse(event.data);
        setNotifications((prev) => [alertData, ...prev]);

        // Kích hoạt callback / popup thông báo
        if (onAlertReceivedRef.current) {
          onAlertReceivedRef.current(alertData);
        }
      } catch (err) {
        console.error('Lỗi khi phân tích thông báo alert SSE:', err);
      }
    });

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [token]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    isConnected,
    clearNotifications,
  };
}
