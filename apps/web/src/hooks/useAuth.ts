'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  telegramChatId?: string | null;
  activeAlertsCount?: number;
  createdAt?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Tải token từ localStorage khi khởi động
  useEffect(() => {
    const savedToken = localStorage.getItem('fc_token');
    const savedUser = localStorage.getItem('fc_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('fc_token');
        localStorage.removeItem('fc_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error?.message || 'Đăng nhập không thành công' };
      }

      const { user: userData, token: tokenData } = json.data;
      setUser(userData);
      setToken(tokenData);
      localStorage.setItem('fc_token', tokenData);
      localStorage.setItem('fc_user', JSON.stringify(userData));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi kết nối máy chủ' };
    }
  };

  const register = async (
    email: string,
    password: string,
    telegramChatId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, telegramChatId }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error?.message || 'Đăng ký không thành công' };
      }

      const { user: userData, token: tokenData } = json.data;
      setUser(userData);
      setToken(tokenData);
      localStorage.setItem('fc_token', tokenData);
      localStorage.setItem('fc_user', JSON.stringify(userData));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Lỗi mạng khi đăng ký' };
    }
  };

  /**
   * Tạo nhanh tài khoản Demo cho người dùng dùng thử ngay tức thì
   */
  const quickDemoLogin = async (): Promise<{ success: boolean; error?: string }> => {
    const randomId = Math.random().toString(36).substring(2, 7);
    const demoEmail = `trader_${randomId}@flashcrypto.io`;
    const demoPassword = `DemoPass@${randomId}123`;
    return register(demoEmail, demoPassword);
  };

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('fc_token');
    localStorage.removeItem('fc_user');
  }, []);

  return {
    user,
    token,
    isLoading,
    login,
    register,
    quickDemoLogin,
    logout,
  };
}
