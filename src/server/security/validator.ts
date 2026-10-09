import { URL } from 'url';

export interface ValidationResult {
  isValid: boolean;
  cleanUrl?: string;
  error?: string;
}

// IP blocks prohibited for SSRF protection
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
];

export function validateAndCleanUrl(rawUrl: string): ValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'الرابط فارغ أو غير صالح' };
  }

  const trimmed = rawUrl.trim();

  // Extract URL if surrounded by text
  const urlRegex = /(https?:\/\/[^\s<>"'{}|\\^`]+)/i;
  const match = trimmed.match(urlRegex);
  if (!match) {
    return { isValid: false, error: 'لم يتم العثور على رابط ويب صالح يبدأ بـ http:// أو https://' };
  }

  const matchedUrl = match[1];

  let parsed: URL;
  try {
    parsed = new URL(matchedUrl);
  } catch {
    return { isValid: false, error: 'صيغة الرابط غير صحيحة' };
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'البروتوكول غير مدعوم، يرجى استخدام http أو https' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF Check: Hostname matching
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { isValid: false, error: 'الوصول إلى هذا العنوان الداخلي محظور لأسباب أمنية' };
  }

  // SSRF Check: Private IPv4 check
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return { isValid: false, error: 'الوصول إلى عناوين الشبكة المحلية والخاصة محظور' };
  }

  // Strip tracking parameters if desired, but keep essentials
  const cleanUrl = parsed.toString();
  return { isValid: true, cleanUrl };
}

// In-Memory Rate Limiter
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 10, windowMs = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodic cleanup every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  public isAllowed(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const windowStart = now - this.windowMs;

    const recent = timestamps.filter((t) => t > windowStart);
    if (recent.length >= this.maxRequests) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.ceil((oldest + this.windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }

    recent.push(now);
    this.requests.set(key, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.requests.entries()) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, active);
      }
    }
  }
}

// User-level rate limiter (10 downloads per minute per user)
export const userRateLimiter = new RateLimiter(10, 60 * 1000);

// API-level rate limiter (60 requests per minute)
export const apiRateLimiter = new RateLimiter(60, 60 * 1000);

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
