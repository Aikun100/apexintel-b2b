/**
 * ApexIntel B2B - Custom Extraction Requests Test Suite
 * 
 * Verifies:
 * 1. Server-side authoritative pricing & cryptographic ID generation (ignores client-tampered price)
 * 2. Input validation (email, territory, volume range)
 * 3. Unauthenticated GET /api/requests/custom returns 401
 * 4. Multi-tenant customer isolation (Bob cannot view or modify Alice's requests)
 * 5. Non-admin customer attempting PATCH returns 403 Forbidden
 * 6. Admin can view complete queue and execute lifecycle transitions (Submitted -> Reviewing -> Mining -> Delivered)
 * 7. Rate limiting (max 5 submissions / 15 min), CSRF/Origin enforcement, and Worker secret verification
 */

import assert from 'node:assert';
import { InMemoryRequestsRepository, setRequestsRepository } from '../../src/requests/repository.js';
import { RequestsService, ALLOWED_STATUSES } from '../../src/requests/service.js';
import { dispatchRequestsRoute } from '../../src/requests/router.js';
import { InMemoryAuthRepository, setAuthRepository } from '../../src/auth/repository.js';
import { AuthService } from '../../src/auth/service.js';
import { RateLimiter } from '../../src/auth/rate-limiter.js';
import { SESSION_CONFIG } from '../../src/auth/session.js';

export async function runRequestsTests() {
  console.log('🧪 Starting Custom Extraction Requests Test Suite...\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  }

  // Set test environment flags
  process.env.NODE_ENV = 'test';

  const authRepo = new InMemoryAuthRepository();
  setAuthRepository(authRepo);
  const authSvc = new AuthService({ repository: authRepo });
  const requestsRepo = new InMemoryRequestsRepository();
  setRequestsRepository(requestsRepo);
  const requestsSvc = new RequestsService({ repo: requestsRepo });

  // Setup test users: Alice (Customer), Bob (Customer), Eve (Customer), Admin
  const aliceReg = await authSvc.register({
    email: 'alice@contractoragency.com',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
    name: 'Alice Cooper',
    company: 'Cooper Outbound'
  });
  const aliceLogin = await authSvc.login({ email: 'alice@contractoragency.com', password: 'TestPassword123!' }, '127.0.0.1');
  const aliceCookie = `${SESSION_CONFIG.COOKIE_NAME}=${aliceLogin.rawToken}`;

  const bobReg = await authSvc.register({
    email: 'bob@growthlabs.io',
    password: 'TestPassword123!',
    confirmPassword: 'TestPassword123!',
    name: 'Bob Vance',
    company: 'Vance Leads'
  });
  const bobLogin = await authSvc.login({ email: 'bob@growthlabs.io', password: 'TestPassword123!' }, '127.0.0.1');
  const bobCookie = `${SESSION_CONFIG.COOKIE_NAME}=${bobLogin.rawToken}`;

  const adminReg = await authSvc.register({
    email: 'admin@apexintel.io',
    password: 'AdminPassword123!',
    confirmPassword: 'AdminPassword123!',
    name: 'Admin Boss',
    company: 'ApexIntel HQ'
  });
  await authRepo.updateUser(adminReg.user.userId, { role: 'admin' });
  const adminLogin = await authSvc.login({ email: 'admin@apexintel.io', password: 'AdminPassword123!' }, '127.0.0.1');
  const adminCookie = `${SESSION_CONFIG.COOKIE_NAME}=${adminLogin.rawToken}`;

  // =========================================================================
  // 1. AUTHORITATIVE PRICING & ID GENERATION
  // =========================================================================
  console.log('--- 1. Authoritative Pricing & Server-Side ID Generation ---');

  await test('Computes tiered base volume rate correctly', () => {
    // < 250 -> $0.65
    assert.strictEqual(requestsSvc.calculatePrice(100).ratePerRecord, 0.65);
    assert.strictEqual(requestsSvc.calculatePrice(100).totalCost, 65);

    // 250 - 499 -> $0.55
    assert.strictEqual(requestsSvc.calculatePrice(250).ratePerRecord, 0.55);
    assert.strictEqual(requestsSvc.calculatePrice(250).totalCost, 138); // 250 * 0.55 = 137.5 -> 138

    // 500 - 999 -> $0.45
    assert.strictEqual(requestsSvc.calculatePrice(500).ratePerRecord, 0.45);
    assert.strictEqual(requestsSvc.calculatePrice(500).totalCost, 225);

    // 1000 - 2499 -> $0.35
    assert.strictEqual(requestsSvc.calculatePrice(1000).ratePerRecord, 0.35);
    assert.strictEqual(requestsSvc.calculatePrice(1000).totalCost, 350);

    // >= 2500 -> $0.25
    assert.strictEqual(requestsSvc.calculatePrice(3000).ratePerRecord, 0.25);
    assert.strictEqual(requestsSvc.calculatePrice(3000).totalCost, 750);
  });

  await test('Correctly applies optional enrichment addons (latency, pixel, mobile)', () => {
    // 500 records: base 0.45 + latency 0.08 + pixel 0.08 + mobile 0.12 = 0.73
    const priced = requestsSvc.calculatePrice(500, { latency: true, pixel: true, mobile: true });
    assert.strictEqual(priced.ratePerRecord, 0.73);
    assert.strictEqual(priced.totalCost, 365);
    assert.strictEqual(priced.estimatedPrice, '$365.00');
    assert.strictEqual(priced.priceInCents, 36500);
  });

  await test('Generates cryptographically random REQ-2026-<hex> ID and ignores client-submitted price', async () => {
    const created = await requestsSvc.createCustomRequest({
      email: 'alice@contractoragency.com',
      industry: 'Commercial Roofing',
      territory: 'Dallas-Fort Worth, TX',
      volume: 250,
      estimatedPrice: '$5.00', // Client tampered price
      enrichments: { latency: true }
    }, { userId: aliceReg.user.userId, email: aliceReg.user.email, role: 'customer' });

    assert.ok(created.requestId.startsWith('REQ-2026-'));
    assert.strictEqual(created.requestId.length, 15); // REQ-2026- + 6 hex chars
    assert.strictEqual(created.status, 'Submitted');
    assert.strictEqual(created.userId, aliceReg.user.userId);
    // Base 0.55 + 0.08 = 0.63 * 250 = 157.5 -> 158
    assert.strictEqual(created.estimatedPrice, '$158.00'); // Server-authoritative!
    assert.notStrictEqual(created.estimatedPrice, '$5.00');
  });

  // =========================================================================
  // 2. INPUT VALIDATION
  // =========================================================================
  console.log('\n--- 2. Request Input Validation ---');

  await test('Rejects request with invalid or missing email', async () => {
    await assert.rejects(
      async () => await requestsSvc.createCustomRequest({
        email: 'invalid-email',
        territory: 'Austin, TX',
        volume: 200
      }),
      /valid delivery email/i
    );
  });

  await test('Rejects request with empty territory', async () => {
    await assert.rejects(
      async () => await requestsSvc.createCustomRequest({
        email: 'test@example.com',
        territory: '',
        volume: 200
      }),
      /territory must be between/i
    );
  });

  await test('Rejects volume outside 50 - 50,000 bounds', async () => {
    await assert.rejects(
      async () => await requestsSvc.createCustomRequest({
        email: 'test@example.com',
        territory: 'Miami, FL',
        volume: 20 // Below 50
      }),
      /integer between 50 and 50,000/i
    );

    await assert.rejects(
      async () => await requestsSvc.createCustomRequest({
        email: 'test@example.com',
        territory: 'Miami, FL',
        volume: 100000 // Above 50,000
      }),
      /integer between 50 and 50,000/i
    );
  });

  // =========================================================================
  // 3. API ENDPOINTS & AUTHENTICATION ENFORCEMENT
  // =========================================================================
  console.log('\n--- 3. API Authentication & Tenant Isolation ---');

  let aliceRequestId = null;

  await test('POST /api/requests/custom allows submission and attaches authenticated user', async () => {
    const res = await dispatchRequestsRoute({
      method: 'POST',
      path: '/api/requests/custom',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://apexintel-b2b.shop',
        'cookie': aliceCookie
      },
      body: {
        email: 'alice@contractoragency.com',
        industry: 'Commercial Solar',
        territory: 'Phoenix, AZ',
        volume: 500,
        enrichments: { latency: true, pixel: true }
      },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.request.userId, aliceReg.user.userId);
    assert.strictEqual(res.body.request.status, 'Submitted');
    aliceRequestId = res.body.request.requestId;
  });

  await test('GET /api/requests/custom returns 401 when unauthenticated', async () => {
    const res = await dispatchRequestsRoute({
      method: 'GET',
      path: '/api/requests/custom',
      headers: {
        'origin': 'https://apexintel-b2b.shop'
      },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(res.statusCode, 401);
    assert.match(res.body.error, /authentication required/i);
  });

  await test('Customer Alice sees ONLY her own requests (tenant isolation)', async () => {
    const res = await dispatchRequestsRoute({
      method: 'GET',
      path: '/api/requests/custom',
      headers: {
        'origin': 'https://apexintel-b2b.shop',
        'cookie': aliceCookie
      },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.requests));
    assert.ok(res.body.requests.length >= 1);
    for (const req of res.body.requests) {
      assert.strictEqual(req.userId, aliceReg.user.userId);
    }
  });

  await test('Customer Bob CANNOT view Alice\'s requests (tenant isolation cross-check)', async () => {
    // Bob lists his requests -> Alice's request must NOT be included
    const listRes = await dispatchRequestsRoute({
      method: 'GET',
      path: '/api/requests/custom',
      headers: {
        'origin': 'https://apexintel-b2b.shop',
        'cookie': bobCookie
      },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual(listRes.body.requests.length, 0);

    // Bob directly tries to fetch Alice's request by ID -> 403 Forbidden!
    const getRes = await dispatchRequestsRoute({
      method: 'GET',
      path: `/api/requests/custom/${aliceRequestId}`,
      headers: {
        'origin': 'https://apexintel-b2b.shop',
        'cookie': bobCookie
      },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(getRes.statusCode, 403);
    assert.match(getRes.body.error, /access denied|not authorized/i);
  });

  await test('Customer Bob CANNOT modify request status via PATCH (403 Forbidden)', async () => {
    const patchRes = await dispatchRequestsRoute({
      method: 'PATCH',
      path: `/api/requests/custom/${aliceRequestId}`,
      headers: {
        'content-type': 'application/json',
        'origin': 'https://apexintel-b2b.shop',
        'cookie': bobCookie
      },
      body: { status: 'Delivered' },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(patchRes.statusCode, 403);
    assert.match(patchRes.body.error, /forbidden|administrators/i);
  });

  // =========================================================================
  // 4. ADMIN QUEUE & LIFECYCLE STATE TRANSITIONS
  // =========================================================================
  console.log('\n--- 4. Admin Queue & Lifecycle State Transitions ---');

  await test('Admin can view the complete custom requests queue', async () => {
    const res = await dispatchRequestsRoute({
      method: 'GET',
      path: '/api/requests/custom',
      headers: {
        'origin': 'https://apexintel-b2b.shop',
        'cookie': adminCookie
      },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.requests.length >= 1);
    const foundAliceReq = res.body.requests.find(r => r.requestId === aliceRequestId);
    assert.ok(foundAliceReq, 'Admin queue must include Alice\'s request');
  });

  await test('Admin transitions lifecycle: Submitted -> Reviewing -> Mining -> Delivered', async () => {
    // 1. Submitted -> Reviewing
    const r1 = await dispatchRequestsRoute({
      method: 'PATCH',
      path: `/api/requests/custom/${aliceRequestId}`,
      headers: {
        'content-type': 'application/json',
        'origin': 'https://apexintel-b2b.shop',
        'cookie': adminCookie
      },
      body: { status: 'Reviewing', notes: 'Lead research initiated.' },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(r1.statusCode, 200);
    assert.strictEqual(r1.body.request.status, 'Reviewing');

    // 2. Reviewing -> Mining
    const r2 = await dispatchRequestsRoute({
      method: 'PATCH',
      path: `/api/requests/custom/${aliceRequestId}`,
      headers: {
        'content-type': 'application/json',
        'origin': 'https://apexintel-b2b.shop',
        'cookie': adminCookie
      },
      body: { status: 'Mining', notes: 'Crawler active on Phoenix registry.' },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(r2.statusCode, 200);
    assert.strictEqual(r2.body.request.status, 'Mining');

    // 3. Mining -> Delivered
    const r3 = await dispatchRequestsRoute({
      method: 'PATCH',
      path: `/api/requests/custom/${aliceRequestId}`,
      headers: {
        'content-type': 'application/json',
        'origin': 'https://apexintel-b2b.shop',
        'cookie': adminCookie
      },
      body: { status: 'Delivered', notes: 'Delivered 500 solar contractors.' },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(r3.statusCode, 200);
    assert.strictEqual(r3.body.request.status, 'Delivered');
  });

  await test('Admin PATCH rejects invalid status with 400', async () => {
    const res = await dispatchRequestsRoute({
      method: 'PATCH',
      path: `/api/requests/custom/${aliceRequestId}`,
      headers: {
        'content-type': 'application/json',
        'origin': 'https://apexintel-b2b.shop',
        'cookie': adminCookie
      },
      body: { status: 'InventedFakeStatus' },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.error, /invalid status/i);
  });

  // =========================================================================
  // 5. SECURITY CONTROLS: RATE LIMITING, ORIGIN & WORKER SECRET
  // =========================================================================
  console.log('\n--- 5. Security Controls: Rate Limiting, Origin & Worker Secret ---');

  const customLimiter = new RateLimiter();

  await test('Enforces rate limiting on POST /api/requests/custom (5 allowed, 6th blocked)', async () => {
    const reqObj = {
      method: 'POST',
      path: '/api/requests/custom',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://apexintel-b2b.shop'
      },
      body: {
        email: 'spammer@domain.com',
        industry: 'HVAC',
        territory: 'Dallas, TX',
        volume: 100
      },
      ip: '198.51.100.77'
    };

    // First 5 requests succeed
    for (let i = 0; i < 5; i++) {
      const res = await dispatchRequestsRoute(reqObj, requestsSvc, authSvc, customLimiter);
      assert.strictEqual(res.statusCode, 201, `Request ${i + 1} should be 201`);
    }

    // 6th request is rate limited with 429
    const blocked = await dispatchRequestsRoute(reqObj, requestsSvc, authSvc, customLimiter);
    assert.strictEqual(blocked.statusCode, 429);
    assert.match(blocked.body.error, /rate limit exceeded/i);
    assert.ok(blocked.headers['Retry-After']);
  });

  await test('Rejects request from untrusted Origin with 403', async () => {
    const res = await dispatchRequestsRoute({
      method: 'POST',
      path: '/api/requests/custom',
      headers: {
        'content-type': 'application/json',
        'origin': 'https://attacker.evil.com'
      },
      body: {
        email: 'victim@domain.com',
        industry: 'Roofing',
        territory: 'Houston, TX',
        volume: 100
      },
      ip: '127.0.0.1'
    }, requestsSvc, authSvc, new RateLimiter());

    assert.strictEqual(res.statusCode, 403);
    assert.match(res.body.error, /not permitted/i);
  });

  await test('Enforces Worker secret in production Lambda environment', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.WORKER_BACKEND_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_BACKEND_SECRET = 'super-secret-custom-token-xyz';

      // Request without worker secret -> 403
      const resWithoutSecret = await dispatchRequestsRoute({
        method: 'POST',
        path: '/api/requests/custom',
        headers: {
          'content-type': 'application/json',
          'origin': 'https://apexintel-b2b.shop'
        },
        body: {
          email: 'customer@company.com',
          industry: 'Solar',
          territory: 'Orlando, FL',
          volume: 200
        },
        ip: '127.0.0.1'
      }, requestsSvc, authSvc, new RateLimiter());

      assert.strictEqual(resWithoutSecret.statusCode, 403);
      assert.match(resWithoutSecret.body.error, /secret|worker|prohibited/i);

      // Request with worker secret -> 201
      const resWithSecret = await dispatchRequestsRoute({
        method: 'POST',
        path: '/api/requests/custom',
        headers: {
          'content-type': 'application/json',
          'origin': 'https://apexintel-b2b.shop',
          'x-apexintel-worker-secret': 'super-secret-custom-token-xyz'
        },
        body: {
          email: 'customer@company.com',
          industry: 'Solar',
          territory: 'Orlando, FL',
          volume: 200
        },
        ip: '127.0.0.1'
      }, requestsSvc, authSvc, new RateLimiter());

      assert.strictEqual(resWithSecret.statusCode, 201);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.WORKER_BACKEND_SECRET = prevSecret;
    }
  });

  console.log(`\n======================================================`);
  console.log(`Custom Requests Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    throw new Error(`Custom Extraction Requests Test Suite failed with ${failed} failure(s).`);
  }
}
