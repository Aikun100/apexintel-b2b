/**
 * ApexIntel B2B - Discovery & Crawler Ingestion Service
 * 
 * Responsibilities:
 * 1. Filtered, paginated live discovery queries with contact masking for public visitors
 * 2. Admin-only emergency recrawl trigger invoking the live ingestion pipeline
 * 3. Server-side contact entitlement enforcement (unauthenticated visitors receive masked preview fields)
 */

import { getDiscoveryRepository } from './repository.js';
import { processLeadIngestionBatch } from '../../aws/lambda-crawler-handler.mjs';
import { scoreLead } from '../tools/opportunity-scorer.js';

/**
 * Mask an email address for public preview (e.g. "info@dallasroofer.com" -> "in**@dallasroofer.com")
 * @param {string} email
 * @returns {string}
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null;
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
  if (!phone || typeof phone !== 'string') return null;
  const parts = phone.trim().split(' ');
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} *** ${parts[3]}`;
  }
  return phone.substring(0, 6) + ' *** ' + phone.slice(-4);
}

export class DiscoveryService {
  constructor(options = {}) {
    this._repo = options.repository || null;
    this.resolveMx = options.resolveMx || null;
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
    const rawTrade = params.trade ? String(params.trade).trim() : null;
    let trade = rawTrade;
    let location = params.location ? String(params.location).trim() : null;
    if (rawTrade) {
      const alias = rawTrade.toLowerCase();
      if (alias === 'texas') { trade = null; location = location || ', TX'; }
      else if (alias === 'florida') { trade = null; location = location || ', FL'; }
      else if (alias === 'medspas') { trade = 'MedSpas'; }
      else if (alias === 'hvac') { trade = 'HVAC'; }
    }
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
      const email = typeof lead.email === 'string' ? lead.email : null;
      const phone = typeof lead.phone === 'string' ? lead.phone : null;
      const speedMs = Number.isFinite(Number(lead.speed_ms)) && lead.speed_ms !== null
        ? Number(lead.speed_ms)
        : null;
      const metaPixel = typeof lead.meta_pixel === 'boolean' ? lead.meta_pixel : null;
      const googleAds = typeof lead.google_ads === 'boolean' ? lead.google_ads : null;
      const opportunity = scoreLead({
        speed_ms: speedMs,
        meta_pixel: metaPixel,
        google_ads: googleAds,
        email,
        phone,
        mx_verified: typeof lead.mx_verified === 'boolean' ? lead.mx_verified : null,
        cms: lead.cms || lead.tech || null,
        trade: lead.trade || lead.category || null,
        title: lead.title,
        metaDesc: lead.metaDesc,
        seoIssues: lead.seoIssues,
        sslDetails: lead.sslDetails,
        securityHeaders: lead.securityHeaders,
        pixels: lead.pixels,
        scanStatus: lead.scanStatus
      });

      return {
        id: lead.id,
        domain: lead.domain || lead.id,
        name: lead.name || lead.company_name || null,
        company_name: lead.company_name || lead.name || null,
        trade: lead.trade || lead.category || null,
        category: lead.category || lead.trade || null,
        city: lead.city || lead.location || null,
        location: lead.location || lead.city || null,
        speed: lead.speed || (speedMs !== null ? `${speedMs}ms` : null),
        speed_ms: speedMs,
        pixel: lead.pixel || (metaPixel === null ? null : (metaPixel ? 'Meta Pixel' : 'No Pixel')),
        meta_pixel: metaPixel,
        google_ads: googleAds,
        cms: lead.cms || lead.tech || null,
        tech: lead.tech || lead.cms || null,
        mx_verified: typeof lead.mx_verified === 'boolean' ? lead.mx_verified : null,
        opportunityScore: opportunity.score,
        opportunityGrade: opportunity.grade,
        opportunityFactors: opportunity.factors,
        provenance: opportunity.provenance,
        createdAt: lead.createdAt || lead.created_at || null,
        // Sensitive contact fields: masked unless user is platform admin; missing values stay unavailable.
        email: isAdmin ? email : maskEmail(email),
        phone: isAdmin ? phone : maskPhone(phone),
        isContactMasked: !isAdmin && Boolean(email || phone)
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

    if (!Array.isArray(candidateLeads) || candidateLeads.length === 0) {
      const err = new Error('No crawl candidates were supplied. Connect a live source or submit an explicit lead batch before running ingestion.');
      err.statusCode = 400;
      throw err;
    }

    const result = await processLeadIngestionBatch(candidateLeads, {
      repository: this.repo,
      resolveMx: this.resolveMx
    });

    return {
      success: true,
      message: `Processed ${result.processedCount} supplied records; ${result.verifiedCount} domains returned MX records.`,
      processedCount: result.processedCount,
      verifiedCount: result.verifiedCount,
      persistedCount: result.persistedCount,
      timestamp: new Date().toISOString()
    };
  }
}

export const discoveryService = new DiscoveryService();
