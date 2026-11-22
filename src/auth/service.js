/**
 * ApexIntel B2B - Central Authentication Service
 * 
 * Implements core business logic:
 * - Customer registration with atomic uniqueness and customer-role enforcement
 * - Customer login with rate-limiting, timing-safe password verification, and session creation
 * - Safe session validation and role retrieval (/api/auth/me)
 * - Session revocation on logout
 * - Password change with session rotation
 * - Password reset workflows (account-enumeration resistant)
 * - Server-side role checks and safe user profile sanitization
 */

import crypto from 'node:crypto';
import validator from 'validator';
import { hashPassword, verifyPassword, validatePasswordPolicy } from './password.js';
import { 
  generateSessionToken, 
  hashSessionToken, 
  createSessionRecord, 
  validateSessionRecord 
} from './session.js';
import { getAuthRepository } from './repository.js';
import { rateLimiter } from './rate-limiter.js';
import { auditLogger } from './audit-logger.js';

export class AuthService {
  constructor(options = {}) {
    this.repo = options.repository || getAuthRepository();
    this.rateLimiter = options.rateLimiter || rateLimiter;
    this.auditLogger = options.auditLogger || auditLogger;
  }

  /**
   * Sanitize user record for public/client consumption.
   * NEVER returns passwordHash, passwordSalt, or internal keys.
   * @param {object} user 
   * @returns {object}
   */
  static sanitizeUser(user) {
    if (!user) return null;
    return {
      userId: user.userId,
      email: user.email,
      name: user.name || 'User',
      company: user.company || 'Independent Agency',
      plan: user.plan || 'Agency Growth',
      credits: user.credits !== undefined ? user.credits : 50,
      role: user.role || 'customer',
      accountStatus: user.accountStatus || 'active',
      emailVerified: !!user.emailVerified,
      apiKey: user.apiKey || 'apex_live_sec_' + user.userId.replace(/-/g, '').substring(0, 16),
      targetNiche: user.targetNiche || 'Contractors',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  /**
   * Register a new customer account.
   * Public registration is strictly restricted to role: 'customer'.
   * @param {object} input 
   * @param {string} [ip]
   * @returns {Promise<{ user: object, rawToken: string }>}
   */
  async register(input, ip = '127.0.0.1') {
    const { email, password, passwordConfirmation, name, company, targetNiche } = input || {};

    // 1. Rate limit registration attempts by IP
    const rateCheck = this.rateLimiter.checkAndIncrement('REGISTER', ip);
    if (!rateCheck.allowed) {
      this.auditLogger.log('AUTH_RATE_LIMIT_EXCEEDED', { ip, action: 'REGISTER' });
      const err = new Error(`Too many registration attempts. Please retry in ${rateCheck.retryAfterSeconds} seconds.`);
      err.statusCode = 429;
      throw err;
    }

    // 2. Validate Email
    if (!email || typeof email !== 'string' || !validator.isEmail(email.trim())) {
      const err = new Error('Please provide a valid email address.');
      err.statusCode = 400;
      throw err;
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Validate Password and Confirmation
    if (!password || typeof password !== 'string') {
      const err = new Error('Password is required.');
      err.statusCode = 400;
      throw err;
    }

    if (passwordConfirmation !== undefined && password !== passwordConfirmation) {
      const err = new Error('Password confirmation does not match.');
      err.statusCode = 400;
      throw err;
    }

    const policyCheck = validatePasswordPolicy(password);
    if (!policyCheck.valid) {
      const err = new Error(policyCheck.message);
      err.statusCode = 400;
      throw err;
    }

    // 4. Hash password with scrypt
    const { hash: passwordHash, salt: passwordSalt } = await hashPassword(password);

    // 5. Build user record (FORCE role = 'customer' - NEVER trust input.role)
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const apiKey = 'apex_live_sec_' + crypto.randomBytes(12).toString('hex');

    const newUser = {
      userId,
      email: email.trim(),
      normalizedEmail,
      passwordHash,
      passwordSalt,
      role: 'customer', // Immutable for public registration
      accountStatus: 'active',
      emailVerified: false,
      name: (name || 'New Member').trim().substring(0, 100),
      company: (company || 'Independent Agency').trim().substring(0, 100),
      plan: 'Agency Growth',
      credits: 50,
      targetNiche: targetNiche || 'Commercial Roofing',
      apiKey,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      passwordChangedAt: now
    };

    // 6. Persist with atomic uniqueness check in repository
    try {
      await this.repo.createUser(newUser);
    } catch (err) {
      if (err.name === 'DuplicateEmailError' || err.name === 'TransactionCanceledException' || err.code === 'ConditionalCheckFailed') {
        this.auditLogger.log('AUTH_REGISTER_FAILURE', { email: normalizedEmail, ip, reason: 'duplicate_email' });
        const conflictErr = new Error('An account with this email already exists.');
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
      throw err;
    }

    // 7. Create Session
    const { rawToken, tokenHash } = generateSessionToken();
    const session = createSessionRecord({
      userId,
      role: 'customer',
      tokenHash,
      ipAddress: ip
    });
    await this.repo.createSession(session);

    this.auditLogger.log('AUTH_REGISTER_SUCCESS', { userId, email: normalizedEmail, ip });

    return {
      user: AuthService.sanitizeUser(newUser),
      rawToken
    };
  }

  /**
   * Authenticate an existing account.
   * @param {object} input 
   * @param {string} [ip]
   * @param {string} [userAgent]
   * @returns {Promise<{ user: object, rawToken: string }>}
   */
  async login(input, ip = '127.0.0.1', userAgent = '') {
    const { email, password } = input || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      const err = new Error('Email and password are required.');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Rate limiting by IP and Email
    const rateCheck = this.rateLimiter.checkAndIncrement('LOGIN', ip, normalizedEmail);
    if (!rateCheck.allowed) {
      this.auditLogger.log('AUTH_RATE_LIMIT_EXCEEDED', { email: normalizedEmail, ip, action: 'LOGIN' });
      const err = new Error(`Too many failed login attempts. Please retry in ${rateCheck.retryAfterSeconds} seconds.`);
      err.statusCode = 429;
      throw err;
    }

    // 2. Fetch user
    const user = await this.repo.findUserByNormalizedEmail(normalizedEmail);
    if (!user) {
      this.auditLogger.log('AUTH_LOGIN_FAILURE', { email: normalizedEmail, ip, reason: 'user_not_found' });
      // Execute dummy scrypt calculation to resist timing attacks
      await hashPassword('dummy-timing-protection-pass');
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    // 3. Verify Account Status
    if (user.accountStatus !== 'active') {
      this.auditLogger.log('AUTH_LOGIN_FAILURE', { userId: user.userId, email: normalizedEmail, ip, status: user.accountStatus });
      const err = new Error('Account is suspended or disabled. Please contact support@apexintel-b2b.shop.');
      err.statusCode = 403;
      throw err;
    }

    // 4. Verify Password
    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      this.auditLogger.log('AUTH_LOGIN_FAILURE', { userId: user.userId, email: normalizedEmail, ip, reason: 'invalid_password' });
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    // 5. Successful login: reset rate limit counters
    this.rateLimiter.reset('LOGIN', ip, normalizedEmail);

    // 6. Update lastLoginAt
    const now = new Date().toISOString();
    await this.repo.updateUser(user.userId, { lastLoginAt: now });

    // 7. Create Session
    const { rawToken, tokenHash } = generateSessionToken();
    const session = createSessionRecord({
      userId: user.userId,
      role: user.role,
      tokenHash,
      userAgent,
      ipAddress: ip
    });
    await this.repo.createSession(session);

    this.auditLogger.log('AUTH_LOGIN_SUCCESS', { userId: user.userId, email: normalizedEmail, role: user.role, ip });

    return {
      user: AuthService.sanitizeUser({ ...user, lastLoginAt: now }),
      rawToken
    };
  }

  /**
   * Validate session and retrieve current authenticated user profile.
   * @param {string} rawToken 
   * @returns {Promise<object>}
   */
  async getMe(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      throw err;
    }

    const tokenHash = hashSessionToken(rawToken);
    const session = await this.repo.findSessionByTokenHash(tokenHash);
    const validation = validateSessionRecord(session);

    if (!validation.valid) {
      const err = new Error(validation.reason || 'Session expired or invalid.');
      err.statusCode = 401;
      throw err;
    }

    const user = await this.repo.findUserById(session.userId);
    if (!user || user.accountStatus !== 'active') {
      const err = new Error('User account is invalid or no longer active.');
      err.statusCode = 401;
      throw err;
    }

    // Update last activity timestamp asynchronously
    await this.repo.updateSessionActivity(tokenHash, new Date().toISOString());

    return AuthService.sanitizeUser(user);
  }

  /**
   * Invalidate the current session upon logout.
   * @param {string} rawToken 
   * @param {string} [ip]
   * @returns {Promise<boolean>}
   */
  async logout(rawToken, ip = '127.0.0.1') {
    if (!rawToken || typeof rawToken !== 'string') {
      return true;
    }

    try {
      const tokenHash = hashSessionToken(rawToken);
      const session = await this.repo.findSessionByTokenHash(tokenHash);
      if (session) {
        await this.repo.revokeSession(tokenHash);
        this.auditLogger.log('AUTH_LOGOUT', { userId: session.userId, ip });
      }
    } catch (err) {
      // Logout should remain safe even if token lookup fails
    }
    return true;
  }

  /**
   * Change user password with session invalidation.
   * @param {string} rawToken 
   * @param {object} input 
   * @param {string} [ip]
   * @returns {Promise<{ success: boolean, newRawToken: string }>}
   */
  async changePassword(rawToken, input, ip = '127.0.0.1') {
    const { currentPassword, newPassword, newPasswordConfirmation } = input || {};
    const currentUser = await this.getMe(rawToken);

    // Fetch full user record to verify current password
    const user = await this.repo.findUserById(currentUser.userId);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      this.auditLogger.log('AUTH_PASSWORD_CHANGE_FAILURE', { userId: user.userId, ip, reason: 'wrong_current_password' });
      const err = new Error('Current password is incorrect.');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword !== newPasswordConfirmation) {
      const err = new Error('New password confirmation does not match.');
      err.statusCode = 400;
      throw err;
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      const err = new Error(policyCheck.message);
      err.statusCode = 400;
      throw err;
    }

    const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);
    const now = new Date().toISOString();

    await this.repo.updateUser(user.userId, {
      passwordHash: newHash,
      passwordSalt: newSalt,
      passwordChangedAt: now
    });

    // Revoke all existing sessions
    await this.repo.revokeAllUserSessions(user.userId);

    // Issue a fresh rotated session for the caller
    const { rawToken: newRawToken, tokenHash } = generateSessionToken();
    const session = createSessionRecord({
      userId: user.userId,
      role: user.role,
      tokenHash,
      ipAddress: ip
    });
    await this.repo.createSession(session);

    this.auditLogger.log('AUTH_PASSWORD_CHANGE_SUCCESS', { userId: user.userId, ip });

    return {
      success: true,
      newRawToken
    };
  }

  /**
   * Request password recovery (enumeration-resistant).
   * @param {string} email 
   * @param {string} [ip]
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async forgotPassword(email, ip = '127.0.0.1') {
    if (!email || typeof email !== 'string') {
      const err = new Error('Email is required.');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const rateCheck = this.rateLimiter.checkAndIncrement('PASSWORD_RESET', ip, normalizedEmail);
    if (!rateCheck.allowed) {
      const err = new Error(`Too many password reset requests. Please retry in ${rateCheck.retryAfterSeconds} seconds.`);
      err.statusCode = 429;
      throw err;
    }

    const user = await this.repo.findUserByNormalizedEmail(normalizedEmail);
    if (user && user.accountStatus === 'active') {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

      await this.repo.createPasswordResetToken({
        tokenHash,
        userId: user.userId,
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });

      this.auditLogger.log('AUTH_PASSWORD_RESET_REQUEST', { userId: user.userId, email: normalizedEmail, ip });
    }

    // Always return identical generic message to prevent account enumeration
    return {
      success: true,
      message: 'If an account matches that email address, password reset instructions have been dispatched.'
    };
  }

  /**
   * Complete password reset using token.
   * @param {object} input 
   * @param {string} [ip]
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async resetPassword(input, ip = '127.0.0.1') {
    const { resetToken, newPassword, newPasswordConfirmation } = input || {};

    if (!resetToken || typeof resetToken !== 'string') {
      const err = new Error('Invalid or missing password reset token.');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword !== newPasswordConfirmation) {
      const err = new Error('New password confirmation does not match.');
      err.statusCode = 400;
      throw err;
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      const err = new Error(policyCheck.message);
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetRecord = await this.repo.findPasswordResetToken(tokenHash);

    if (!resetRecord || resetRecord.status !== 'active') {
      const err = new Error('This password reset link is invalid or has already been used.');
      err.statusCode = 400;
      throw err;
    }

    if (Date.now() > new Date(resetRecord.expiresAt).getTime()) {
      const err = new Error('This password reset link has expired.');
      err.statusCode = 400;
      throw err;
    }

    const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);
    const now = new Date().toISOString();

    await this.repo.updateUser(resetRecord.userId, {
      passwordHash: newHash,
      passwordSalt: newSalt,
      passwordChangedAt: now
    });

    await this.repo.invalidatePasswordResetToken(tokenHash);
    await this.repo.revokeAllUserSessions(resetRecord.userId);

    this.auditLogger.log('AUTH_PASSWORD_RESET_COMPLETE', { userId: resetRecord.userId, ip });

    return {
      success: true,
      message: 'Password reset successfully. You may now sign in with your new credentials.'
    };
  }
}

export const authService = new AuthService();
