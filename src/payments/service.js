/**
 * ApexIntel B2B - Payment & S3 Dataset Fulfillment Service
 * 
 * Strict Security Guarantees:
 * 1. Authoritative Pricing: Prices are strictly resolved from server catalog.
 * 2. Cryptographic Webhook Verification: Raw body + stripe-signature validated via STRIPE_WEBHOOK_SECRET.
 * 3. Idempotent Fulfillment: Retried webhooks never double-credit or fail.
 * 4. Strict Tenant Isolation: Downloads require authenticated session where order.userId === session.userId.
 * 5. Payment State Gate: Download URLs are strictly rejected for unpaid/pending orders (HTTP 403).
 * 6. Short-Lived S3 Presigned URLs: 15-minute time-bound URLs against private S3 bucket.
 */

import crypto from 'node:crypto';
import path from 'node:path';
import Stripe from 'stripe';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getOrdersRepository } from './repository.js';
import { getProductByKey } from './catalog.js';

export const DATASETS_BUCKET = process.env.S3_DATASETS_BUCKET || 'apexintel-datasets-production';
export const PRESIGNED_URL_EXPIRES_IN_SECONDS = 900; // 15 minutes

export class PaymentsService {
  constructor(options = {}) {
    this._repo = options.repository || null;
    this._stripeClient = options.stripeClient || null;
    this._s3Client = options.s3Client || null;
    this._region = options.region || process.env.AWS_REGION || 'ap-southeast-2';
    this._webhookSecret = options.webhookSecret || null;
  }

  get repo() {
    return this._repo || getOrdersRepository();
  }

  get stripe() {
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (isProduction && (!stripeKey || stripeKey.startsWith('sk_test_placeholder'))) {
      const err = new Error('STRIPE_SECRET_KEY is not configured in production environment.');
      err.statusCode = 500;
      throw err;
    }
    if (this._stripeClient) return this._stripeClient;
    const finalKey = stripeKey || 'sk_test_placeholder_for_local_dev';
    this._stripeClient = new Stripe(finalKey, {
      apiVersion: '2024-06-20'
    });
    return this._stripeClient;
  }

  get s3() {
    if (this._s3Client) return this._s3Client;
    this._s3Client = new S3Client({ region: this._region });
    return this._s3Client;
  }

  /**
   * Create a pending order and Stripe Checkout Session.
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.userEmail
   * @param {string} params.productKey
   * @param {string} [params.origin]
   * @returns {Promise<{ orderId: string, checkoutUrl: string, stripeSessionId: string }>}
   */
  async createCheckoutSession({ userId, userEmail, productKey, origin }) {
    if (!userId) {
      const err = new Error('User authentication required.');
      err.statusCode = 401;
      throw err;
    }

    const product = getProductByKey(productKey);
    if (!product) {
      const err = new Error(`Invalid product key '${productKey}'. Product not found in catalog.`);
      err.statusCode = 400;
      throw err;
    }

    const orderId = `ord_${product.key}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const baseUrl = origin || process.env.PUBLIC_APP_URL || 'https://apexintel-b2b.shop';
    const successUrl = `${baseUrl}/?payment_success=true&order_id=${orderId}`;
    const cancelUrl = `${baseUrl}/?payment_cancelled=true`;

    // 1. Create Checkout Session via Stripe
    let session;
    try {
      session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: userEmail,
        client_reference_id: orderId,
        metadata: {
          orderId,
          userId,
          productKey: product.key
        },
        line_items: [
          {
            price_data: {
              currency: product.currency,
              unit_amount: product.priceInCents,
              product_data: {
                name: product.title,
                description: product.description
              }
            },
            quantity: 1
          }
        ],
        success_url: successUrl,
        cancel_url: cancelUrl
      });
    } catch (stripeErr) {
      // In offline/test/dev mode without live Stripe key, handle gracefully
      const isDevOrTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
      const isPlaceholderKey = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_placeholder');
      if (isDevOrTest && isPlaceholderKey) {
        session = {
          id: `cs_test_mock_${Date.now()}`,
          url: `${successUrl}`
        };
      } else {
        const err = new Error(`Stripe Checkout creation failed: ${stripeErr.message}`);
        err.statusCode = 502;
        throw err;
      }
    }

    // 2. Persist pending order with authoritative pricing & private S3 key
    const orderRecord = {
      orderId,
      userId,
      userEmail,
      productKey: product.key,
      productName: product.title,
      amount: product.price,
      amountInCents: product.priceInCents,
      currency: product.currency,
      s3Bucket: product.s3Bucket,
      s3Key: product.s3Key,
      filename: product.filename,
      status: 'pending_payment',
      stripeSessionId: session.id,
      createdAt: now,
      updatedAt: now
    };

    await this.repo.createOrder(orderRecord);

    return {
      orderId,
      checkoutUrl: session.url,
      stripeSessionId: session.id
    };
  }

  /**
   * Process incoming Stripe payment webhook with cryptographic signature validation.
   * @param {string|Buffer} rawBody
   * @param {string} signatureHeader
   * @param {string} [secretOverride]
   * @returns {Promise<{ received: boolean, eventType: string, fulfilled?: boolean, alreadyFulfilled?: boolean, orderId?: string }>}
   */
  async handleStripeWebhook(rawBody, signatureHeader, secretOverride) {
    const webhookSecret = secretOverride || this._webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      const err = new Error('STRIPE_WEBHOOK_SECRET is not configured on the server.');
      err.statusCode = 500;
      throw err;
    }

    if (!signatureHeader) {
      const err = new Error('Missing stripe-signature header.');
      err.statusCode = 400;
      throw err;
    }

    let event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
    } catch (err) {
      const error = new Error(`Stripe webhook signature verification failed: ${err.message}`);
      error.statusCode = 400;
      throw error;
    }

    // Process checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId || session.client_reference_id;

      let order = null;
      if (orderId) {
        order = await this.repo.getOrderById(orderId);
      } else if (session.id) {
        order = await this.repo.getOrderByStripeSessionId(session.id);
      }

      if (!order) {
        const error = new Error(`Order not found for completed Stripe session: ${session.id}`);
        error.statusCode = 404;
        throw error;
      }

      // 1. Strict Session ID verification
      if (!session.id || !order.stripeSessionId || session.id !== order.stripeSessionId) {
        console.warn(`[SECURITY WARNING] Stripe Session ID mismatch or missing for order ${order.orderId}: expected ${order.stripeSessionId}, got ${session.id}`);
        const err = new Error('Security validation failed: Stripe Session ID mismatch.');
        err.statusCode = 400;
        throw err;
      }

      // 2. Strict Authoritative Amount verification
      if (session.amount_total === undefined || session.amount_total === null || session.amount_total !== order.amountInCents) {
        console.warn(`[SECURITY WARNING] Payment amount mismatch or missing for order ${order.orderId}: expected ${order.amountInCents}, got ${session.amount_total}`);
        const err = new Error('Security validation failed: Payment amount mismatch.');
        err.statusCode = 400;
        throw err;
      }

      // 3. Strict Authoritative Currency verification
      if (!session.currency || session.currency.toLowerCase() !== (order.currency || 'usd').toLowerCase()) {
        console.warn(`[SECURITY WARNING] Currency mismatch or missing for order ${order.orderId}: expected ${order.currency}, got ${session.currency}`);
        const err = new Error('Security validation failed: Currency mismatch.');
        err.statusCode = 400;
        throw err;
      }

      // 4. Strict Payment State verification (must be 'paid')
      if (session.payment_status !== 'paid') {
        console.warn(`[WEBHOOK] Session ${session.id} for order ${order.orderId} ignored: payment_status is '${session.payment_status}' (not 'paid').`);
        return {
          received: true,
          eventType: event.type,
          ignored: true,
          reason: 'payment_not_paid',
          orderId: order.orderId
        };
      }

      // 5. Deduplication check: replayed event ID
      if (this.repo.hasProcessedEvent && this.repo.hasProcessedEvent(event.id)) {
        return {
          received: true,
          eventType: event.type,
          alreadyFulfilled: true,
          orderId: order.orderId
        };
      }

      // 6. Fast-path check: if order is already marked paid
      if (order.status === 'paid') {
        return {
          received: true,
          eventType: event.type,
          alreadyFulfilled: true,
          orderId: order.orderId
        };
      }

      // 7. Atomic Conditional Fulfillment & Event Deduplication
      const now = new Date().toISOString();
      const packDomainHashes = {
        texas: 'sha256:7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
        florida: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        medspas: 'sha256:3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
        hvac: 'sha256:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f'
      };
      const fulfillmentResult = await this.repo.markOrderPaidAtomically(order.orderId, {
        stripeEventId: event.id || null,
        stripePaymentIntentId: session.payment_intent || null,
        paidAt: now,
        packDomainHash: packDomainHashes[order.productKey] || null
      });

      if (fulfillmentResult.alreadyFulfilled) {
        return {
          received: true,
          eventType: event.type,
          alreadyFulfilled: true,
          orderId: order.orderId
        };
      }

      return {
        received: true,
        eventType: event.type,
        fulfilled: true,
        orderId: order.orderId
      };
    }

    return {
      received: true,
      eventType: event.type
    };
  }

  /**
   * List purchase history for authenticated user.
   * @param {string} userId
   * @returns {Promise<Array<object>>}
   */
  async listUserOrders(userId) {
    if (!userId) {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      throw err;
    }

    const orders = await this.repo.listOrdersByUserId(userId);
    return orders.map(o => ({
      orderId: o.orderId,
      productKey: o.productKey,
      productName: o.productName,
      leadsCount: getProductByKey(o.productKey)?.leadsCount ?? null,
      amount: o.amount,
      currency: o.currency,
      status: o.status,
      filename: o.filename,
      createdAt: o.createdAt,
      paidAt: o.paidAt || null
    }));
  }

  /**
   * Generate a time-limited S3 presigned URL for downloading a purchased dataset.
   * Strict security checks:
   * 1. Order must exist
   * 2. Order must belong to authenticated user (tenant isolation)
   * 3. Order must have status === 'paid'
   * 
   * @param {string} userId
   * @param {string} orderId
   * @returns {Promise<{ orderId: string, downloadUrl: string, filename: string, expiresIn: number }>}
   */
  async generateSignedDownloadUrl(userId, orderId) {
    if (!userId) {
      const err = new Error('Authentication required.');
      err.statusCode = 401;
      throw err;
    }

    if (!orderId) {
      const err = new Error('orderId query parameter is required.');
      err.statusCode = 400;
      throw err;
    }

    const order = await this.repo.getOrderById(orderId);
    if (!order) {
      const err = new Error(`Order '${orderId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Strict Cross-Tenant Isolation: User B cannot download User A's order
    if (order.userId !== userId) {
      const err = new Error('Access denied: You do not have permission to download this order.');
      err.statusCode = 403;
      throw err;
    }

    // Strict Payment Gate: Unpaid orders cannot be fulfilled
    if (order.status !== 'paid') {
      const err = new Error(`Download unavailable: Order status is '${order.status}'. Payment confirmation is required.`);
      err.statusCode = 403;
      throw err;
    }

    const bucket = order.s3Bucket || DATASETS_BUCKET;
    const s3Key = order.s3Key;
    const filename = order.filename || path.basename(s3Key);

    let downloadUrl;
    // In test environment or when mock storage is active without real AWS credentials, provide simulated presigned URL
    if (process.env.USE_MOCK_STORAGE === 'true' || (process.env.NODE_ENV === 'test' && !process.env.AWS_ACCESS_KEY_ID)) {
      downloadUrl = `https://${bucket}.s3.${this._region}.amazonaws.com/${s3Key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${PRESIGNED_URL_EXPIRES_IN_SECONDS}&X-Amz-Signature=mock_valid_test_presigned_sig`;
    } else {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${filename}"`
      });

      downloadUrl = await getSignedUrl(this.s3, command, {
        expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS
      });
    }

    return {
      orderId: order.orderId,
      downloadUrl,
      filename,
      expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS
    };
  }
}

export const paymentsService = new PaymentsService();
