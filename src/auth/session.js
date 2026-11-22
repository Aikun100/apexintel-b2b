/**
 * ApexIntel B2B - Session Management & Secure Cookie Engine
 * 
 * Features:
 * - Opaque 256-bit cryptographically secure random session tokens
 * - SHA-256 token hashing (raw tokens NEVER saved to database)
 * - HttpOnly, Secure, SameSite=Lax, Path=/ cookie generation
 * - Role-based session expiration:
 *   - Maximum lifetime: 7 days
 *   - Customer idle expiration: 24 hours
 *   - Admin idle expiration: 30 minutes
 */

import crypto from 'node:crypto';

export const SESSION_CONFIG = {
  COOKIE_NAME: 'apexintel_session',
  CSRF_COOKIE_NAME: 'apexintel_csrf',
  MAX_AGE_SECONDS: 7 * 24 * 60 * 60, // 7 days
  CUSTOMER_IDLE_SECONDS: 24 * 60 * 60, // 24 hours
  ADMIN_IDLE_SECONDS: 30 * 60, // 30 minutes
  TOKEN_BYTE_LENGTH: 32
};

/**
 * Generate a new cryptographically secure random session token and its SHA-256 hash.
 * @returns {{ rawToken: string, tokenHash: string }}
 */
export function generateSessionToken() {
  const rawToken = crypto.randomBytes(SESSION_CONFIG.TOKEN_BYTE_LENGTH).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Hash a session token using SHA-256.
 * @param {string} rawToken 
 * @returns {string}
 */
export function hashSessionToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Invalid raw session token provided for hashing.');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Create a new session record object.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.role
 * @param {string} params.tokenHash
 * @param {string} [params.userAgent]
 * @param {string} [params.ipAddress]
 * @returns {object}
 */
export function createSessionRecord({ userId, role, tokenHash, userAgent = '', ipAddress = '' }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_CONFIG.MAX_AGE_SECONDS * 1000);
  const ttlEpoch = Math.floor(expiresAt.getTime() / 1000);

  return {
    sessionId: crypto.randomUUID(),
    userId,
    role: role || 'customer',
    tokenHash,
    sessionStatus: 'active',
    createdAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    revokedAt: null,
    userAgent: (userAgent || '').substring(0, 256),
    ipAddress: (ipAddress || '').substring(0, 64),
    ttl: ttlEpoch
  };
}

/**
 * Validate a session record against expiration and idle rules.
 * @param {object} session
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateSessionRecord(session) {
  if (!session) {
    return { valid: false, reason: 'Session does not exist.' };
  }

  if (session.sessionStatus !== 'active' || session.revokedAt) {
    return { valid: false, reason: 'Session has been revoked.' };
  }

  const now = Date.now();
  const expiresAtTime = new Date(session.expiresAt).getTime();
  if (now > expiresAtTime) {
    return { valid: false, reason: 'Session has expired (maximum lifetime reached).' };
  }

  const lastActivityTime = new Date(session.lastActivityAt || session.createdAt).getTime();
  const idleLimitSeconds = session.role === 'admin' 
    ? SESSION_CONFIG.ADMIN_IDLE_SECONDS 
    : SESSION_CONFIG.CUSTOMER_IDLE_SECONDS;

  if (now - lastActivityTime > idleLimitSeconds * 1000) {
    return { valid: false, reason: 'Session has expired due to inactivity.' };
  }

  return { valid: true };
}

/**
 * Parse cookies from a Cookie header string.
 * @param {string} cookieHeader 
 * @returns {Record<string, string>}
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;

  cookieHeader.split(';').forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  });

  return cookies;
}

/**
 * Serialize an HttpOnly authentication cookie header.
 * @param {string} token 
 * @param {object} [options]
 * @returns {string}
 */
export function serializeSessionCookie(token, options = {}) {
  const isProd = options.isProduction !== undefined ? options.isProduction : process.env.NODE_ENV === 'production';
  const maxAge = options.maxAge !== undefined ? options.maxAge : SESSION_CONFIG.MAX_AGE_SECONDS;
  const cookieName = options.cookieName || SESSION_CONFIG.COOKIE_NAME;

  let cookie = `${cookieName}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
  if (isProd) {
    cookie += '; Secure';
  }
  return cookie;
}

/**
 * Serialize a cookie to clear/delete the session.
 * @param {object} [options]
 * @returns {string}
 */
export function serializeClearSessionCookie(options = {}) {
  const isProd = options.isProduction !== undefined ? options.isProduction : process.env.NODE_ENV === 'production';
  const cookieName = options.cookieName || SESSION_CONFIG.COOKIE_NAME;

  let cookie = `${cookieName}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
  if (isProd) {
    cookie += '; Secure';
  }
  return cookie;
}
