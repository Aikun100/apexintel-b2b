/**
 * ApexIntel B2B - Payments & Fulfillment Test Suite
 * 
 * Verifies:
 * 1. Unauthenticated request rejection (HTTP 401) on checkout, orders, and download
 * 2. Server-side price authority (catalog price enforced; client tampered prices ignored)
 * 3. Webhook signature cryptographic verification (HTTP 400 on forged signatures)
 * 4. Webhook idempotency (repeated events do not duplicate or fail)
 * 5. Strict multi-tenant data isolation (User B cannot download User A's order - HTTP 403)
 * 6. Payment state gating (unpaid/pending orders cannot generate download URLs - HTTP 403)
 * 7. Authorized 15-minute S3 presigned URL delivery for paid orders
 * 8. Edge origin protection via worker secret
 * 
 * Target: Node.js 20+ Native Test Runner
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { dispatchPaymentsRoute } from '../../src/payments/router.js';
import { PaymentsService, PRESIGNED_URL_EXPIRES_IN_SECONDS } from '../../src/payments/service.js';
import { InMemoryOrdersRepository, setOrdersRepository } from '../../src/payments/repository.js';
import { AuthService } from '../../src/auth/service.js';
import { InMemoryAuthRepository, setAuthRepository } from '../../src/auth/repository.js';
import { serializeSessionCookie } from '../../src/auth/session.js';
import { APEX_PRODUCT_CATALOG } from '../../src/payments/catalog.js';

// Setup Mock Repositories
const authRepo = new InMemoryAuthRepository();
setAuthRepository(authRepo);
const authService = new AuthService({ repository: authRepo });

const ordersRepo = new InMemoryOrdersRepository();
setOrdersRepository(ordersRepo);

// Mock Stripe Client for cryptographic webhook testing and checkout session creation
const TEST_WEBHOOK_SECRET = 'whsec_test_secret_apexintel_2026_super_secure';

const mockStripeClient = {
  checkout: {
    sessions: {
      create: async (params) => {
        const sessionId = `cs_test_${crypto.randomUUID()}`;
        return {
          id: sessionId,
          url: `https://checkout.stripe.com/c/pay/${sessionId}`,
          client_reference_id: params.client_reference_id,
          metadata: params.metadata,
          customer_email: params.customer_email
        };
      }
    }
  },
  webhooks: {
    constructEvent: (rawBody, signatureHeader, secret) => {
      if (secret !== TEST_WEBHOOK_SECRET) {
        throw new Error('Invalid webhook secret');
      }

      // Parse signature header: t=timestamp,v1=signature
      const sigMap = {};
      signatureHeader.split(',').forEach(part => {
        const [k, v] = part.split('=');
        if (k && v) sigMap[k.trim()] = v.trim();
      });

      if (!sigMap.t || !sigMap.v1) {
        throw new Error('Unable to extract timestamp and signatures from header');
      }

      const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
      const signedPayload = `${sigMap.t}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      if (sigMap.v1 !== expectedSignature) {
        throw new Error('Signature mismatch');
      }

      return JSON.parse(payload);
    }
  }
};

const paymentsService = new PaymentsService({
  repository: ordersRepo,
  stripeClient: mockStripeClient
});

function dispatch(reqObj) {
  return dispatchPaymentsRoute(reqObj, paymentsService, authService);
}

// Helper to generate valid Stripe signature for test payloads
function generateTestStripeSignature(payloadObj, secret = TEST_WEBHOOK_SECRET) {
  const payloadStr = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payloadStr}`;
  const hmac = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

// Helper to create test user with active session cookie
async function createTestUser(email, name = 'Test User') {
  const reg = await authService.register({
    email,
    password: 'ValidPassword2026!',
    name,
    company: 'Test Agency Inc'
  });
  const cookie = serializeSessionCookie(reg.rawToken, { isProduction: false });
  return {
    user: reg.user,
    rawToken: reg.rawToken,
    cookie
  };
}

test('Payments Suite: Authentication & Origin Boundary Protection', async (t) => {
  ordersRepo.clear();
  authRepo.clear();

  const userA = await createTestUser('alice@velocityagency.com', 'Alice');

  await t.test('rejects unauthenticated POST /api/orders/checkout with HTTP 401', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/orders/checkout',
      headers: {
        'content-type': 'application/json'
      },
      body: { productKey: 'texas' }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Authentication required/i);
  });

  await t.test('rejects unauthenticated GET /api/orders with HTTP 401', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/orders',
      headers: {}
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  await t.test('rejects unauthenticated GET /api/downloads/signed-url with HTTP 401', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/downloads/signed-url',
      query: { orderId: 'ord_sample_123' },
      headers: {}
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  await t.test('rejects checkout request from disallowed Origin with HTTP 403', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/orders/checkout',
      headers: {
        cookie: userA.cookie,
        origin: 'https://evil-scammer-domain.com',
        'content-type': 'application/json'
      },
      body: { productKey: 'texas' }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not permitted/i);
  });
});

test('Payments Suite: Authoritative Pricing & Checkout Session Creation', async (t) => {
  ordersRepo.clear();
  authRepo.clear();

  const userA = await createTestUser('alice@velocityagency.com', 'Alice');

  await t.test('creates pending order with authoritative catalog price ($79 for texas)', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/orders/checkout',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { productKey: 'texas' }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.orderId.startsWith('ord_texas_'));
    assert.ok(res.body.checkoutUrl.startsWith('https://checkout.stripe.com/'));

    // Verify order record in repository
    const storedOrder = await ordersRepo.getOrderById(res.body.orderId);
    assert.ok(storedOrder);
    assert.equal(storedOrder.userId, userA.user.userId);
    assert.equal(storedOrder.amount, 79);
    assert.equal(storedOrder.amountInCents, 7900);
    assert.equal(storedOrder.currency, 'usd');
    assert.equal(storedOrder.status, 'pending_payment');
    assert.equal(storedOrder.s3Key, 'datasets/Texas_HighTicket_Contractors_Enriched_Audited.xlsx');
  });

  await t.test('strictly ignores client-side tampered price amounts', async () => {
    // Attacker tries to send price: 1 or discount
    const res = await dispatch({
      method: 'POST',
      path: '/api/orders/checkout',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { 
        productKey: 'medspas',
        price: 1, // Tampered price
        amount: 1,
        amountInCents: 100
      }
    });

    assert.equal(res.statusCode, 200);
    const storedOrder = await ordersRepo.getOrderById(res.body.orderId);
    assert.equal(storedOrder.amount, 89); // Server catalog price ($89) enforced!
    assert.equal(storedOrder.amountInCents, 8900);
  });

  await t.test('rejects unknown productKey with HTTP 400', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/orders/checkout',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { productKey: 'non_existent_pack' }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not found in catalog/i);
  });
});

test('Payments Suite: Cryptographic Webhook Verification & Idempotent Fulfillment', async (t) => {
  ordersRepo.clear();
  authRepo.clear();
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

  const userA = await createTestUser('buyer@agency.com', 'Buyer');

  // Create pending order
  const checkoutRes = await dispatch({
    method: 'POST',
    path: '/api/orders/checkout',
    headers: {
      cookie: userA.cookie,
      origin: 'https://apexintel-b2b.shop',
      'content-type': 'application/json'
    },
    body: { productKey: 'florida' }
  });

  const orderId = checkoutRes.body.orderId;
  const stripeSessionId = checkoutRes.body.stripeSessionId;

  await t.test('rejects webhook with missing stripe-signature header with HTTP 400', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/webhooks/payment',
      headers: {},
      rawBody: JSON.stringify({ type: 'checkout.session.completed' })
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Missing stripe-signature header/i);
  });

  await t.test('rejects webhook with forged / invalid cryptographic signature with HTTP 400', async () => {
    const forgedSig = 't=1700000000,v1=deadbeefcafebabe0123456789abcdef';
    const res = await dispatch({
      method: 'POST',
      path: '/api/webhooks/payment',
      headers: {
        'stripe-signature': forgedSig
      },
      rawBody: JSON.stringify({ type: 'checkout.session.completed' })
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /signature verification failed/i);
  });

  await t.test('accepts valid cryptographic signature and fulfills order to paid status', async () => {
    const webhookEvent = {
      id: `evt_test_${crypto.randomUUID()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: stripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          payment_intent: 'pi_test_live_payment_intent_8899',
          metadata: {
            orderId,
            userId: userA.user.userId,
            productKey: 'florida'
          }
        }
      }
    };

    const validSig = generateTestStripeSignature(webhookEvent);

    const res = await dispatch({
      method: 'POST',
      path: '/api/webhooks/payment',
      headers: {
        'stripe-signature': validSig
      },
      rawBody: JSON.stringify(webhookEvent)
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.received, true);
    assert.equal(res.body.fulfilled, true);
    assert.equal(res.body.orderId, orderId);

    // Verify database state
    const orderInDb = await ordersRepo.getOrderById(orderId);
    assert.equal(orderInDb.status, 'paid');
    assert.equal(orderInDb.stripePaymentIntentId, 'pi_test_live_payment_intent_8899');
    assert.ok(orderInDb.paidAt);
  });

  await t.test('handles retried webhook idempotently without double-fulfillment', async () => {
    const webhookEvent = {
      id: `evt_test_retry_123`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: stripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          payment_intent: 'pi_test_live_payment_intent_8899',
          metadata: {
            orderId,
            userId: userA.user.userId
          }
        }
      }
    };

    const validSig = generateTestStripeSignature(webhookEvent);

    const res = await dispatch({
      method: 'POST',
      path: '/api/webhooks/payment',
      headers: {
        'stripe-signature': validSig
      },
      rawBody: JSON.stringify(webhookEvent)
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.received, true);
    assert.equal(res.body.alreadyFulfilled, true);
    assert.equal(res.body.orderId, orderId);
  });
});

test('Payments Suite: Concurrency, Replay Defense & Strict Validation', async (t) => {
  ordersRepo.clear();
  authRepo.clear();
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

  const testUser = await createTestUser('integrity@apexintel.io', 'Integrity Tester');

  await t.test('handles concurrent webhooks on the same order with exactly one fulfillment', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_concurrent_test_101',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'florida',
      productName: APEX_PRODUCT_CATALOG.florida.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      s3Bucket: 'apexintel-datasets-production',
      s3Key: 'datasets/Florida_HighTicket_Contractors_Enriched_Audited.xlsx',
      filename: 'Florida_HighTicket_Contractors_Enriched_Audited.xlsx',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_concurrent_sess_101'
    });

    const webhookEvent1 = {
      id: 'evt_concurrent_delivery_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          payment_intent: 'pi_test_concurrent_pi_1',
          metadata: {
            orderId: order.orderId,
            userId: testUser.user.userId
          }
        }
      }
    };

    const webhookEvent2 = {
      id: 'evt_concurrent_delivery_2',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          payment_intent: 'pi_test_concurrent_pi_2',
          metadata: {
            orderId: order.orderId,
            userId: testUser.user.userId
          }
        }
      }
    };

    const sig1 = generateTestStripeSignature(webhookEvent1);
    const sig2 = generateTestStripeSignature(webhookEvent2);

    const [res1, res2] = await Promise.all([
      paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent1), sig1),
      paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent2), sig2)
    ]);

    const results = [res1, res2];
    const fulfilledCount = results.filter(r => r.fulfilled === true).length;
    const alreadyFulfilledCount = results.filter(r => r.alreadyFulfilled === true).length;

    assert.equal(fulfilledCount, 1, 'Exactly one concurrent webhook must be fulfilled');
    assert.equal(alreadyFulfilledCount, 1, 'Exactly one concurrent webhook must return alreadyFulfilled');

    const updatedOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(updatedOrder.status, 'paid');
    assert.ok(updatedOrder.paidAt);
  });

  await t.test('replayed event.id returns idempotent alreadyFulfilled: true', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_replay_test_102',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_replay_sess_102'
    });

    const eventId = 'evt_test_replay_unique_999';
    const webhookEvent = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          payment_intent: 'pi_test_replay_pi',
          metadata: {
            orderId: order.orderId,
            userId: testUser.user.userId
          }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);

    const res1 = await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
    assert.equal(res1.fulfilled, true);

    const res2 = await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
    assert.equal(res2.received, true);
    assert.equal(res2.alreadyFulfilled, true);
    assert.equal(res2.orderId, order.orderId);
  });

  await t.test('payment_status !== "paid" does NOT mark order paid and returns ignored', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_unpaid_test_103',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_unpaid_sess_103'
    });

    const webhookEvent = {
      id: 'evt_test_unpaid_event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'unpaid',
          amount_total: 7900,
          currency: 'usd',
          payment_intent: null,
          metadata: {
            orderId: order.orderId,
            userId: testUser.user.userId
          }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);
    const res = await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);

    assert.equal(res.received, true);
    assert.equal(res.ignored, true);
    assert.equal(res.reason, 'payment_not_paid');

    const freshOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(freshOrder.status, 'pending_payment');
  });

  await t.test('mismatched amount_total is rejected with 400 and leaves order pending_payment', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_mismatch_amount_104',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_amount_sess_104'
    });

    const webhookEvent = {
      id: 'evt_mismatch_amount',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'paid',
          amount_total: 1000,
          currency: 'usd',
          metadata: { orderId: order.orderId }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);

    await assert.rejects(
      async () => {
        await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Payment amount mismatch/i);
        return true;
      }
    );

    const freshOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(freshOrder.status, 'pending_payment');
  });

  await t.test('mismatched currency is rejected with 400 and leaves order pending_payment', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_mismatch_currency_105',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_currency_sess_105'
    });

    const webhookEvent = {
      id: 'evt_mismatch_currency',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'eur',
          metadata: { orderId: order.orderId }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);

    await assert.rejects(
      async () => {
        await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Currency mismatch/i);
        return true;
      }
    );

    const freshOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(freshOrder.status, 'pending_payment');
  });

  await t.test('mismatched stripeSessionId is rejected with 400 and leaves order pending_payment', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_mismatch_session_106',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_legit_sess_106'
    });

    const webhookEvent = {
      id: 'evt_mismatch_session',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_attacker_spoofed_session',
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          metadata: { orderId: order.orderId }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);

    await assert.rejects(
      async () => {
        await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Stripe Session ID mismatch/i);
        return true;
      }
    );

    const freshOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(freshOrder.status, 'pending_payment');
  });

  await t.test('missing amount_total is rejected with 400 and leaves order pending_payment', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_missing_amount_107',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_missing_amt_sess_107'
    });

    const webhookEvent = {
      id: 'evt_missing_amount',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'paid',
          currency: 'usd',
          metadata: { orderId: order.orderId }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);

    await assert.rejects(
      async () => {
        await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Payment amount mismatch/i);
        return true;
      }
    );

    const freshOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(freshOrder.status, 'pending_payment');
  });

  await t.test('missing currency is rejected with 400 and leaves order pending_payment', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_missing_currency_108',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_missing_curr_sess_108'
    });

    const webhookEvent = {
      id: 'evt_missing_currency',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: order.stripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          metadata: { orderId: order.orderId }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);

    await assert.rejects(
      async () => {
        await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Currency mismatch/i);
        return true;
      }
    );

    const freshOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(freshOrder.status, 'pending_payment');
  });

  await t.test('missing stripeSessionId is rejected with 400 and leaves order pending_payment', async () => {
    const order = await ordersRepo.createOrder({
      orderId: 'ord_missing_session_109',
      userId: testUser.user.userId,
      userEmail: testUser.user.email,
      productKey: 'texas',
      productName: APEX_PRODUCT_CATALOG.texas.title,
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'pending_payment',
      stripeSessionId: 'cs_test_missing_sess_109'
    });

    const webhookEvent = {
      id: 'evt_missing_session',
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          metadata: { orderId: order.orderId }
        }
      }
    };

    const sig = generateTestStripeSignature(webhookEvent);

    await assert.rejects(
      async () => {
        await paymentsService.handleStripeWebhook(JSON.stringify(webhookEvent), sig);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Stripe Session ID mismatch/i);
        return true;
      }
    );

    const freshOrder = await ordersRepo.getOrderById(order.orderId);
    assert.equal(freshOrder.status, 'pending_payment');
  });

  await t.test('missing STRIPE_SECRET_KEY when NODE_ENV=production fails closed with HTTP 500', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.STRIPE_SECRET_KEY;
    const originalLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;

      const unconfiguredService = new PaymentsService({ repository: ordersRepo });

      assert.throws(
        () => {
          const client = unconfiguredService.stripe;
        },
        (err) => {
          assert.equal(err.statusCode, 500);
          assert.match(err.message, /STRIPE_SECRET_KEY is not configured in production environment/i);
          return true;
        }
      );

      process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_for_local_dev';
      const placeholderService = new PaymentsService({ repository: ordersRepo });

      assert.throws(
        () => {
          const client = placeholderService.stripe;
        },
        (err) => {
          assert.equal(err.statusCode, 500);
          assert.match(err.message, /STRIPE_SECRET_KEY is not configured in production environment/i);
          return true;
        }
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey !== undefined) {
        process.env.STRIPE_SECRET_KEY = originalKey;
      } else {
        delete process.env.STRIPE_SECRET_KEY;
      }
      if (originalLambda !== undefined) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalLambda;
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      }
    }
  });
});

test('Payments Suite: Strict Cross-Tenant Isolation & S3 Fulfillment Gating', async (t) => {
  ordersRepo.clear();
  authRepo.clear();

  const userAlice = await createTestUser('alice@tenant-a.com', 'Alice');
  const userBob = await createTestUser('bob@tenant-b.com', 'Bob');

  // Alice purchases and pays for Texas Pack
  const aliceOrder = await ordersRepo.createOrder({
    orderId: 'ord_alice_tx_1001',
    userId: userAlice.user.userId,
    userEmail: userAlice.user.email,
    productKey: 'texas',
    productName: APEX_PRODUCT_CATALOG.texas.title,
    amount: 79,
    amountInCents: 7900,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/Texas_HighTicket_Contractors_Enriched_Audited.xlsx',
    filename: 'Texas_HighTicket_Contractors_Enriched_Audited.xlsx',
    status: 'paid',
    paidAt: new Date().toISOString()
  });

  // Bob creates a pending order for HVAC Pack (unpaid)
  const bobOrder = await ordersRepo.createOrder({
    orderId: 'ord_bob_hvac_2002',
    userId: userBob.user.userId,
    userEmail: userBob.user.email,
    productKey: 'hvac',
    productName: APEX_PRODUCT_CATALOG.hvac.title,
    amount: 99,
    amountInCents: 9900,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/Commercial_HVAC_Mechanical_Enriched_Audited.xlsx',
    filename: 'Commercial_HVAC_Mechanical_Enriched_Audited.xlsx',
    status: 'pending_payment'
  });

  await t.test('Bob CANNOT download Alice paid order (returns HTTP 403 Forbidden)', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/downloads/signed-url',
      query: { orderId: aliceOrder.orderId },
      headers: {
        cookie: userBob.cookie
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Access denied/i);
  });

  await t.test('Bob CANNOT download his own order while status is unpaid (returns HTTP 403)', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/downloads/signed-url',
      query: { orderId: bobOrder.orderId },
      headers: {
        cookie: userBob.cookie
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Download unavailable.*Payment confirmation is required/i);
  });

  await t.test('Alice CAN download her own paid order (returns time-limited S3 presigned URL)', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/downloads/signed-url',
      query: { orderId: aliceOrder.orderId },
      headers: {
        cookie: userAlice.cookie
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.orderId, aliceOrder.orderId);
    assert.ok(res.body.downloadUrl.includes('s3.ap-southeast-2.amazonaws.com'));
    assert.ok(res.body.downloadUrl.includes('X-Amz-Expires=900'));
    assert.equal(res.body.expiresIn, 900);
  });

  await t.test('Order listing strictly isolates orders per tenant', async () => {
    // Alice's orders
    const aliceListRes = await dispatch({
      method: 'GET',
      path: '/api/orders',
      headers: {
        cookie: userAlice.cookie
      }
    });
    assert.equal(aliceListRes.statusCode, 200);
    assert.equal(aliceListRes.body.orders.length, 1);
    assert.equal(aliceListRes.body.orders[0].orderId, aliceOrder.orderId);

    // Bob's orders
    const bobListRes = await dispatch({
      method: 'GET',
      path: '/api/orders',
      headers: {
        cookie: userBob.cookie
      }
    });
    assert.equal(bobListRes.statusCode, 200);
    assert.equal(bobListRes.body.orders.length, 1);
    assert.equal(bobListRes.body.orders[0].orderId, bobOrder.orderId);
  });
});
