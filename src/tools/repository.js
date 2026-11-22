/**
 * ApexIntel B2B - Website Scans Repository & Caching Engine
 * 
 * Provides 7-day TTL caching for domain intelligence scans to prevent redundant
 * external network scans and conserve serverless execution resources.
 * 
 * Storage Backends:
 * - InMemoryScansRepository (for automated tests and local development)
 * - DynamoDBScansRepository (for AWS Lambda production execution on apexintel_scans_cache)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.SCANS_TABLE_NAME || 'apexintel_scans_cache';
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604,800 seconds

// ============================================================================
// IN-MEMORY REPOSITORY (For Testing & Local Dev)
// ============================================================================

export class InMemoryScansRepository {
  constructor() {
    this.scans = new Map();
  }

  async getCachedScan(domain) {
    if (!domain) return null;
    const key = domain.trim().toLowerCase();
    const record = this.scans.get(key);
    if (!record) return null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (record.ttl && record.ttl < nowSeconds) {
      this.scans.delete(key);
      return null;
    }

    return { ...record };
  }

  async saveScan(scanData) {
    if (!scanData || !scanData.domain) {
      throw new Error('Scan data must include a domain.');
    }
    const key = scanData.domain.trim().toLowerCase();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl = scanData.ttl || (nowSeconds + SEVEN_DAYS_SECONDS);

    const record = {
      ...scanData,
      domain: key,
      ttl,
      savedAt: new Date().toISOString()
    };

    this.scans.set(key, record);
    return { ...record };
  }

  clear() {
    this.scans.clear();
  }
}

// ============================================================================
// DYNAMODB REPOSITORY (For Production AWS Lambda)
// ============================================================================

export class DynamoDBScansRepository {
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

  async getCachedScan(domain) {
    if (!domain) return null;
    const key = domain.trim().toLowerCase();

    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { domain: key }
      }));

      if (!result.Item) return null;

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (result.Item.ttl && result.Item.ttl < nowSeconds) {
        return null; // TTL expired in DynamoDB (before sweep)
      }

      return result.Item;
    } catch (err) {
      const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isProduction) {
        throw new Error(`DynamoDB Scans Cache read failed in production: ${err.message}`);
      }
      console.warn(`[DynamoDBScansRepository] Read error: ${err.message}`);
      return null;
    }
  }

  async saveScan(scanData) {
    if (!scanData || !scanData.domain) {
      throw new Error('Scan data must include a domain.');
    }
    const key = scanData.domain.trim().toLowerCase();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl = scanData.ttl || (nowSeconds + SEVEN_DAYS_SECONDS);

    const record = {
      ...scanData,
      domain: key,
      ttl,
      savedAt: new Date().toISOString()
    };

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: record
      }));
      return record;
    } catch (err) {
      const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isProduction) {
        throw new Error(`DynamoDB Scans Cache write failed in production: ${err.message}`);
      }
      console.warn(`[DynamoDBScansRepository] Write error: ${err.message}`);
      return record;
    }
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let currentScansRepo = null;

export function getScansRepository() {
  if (currentScansRepo) return currentScansRepo;

  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isProduction) {
    currentScansRepo = new DynamoDBScansRepository();
    return currentScansRepo;
  }

  currentScansRepo = new InMemoryScansRepository();
  return currentScansRepo;
}

export function setScansRepository(repo) {
  currentScansRepo = repo;
}
