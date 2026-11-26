/**
 * ApexIntel B2B - Orders & Payment Fulfillment Repository
 * 
 * Enforces strict per-user order isolation and idempotent webhook fulfillment:
 * - Table: apexintel_orders
 * - Partition Key: orderId (S)
 * - GSI 1: userId-createdAt-index (PK: userId, SK: createdAt)
 * - GSI 2: stripeSessionId-index (PK: stripeSessionId)
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

export const ORDERS_TABLE_NAME = process.env.DYNAMODB_ORDERS_TABLE || 'apexintel_orders';

/**
 * In-Memory Orders Adapter for unit testing and offline development.
 */
export class InMemoryOrdersRepository {
  constructor() {
    this.ordersById = new Map(); // Key: orderId
    this.processedEventIds = new Set(); // Track processed Stripe event IDs
  }

  hasProcessedEvent(eventId) {
    return Boolean(eventId && this.processedEventIds.has(eventId));
  }

  async createOrder(order) {
    if (!order.orderId) throw new Error('orderId is required');
    const record = { ...order };
    this.ordersById.set(record.orderId, record);
    return { ...record };
  }

  async getOrderById(orderId) {
    const record = this.ordersById.get(orderId);
    return record ? { ...record } : null;
  }

  async getOrderByStripeSessionId(stripeSessionId) {
    for (const order of this.ordersById.values()) {
      if (order.stripeSessionId === stripeSessionId) {
        return { ...order };
      }
    }
    return null;
  }

  async updateOrderStatus(orderId, updateFields) {
    const existing = this.ordersById.get(orderId);
    if (!existing) {
      const error = new Error(`Order '${orderId}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    const updated = {
      ...existing,
      ...updateFields,
      updatedAt: new Date().toISOString()
    };
    this.ordersById.set(orderId, updated);
    return { ...updated };
  }

  async markOrderPaidAtomically(orderId, { stripeEventId, stripePaymentIntentId, paidAt } = {}) {
    if (stripeEventId && this.processedEventIds.has(stripeEventId)) {
      const order = this.ordersById.get(orderId);
      return { alreadyFulfilled: true, order: order ? { ...order } : null };
    }

    const existing = this.ordersById.get(orderId);
    if (!existing) {
      const error = new Error(`Order '${orderId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'paid') {
      if (stripeEventId) this.processedEventIds.add(stripeEventId);
      return { alreadyFulfilled: true, order: { ...existing } };
    }

    if (existing.status !== 'pending_payment') {
      const error = new Error(`Order '${orderId}' cannot be marked paid from status '${existing.status}'.`);
      error.statusCode = 400;
      throw error;
    }

    // Atomic synchronous transition
    const now = paidAt || new Date().toISOString();
    const updated = {
      ...existing,
      status: 'paid',
      stripePaymentIntentId: stripePaymentIntentId || existing.stripePaymentIntentId || null,
      lastStripeEventId: stripeEventId || existing.lastStripeEventId || null,
      paidAt: now,
      updatedAt: now
    };

    this.ordersById.set(orderId, updated);
    if (stripeEventId) {
      this.processedEventIds.add(stripeEventId);
    }

    return { fulfilled: true, order: { ...updated } };
  }

  async listOrdersByUserId(userId) {
    const orders = [];
    for (const order of this.ordersById.values()) {
      if (order.userId === userId) {
        orders.push({ ...order });
      }
    }
    // Sort descending by createdAt
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return orders;
  }

  async listAllOrders(options = {}) {
    const orders = Array.from(this.ordersById.values()).map(order => ({ ...order }));
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return options.limit ? orders.slice(0, options.limit) : orders;
  }

  clear() {
    this.ordersById.clear();
    this.processedEventIds.clear();
  }
}

/**
 * DynamoDB Orders Adapter for Production AWS Lambda & Edge Gateway.
 */
export class DynamoDBOrdersRepository {
  constructor(region = process.env.AWS_REGION || 'ap-southeast-2') {
    this.tableName = ORDERS_TABLE_NAME;
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
  }

  async createOrder(order) {
    const now = new Date().toISOString();
    const record = {
      ...order,
      createdAt: order.createdAt || now,
      updatedAt: order.updatedAt || now
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: record
    }));

    return record;
  }

  async getOrderById(orderId) {
    const res = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { orderId }
    }));
    return res.Item || null;
  }

  async getOrderByStripeSessionId(stripeSessionId) {
    const res = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'stripeSessionId-index',
      KeyConditionExpression: 'stripeSessionId = :sid',
      ExpressionAttributeValues: {
        ':sid': stripeSessionId
      },
      Limit: 1
    }));
    return (res.Items && res.Items[0]) || null;
  }

  async updateOrderStatus(orderId, updateFields) {
    const now = new Date().toISOString();
    const fields = { ...updateFields, updatedAt: now };

    const updateExprParts = [];
    const exprAttrNames = {};
    const exprAttrValues = {};

    for (const [key, value] of Object.entries(fields)) {
      updateExprParts.push(`#${key} = :${key}`);
      exprAttrNames[`#${key}`] = key;
      exprAttrValues[`:${key}`] = value;
    }

    try {
      const res = await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { orderId },
        ConditionExpression: 'attribute_exists(orderId)',
        UpdateExpression: `SET ${updateExprParts.join(', ')}`,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: 'ALL_NEW'
      }));
      return res.Attributes;
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        const error = new Error(`Order '${orderId}' not found.`);
        error.statusCode = 404;
        throw error;
      }
      throw err;
    }
  }

  async markOrderPaidAtomically(orderId, { stripeEventId, stripePaymentIntentId, paidAt } = {}) {
    const now = paidAt || new Date().toISOString();

    const updateExpr = 'SET #status = :paid, stripePaymentIntentId = :pi, lastStripeEventId = :eventId, paidAt = :paidAt, updatedAt = :updatedAt';
    const exprAttrNames = {
      '#status': 'status'
    };
    const exprAttrValues = {
      ':paid': 'paid',
      ':pending': 'pending_payment',
      ':pi': stripePaymentIntentId || null,
      ':eventId': stripeEventId || null,
      ':paidAt': now,
      ':updatedAt': now
    };

    let conditionExpr = 'attribute_exists(orderId) AND #status = :pending';
    if (stripeEventId) {
      conditionExpr += ' AND (attribute_not_exists(lastStripeEventId) OR lastStripeEventId <> :eventId)';
    }

    try {
      const res = await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { orderId },
        ConditionExpression: conditionExpr,
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: exprAttrNames,
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: 'ALL_NEW'
      }));
      return { fulfilled: true, order: res.Attributes };
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        const existing = await this.getOrderById(orderId);
        if (!existing) {
          const error = new Error(`Order '${orderId}' not found.`);
          error.statusCode = 404;
          throw error;
        }
        if (existing.status === 'paid' || (stripeEventId && existing.lastStripeEventId === stripeEventId)) {
          return { alreadyFulfilled: true, order: existing };
        }
        const error = new Error(`Order '${orderId}' cannot be marked paid from status '${existing.status}'.`);
        error.statusCode = 400;
        throw error;
      }
      throw err;
    }
  }

  async listAllOrders(options = {}) {
    const orders = [];
    const pageSize = Math.min(Math.max(Number(options.pageSize) || 100, 1), 1000);
    let ExclusiveStartKey;

    do {
      const result = await this.docClient.send(new ScanCommand({
        TableName: this.tableName,
        Limit: pageSize,
        ExclusiveStartKey
      }));
      orders.push(...(result.Items || []));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey && (!options.limit || orders.length < options.limit));

    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return options.limit ? orders.slice(0, options.limit) : orders;
  }

  async listOrdersByUserId(userId) {
    const res = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      },
      ScanIndexForward: false // Newest first
    }));
    return res.Items || [];
  }
}

let activeOrdersRepository = null;

export function getOrdersRepository() {
  if (activeOrdersRepository) return activeOrdersRepository;

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (process.env.USE_MOCK_STORAGE === 'true' || process.env.NODE_ENV === 'test') {
    activeOrdersRepository = new InMemoryOrdersRepository();
  } else if (isProduction) {
    // Fail closed in production/Lambda: never silently fall back to in-memory storage
    activeOrdersRepository = new DynamoDBOrdersRepository();
  } else {
    // Development fallback
    try {
      activeOrdersRepository = new DynamoDBOrdersRepository();
    } catch (err) {
      console.warn(`[getOrdersRepository] DynamoDB Orders initialization failed in development: ${err.message}. Falling back to InMemoryOrdersRepository.`);
      activeOrdersRepository = new InMemoryOrdersRepository();
    }
  }

  return activeOrdersRepository;
}

export function setOrdersRepository(repo) {
  activeOrdersRepository = repo;
}
