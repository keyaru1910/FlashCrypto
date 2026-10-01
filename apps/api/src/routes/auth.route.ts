import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@flashcrypto/db';
import { JwtService } from '../services/jwt.service.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * POST /auth/register: Đăng ký tài khoản mới
   */
  router.post('/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, telegramChatId } = req.body;

      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Vui lòng cung cấp email và mật khẩu hợp lệ.' },
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Mật khẩu phải có ít nhất 6 ký tự.' },
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingUser) {
        return res.status(409).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.' },
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          telegramChatId: telegramChatId ? String(telegramChatId).trim() : null,
        },
      });

      const token = JwtService.sign({
        userId: newUser.id,
        email: newUser.email,
      });

      res.status(201).json({
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            telegramChatId: newUser.telegramChatId,
            createdAt: newUser.createdAt,
          },
          token,
        },
        meta: { timestamp: Date.now() },
        error: null,
      });
    } catch (err: any) {
      console.error('Lỗi đăng ký tài khoản:', err);
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: 'Không thể tạo tài khoản', details: err.message },
      });
    }
  });

  /**
   * POST /auth/login: Đăng nhập hệ thống
   */
  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Vui lòng nhập đầy đủ email và mật khẩu.' },
        });
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        return res.status(401).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Email hoặc mật khẩu không chính xác.' },
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Email hoặc mật khẩu không chính xác.' },
        });
      }

      const token = JwtService.sign({
        userId: user.id,
        email: user.email,
      });

      res.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            telegramChatId: user.telegramChatId,
            createdAt: user.createdAt,
          },
          token,
        },
        meta: { timestamp: Date.now() },
        error: null,
      });
    } catch (err: any) {
      console.error('Lỗi đăng nhập:', err);
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: 'Lỗi máy chủ khi đăng nhập', details: err.message },
      });
    }
  });

  /**
   * GET /auth/me: Lấy thông tin user hiện tại
   */
  router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { alerts: { where: { status: 'ACTIVE' } } },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          data: null,
          meta: { timestamp: Date.now() },
          error: { message: 'Không tìm thấy người dùng.' },
        });
      }

      res.json({
        data: {
          id: user.id,
          email: user.email,
          telegramChatId: user.telegramChatId,
          activeAlertsCount: user._count.alerts,
          createdAt: user.createdAt,
        },
        meta: { timestamp: Date.now() },
        error: null,
      });
    } catch (err: any) {
      res.status(500).json({
        data: null,
        meta: { timestamp: Date.now() },
        error: { message: 'Lỗi khi lấy thông tin người dùng', details: err.message },
      });
    }
  });

  return router;
}
