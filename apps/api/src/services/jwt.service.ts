import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'flashcrypto_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Service quản lý việc tạo và xác thực JSON Web Token (JWT)
 */
export class JwtService {
  /**
   * Tạo token đăng nhập mới
   */
  static sign(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Kiểm tra tính hợp lệ của token và giải mã payload
   */
  static verify(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      return null;
    }
  }
}
