/**
 * ApexIntel B2B - Discovery & Crawler Ingestion Service
 * 
 * Responsibilities:
 * 1. Filtered, paginated live discovery queries with contact masking for public visitors
 * 2. Admin-only emergency recrawl trigger invoking the live ingestion pipeline
 * 3. Server-side contact entitlement enforcement (unauthenticated visitors receive masked preview fields)
 */

import { getDiscoveryRepository } from './repository.js';
import { processLeadIngestionBatch, DEFAULT_CANDIDATE_LEADS } from '../../aws/lambda-crawler-handler.mjs';

/**
 * Mask an email address for public preview (e.g. "info@dallasroofer.com" -> "in**@dallasroofer.com")
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return 'in**@domain.com';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local.charAt(0)}*@${domain}`;
  }
  const prefix = local.substring(0, 2);
  return `${prefix}**@${domain}`;
}

/**
 * Mask a phone number for public preview (e.g. "+1 469 931 9867" -> "+1 469 *** 9867")
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '+1 *** *** ****';
  const parts = phone.trim().split(' ');
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} *** ${parts[3]}`;
  }
  return phone.substring(0, 6) + ' *** ' + phone.slice(-4);
}

export class DiscoveryService {
  constructor(options = {}) {
    this._repo = options.repository || null;
  }

  get repo() {
    return this._repo || getDiscoveryRepository();
  }

  /**
   * Search cached discovery leads with server-side contact masking.
   * @param {object} params
   * @param {string} [params.trade]
   * @param {string} [params.location]
   * @param {boolean|string} [params.verified]
   * @param {number|string} [params.limit]
   * @param {string} [params.cursor]
   * @param {object|null} [params.authenticatedUser]
   * @returns {Promise<{ leads: Array<object>, totalCount: number, nextCursor: string|null }>}
   */
  async searchLeads(params = {}) {
    const limit = Math.min(Math.max(parseInt(params.limit, 10) || 20, 1), 50);
    const trade = params.trade ? String(params.trade).trim() : null;
    const location = params.location ? String(params.location).trim() : null;
    const verified = params.verified === true || params.verified === 'true';
    const cursor = params.cursor || null;

    // Perform query against repository (InMemory or DynamoDB GSI)
    const result = await this.repo.searchLeads({
      trade,
      location,
      verified,
      limit,
      cursor
    });

    const isAdmin = params.authenticatedUser && params.authenticatedUser.role === 'admin';

    // Apply server-side contact entitlement masking
    const sanitizedLeads = result.leads.map(lead => {
      const email = lead.email || `info@${lead.id}`;
      const phone = lead.phone || '+1 555 000 0000';

      return {
        id: lead.id,
        domain: lead.domain || lead.id,
        name: lead.name || lead.company_name,
        company_name: lead.company_name || lead.name,
        trade: lead.trade || lead.category,
        category: lead.category || lead.trade,
        city: lead.city || lead.location,
        location: lead.location || lead.city,
        speed: lead.speed || `${lead.speed_ms || 750}ms`,
        speed_ms: lead.speed_ms || 750,
        pixel: lead.pixel || (lead.meta_pixel ? 'Meta Pixel' : 'No Pixel'),
        meta_pixel: Boolean(lead.meta_pixel),
        google_ads: Boolean(lead.google_ads),
        cms: lead.cms || lead.tech || 'WordPress',
        tech: lead.tech || lead.cms || 'WordPress',
        mx_verified: Boolean(lead.mx_verified),
        createdAt: lead.createdAt || lead.created_at,
        // Sensitive contact fields: masked unless user is platform admin
        email: isAdmin ? email : maskEmail(email),
        phone: isAdmin ? phone : maskPhone(phone),
        isContactMasked: !isAdmin
      };
    });

    return {
      leads: sanitizedLeads,
      totalCount: result.totalCount,
      nextCursor: result.nextCursor
    };
  }

  /**
   * Admin-Only trigger for live crawler ingestion pipeline.
   * @param {object} authenticatedUser
   * @param {Array<object>} [candidateLeads]
   * @returns {Promise<object>}
   */
  async triggerRecrawl(authenticatedUser, candidateLeads = null) {
    if (!authenticatedUser) {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      throw err;
    }

    if (authenticatedUser.role !== 'admin') {
      const err = new Error('Access denied: Administrator privileges required to trigger crawler ingestion.');
      err.statusCode = 403;
      throw err;
    }

    const leads = Array.isArray(candidateLeads) && candidateLeads.length > 0 
      ? candidateLeads 
      : DEFAULT_CANDIDATE_LEADS;

    const result = await processLeadIngestionBatch(leads, {
      repository: this.repo
    });

    return {
      success: true,
      message: `Successfully executed crawler pipeline: ${result.persistedCount} verified leads ingested into DynamoDB leads_cache.`,
      processedCount: result.processedCount,
      verifiedCount: result.verifiedCount,
      persistedCount: result.persistedCount,
      timestamp: new Date().toISOString()
    };
  }
}

export const discoveryService = new DiscoveryService();
