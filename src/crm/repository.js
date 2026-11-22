/**
 * ApexIntel B2B - Multi-Tenant CRM Data Repository
 * 
 * Enforces strict per-tenant data partitioning in DynamoDB:
 * - Table: apexintel_user_crm
 * - Partition Key: userId (S)
 * - Sort Key: leadId (S)
 * 
 * Cross-tenant isolation guarantee:
 * Every data access query, mutation, and deletion is strictly bound to the authenticated
 * user's userId. It is physically impossible to access another user's leads.
 */

import crypto from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';

export const CRM_TABLE_NAME = process.env.DYNAMODB_CRM_TABLE || 'apexintel_user_crm';

/**
 * In-Memory CRM Adapter for unit testing, CI/CD, and offline development.
 */
export class InMemoryCrmRepository {
  constructor() {
    this.leadsByKey = new Map(); // Key: `${userId}#${leadId}`
  }

  _compositeKey(userId, leadId) {
    return `${userId}#${leadId}`;
  }

  async findLeadsByUserId(userId, options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
    const filterStatus = options.status ? String(options.status).trim() : null;

    let userLeads = [];
    for (const [key, record] of this.leadsByKey.entries()) {
      if (record.userId === userId) {
        if (!filterStatus || record.status === filterStatus) {
          userLeads.push({ ...record });
        }
      }
    }

    // Sort by updatedAt descending (newest first)
    userLeads.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

    // Simple cursor offset pagination
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

    const paginated = userLeads.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const nextCursor = nextIndex < userLeads.length 
      ? Buffer.from(String(nextIndex), 'utf8').toString('base64') 
      : null;

    return {
      leads: paginated,
      totalCount: userLeads.length,
      nextCursor
    };
  }

  async findLeadById(userId, leadId) {
    const record = this.leadsByKey.get(this._compositeKey(userId, leadId));
    if (!record || record.userId !== userId) {
      return null;
    }
    return { ...record };
  }

  async createLead(userId, leadData) {
    const leadId = leadData.leadId || leadData.id || `lead_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const record = {
      ...leadData,
      id: leadId,
      leadId,
      userId,
      createdAt: leadData.createdAt || now,
      updatedAt: now
    };

    this.leadsByKey.set(this._compositeKey(userId, leadId), record);
    return { ...record };
  }

  async batchCreateLeads(userId, leadsArray) {
    const saved = [];
    for (const lead of leadsArray) {
      const res = await this.createLead(userId, lead);
      saved.push(res);
    }
    return saved;
  }

  async updateLead(userId, leadId, updates) {
    const key = this._compositeKey(userId, leadId);
    const existing = this.leadsByKey.get(key);
    if (!existing || existing.userId !== userId) {
      const err = new Error(`Lead '${leadId}' not found for user.`);
      err.statusCode = 404;
      throw err;
    }

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      ...updates,
      leadId,
      id: leadId,
      userId,
      updatedAt: now
    };

    this.leadsByKey.set(key, updated);
    return { ...updated };
  }

  async deleteLead(userId, leadId) {
    const key = this._compositeKey(userId, leadId);
    const existing = this.leadsByKey.get(key);
    if (!existing || existing.userId !== userId) {
      const err = new Error(`Lead '${leadId}' not found for user.`);
      err.statusCode = 404;
      throw err;
    }

    this.leadsByKey.delete(key);
    return { success: true, leadId };
  }

  clear() {
    this.leadsByKey.clear();
  }
}

/**
 * Production DynamoDB CRM Repository.
 */
export class DynamoDBCrmRepository {
  constructor(options = {}) {
    const region = options.region || process.env.AWS_REGION || 'ap-southeast-2';
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
    this.tableName = CRM_TABLE_NAME;
  }

  async findLeadsByUserId(userId, options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
    const filterStatus = options.status ? String(options.status).trim() : null;

    let queryParams;
    if (filterStatus) {
      queryParams = {
        TableName: this.tableName,
        IndexName: 'userId-status-index',
        KeyConditionExpression: 'userId = :uid AND #st = :status',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':uid': userId,
          ':status': filterStatus
        },
        Limit: limit
      };
    } else {
      queryParams = {
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: limit,
        ScanIndexForward: false
      };
    }

    if (options.cursor) {
      try {
        const decoded = Buffer.from(options.cursor, 'base64').toString('utf8');
        queryParams.ExclusiveStartKey = JSON.parse(decoded);
      } catch {
        // Ignore invalid cursor
      }
    }

    const res = await this.docClient.send(new QueryCommand(queryParams));
    const leads = (res.Items || []).map(item => ({
      ...item,
      id: item.leadId || item.id
    }));

    let nextCursor = null;
    if (res.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(res.LastEvaluatedKey), 'utf8').toString('base64');
    }

    return {
      leads,
      totalCount: leads.length,
      nextCursor
    };
  }

  async findLeadById(userId, leadId) {
    const res = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { userId, leadId }
    }));

    if (!res.Item) return null;
    return {
      ...res.Item,
      id: res.Item.leadId || res.Item.id
    };
  }

  async createLead(userId, leadData) {
    const leadId = leadData.leadId || leadData.id || `lead_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const record = {
      ...leadData,
      id: leadId,
      leadId,
      userId,
      createdAt: leadData.createdAt || now,
      updatedAt: now
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: record
    }));

    return record;
  }

  async batchCreateLeads(userId, leadsArray) {
    const now = new Date().toISOString();
    const saved = [];

    // DynamoDB BatchWriteItem supports max 25 items per request
    const chunks = [];
    for (let i = 0; i < leadsArray.length; i += 25) {
      chunks.push(leadsArray.slice(i, i + 25));
    }

    for (const chunk of chunks) {
      const putRequests = chunk.map(leadData => {
        const leadId = leadData.leadId || leadData.id || `lead_${crypto.randomUUID()}`;
        const record = {
          ...leadData,
          id: leadId,
          leadId,
          userId,
          createdAt: leadData.createdAt || now,
          updatedAt: now
        };
        saved.push(record);
        return {
          PutRequest: { Item: record }
        };
      });

      await this.docClient.send(new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: putRequests
        }
      }));
    }

    return saved;
  }

  async updateLead(userId, leadId, updates) {
    const now = new Date().toISOString();
    const cleanUpdates = { ...updates };
    delete cleanUpdates.userId;
    delete cleanUpdates.leadId;
    delete cleanUpdates.id;

    cleanUpdates.updatedAt = now;

    const entries = Object.entries(cleanUpdates);
    if (entries.length === 0) {
      return this.findLeadById(userId, leadId);
    }

    const setExprs = [];
    const attrNames = {};
    const attrValues = {};

    entries.forEach(([key, val], idx) => {
      const nameKey = `#k_${idx}`;
      const valKey = `:v_${idx}`;
      setExprs.push(`${nameKey} = ${valKey}`);
      attrNames[nameKey] = key;
      attrValues[valKey] = val;
    });

    try {
      const res = await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { userId, leadId },
        UpdateExpression: `SET ${setExprs.join(', ')}`,
        ConditionExpression: 'attribute_exists(userId) AND attribute_exists(leadId)',
        ExpressionAttributeNames: attrNames,
        ExpressionAttributeValues: attrValues,
        ReturnValues: 'ALL_NEW'
      }));

      return {
        ...res.Attributes,
        id: res.Attributes.leadId || res.Attributes.id
      };
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        const error = new Error(`Lead '${leadId}' not found for user.`);
        error.statusCode = 404;
        throw error;
      }
      throw err;
    }
  }

  async deleteLead(userId, leadId) {
    try {
      await this.docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { userId, leadId },
        ConditionExpression: 'attribute_exists(userId) AND attribute_exists(leadId)'
      }));
      return { success: true, leadId };
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        const error = new Error(`Lead '${leadId}' not found for user.`);
        error.statusCode = 404;
        throw error;
      }
      throw err;
    }
  }
}

let activeCrmRepository = null;

export function getCrmRepository() {
  if (activeCrmRepository) return activeCrmRepository;

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (process.env.USE_MOCK_STORAGE === 'true' || process.env.NODE_ENV === 'test') {
    activeCrmRepository = new InMemoryCrmRepository();
  } else if (isProduction) {
    // Fail closed in production/Lambda: never silently fall back to in-memory storage
    activeCrmRepository = new DynamoDBCrmRepository();
  } else {
    // Development fallback
    try {
      activeCrmRepository = new DynamoDBCrmRepository();
    } catch (err) {
      console.warn(`[getCrmRepository] DynamoDB CRM initialization failed in development: ${err.message}. Falling back to InMemoryCrmRepository.`);
      activeCrmRepository = new InMemoryCrmRepository();
    }
  }

  return activeCrmRepository;
}

export function setCrmRepository(repo) {
  activeCrmRepository = repo;
}
