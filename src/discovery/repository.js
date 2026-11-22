/**
 * ApexIntel B2B - Leads Discovery & Crawler Cache Repository
 * 
 * Table: leads_cache
 * - Partition Key: id (S, normalized domain e.g. "dallasroofer.com")
 * - GSI 1: trade-createdAt-index (PK: trade, SK: createdAt)
 * - GSI 2: city-createdAt-index (PK: city, SK: createdAt)
 * 
 * Deduplication Guarantee:
 * Domain-partitioned storage ensures idempotency during recrawls.
 * Historical buyer delivery tracking (delivered_to) is strictly preserved
 * during subsequent crawler ingestion runs.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';

export const LEADS_CACHE_TABLE = process.env.DYNAMODB_LEADS_TABLE || 'leads_cache';

/**
 * Normalize domain string to clean consistent partition key.
 * @param {string} rawDomain
 * @returns {string}
 */
export function normalizeDomain(rawDomain) {
  if (!rawDomain || typeof rawDomain !== 'string') return '';
  let domain = rawDomain.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//i, '');
  domain = domain.replace(/^www\./i, '');
  domain = domain.split('/')[0];
  domain = domain.split(':')[0];
  return domain;
}

/**
 * In-Memory Discovery Adapter for unit testing, CI/CD, and offline development.
 */
export class InMemoryDiscoveryRepository {
  constructor() {
    this.leadsByDomain = new Map(); // Key: domain id
  }

  async upsertLead(leadData) {
    const domain = normalizeDomain(leadData.id || leadData.domain || (leadData.email ? leadData.email.split('@')[1] : ''));
    if (!domain) {
      throw new Error('Valid domain id is required for lead ingestion.');
    }

    const now = new Date().toISOString();
    const existing = this.leadsByDomain.get(domain);

    // Preserve existing delivery tracking and creation timestamp across recrawls
    const deliveredTo = existing && Array.isArray(existing.delivered_to) 
      ? [...new Set([...existing.delivered_to, ...(leadData.delivered_to || [])])]
      : [...new Set(leadData.delivered_to || [])];

    const createdAt = existing?.createdAt || existing?.created_at || leadData.createdAt || leadData.created_at || now;

    const record = {
      ...leadData,
      id: domain,
      domain,
      company_name: leadData.company_name || leadData.name || existing?.company_name || domain,
      name: leadData.company_name || leadData.name || existing?.name || domain,
      trade: leadData.trade || leadData.category || existing?.trade || 'Contractors',
      category: leadData.trade || leadData.category || existing?.category || 'Contractors',
      city: leadData.city || leadData.location || existing?.city || 'Texas',
      location: leadData.city || leadData.location || existing?.location || 'Texas',
      email: leadData.email || existing?.email || `info@${domain}`,
      phone: leadData.phone || existing?.phone || '+1 555 000 0000',
      speed_ms: leadData.speed_ms !== undefined ? leadData.speed_ms : (existing?.speed_ms ?? 750),
      speed: leadData.speed || `${leadData.speed_ms || existing?.speed_ms || 750}ms`,
      pixel: leadData.pixel || (leadData.meta_pixel ? 'Meta Pixel' : 'No Pixel'),
      meta_pixel: leadData.meta_pixel !== undefined ? leadData.meta_pixel : (existing?.meta_pixel ?? false),
      google_ads: leadData.google_ads !== undefined ? leadData.google_ads : (existing?.google_ads ?? false),
      cms: leadData.cms || leadData.tech || existing?.cms || 'WordPress',
      tech: leadData.cms || leadData.tech || existing?.tech || 'WordPress',
      mx_verified: leadData.mx_verified !== undefined ? leadData.mx_verified : (existing?.mx_verified ?? true),
      delivered_to: deliveredTo,
      createdAt,
      created_at: createdAt,
      updatedAt: now,
      lastCrawledAt: now
    };

    this.leadsByDomain.set(domain, record);
    return { ...record };
  }

  async batchUpsertLeads(leads) {
    const results = [];
    for (const lead of leads) {
      const saved = await this.upsertLead(lead);
      results.push(saved);
    }
    return results;
  }

  async getLeadByDomain(rawDomain) {
    const domain = normalizeDomain(rawDomain);
    const lead = this.leadsByDomain.get(domain);
    return lead ? { ...lead } : null;
  }

  async recordDelivery(rawDomain, customerEmail) {
    const domain = normalizeDomain(rawDomain);
    const lead = this.leadsByDomain.get(domain);
    if (!lead) return false;

    const email = String(customerEmail).trim().toLowerCase();
    if (!lead.delivered_to) lead.delivered_to = [];
    if (!lead.delivered_to.includes(email)) {
      lead.delivered_to.push(email);
      lead.last_delivered_at = new Date().toISOString();
    }
    return true;
  }

  async searchLeads(options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 50);
    const tradeFilter = options.trade ? String(options.trade).trim().toLowerCase() : null;
    const locationFilter = options.location || options.city ? String(options.location || options.city).trim().toLowerCase() : null;
    const verifiedOnly = options.verified === true || options.verified === 'true';

    let matches = [];
    for (const record of this.leadsByDomain.values()) {
      if (verifiedOnly && !record.mx_verified) continue;

      if (tradeFilter) {
        const recordTrade = String(record.trade || record.category || '').toLowerCase();
        if (!recordTrade.includes(tradeFilter)) continue;
      }

      if (locationFilter) {
        const recordLoc = String(record.city || record.location || '').toLowerCase();
        if (!recordLoc.includes(locationFilter)) continue;
      }

      matches.push({ ...record });
    }

    // Sort descending by createdAt (newest first)
    matches.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Opaque base64 cursor pagination
    let startIndex = 0;
    if (options.cursor) {
      try {
        const decoded = Buffer.from(options.cursor, 'base64').toString('utf8');
        const cursorIdx = parseInt(decoded, 10);
        if (!isNaN(cursorIdx) && cursorIdx >= 0) {
          startIndex = cursorIdx;
        }
      } catch {
        startIndex = 0;
      }
    }

    const paginated = matches.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const nextCursor = nextIndex < matches.length 
      ? Buffer.from(String(nextIndex), 'utf8').toString('base64') 
      : null;

    return {
      leads: paginated,
      totalCount: matches.length,
      nextCursor
    };
  }

  clear() {
    this.leadsByDomain.clear();
  }
}

/**
 * DynamoDB Discovery Adapter for Production AWS Lambda & Edge Gateway.
 */
export class DynamoDBDiscoveryRepository {
  constructor(region = process.env.AWS_REGION || 'ap-southeast-2') {
    this.tableName = LEADS_CACHE_TABLE;
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
  }

  async upsertLead(leadData) {
    const domain = normalizeDomain(leadData.id || leadData.domain || (leadData.email ? leadData.email.split('@')[1] : ''));
    if (!domain) {
      throw new Error('Valid domain id is required for lead ingestion.');
    }

    const now = new Date().toISOString();

    // 1. Point lookup to preserve existing delivered_to and createdAt
    const existingRes = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { id: domain }
    }));
    const existing = existingRes.Item;

    const deliveredTo = existing && Array.isArray(existing.delivered_to)
      ? [...new Set([...existing.delivered_to, ...(leadData.delivered_to || [])])]
      : [...new Set(leadData.delivered_to || [])];

    const createdAt = existing?.createdAt || existing?.created_at || leadData.createdAt || leadData.created_at || now;

    const record = {
      ...leadData,
      id: domain,
      domain,
      company_name: leadData.company_name || leadData.name || existing?.company_name || domain,
      name: leadData.company_name || leadData.name || existing?.name || domain,
      trade: leadData.trade || leadData.category || existing?.trade || 'Contractors',
      category: leadData.trade || leadData.category || existing?.category || 'Contractors',
      city: leadData.city || leadData.location || existing?.city || 'Texas',
      location: leadData.city || leadData.location || existing?.location || 'Texas',
      email: leadData.email || existing?.email || `info@${domain}`,
      phone: leadData.phone || existing?.phone || '+1 555 000 0000',
      speed_ms: leadData.speed_ms !== undefined ? leadData.speed_ms : (existing?.speed_ms ?? 750),
      speed: leadData.speed || `${leadData.speed_ms || existing?.speed_ms || 750}ms`,
      pixel: leadData.pixel || (leadData.meta_pixel ? 'Meta Pixel' : 'No Pixel'),
      meta_pixel: leadData.meta_pixel !== undefined ? leadData.meta_pixel : (existing?.meta_pixel ?? false),
      google_ads: leadData.google_ads !== undefined ? leadData.google_ads : (existing?.google_ads ?? false),
      cms: leadData.cms || leadData.tech || existing?.cms || 'WordPress',
      tech: leadData.cms || leadData.tech || existing?.tech || 'WordPress',
      mx_verified: leadData.mx_verified !== undefined ? leadData.mx_verified : (existing?.mx_verified ?? true),
      delivered_to: deliveredTo,
      createdAt,
      created_at: createdAt,
      updatedAt: now,
      lastCrawledAt: now
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: record
    }));

    return record;
  }

  async batchUpsertLeads(leads) {
    const results = [];
    for (const lead of leads) {
      const saved = await this.upsertLead(lead);
      results.push(saved);
    }
    return results;
  }

  async getLeadByDomain(rawDomain) {
    const domain = normalizeDomain(rawDomain);
    const res = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { id: domain }
    }));
    return res.Item || null;
  }

  async recordDelivery(rawDomain, customerEmail) {
    const domain = normalizeDomain(rawDomain);
    const email = String(customerEmail).trim().toLowerCase();

    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { id: domain },
        UpdateExpression: 'SET delivered_to = list_append(if_not_exists(delivered_to, :empty_list), :new_email), last_delivered_at = :now',
        ExpressionAttributeValues: {
          ':empty_list': [],
          ':new_email': [email],
          ':now': new Date().toISOString()
        }
      }));
      return true;
    } catch (err) {
      console.warn(`[recordDelivery] Failed to record delivery for ${domain}: ${err.message}`);
      return false;
    }
  }

  async searchLeads(options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 50);
    const tradeFilter = options.trade ? String(options.trade).trim() : null;
    const locationFilter = options.location || options.city ? String(options.location || options.city).trim() : null;
    const verifiedOnly = options.verified === true || options.verified === 'true';

    let exclusiveStartKey = null;
    if (options.cursor) {
      try {
        const decoded = Buffer.from(options.cursor, 'base64').toString('utf8');
        exclusiveStartKey = JSON.parse(decoded);
      } catch {
        exclusiveStartKey = null;
      }
    }

    let command;

    if (tradeFilter) {
      // Use GSI: trade-createdAt-index
      let filterExpr = [];
      const exprAttrNames = { '#trade': 'trade' };
      const exprAttrValues = { ':trade': tradeFilter };

      if (locationFilter) {
        filterExpr.push('contains(#city, :city)');
        exprAttrNames['#city'] = 'city';
        exprAttrValues[':city'] = locationFilter;
      }
      if (verifiedOnly) {
        filterExpr.push('#mx = :mx');
        exprAttrNames['#mx'] = 'mx_verified';
        exprAttrValues[':mx'] = true;
      }

      command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'trade-createdAt-index',
        KeyConditionExpression: '#trade = :trade',
        FilterExpression: filterExpr.length > 0 ? filterExpr.join(' AND ') : undefined,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey || undefined
      });
    } else if (locationFilter) {
      // Use GSI: city-createdAt-index
      let filterExpr = [];
      const exprAttrNames = { '#city': 'city' };
      const exprAttrValues = { ':city': locationFilter };

      if (verifiedOnly) {
        filterExpr.push('#mx = :mx');
        exprAttrNames['#mx'] = 'mx_verified';
        exprAttrValues[':mx'] = true;
      }

      command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'city-createdAt-index',
        KeyConditionExpression: '#city = :city',
        FilterExpression: filterExpr.length > 0 ? filterExpr.join(' AND ') : undefined,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey || undefined
      });
    } else {
      // General scan with limit
      let filterExpr = [];
      const exprAttrNames = {};
      const exprAttrValues = {};

      if (verifiedOnly) {
        filterExpr.push('#mx = :mx');
        exprAttrNames['#mx'] = 'mx_verified';
        exprAttrValues[':mx'] = true;
      }

      command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: filterExpr.length > 0 ? filterExpr.join(' AND ') : undefined,
        ExpressionAttributeNames: Object.keys(exprAttrNames).length > 0 ? exprAttrNames : undefined,
        ExpressionAttributeValues: Object.keys(exprAttrValues).length > 0 ? exprAttrValues : undefined,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey || undefined
      });
    }

    const res = await this.docClient.send(command);
    const leads = res.Items || [];

    const nextCursor = res.LastEvaluatedKey 
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey), 'utf8').toString('base64') 
      : null;

    return {
      leads,
      totalCount: leads.length,
      nextCursor
    };
  }
}

let activeDiscoveryRepository = null;

export function getDiscoveryRepository() {
  if (activeDiscoveryRepository) return activeDiscoveryRepository;

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (process.env.USE_MOCK_STORAGE === 'true' || process.env.NODE_ENV === 'test') {
    activeDiscoveryRepository = new InMemoryDiscoveryRepository();
  } else if (isProduction) {
    // Fail closed in production/Lambda: never silently fall back to in-memory storage
    activeDiscoveryRepository = new DynamoDBDiscoveryRepository();
  } else {
    // Development fallback
    try {
      activeDiscoveryRepository = new DynamoDBDiscoveryRepository();
    } catch (err) {
      console.warn(`[getDiscoveryRepository] DynamoDB Discovery initialization failed in development: ${err.message}. Falling back to InMemoryDiscoveryRepository.`);
      activeDiscoveryRepository = new InMemoryDiscoveryRepository();
    }
  }

  return activeDiscoveryRepository;
}

export function setDiscoveryRepository(repo) {
  activeDiscoveryRepository = repo;
}
