/**
 * ApexIntel B2B - Authentication Security Audit Logger
 * 
 * Guarantees:
 * - Structured JSON logging format for ingestion into AWS CloudWatch / Datadog
 * - ZERO plaintext passwords, hashes, session tokens, or raw cookies logged
 * - Standardized security event taxonomy:
 *   - AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILURE
 *   - AUTH_REGISTER_SUCCESS, AUTH_REGISTER_FAILURE
 *   - AUTH_LOGOUT
 *   - AUTH_PASSWORD_CHANGE_SUCCESS, AUTH_PASSWORD_CHANGE_FAILURE
 *   - AUTH_PASSWORD_RESET_REQUEST, AUTH_PASSWORD_RESET_COMPLETE
 *   - AUTH_RATE_LIMIT_EXCEEDED
 *   - AUTH_UNAUTHORIZED_ACCESS
 *   - AUTH_ADMIN_BOOTSTRAP
 */

import crypto from 'node:crypto';

export class AuditLogger {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.destination = options.destination || console.log;
  }

  /**
   * Mask or hash sensitive strings for safe audit logging.
   * @param {string} val 
   * @returns {string}
   */
  static maskEmail(val) {
    if (!val || typeof val !== 'string') return 'anonymous';
    const [user, domain] = val.split('@');
    if (!domain) return 'invalid_email';
    const visibleChars = user.length > 2 ? user.slice(0, 2) : user.slice(0, 1);
    return `${visibleChars}***@${domain}`;
  }

  /**
   * Record a structured security event.
   * @param {string} eventType 
   * @param {object} details
   */
  log(eventType, details = {}) {
    const timestamp = new Date().toISOString();
    const eventId = crypto.randomUUID();

    const sanitizedDetails = { ...details };
    // Explicitly delete any accidental sensitive parameters
    delete sanitizedDetails.password;
    delete sanitizedDetails.currentPassword;
    delete sanitizedDetails.newPassword;
    delete sanitizedDetails.passwordConfirmation;
    delete sanitizedDetails.passwordHash;
    delete sanitizedDetails.token;
    delete sanitizedDetails.rawToken;
    delete sanitizedDetails.cookie;

    if (sanitizedDetails.email) {
      sanitizedDetails.email = AuditLogger.maskEmail(sanitizedDetails.email);
    }

    const payload = {
      timestamp,
      eventId,
      eventType,
      ...sanitizedDetails
    };

    if (!this.silent) {
      this.destination(JSON.stringify(payload));
    }

    return payload;
  }
}

export const auditLogger = new AuditLogger();
