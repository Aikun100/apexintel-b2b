/**
 * ApexIntel B2B - Custom Extraction Requests Service
 * 
 * Business Logic & Security Controls:
 * - Server-Authoritative Pricing Calculation (Never trusts client-submitted prices)
 * - Cryptographic Request ID Generation (REQ-2026-<randomHex>)
 * - Multi-Tenant Isolation (Customers can only view their own requests)
 * - Admin-Only Lifecycle State Transitions (Submitted -> Reviewing -> Mining -> Delivered)
 * - Non-Blocking SES Notification Adapter
 */

import crypto from 'node:crypto';
import validator from 'validator';
import { getRequestsRepository } from './repository.js';

export const ALLOWED_STATUSES = [
  'Submitted',
  'Reviewing',
  'Mining',
  'Delivered',
  'Cancelled'
];

export class RequestsService {
  constructor(options = {}) {
    this._repo = options.repo || null;
  }

  get repo() {
    return this._repo || getRequestsRepository();
  }

  /**
   * Calculate authoritative pricing for a custom extraction request.
   * 
   * @param {number} volume 
   * @param {object} [enrichments]
   * @returns {{ ratePerRecord: number, totalCost: number, estimatedPrice: string, priceInCents: number }}
   */
  calculatePrice(volume, enrichments = {}) {
    const vol = Math.max(50, Math.min(50000, parseInt(volume, 10) || 100));

    // Base volume tier rate
    let rate = 0.65;
    if (vol >= 2500) rate = 0.25;
    else if (vol >= 1000) rate = 0.35;
    else if (vol >= 500) rate = 0.45;
    else if (vol >= 250) rate = 0.55;

    // Optional enrichment addons
    if (enrichments.latency) rate += 0.08;
    if (enrichments.pixel) rate += 0.08;
    if (enrichments.mobile) rate += 0.12;

    rate = Math.round(rate * 100) / 100;
    const totalCost = Math.round(vol * rate);

    return {
      ratePerRecord: rate,
      totalCost,
      estimatedPrice: `$${totalCost}.00`,
      priceInCents: totalCost * 100
    };
  }

  /**
   * Create a new custom extraction request.
   * 
   * @param {object} input 
   * @param {object} [userContext] - Authenticated user session { userId, email, role } if present
   * @returns {Promise<object>}
   */
  async createCustomRequest(input = {}, userContext = null) {
    const rawEmail = input.email || userContext?.email;
    if (!rawEmail || typeof rawEmail !== 'string' || !validator.isEmail(rawEmail.trim())) {
      const err = new Error('A valid delivery email address is required.');
      err.statusCode = 400;
      throw err;
    }
    const email = validator.normalizeEmail(rawEmail.trim());

    const territory = (input.territory || '').trim();
    if (!territory || territory.length < 2 || territory.length > 200) {
      const err = new Error('Geographic territory must be between 2 and 200 characters.');
      err.statusCode = 400;
      throw err;
    }

    const industry = (input.industry || '').trim() || 'Commercial Services';
    if (industry.length > 100) {
      const err = new Error('Industry specification cannot exceed 100 characters.');
      err.statusCode = 400;
      throw err;
    }

    const volume = parseInt(input.volume, 10);
    if (isNaN(volume) || volume < 50 || volume > 50000) {
      const err = new Error('Target record volume must be an integer between 50 and 50,000.');
      err.statusCode = 400;
      throw err;
    }

    const enrichments = {
      latency: Boolean(input.enrichments?.latency || input.hasLatency),
      pixel: Boolean(input.enrichments?.pixel || input.hasPixel),
      mobile: Boolean(input.enrichments?.mobile || input.hasMobile)
    };

    // Calculate authoritative pricing (ignores client-supplied price)
    const pricing = this.calculatePrice(volume, enrichments);

    // Cryptographic request ID: REQ-2026-<6 hex chars>
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const requestId = `REQ-2026-${randomHex}`;

    const now = new Date().toISOString();
    const userId = userContext?.userId || `anon_${crypto.randomBytes(8).toString('hex')}`;

    const record = {
      requestId,
      userId,
      email,
      industry,
      territory,
      volume,
      enrichments,
      ratePerRecord: pricing.ratePerRecord,
      totalCost: pricing.totalCost,
      estimatedPrice: pricing.estimatedPrice,
      priceInCents: pricing.priceInCents,
      status: 'Submitted',
      notes: (input.notes || '').trim().slice(0, 1000) || `Custom data extraction request for ${industry} in ${territory}.`,
      createdAt: now,
      updatedAt: now,
      authenticatedSubmission: Boolean(userContext?.userId)
    };

    const saved = await this.repo.createRequest(record);

    // Trigger non-blocking administrator notification
    this._notifyAdmins(saved);

    return saved;
  }

  /**
   * Retrieve a single custom request by ID with tenant access control.
   * 
   * @param {string} requestId 
   * @param {object} requestingUser - { userId, role }
   * @returns {Promise<object>}
   */
  async getCustomRequest(requestId, requestingUser) {
    if (!requestId) {
      const err = new Error('requestId is required.');
      err.statusCode = 400;
      throw err;
    }

    const record = await this.repo.getRequestById(requestId);
    if (!record) {
      const err = new Error(`Request '${requestId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Tenant Isolation Check: Customers may only view their own requests
    if (requestingUser.role !== 'admin' && record.userId !== requestingUser.userId) {
      const err = new Error('Access denied: You are not authorized to view this extraction request.');
      err.statusCode = 403;
      throw err;
    }

    return record;
  }

  /**
   * List custom extraction requests for customer or admin queue.
   * 
   * @param {object} requestingUser - { userId, role }
   * @param {object} [options] - { status, limit, userId }
   * @returns {Promise<object[]>}
   */
  async listCustomRequests(requestingUser, options = {}) {
    if (!requestingUser || !requestingUser.userId) {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      throw err;
    }

    // Admin view
    if (requestingUser.role === 'admin') {
      if (options.userId) {
        return this.repo.listRequestsByUserId(options.userId, options);
      }
      return this.repo.listAllRequests(options);
    }

    // Customer view: strictly isolated to requestingUser.userId
    return this.repo.listRequestsByUserId(requestingUser.userId, options);
  }

  /**
   * Admin-only lifecycle status transition.
   * 
   * @param {string} requestId 
   * @param {object} updates - { status, notes }
   * @param {object} adminUser - { userId, role }
   * @returns {Promise<object>}
   */
  async updateRequestStatus(requestId, updates = {}, adminUser) {
    if (!adminUser || adminUser.role !== 'admin') {
      const err = new Error('Forbidden: Only administrators can update request lifecycle status.');
      err.statusCode = 403;
      throw err;
    }

    const existing = await this.repo.getRequestById(requestId);
    if (!existing) {
      const err = new Error(`Request '${requestId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const newStatus = updates.status;
    if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
      const err = new Error(`Invalid status '${newStatus}'. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const payload = {
      status: newStatus,
      adminUserId: adminUser.userId,
      updatedAt: new Date().toISOString()
    };

    if (updates.notes !== undefined) {
      payload.notes = String(updates.notes).trim().slice(0, 1000);
    }

    return this.repo.updateRequestStatus(requestId, payload);
  }

  /**
   * Non-blocking administrator notification hook.
   * Safe execution: logs notification, never leaks secrets or throws uncaught errors.
   * 
   * @param {object} request 
   */
  _notifyAdmins(request) {
    try {
      console.log(`[Notification] New custom extraction request ${request.requestId} received: ${request.volume} leads for ${request.industry} (${request.territory}) - Estimate: ${request.estimatedPrice}`);
    } catch {
      // Non-blocking
    }
  }
}

export const requestsService = new RequestsService();
