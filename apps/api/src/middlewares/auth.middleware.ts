import { Request, Response, NextFunction } from 'express';
import { JwtService, JwtPayload } from '../services/jwt.service.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Middleware kiểm tra và xác thực JWT token của người dùng từ Authorization header hoặc Query param
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Kiểm tra Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Kiểm tra query param token (Hữu ích khi kết nối Server-Sent Events từ trình duyệt)
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      data: null,
      meta: { timestamp: Date.now() },
      error: { message: 'Yêu cầu đăng nhập để thực hiện hành động này.' },
    });
  }

  const payload = JwtService.verify(token);
  if (!payload) {
    return res.status(401).json({
      data: null,
      meta: { timestamp: Date.now() },
      error: { message: 'Token không hợp lệ hoặc đã hết hạn.' },
    });
  }

  req.user = payload;
  next();
}
