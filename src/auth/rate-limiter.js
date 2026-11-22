/**
 * ApexIntel B2B - Server-Side Multi-Key Rate Limiting Engine
 * 
 * Features:
 * - Protects login, registration, password change, and reset endpoints
 * - Enforces limits per client IP AND per normalized email
 * - Configurable sliding window and maximum attempts
 * - In-memory and DynamoDB-compatible atomic counters
 */

export const RATE_LIMIT_CONFIG = {
  LOGIN: {
    WINDOW_SECONDS: 15 * 60, // 15 minutes
    MAX_ATTEMPTS_PER_IP: 15,
    MAX_ATTEMPTS_PER_EMAIL: 5
  },
  REGISTER: {
    WINDOW_SECONDS: 60 * 60, // 1 hour
    MAX_ATTEMPTS_PER_IP: 10
  },
  PASSWORD_RESET: {
    WINDOW_SECONDS: 60 * 60, // 1 hour
    MAX_ATTEMPTS_PER_IP: 5,
    MAX_ATTEMPTS_PER_EMAIL: 3
  },
  SCAN: {
    WINDOW_SECONDS: 60, // 1 minute
    MAX_ATTEMPTS_PER_IP: 10
  },
  CUSTOM_REQUEST: {
    WINDOW_SECONDS: 15 * 60, // 15 minutes
    MAX_ATTEMPTS_PER_IP: 5
  }
};

export class RateLimiter {
  constructor(options = {}) {
    this.storage = options.storage || new Map();
  }

  /**
   * Build a composite cache key.
   * @param {string} action 
   * @param {string} scope 
   * @param {string} identifier 
   * @returns {string}
   */
  _buildKey(action, scope, identifier) {
    return `ratelimit:${action}:${scope}:${identifier.trim().toLowerCase()}`;
  }

  /**
   * Check rate limit and increment attempt count.
   * @param {string} action - 'LOGIN', 'REGISTER', 'PASSWORD_RESET'
   * @param {string} ip - Client IP
   * @param {string} [email] - Normalized target email
   * @returns {{ allowed: boolean, remainingAttempts: number, retryAfterSeconds: number }}
   */
  checkAndIncrement(action, ip, email = null) {
    const config = RATE_LIMIT_CONFIG[action] || RATE_LIMIT_CONFIG.LOGIN;
    const now = Date.now();
    const windowMs = config.WINDOW_SECONDS * 1000;

    // Check IP
    const ipKey = this._buildKey(action, 'ip', ip || 'unknown-ip');
    const ipRecord = this._getOrInitRecord(ipKey, windowMs, now);

    if (ipRecord.count >= config.MAX_ATTEMPTS_PER_IP) {
      const retryAfter = Math.ceil((ipRecord.resetTime - now) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds: Math.max(1, retryAfter) };
    }

    // Check Email if provided
    let emailRecord = null;
    if (email && config.MAX_ATTEMPTS_PER_EMAIL) {
      const emailKey = this._buildKey(action, 'email', email);
      emailRecord = this._getOrInitRecord(emailKey, windowMs, now);

      if (emailRecord.count >= config.MAX_ATTEMPTS_PER_EMAIL) {
        const retryAfter = Math.ceil((emailRecord.resetTime - now) / 1000);
        return { allowed: false, remainingAttempts: 0, retryAfterSeconds: Math.max(1, retryAfter) };
      }
    }

    // Increment
    ipRecord.count += 1;
    if (emailRecord) {
      emailRecord.count += 1;
    }

    const remaining = Math.max(
      0,
      config.MAX_ATTEMPTS_PER_IP - ipRecord.count,
      emailRecord ? config.MAX_ATTEMPTS_PER_EMAIL - emailRecord.count : 999
    );

    return { allowed: true, remainingAttempts: remaining, retryAfterSeconds: 0 };
  }

  /**
   * Reset rate limit upon successful authentication.
   * @param {string} action 
   * @param {string} ip 
   * @param {string} [email] 
   */
  reset(action, ip, email = null) {
    if (ip) {
      this.storage.delete(this._buildKey(action, 'ip', ip));
    }
    if (email) {
      this.storage.delete(this._buildKey(action, 'email', email));
    }
  }

  _getOrInitRecord(key, windowMs, now) {
    let record = this.storage.get(key);
    if (!record || now >= record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      this.storage.set(key, record);
    }
    return record;
  }
}

export const rateLimiter = new RateLimiter();
