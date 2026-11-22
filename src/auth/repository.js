/**
 * ApexIntel B2B - Auth Repository & DynamoDB Data Access Layer
 * 
 * Implements:
 * - Atomic email uniqueness verification via DynamoDB TransactWrite
 * - O(1) point lookups for sessions by tokenHash
 * - Zero plaintext password/token persistence
 * - In-Memory fallback adapter for automated unit testing and offline development
 */

import crypto from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  QueryCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';

export const TABLE_NAMES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || 'apexintel_users',
  SESSIONS: process.env.DYNAMODB_SESSIONS_TABLE || 'apexintel_sessions',
  RATE_LIMITS: process.env.DYNAMODB_RATE_LIMITS_TABLE || 'apexintel_rate_limits',
  PASSWORD_RESETS: process.env.DYNAMODB_RESETS_TABLE || 'apexintel_password_resets'
};

/**
 * In-Memory Database Adapter for zero-dependency local testing.
 */
export class InMemoryAuthRepository {
  constructor() {
    this.usersById = new Map();
    this.usersByEmail = new Map();
    this.sessionsByTokenHash = new Map();
    this.resetTokensByHash = new Map();
  }

  async createUser(user) {
    const normalizedEmail = user.normalizedEmail.toLowerCase().trim();
    if (this.usersByEmail.has(normalizedEmail)) {
      const err = new Error('ConditionalCheckFailed: An account with this email already exists.');
      err.name = 'TransactionCanceledException';
      err.code = 'ConditionalCheckFailed';
      throw err;
    }

    const record = { ...user, normalizedEmail };
    this.usersById.set(record.userId, record);
    this.usersByEmail.set(normalizedEmail, record.userId);
    return { ...record };
  }

  async findUserById(userId) {
    const user = this.usersById.get(userId);
    return user ? { ...user } : null;
  }

  async findUserByNormalizedEmail(normalizedEmail) {
    const emailKey = normalizedEmail.toLowerCase().trim();
    const userId = this.usersByEmail.get(emailKey);
    if (!userId) return null;
    return this.findUserById(userId);
  }

  async updateUser(userId, updates) {
    const existing = this.usersById.get(userId);
    if (!existing) {
      throw new Error(`User ${userId} not found.`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.usersById.set(userId, updated);
    return { ...updated };
  }

  async createSession(session) {
    this.sessionsByTokenHash.set(session.tokenHash, { ...session });
    return { ...session };
  }

  async findSessionByTokenHash(tokenHash) {
    const session = this.sessionsByTokenHash.get(tokenHash);
    return session ? { ...session } : null;
  }

  async updateSessionActivity(tokenHash, lastActivityAt) {
    const session = this.sessionsByTokenHash.get(tokenHash);
    if (session) {
      session.lastActivityAt = lastActivityAt;
      this.sessionsByTokenHash.set(tokenHash, session);
    }
  }

  async revokeSession(tokenHash) {
    const session = this.sessionsByTokenHash.get(tokenHash);
    if (session) {
      session.sessionStatus = 'revoked';
      session.revokedAt = new Date().toISOString();
      this.sessionsByTokenHash.set(tokenHash, session);
    }
  }

  async revokeAllUserSessions(userId) {
    for (const [hash, session] of this.sessionsByTokenHash.entries()) {
      if (session.userId === userId) {
        session.sessionStatus = 'revoked';
        session.revokedAt = new Date().toISOString();
        this.sessionsByTokenHash.set(hash, session);
      }
    }
  }

  async createPasswordResetToken(record) {
    this.resetTokensByHash.set(record.tokenHash, { ...record });
    return { ...record };
  }

  async findPasswordResetToken(tokenHash) {
    const record = this.resetTokensByHash.get(tokenHash);
    return record ? { ...record } : null;
  }

  async invalidatePasswordResetToken(tokenHash) {
    const record = this.resetTokensByHash.get(tokenHash);
    if (record) {
      record.status = 'used';
      record.usedAt = new Date().toISOString();
      this.resetTokensByHash.set(tokenHash, record);
    }
  }

  clear() {
    this.usersById.clear();
    this.usersByEmail.clear();
    this.sessionsByTokenHash.clear();
    this.resetTokensByHash.clear();
  }
}

/**
 * DynamoDB Repository for production AWS environment.
 */
export class DynamoDBAuthRepository {
  constructor(options = {}) {
    const region = options.region || process.env.AWS_REGION || 'ap-southeast-2';
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
  }

  async createUser(user) {
    const normalizedEmail = user.normalizedEmail.toLowerCase().trim();
    const now = new Date().toISOString();

    const emailLockKey = `email#${normalizedEmail}`;
    const userRecord = {
      ...user,
      normalizedEmail,
      createdAt: user.createdAt || now,
      updatedAt: user.updatedAt || now
    };

    // Atomic transaction: locks the normalized email and creates the user in apexintel_users
    const params = {
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAMES.USERS,
            Item: {
              userId: emailLockKey,
              targetUserId: user.userId,
              type: 'EMAIL_LOCK',
              createdAt: now
            },
            ConditionExpression: 'attribute_not_exists(userId)'
          }
        },
        {
          Put: {
            TableName: TABLE_NAMES.USERS,
            Item: userRecord,
            ConditionExpression: 'attribute_not_exists(userId)'
          }
        }
      ]
    };

    try {
      await this.docClient.send(new TransactWriteCommand(params));
      return userRecord;
    } catch (err) {
      if (err.name === 'TransactionCanceledException') {
        const error = new Error('An account with this email already exists.');
        error.name = 'DuplicateEmailError';
        throw error;
      }
      throw err;
    }
  }

  async findUserById(userId) {
    const res = await this.docClient.send(new GetCommand({
      TableName: TABLE_NAMES.USERS,
      Key: { userId }
    }));
    return res.Item || null;
  }

  async findUserByNormalizedEmail(normalizedEmail) {
    const emailLockKey = `email#${normalizedEmail.toLowerCase().trim()}`;
    // Step 1: Look up target userId from email lock
    const lockRes = await this.docClient.send(new GetCommand({
      TableName: TABLE_NAMES.USERS,
      Key: { userId: emailLockKey }
    }));

    if (!lockRes.Item || !lockRes.Item.targetUserId) {
      return null;
    }

    return this.findUserById(lockRes.Item.targetUserId);
  }

  async updateUser(userId, updates) {
    const now = new Date().toISOString();
    const updateEntries = Object.entries(updates).filter(([k]) => k !== 'userId');

    if (updateEntries.length === 0) return this.findUserById(userId);

    const updateExpressions = [];
    const expressionAttrNames = {};
    const expressionAttrValues = { ':updatedAt': now };

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttrNames['#updatedAt'] = 'updatedAt';

    updateEntries.forEach(([key, val], idx) => {
      const attrName = `#attr_${idx}`;
      const attrVal = `:val_${idx}`;
      updateExpressions.push(`${attrName} = ${attrVal}`);
      expressionAttrNames[attrName] = key;
      expressionAttrValues[attrVal] = val;
    });

    const res = await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.USERS,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttrNames,
      ExpressionAttributeValues: expressionAttrValues,
      ReturnValues: 'ALL_NEW'
    }));

    return res.Attributes;
  }

  async createSession(session) {
    await this.docClient.send(new PutCommand({
      TableName: TABLE_NAMES.SESSIONS,
      Item: session
    }));
    return session;
  }

  async findSessionByTokenHash(tokenHash) {
    const res = await this.docClient.send(new GetCommand({
      TableName: TABLE_NAMES.SESSIONS,
      Key: { tokenHash }
    }));
    return res.Item || null;
  }

  async updateSessionActivity(tokenHash, lastActivityAt) {
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.SESSIONS,
      Key: { tokenHash },
      UpdateExpression: 'SET #lastAct = :act',
      ExpressionAttributeNames: { '#lastAct': 'lastActivityAt' },
      ExpressionAttributeValues: { ':act': lastActivityAt }
    }));
  }

  async revokeSession(tokenHash) {
    const now = new Date().toISOString();
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.SESSIONS,
      Key: { tokenHash },
      UpdateExpression: 'SET #status = :revoked, #revAt = :now',
      ExpressionAttributeNames: { '#status': 'sessionStatus', '#revAt': 'revokedAt' },
      ExpressionAttributeValues: { ':revoked': 'revoked', ':now': now }
    }));
  }

  async revokeAllUserSessions(userId) {
    // Queries GSI userId-index and marks sessions revoked
    try {
      const res = await this.docClient.send(new QueryCommand({
        TableName: TABLE_NAMES.SESSIONS,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }));

      if (res.Items && res.Items.length > 0) {
        for (const session of res.Items) {
          await this.revokeSession(session.tokenHash);
        }
      }
    } catch (err) {
      console.warn(`[DynamoDBAuthRepository] revokeAllUserSessions query failed: ${err.message}`);
    }
  }

  async createPasswordResetToken(record) {
    await this.docClient.send(new PutCommand({
      TableName: TABLE_NAMES.PASSWORD_RESETS,
      Item: record
    }));
    return record;
  }

  async findPasswordResetToken(tokenHash) {
    const res = await this.docClient.send(new GetCommand({
      TableName: TABLE_NAMES.PASSWORD_RESETS,
      Key: { tokenHash }
    }));
    return res.Item || null;
  }

  async invalidatePasswordResetToken(tokenHash) {
    const now = new Date().toISOString();
    await this.docClient.send(new UpdateCommand({
      TableName: TABLE_NAMES.PASSWORD_RESETS,
      Key: { tokenHash },
      UpdateExpression: 'SET #status = :used, #usedAt = :now',
      ExpressionAttributeNames: { '#status': 'status', '#usedAt': 'usedAt' },
      ExpressionAttributeValues: { ':used': 'used', ':now': now }
    }));
  }
}

/**
 * Factory to retrieve the active repository.
 * Defaults to In-Memory if explicit env flag or in test environment,
 * otherwise attempts DynamoDB.
 */
let activeRepository = null;

export function getAuthRepository() {
  if (activeRepository) return activeRepository;

  if (process.env.USE_MOCK_STORAGE === 'true' || process.env.NODE_ENV === 'test') {
    activeRepository = new InMemoryAuthRepository();
  } else {
    // Attempt DynamoDB, fall back to in-memory if credentials/tables fail
    try {
      activeRepository = new DynamoDBAuthRepository();
    } catch {
      activeRepository = new InMemoryAuthRepository();
    }
  }
  return activeRepository;
}

export function setAuthRepository(repo) {
  activeRepository = repo;
}
