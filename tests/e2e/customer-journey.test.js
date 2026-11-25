/**
 * ApexIntel B2B - End-to-End Customer Purchase Journey & Lifecycle Test Suite
 * 
 * Validates the complete customer purchase journey as defined in Blueprint v1.0 Section 5:
 * 1. Customer Registration & Session Cookie Issuance (/api/auth/register)
 * 2. Authenticated Profile & Workspace Resolution (/api/auth/me)
 * 3. Prospect Discovery & CRM Lead Ingestion (/api/crm/leads)
 * 4. 11-Stage Pipeline Lifecycle Progression (/api/crm/leads/:id)
 * 5. Dataset Purchase: Stripe Checkout & Cryptographic Webhook Fulfillment (/api/orders/checkout, /api/webhooks/payment)
 * 6. Authorized Time-Limited S3 Presigned Download Delivery (/api/downloads/signed-url)
 * 7. Custom Intelligence Research Intake & Lifecycle Tracking (/api/requests/custom)
 * 8. Strict Multi-Tenant Data Isolation (Tenant A cannot access Tenant B's data)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Auth
import { dispatchAuthRoute } from '../../src/auth/router.js';
import { AuthService } from '../../src/auth/service.js';
import { InMemoryAuthRepository, setAuthRepository } from '../../src/auth/repository.js';
import { serializeSessionCookie } from '../../src/auth/session.js';

// CRM
import { dispatchCrmRoute } from '../../src/crm/router.js';
import { CrmService } from '../../src/crm/service.js';
import { InMemoryCrmRepository, setCrmRepository } from '../../src/crm/repository.js';

// Payments
import { dispatchPaymentsRoute } from '../../src/payments/router.js';
import { PaymentsService } from '../../src/payments/service.js';
import { InMemoryOrdersRepository, setOrdersRepository } from '../../src/payments/repository.js';

// Custom Requests
import { dispatchRequestsRoute } from '../../src/requests/router.js';
import { RequestsService } from '../../src/requests/service.js';
import { InMemoryRequestsRepository } from '../../src/requests/repository.js';

// Setup Mock Repositories
const authRepo = new InMemoryAuthRepository();
setAuthRepository(authRepo);
const authService = new AuthService({ repository: authRepo });

const crmRepo = new InMemoryCrmRepository();
setCrmRepository(crmRepo);
const crmService = new CrmService({ repository: crmRepo });

const ordersRepo = new InMemoryOrdersRepository();
setOrdersRepository(ordersRepo);

const requestsRepo = new InMemoryRequestsRepository();
const requestsService = new RequestsService({ repo: requestsRepo });

// Mock Stripe Client & S3 Client
const TEST_WEBHOOK_SECRET = 'whsec_e2e_customer_journey_secret_2026';
process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
process.env.USE_MOCK_STORAGE = 'true';

const mockStripeClient = {
  checkout: {
    sessions: {
      create: async (params) => {
        const sessionId = `cs_e2e_${crypto.randomUUID()}`;
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
    constructEvent: (rawBody, signature, secret) => {
      if (secret !== TEST_WEBHOOK_SECRET) {
        throw new Error('Invalid webhook secret');
      }
      return JSON.parse(rawBody);
    }
  }
};

const mockS3Client = {
  generatePresignedDownloadUrl: async (s3Key, expiresInSeconds) => {
    return `https://apexintel-datasets-ap-southeast-2.s3.ap-southeast-2.amazonaws.com/${s3Key}?X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=e2e_valid_sig_2026`;
  }
};

const paymentsService = new PaymentsService({
  repository: ordersRepo,
  stripeClient: mockStripeClient,
  s3Client: mockS3Client,
  webhookSecret: TEST_WEBHOOK_SECRET
});

// Helper: Dispatch with Auth & Standard Headers
const DEFAULT_HEADERS = {
  'content-type': 'application/json',
  origin: 'https://apexintel-b2b.shop'
};

function authDispatch(reqObj) {
  return dispatchAuthRoute({
    ...reqObj,
    headers: { ...DEFAULT_HEADERS, ...(reqObj.headers || {}) }
  }, authService);
}

function crmDispatch(reqObj) {
  return dispatchCrmRoute({
    ...reqObj,
    headers: { ...DEFAULT_HEADERS, ...(reqObj.headers || {}) }
  }, crmService, authService);
}

function paymentsDispatch(reqObj) {
  return dispatchPaymentsRoute({
    ...reqObj,
    headers: { ...DEFAULT_HEADERS, ...(reqObj.headers || {}) }
  }, paymentsService, authService);
}

function requestsDispatch(reqObj) {
  return dispatchRequestsRoute({
    ...reqObj,
    headers: { ...DEFAULT_HEADERS, ...(reqObj.headers || {}) }
  }, requestsService, authService);
}

test('ApexIntel B2B — End-to-End Customer Purchase Journey Suite', async (t) => {

  let customerSarah = null;
  let sarahCookie = null;
  let sarahLeadId = null;
  let sarahOrderId = null;
  let sarahStripeSessionId = null;
  let sarahRequestId = null;

  let customerBob = null;
  let bobCookie = null;

  await t.test('1. Customer Registration & Session Resolution (/api/auth/register, /api/auth/me)', async () => {
    const regRes = await authDispatch({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        email: 'sarah.jenkins@growthagency.com',
        password: 'SuperSecurePassword2026!',
        passwordConfirmation: 'SuperSecurePassword2026!',
        name: 'Sarah Jenkins',
        company: 'Apex Growth Marketing'
      }
    });

    assert.equal(regRes.statusCode, 201, 'Registration must return HTTP 201 Created');
    assert.ok(regRes.body.success, 'Registration body must indicate success');
    assert.equal(regRes.body.user.role, 'customer', 'Role must strictly default to customer');
    assert.ok(!regRes.body.user.passwordHash, 'Password hash must never leak in response');

    // Extract cookie
    const setCookieHeader = regRes.headers['Set-Cookie'] || '';
    const tokenMatch = setCookieHeader.match(/apexintel_session=([a-f0-9]+)/);
    assert.ok(tokenMatch, 'Set-Cookie header must issue apexintel_session cookie');
    
    sarahCookie = `apexintel_session=${tokenMatch[1]}`;
    customerSarah = regRes.body.user;

    // Verify session via /api/auth/me
    const meRes = await authDispatch({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Cookie: sarahCookie }
    });

    assert.equal(meRes.statusCode, 200, 'Authenticated session lookup must return HTTP 200');
    assert.equal(meRes.body.user.email, 'sarah.jenkins@growthagency.com');
  });

  await t.test('2. Discovery & CRM Lead Ingestion (/api/crm/leads)', async () => {
    const leadPayload = {
      company: 'T Rock Roofing & Restoration',
      domain: 'dallasroofer.com',
      contactName: 'Thomas Rock (Managing Partner)',
      email: 'info@dallasroofer.com',
      phone: '+1 469 931 9867',
      city: 'Dallas-Fort Worth, TX',
      industry: 'Roofing & Storm Restoration',
      stage: 'New',
      priority: 'P1',
      opportunityScore: 92,
      speed_ms: 1473,
      metaPixel: false,
      googleAds: true,
      tags: ['dallas', 'slow-latency', 'missing-pixel']
    };

    const addRes = await crmDispatch({
      method: 'POST',
      path: '/api/crm/leads',
      headers: { Cookie: sarahCookie },
      body: leadPayload
    });

    assert.equal(addRes.statusCode, 201, 'Adding prospect to CRM must return HTTP 201 Created');
    assert.ok(addRes.body.lead.leadId, 'Created lead must have a unique leadId');
    assert.equal(addRes.body.lead.company, 'T Rock Roofing & Restoration');
    assert.equal(addRes.body.lead.stage, 'New');

    sarahLeadId = addRes.body.lead.leadId;

    // Verify lead appears in customer Sarah\'s CRM list
    const listRes = await crmDispatch({
      method: 'GET',
      path: '/api/crm/leads',
      headers: { Cookie: sarahCookie }
    });

    assert.equal(listRes.statusCode, 200);
    assert.equal(listRes.body.leads.length, 1);
    assert.equal(listRes.body.leads[0].leadId, sarahLeadId);
  });

  await t.test('3. CRM 11-Stage Pipeline Progression (/api/crm/leads/:id)', async () => {
    // Stage 1: Transition to "Ready to Contact"
    const step1 = await crmDispatch({
      method: 'PUT',
      path: `/api/crm/leads/${sarahLeadId}`,
      headers: { Cookie: sarahCookie },
      body: {
        stage: 'Ready to Contact',
        note: 'Researched mobile speed gap (1473ms TTFB); preparing consultative cold email pitch.'
      }
    });

    assert.equal(step1.statusCode, 200);
    assert.equal(step1.body.lead.stage, 'Ready to Contact');
    assert.equal(step1.body.lead.notes.length, 1);

    // Stage 2: Transition to "Meeting Scheduled" with follow-up date
    const step2 = await crmDispatch({
      method: 'PUT',
      path: `/api/crm/leads/${sarahLeadId}`,
      headers: { Cookie: sarahCookie },
      body: {
        stage: 'Meeting Scheduled',
        followUpDate: '2026-11-28',
        note: 'Thomas Rock responded to mobile latency teardown; zoom scheduled for Thursday 2pm.'
      }
    });

    assert.equal(step2.statusCode, 200);
    assert.equal(step2.body.lead.stage, 'Meeting Scheduled');
    assert.equal(step2.body.lead.followUpDate, '2026-11-28');
    assert.equal(step2.body.lead.notes.length, 2);
  });

  await t.test('4. Dataset Purchase: Stripe Checkout & Order Creation (/api/orders/checkout)', async () => {
    const checkoutRes = await paymentsDispatch({
      method: 'POST',
      path: '/api/orders/checkout',
      headers: { Cookie: sarahCookie },
      body: {
        productKey: 'texas',
        successUrl: 'https://apexintel.io/dashboard?purchase=success',
        cancelUrl: 'https://apexintel.io/dashboard?purchase=cancelled'
      }
    });

    assert.equal(checkoutRes.statusCode, 200, 'Checkout creation must return HTTP 200');
    assert.ok(checkoutRes.body.orderId, 'Must return orderId');
    assert.ok(checkoutRes.body.checkoutUrl.startsWith('https://checkout.stripe.com/'), 'Must return valid Stripe session URL');

    sarahOrderId = checkoutRes.body.orderId;
    sarahStripeSessionId = checkoutRes.body.stripeSessionId;

    // Check order is initially pending_payment
    const orderRecord = await ordersRepo.getOrderById(sarahOrderId);
    assert.equal(orderRecord.status, 'pending_payment');
    assert.equal(orderRecord.amount, 79.00, 'Authoritative price for Texas pack must be $79.00');
  });

  await t.test('5. Cryptographic Stripe Webhook Fulfillment (/api/webhooks/payment)', async () => {
    const webhookEvent = {
      id: `evt_test_${crypto.randomUUID()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sarahStripeSessionId,
          payment_status: 'paid',
          amount_total: 7900,
          currency: 'usd',
          client_reference_id: sarahOrderId,
          customer_email: 'sarah.jenkins@growthagency.com',
          metadata: {
            orderId: sarahOrderId,
            userId: customerSarah.userId,
            productKey: 'texas'
          },
          payment_intent: `pi_test_${crypto.randomUUID()}`
        }
      }
    };

    const rawPayload = JSON.stringify(webhookEvent);
    const webhookRes = await paymentsDispatch({
      method: 'POST',
      path: '/api/webhooks/payment',
      headers: {
        'stripe-signature': 'mock_valid_signature'
      },
      rawBody: rawPayload,
      body: webhookEvent
    });

    assert.equal(webhookRes.statusCode, 200, 'Webhook must respond with HTTP 200 OK');
    assert.ok(webhookRes.body.received, 'Webhook result must indicate received');

    // Confirm order is now paid
    const updatedOrder = await ordersRepo.getOrderById(sarahOrderId);
    assert.equal(updatedOrder.status, 'paid');
    assert.ok(updatedOrder.paidAt, 'paidAt timestamp must be recorded');
  });

  await t.test('6. S3 Presigned Download Generation (/api/downloads/signed-url)', async () => {
    const downloadRes = await paymentsDispatch({
      method: 'GET',
      path: '/api/downloads/signed-url',
      headers: { Cookie: sarahCookie },
      query: { orderId: sarahOrderId }
    });

    assert.equal(downloadRes.statusCode, 200, 'Authorized customer download must return HTTP 200 OK');
    assert.ok(downloadRes.body.downloadUrl, 'Must return secure S3 presigned URL');
    assert.ok(downloadRes.body.downloadUrl.includes('X-Amz-Signature='), 'Must include S3 authorization signature');
    assert.equal(downloadRes.body.expiresIn, 900, 'Must enforce 15-minute expiration');
  });

  await t.test('7. Custom Intelligence Research Intake (/api/requests/custom)', async () => {
    const requestPayload = {
      niche: 'Commercial Solar & Energy Storage',
      territory: 'Phoenix & Scottsdale, AZ',
      volume: 300,
      enrichments: ['latency_audit', 'pixel_diagnostics'],
      customCriteria: 'Target companies spending on Google Ads with site speed > 1,200ms.'
    };

    const submitRes = await requestsDispatch({
      method: 'POST',
      path: '/api/requests/custom',
      headers: { Cookie: sarahCookie },
      body: requestPayload
    });

    assert.equal(submitRes.statusCode, 201, 'Custom request submission must return HTTP 201 Created');
    assert.ok(submitRes.body.request.requestId.startsWith('REQ-2026-'), 'Must generate cryptographically unique REQ-2026 ID');
    assert.equal(submitRes.body.request.status, 'Submitted');
    assert.equal(submitRes.body.request.volume, 300);

    sarahRequestId = submitRes.body.request.requestId;

    // Verify lifecycle progression to Delivered
    await requestsRepo.updateRequestStatus(sarahRequestId, { status: 'Reviewing', notes: 'Scope approved by senior data analyst.' });
    await requestsRepo.updateRequestStatus(sarahRequestId, { status: 'Mining', notes: 'Crawling Arizona corporate registry and verifying mailboxes.' });
    const delivered = await requestsRepo.updateRequestStatus(sarahRequestId, { status: 'Delivered', notes: '300 leads delivered to customer workspace.' });

    assert.equal(delivered.status, 'Delivered');

    // Customer verifies delivery
    const myRequestsRes = await requestsDispatch({
      method: 'GET',
      path: '/api/requests/custom',
      headers: { Cookie: sarahCookie }
    });

    assert.equal(myRequestsRes.statusCode, 200);
    assert.equal(myRequestsRes.body.requests[0].status, 'Delivered');
  });

  await t.test('8. Strict Multi-Tenant Data Isolation Enforcement', async () => {
    // Register Tenant B: Bob Miller
    const bobReg = await authDispatch({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        email: 'bob.miller@rivalagency.io',
        password: 'SecureBobPassword2026!',
        passwordConfirmation: 'SecureBobPassword2026!',
        name: 'Bob Miller',
        company: 'Rival Agency'
      }
    });

    assert.equal(bobReg.statusCode, 201);
    const bobSetCookie = bobReg.headers['Set-Cookie'] || '';
    const bobTokenMatch = bobSetCookie.match(/apexintel_session=([a-f0-9]+)/);
    bobCookie = `apexintel_session=${bobTokenMatch[1]}`;
    customerBob = bobReg.body.user;

    // 1. Tenant Isolation: Bob CANNOT view Sarah\'s CRM leads
    const bobCrmList = await crmDispatch({
      method: 'GET',
      path: '/api/crm/leads',
      headers: { Cookie: bobCookie }
    });
    assert.equal(bobCrmList.body.leads.length, 0, 'Bob must have 0 leads in his isolated CRM');

    // 2. Tenant Isolation: Bob CANNOT read or modify Sarah\'s lead by ID
    const bobGetLead = await crmDispatch({
      method: 'GET',
      path: `/api/crm/leads/${sarahLeadId}`,
      headers: { Cookie: bobCookie }
    });
    assert.equal(bobGetLead.statusCode, 404, 'Cross-tenant lead lookup must return HTTP 404 Not Found');

    // 3. Tenant Isolation: Bob CANNOT download Sarah\'s purchased dataset
    const bobDownload = await paymentsDispatch({
      method: 'GET',
      path: '/api/downloads/signed-url',
      headers: { Cookie: bobCookie },
      query: { orderId: sarahOrderId }
    });
    assert.equal(bobDownload.statusCode, 403, 'Cross-tenant dataset download must be rejected with HTTP 403 Forbidden');

    // 4. Tenant Isolation: Bob CANNOT see Sarah\'s custom extraction request
    const bobRequests = await requestsDispatch({
      method: 'GET',
      path: '/api/requests/custom',
      headers: { Cookie: bobCookie }
    });
    assert.equal(bobRequests.body.requests.length, 0, 'Bob must have 0 custom extraction requests');
  });

});
