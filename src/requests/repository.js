/**
 * ApexIntel B2B - Custom Extraction Requests Repository
 * 
 * Provides persistent storage for custom data extraction requests:
 * - InMemoryRequestsRepository (for testing and local dev)
 * - DynamoDBRequestsRepository (for AWS Lambda production execution on apexintel_custom_requests)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  QueryCommand, 
  ScanCommand, 
  UpdateCommand 
} from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.CUSTOM_REQUESTS_TABLE_NAME || 'apexintel_custom_requests';

// ============================================================================
// IN-MEMORY REPOSITORY (For Testing & Local Dev)
// ============================================================================

export class InMemoryRequestsRepository {
  constructor() {
    this.requests = new Map();
  }

  async createRequest(record) {
    if (!record || !record.requestId) {
      throw new Error('Request record must include a requestId.');
    }
    const copy = { ...record };
    this.requests.set(record.requestId, copy);
    return { ...copy };
  }

  async getRequestById(requestId) {
    if (!requestId) return null;
    const item = this.requests.get(requestId);
    return item ? { ...item } : null;
  }

  async listRequestsByUserId(userId, options = {}) {
    if (!userId) return [];
    const results = [];
    for (const req of this.requests.values()) {
      if (req.userId === userId) {
        results.push({ ...req });
      }
    }
    // Sort by createdAt descending
    results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (options.limit && results.length > options.limit) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  async listAllRequests(options = {}) {
    let results = Array.from(this.requests.values()).map(r => ({ ...r }));
    if (options.status) {
      results = results.filter(r => String(r.status || '').toLowerCase() === String(options.status).toLowerCase());
    }
    results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (options.limit && results.length > options.limit) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  async updateRequestStatus(requestId, updates = {}) {
    const existing = this.requests.get(requestId);
    if (!existing) {
      throw new Error(`Request '${requestId}' not found.`);
    }

    const updated = {
      ...existing,
      ...updates,
      requestId,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };

    this.requests.set(requestId, updated);
    return { ...updated };
  }

  clear() {
    this.requests.clear();
  }
}

// ============================================================================
// DYNAMODB REPOSITORY (For AWS Lambda Production)
// ============================================================================

export class DynamoDBRequestsRepository {
  constructor(options = {}) {
    this.tableName = options.tableName || TABLE_NAME;
    const region = options.region || process.env.AWS_REGION || 'ap-southeast-2';

    const clientConfig = { region };
    if (process.env.DYNAMODB_ENDPOINT) {
      clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
    }

    const ddbClient = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: { removeUndefinedValues: true }
    });
  }

  async createRequest(record) {
    if (!record || !record.requestId) {
      throw new Error('Request record must include a requestId.');
    }

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: record
      }));
      return record;
    } catch (err) {
      const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isProduction) {
        throw new Error(`DynamoDB Custom Requests write failed in production: ${err.message}`);
      }
      console.warn(`[DynamoDBRequestsRepository] Write error: ${err.message}`);
      return record;
    }
  }

  async getRequestById(requestId) {
    if (!requestId) return null;

    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { requestId }
      }));
      return result.Item || null;
    } catch (err) {
      const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isProduction) {
        throw new Error(`DynamoDB Custom Requests read failed in production: ${err.message}`);
      }
      console.warn(`[DynamoDBRequestsRepository] Read error: ${err.message}`);
      return null;
    }
  }

  async listRequestsByUserId(userId, options = {}) {
    if (!userId) return [];

    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false, // Descending order
        Limit: options.limit || 50
      }));
      return result.Items || [];
    } catch (err) {
      const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isProduction) {
        throw new Error(`DynamoDB Custom Requests user query failed in production: ${err.message}`);
      }
      console.warn(`[DynamoDBRequestsRepository] Query error: ${err.message}`);
      return [];
    }
  }

  async listAllRequests(options = {}) {
    const items = [];
    const pageSize = Math.min(Math.max(Number(options.pageSize) || 100, 1), 1000);
    let ExclusiveStartKey;

    do {
      const params = {
        TableName: this.tableName,
        Limit: pageSize,
        ExclusiveStartKey
      };

      let result;
      if (options.status) {
        params.IndexName = 'status-createdAt-index';
        params.KeyConditionExpression = '#st = :st';
        params.ExpressionAttributeNames = { '#st': 'status' };
        params.ExpressionAttributeValues = { ':st': options.status };
        params.ScanIndexForward = false;
        result = await this.docClient.send(new QueryCommand(params));
      } else {
        result = await this.docClient.send(new ScanCommand(params));
      }

      items.push(...(result.Items || []));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey && (!options.limit || items.length < options.limit));

    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return options.limit ? items.slice(0, options.limit) : items;
  }

  async updateRequestStatus(requestId, updates = {}) {
    if (!requestId) throw new Error('requestId is required for status update.');

    const now = updates.updatedAt || new Date().toISOString();
    let updateExp = 'SET #st = :st, updatedAt = :ua';
    const expNames = { '#st': 'status' };
    const expValues = {
      ':st': updates.status,
      ':ua': now
    };

    if (updates.notes !== undefined) {
      updateExp += ', notes = :notes';
      expValues[':notes'] = updates.notes;
    }

    if (updates.adminUserId) {
      updateExp += ', adminUserId = :auid';
      expValues[':auid'] = updates.adminUserId;
    }

    try {
      const result = await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { requestId },
        UpdateExpression: updateExp,
        ExpressionAttributeNames: expNames,
        ExpressionAttributeValues: expValues,
        ReturnValues: 'ALL_NEW'
      }));
      return result.Attributes;
    } catch (err) {
      const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isProduction) {
        throw new Error(`DynamoDB Custom Requests update failed in production: ${err.message}`);
      }
      console.warn(`[DynamoDBRequestsRepository] Update error: ${err.message}`);
      return { requestId, ...updates, updatedAt: now };
    }
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let currentRequestsRepo = null;

export function getRequestsRepository() {
  if (currentRequestsRepo) return currentRequestsRepo;

  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (process.env.USE_MOCK_STORAGE === 'true' || process.env.NODE_ENV === 'test') {
    currentRequestsRepo = new InMemoryRequestsRepository();
  } else if (isProduction) {
    currentRequestsRepo = new DynamoDBRequestsRepository();
  } else {
    try {
      currentRequestsRepo = new DynamoDBRequestsRepository();
    } catch (err) {
      console.warn(`[getRequestsRepository] DynamoDB initialization failed in development: ${err.message}. Falling back to InMemoryRequestsRepository.`);
      currentRequestsRepo = new InMemoryRequestsRepository();
    }
  }

  return currentRequestsRepo;
}

export function setRequestsRepository(repo) {
  currentRequestsRepo = repo;
}
