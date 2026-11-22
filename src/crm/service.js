/**
 * ApexIntel B2B - Multi-Tenant CRM Business Logic Service
 * 
 * Enforces:
 * - 11 Pipeline Stage Integrity
 * - Strict Data Validation & String Sanitization
 * - Maximum Batch Limits (preventing memory exhaustion)
 * - Strict Tenant Scoping on all CRUD operations
 */

import crypto from 'node:crypto';
import validator from 'validator';
import { getCrmRepository } from './repository.js';

export const VALID_PIPELINE_STAGES = new Set([
  'New',
  'Qualified',
  'Ready to Contact',
  'Contacted',
  'Follow-Up',
  'Responded',
  'Meeting Scheduled',
  'Proposal',
  'Won',
  'Lost',
  'Not Qualified'
]);

export const MAX_BATCH_LEADS = 50;

export class CrmService {
  constructor(options = {}) {
    this._customRepo = options.repository || null;
  }

  get repo() {
    return this._customRepo || getCrmRepository();
  }

  set repo(val) {
    this._customRepo = val;
  }

  /**
   * Sanitize string input to prevent XSS / control character injections.
   * @param {string} val 
   * @param {number} [maxLen=255]
   * @returns {string}
   */
  static sanitizeString(val, maxLen = 255) {
    if (val === undefined || val === null) return '';
    return String(val)
      .trim()
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .substring(0, maxLen);
  }

  /**
   * Validate and sanitize a lead input object.
   * @param {object} input 
   * @returns {object}
   */
  static validateLeadInput(input = {}) {
    const company = CrmService.sanitizeString(input.company || input.name, 200);
    if (!company) {
      const err = new Error('Lead company name is required.');
      err.statusCode = 400;
      throw err;
    }

    const domain = CrmService.sanitizeString(input.domain, 150).toLowerCase();
    const contactName = CrmService.sanitizeString(input.contactName, 150);
    const email = CrmService.sanitizeString(input.email, 150).toLowerCase();
    if (email && !validator.isEmail(email)) {
      const err = new Error('Invalid contact email format.');
      err.statusCode = 400;
      throw err;
    }

    const phone = CrmService.sanitizeString(input.phone, 50);
    const city = CrmService.sanitizeString(input.city, 100);
    const territory = CrmService.sanitizeString(input.territory, 100);
    const industry = CrmService.sanitizeString(input.industry, 150);

    let status = input.status ? String(input.status).trim() : 'New';
    if (!VALID_PIPELINE_STAGES.has(status)) {
      status = 'New';
    }

    let priority = input.priority ? String(input.priority).toUpperCase().trim() : 'P2';
    if (!['P1', 'P2', 'P3'].includes(priority)) {
      priority = 'P2';
    }

    let opportunityScore = parseInt(input.opportunityScore, 10);
    if (isNaN(opportunityScore) || opportunityScore < 0 || opportunityScore > 100) {
      opportunityScore = 75;
    }

    let speed_ms = parseInt(input.speed_ms, 10);
    if (isNaN(speed_ms) || speed_ms < 0) {
      speed_ms = 850;
    }

    const metaPixel = Boolean(input.metaPixel);
    const googleAds = Boolean(input.googleAds);
    const campaignId = CrmService.sanitizeString(input.campaignId, 100) || null;

    // Sanitize tags
    let tags = [];
    if (Array.isArray(input.tags)) {
      tags = input.tags
        .map(t => CrmService.sanitizeString(t, 50).toLowerCase())
        .filter(Boolean)
        .slice(0, 20);
      tags = [...new Set(tags)];
    }

    // Sanitize notes
    let notes = [];
    if (Array.isArray(input.notes)) {
      notes = input.notes.map(n => ({
        id: CrmService.sanitizeString(n.id || `n_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, 50),
        timestamp: n.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 16),
        author: CrmService.sanitizeString(n.author || 'Agent', 100),
        text: CrmService.sanitizeString(n.text, 2000)
      })).filter(n => n.text.length > 0);
    }

    // Sanitize follow-up date (YYYY-MM-DD)
    let followUpDate = null;
    if (input.followUpDate) {
      const trimmedDate = String(input.followUpDate).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        followUpDate = trimmedDate;
      }
    }

    return {
      company,
      domain,
      contactName,
      email,
      phone,
      city,
      territory,
      industry,
      status,
      priority,
      opportunityScore,
      speed_ms,
      metaPixel,
      googleAds,
      campaignId,
      tags,
      notes,
      followUpDate
    };
  }

  async listLeads(userId, options = {}) {
    if (!userId) {
      const err = new Error('Tenant identification is required.');
      err.statusCode = 401;
      throw err;
    }
    return this.repo.findLeadsByUserId(userId, options);
  }

  async getLead(userId, leadId) {
    if (!userId || !leadId) {
      const err = new Error('Lead ID and User ID are required.');
      err.statusCode = 400;
      throw err;
    }
    const lead = await this.repo.findLeadById(userId, leadId);
    if (!lead) {
      const err = new Error(`Lead '${leadId}' not found.`);
      err.statusCode = 404;
      throw err;
    }
    return lead;
  }

  async createLead(userId, input) {
    if (!userId) {
      const err = new Error('Tenant identification is required.');
      err.statusCode = 401;
      throw err;
    }
    const validated = CrmService.validateLeadInput(input);
    return this.repo.createLead(userId, validated);
  }

  async batchCreateLeads(userId, leadsArray) {
    if (!userId) {
      const err = new Error('Tenant identification is required.');
      err.statusCode = 401;
      throw err;
    }

    if (!Array.isArray(leadsArray) || leadsArray.length === 0) {
      const err = new Error('Leads payload must be a non-empty array.');
      err.statusCode = 400;
      throw err;
    }

    if (leadsArray.length > MAX_BATCH_LEADS) {
      const err = new Error(`Batch ingestion capped at maximum ${MAX_BATCH_LEADS} leads per request.`);
      err.statusCode = 400;
      throw err;
    }

    const validatedArray = leadsArray.map(l => CrmService.validateLeadInput(l));
    return this.repo.batchCreateLeads(userId, validatedArray);
  }

  async updateLead(userId, leadId, updates) {
    if (!userId || !leadId) {
      const err = new Error('Lead ID and User ID are required.');
      err.statusCode = 400;
      throw err;
    }

    const cleanUpdates = {};

    if (updates.status !== undefined) {
      const st = String(updates.status).trim();
      if (!VALID_PIPELINE_STAGES.has(st)) {
        const err = new Error(`Invalid pipeline stage '${st}'. Must be one of the 11 valid stages.`);
        err.statusCode = 400;
        throw err;
      }
      cleanUpdates.status = st;
    }

    if (updates.company !== undefined) {
      cleanUpdates.company = CrmService.sanitizeString(updates.company, 200);
    }
    if (updates.domain !== undefined) {
      cleanUpdates.domain = CrmService.sanitizeString(updates.domain, 150).toLowerCase();
    }
    if (updates.contactName !== undefined) {
      cleanUpdates.contactName = CrmService.sanitizeString(updates.contactName, 150);
    }
    if (updates.email !== undefined) {
      cleanUpdates.email = CrmService.sanitizeString(updates.email, 150).toLowerCase();
    }
    if (updates.phone !== undefined) {
      cleanUpdates.phone = CrmService.sanitizeString(updates.phone, 50);
    }
    if (updates.city !== undefined) {
      cleanUpdates.city = CrmService.sanitizeString(updates.city, 100);
    }
    if (updates.priority !== undefined) {
      cleanUpdates.priority = ['P1', 'P2', 'P3'].includes(String(updates.priority).toUpperCase())
        ? String(updates.priority).toUpperCase()
        : 'P2';
    }
    if (updates.opportunityScore !== undefined) {
      const score = parseInt(updates.opportunityScore, 10);
      cleanUpdates.opportunityScore = !isNaN(score) ? Math.min(Math.max(score, 0), 100) : 75;
    }
    if (updates.tags !== undefined && Array.isArray(updates.tags)) {
      cleanUpdates.tags = updates.tags
        .map(t => CrmService.sanitizeString(t, 50).toLowerCase())
        .filter(Boolean)
        .slice(0, 20);
    }
    if (updates.notes !== undefined && Array.isArray(updates.notes)) {
      cleanUpdates.notes = updates.notes.map(n => ({
        id: CrmService.sanitizeString(n.id || `n_${Date.now()}`, 50),
        timestamp: n.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 16),
        author: CrmService.sanitizeString(n.author || 'Agent', 100),
        text: CrmService.sanitizeString(n.text, 2000)
      })).filter(n => n.text.length > 0);
    }
    if (updates.followUpDate !== undefined) {
      if (updates.followUpDate && /^\d{4}-\d{2}-\d{2}$/.test(String(updates.followUpDate).trim())) {
        cleanUpdates.followUpDate = String(updates.followUpDate).trim();
      } else {
        cleanUpdates.followUpDate = null;
      }
    }

    return this.repo.updateLead(userId, leadId, cleanUpdates);
  }

  async deleteLead(userId, leadId) {
    if (!userId || !leadId) {
      const err = new Error('Lead ID and User ID are required.');
      err.statusCode = 400;
      throw err;
    }
    return this.repo.deleteLead(userId, leadId);
  }
}

export const crmService = new CrmService();
