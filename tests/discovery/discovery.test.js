/**
 * ApexIntel B2B - Discovery & Crawler Ingestion Test Suite
 * 
 * Verifies:
 * 1. Deduplicated crawler ingestion into repository (preserves delivered_to on re-crawl)
 * 2. GET /api/discovery/search:
 *    - Trade and location filtering
 *    - Pagination, cursor, and limit capping
 *    - Contact masking (in**@...) for public / non-admin callers
 *    - Full contact access for authenticated admin users
 * 3. POST /api/discovery/recrawl:
 *    - Rejects unauthenticated requests with HTTP 401
 *    - Rejects non-admin requests with HTTP 403
 *    - Accepts admin requests with HTTP 200
 *    - Origin / CSRF and Worker-to-Lambda shared secret enforcement
 * 
 * Target: Node.js 20+ Native Test Runner
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchDiscoveryRoute } from '../../src/discovery/router.js';
import { DiscoveryService } from '../../src/discovery/service.js';
import { InMemoryDiscoveryRepository, setDiscoveryRepository } from '../../src/discovery/repository.js';
import { AuthService } from '../../src/auth/service.js';
import { InMemoryAuthRepository, setAuthRepository } from '../../src/auth/repository.js';
import { serializeSessionCookie } from '../../src/auth/session.js';
import { processLeadIngestionBatch } from '../../aws/lambda-crawler-handler.mjs';
import { InMemoryOrdersRepository, setOrdersRepository } from '../../src/payments/repository.js';
import { InMemoryRequestsRepository, setRequestsRepository } from '../../src/requests/repository.js';

// Setup Mock Repositories
const authRepo = new InMemoryAuthRepository();
setAuthRepository(authRepo);
const authService = new AuthService({ repository: authRepo });

const discoveryRepo = new InMemoryDiscoveryRepository();
setDiscoveryRepository(discoveryRepo);

const discoveryService = new DiscoveryService({ repository: discoveryRepo, resolveMx: async () => [{ exchange: 'mx.test' }] });
const ordersRepo = new InMemoryOrdersRepository();
setOrdersRepository(ordersRepo);
const requestsRepo = new InMemoryRequestsRepository();
setRequestsRepository(requestsRepo);

function dispatch(reqObj) {
  return dispatchDiscoveryRoute(reqObj, discoveryService, authService);
}

// Helper to create test user with active session cookie
async function createTestUser(email, role = 'customer', name = 'Test User') {
  const reg = await authService.register({
    email,
    password: 'ValidPassword2026!',
    name,
    company: 'Test Agency Inc'
  });

  // Promote to admin if requested (bypass for test setup)
  if (role === 'admin') {
    await authRepo.updateUser(reg.user.userId, { role: 'admin' });
  }

  const cookie = serializeSessionCookie(reg.rawToken, { isProduction: false });
  return {
    user: { ...reg.user, role },
    rawToken: reg.rawToken,
    cookie
  };
}

test('Discovery Suite: Deduplicated Crawler Ingestion & History Preservation', async (t) => {
  discoveryRepo.clear();

  await t.test('ingests batch of discovered leads with normalized domain keys', async () => {
    const testBatch = [
      {
        id: 'https://dallasroofer.com/',
        company_name: 'T Rock Roofing & Restoration',
        trade: 'Roofing & Storm Restoration',
        city: 'Dallas-Fort Worth, TX',
        email: 'info@dallasroofer.com',
        phone: '+1 469 931 9867',
        speed_ms: 1473,
        meta_pixel: false
      },
      {
        id: 'suttonroofinginc.com',
        company_name: 'Sutton Roofing & Solar',
        trade: 'Roofing & Exterior',
        city: 'Austin, TX',
        email: 'office@suttonroofinginc.com',
        phone: '+1 512 837 8777',
        speed_ms: 620,
        meta_pixel: true
      }
    ];

    const result = await processLeadIngestionBatch(testBatch, { repository: discoveryRepo, resolveMx: async () => [{ exchange: 'mx.test' }] });
    assert.equal(result.success, true);
    assert.equal(result.persistedCount, 2);

    const leadA = await discoveryRepo.getLeadByDomain('dallasroofer.com');
    assert.ok(leadA);
    assert.equal(leadA.id, 'dallasroofer.com');
    assert.equal(leadA.company_name, 'T Rock Roofing & Restoration');
    assert.deepEqual(leadA.delivered_to, []);
  });

  await t.test('preserves historical buyer delivery tracking (delivered_to) during recrawls', async () => {
    // Record that buyer 'client@outboundagency.com' already bought dallasroofer.com
    await discoveryRepo.recordDelivery('dallasroofer.com', 'client@outboundagency.com');

    const leadBefore = await discoveryRepo.getLeadByDomain('dallasroofer.com');
    assert.deepEqual(leadBefore.delivered_to, ['client@outboundagency.com']);

    // Re-run crawler ingestion with updated page speed
    const recrawlBatch = [
      {
        id: 'dallasroofer.com',
        company_name: 'T Rock Roofing & Restoration (Updated)',
        trade: 'Roofing & Storm Restoration',
        city: 'Dallas-Fort Worth, TX',
        email: 'info@dallasroofer.com',
        phone: '+1 469 931 9867',
        speed_ms: 980, // Improved speed
        meta_pixel: true
      }
    ];

    await processLeadIngestionBatch(recrawlBatch, { repository: discoveryRepo, resolveMx: async () => [{ exchange: 'mx.test' }] });

    const leadAfter = await discoveryRepo.getLeadByDomain('dallasroofer.com');
    assert.ok(leadAfter);
    assert.equal(leadAfter.speed_ms, 980);
    assert.equal(leadAfter.meta_pixel, true);
    // Historical delivery tracking must be preserved!
    assert.deepEqual(leadAfter.delivered_to, ['client@outboundagency.com']);
  });
});

test('Discovery Suite: Live Search, Filtering, Pagination & Contact Masking', async (t) => {
  discoveryRepo.clear();
  authRepo.clear();

  // Seed 4 test leads across trades
  await discoveryRepo.batchUpsertLeads([
    {
      id: 'dallasroofer.com',
      company_name: 'T Rock Roofing',
      trade: 'Roofing & Restoration',
      city: 'Dallas, TX',
      email: 'info@dallasroofer.com',
      phone: '+1 469 931 9867',
      mx_verified: true,
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    {
      id: 'austinroofing.com',
      company_name: 'Austin Roof Masters',
      trade: 'Roofing & Restoration',
      city: 'Austin, TX',
      email: 'dispatch@austinroofing.com',
      phone: '+1 512 888 1234',
      mx_verified: true,
      createdAt: '2026-11-20T11:00:00.000Z'
    },
    {
      id: 'tampasolar.com',
      company_name: 'Tampa Bay Clean Energy',
      trade: 'Solar & Clean Energy',
      city: 'Tampa, FL',
      email: 'sales@tampasolar.com',
      phone: '+1 813 555 9922',
      mx_verified: true,
      createdAt: '2026-11-20T12:00:00.000Z'
    },
    {
      id: 'beverlymedspas.com',
      company_name: 'Beverly Aesthetics Clinic',
      trade: 'Aesthetic Medicine',
      city: 'Beverly Hills, CA',
      email: 'concierge@beverlymedspas.com',
      phone: '+1 310 555 7711',
      mx_verified: false,
      createdAt: '2026-11-20T13:00:00.000Z'
    }
  ]);

  const customerUser = await createTestUser('customer@agency.com', 'customer', 'Customer User');
  const adminUser = await createTestUser('admin@apexintel.io', 'admin', 'Platform Admin');

  await t.test('unauthenticated visitor receives masked contact fields', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/discovery/search',
      query: { trade: 'roofing' }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.leads.length, 2);

    const first = res.body.leads[0];
    assert.equal(first.isContactMasked, true);
    assert.equal(first.email, 'di**@austinroofing.com');
    assert.ok(first.phone.includes('***'));
  });

  await t.test('customer user receives masked contact fields', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/discovery/search',
      headers: { cookie: customerUser.cookie }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leads[0].isContactMasked, true);
    assert.ok(res.body.leads[0].email.includes('**'));
  });

  await t.test('authenticated admin user receives unmasked contact fields', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/discovery/search',
      query: { trade: 'roofing' },
      headers: { cookie: adminUser.cookie }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leads.length, 2);
    const unmasked = res.body.leads.find(l => l.id === 'dallasroofer.com');
    assert.ok(unmasked);
    assert.equal(unmasked.isContactMasked, false);
    assert.equal(unmasked.email, 'info@dallasroofer.com');
    assert.equal(unmasked.phone, '+1 469 931 9867');
  });

  await t.test('filters leads by location', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/discovery/search',
      query: { location: 'Tampa' }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leads.length, 1);
    assert.equal(res.body.leads[0].id, 'tampasolar.com');
  });

  await t.test('filters by verified MX resolution only', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/discovery/search',
      query: { verified: 'true' }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leads.length, 3);
    assert.ok(res.body.leads.every(l => l.mx_verified === true));
  });

  await t.test('enforces pagination and caps maximum limit to 50', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/discovery/search',
      query: { limit: '2' }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leads.length, 2);
    assert.ok(res.body.nextCursor);

    // Fetch next page via cursor
    const page2 = await dispatch({
      method: 'GET',
      path: '/api/discovery/search',
      query: { limit: '2', cursor: res.body.nextCursor }
    });

    assert.equal(page2.statusCode, 200);
    assert.equal(page2.body.leads.length, 2);
  });
});

test('Discovery Suite: Admin Recrawl Execution & Access Control', async (t) => {
  discoveryRepo.clear();
  authRepo.clear();
  ordersRepo.clear();
  requestsRepo.clear();

  const customerUser = await createTestUser('customer@agency.com', 'customer', 'Customer');
  const adminUser = await createTestUser('admin@apexintel.io', 'admin', 'Admin');

  await t.test('rejects unauthenticated POST /api/discovery/recrawl with HTTP 401', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/discovery/recrawl',
      headers: {
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Authentication required/i);
  });

  await t.test('rejects non-admin customer POST /api/discovery/recrawl with HTTP 403', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/discovery/recrawl',
      headers: {
        cookie: customerUser.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Administrator privileges required/i);
  });

  await t.test('rejects recrawl request from disallowed Origin with HTTP 403', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/discovery/recrawl',
      headers: {
        cookie: adminUser.cookie,
        origin: 'https://unauthorized-attacker.xyz',
        'content-type': 'application/json'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not permitted/i);
  });

  await t.test('accepts authenticated admin recrawl and ingests leads into DynamoDB cache', async () => {
    const emptyRes = await dispatch({
      method: 'POST',
      path: '/api/discovery/recrawl',
      headers: {
        cookie: adminUser.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { leads: [] }
    });
    assert.equal(emptyRes.statusCode, 400);
    assert.match(emptyRes.body.error, /No crawl candidates/i);

    const res = await dispatch({
      method: 'POST',
      path: '/api/discovery/recrawl',
      headers: {
        cookie: adminUser.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: {
        leads: [{
          id: 'test-recrawl.example',
          company_name: 'Test Recrawl Record',
          email: 'ops@test-recrawl.example',
          trade: 'Roofing',
          city: 'Dallas, TX'
        }]
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.processedCount, 1);
    assert.equal(res.body.persistedCount, 1);
    assert.match(res.body.message, /supplied records/i);

    // Verify repository now has ingested leads
    const searchRes = await discoveryRepo.searchLeads();
    assert.ok(searchRes.totalCount > 0);

    await ordersRepo.createOrder({
      orderId: 'ord_real_test_1',
      userId: customerUser.user.userId,
      userEmail: customerUser.user.email,
      productKey: 'texas',
      productName: 'Texas High-Ticket Contractors',
      amount: 79,
      amountInCents: 7900,
      currency: 'usd',
      status: 'paid',
      stripeSessionId: 'cs_test_real_order',
      createdAt: '2026-11-25T10:00:00.000Z'
    });
    await requestsRepo.createRequest({
      requestId: 'req_real_test_1',
      userId: customerUser.user.userId,
      status: 'Submitted',
      industry: 'Roofing',
      territory: 'Dallas, TX',
      volume: 100,
      createdAt: '2026-11-25T11:00:00.000Z'
    });

    const overview = await dispatch({
      method: 'GET',
      path: '/api/admin/overview',
      headers: { cookie: adminUser.cookie }
    });
    assert.equal(overview.statusCode, 200);
    assert.equal(overview.body.metrics.totalRevenue, 79);
    assert.equal(overview.body.metrics.paidOrdersCount, 1);
    assert.equal(overview.body.metrics.totalUsers, 2);
    assert.equal(overview.body.metrics.activeLeadsPool, 1);
    assert.equal(overview.body.metrics.customRequestsCount, 1);
    assert.equal(overview.body.metrics.pendingCustomRequests, 1);
    assert.equal(overview.body.recentOrders[0].id, 'ord_real_test_1');
    assert.equal(overview.body.customRequests[0].requestId, 'req_real_test_1');
    assert.equal(overview.body.inventorySummary.length, 4);
    assert.ok(!JSON.stringify(overview.body).includes('alex@velocitygrowth.io'));
  });
});
