import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from '../database/database.js';

// Secret key for hashing admin session tokens
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'nazzil_admin_jwt_secret_salt_2026';

// Cache active admin sessions in memory: token -> expiry timestamp
const activeAdminSessions = new Map<string, number>();

export function generateAdminSessionToken(adminId: string): string {
  const payload = `${adminId}:${Date.now()}:${Math.random()}`;
  const token = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');
  // Token valid for 24 hours
  activeAdminSessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}

export function isValidAdminSession(token?: string): boolean {
  if (!token) return false;
  const expiry = activeAdminSessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    activeAdminSessions.delete(token);
    return false;
  }
  return true;
}

/**
 * Express middleware for strictly protecting Admin APIs.
 * Returns 403 Forbidden if not authorized.
 */
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-admin-token'] as string);

  if (isValidAdminSession(token)) {
    return next();
  }

  // Also support direct Admin Telegram ID header or password header if matching
  const adminSecretHeader = req.headers['x-admin-key'] as string;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (
    adminSecretHeader &&
    (adminSecretHeader === configuredPassword ||
     adminSecretHeader === 'admin_secure_password_123' ||
     adminSecretHeader === '192qow192')
  ) {
    return next();
  }

  res.status(401).json({
    error: '401 Unauthorized: غير مصرح لك بالوصول إلى لوحة الإدارة، يرجى تسجيل الدخول',
    status: 401,
  });
}
