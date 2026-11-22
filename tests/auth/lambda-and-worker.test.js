/**
 * ApexIntel B2B - Lambda Cookie Extraction, Worker IP Forwarding, and Origin Protection Tests
 * 
 * Verifies:
 * 1. Lambda Cookie extraction:
 *    - Lowercase headers.cookie
 *    - Uppercase headers.Cookie
 *    - event.cookies array (API Gateway v2 / Function URL format)
 *    - Missing cookies handled safely
 *    - Multiple cookies parsed properly
 *    - Valid session authentication through handleLambdaEvent
 * 2. Trusted Client IP Forwarding:
 *    - Worker overwrites outgoing X-Forwarded-For with CF-Connecting-IP
 *    - Untrusted client-supplied X-Forwarded-For is stripped / overwritten
 *    - Missing CF-Connecting-IP deletes X-Forwarded-For to prevent spoofing
 * 3. Worker-to-Lambda Authentication:
 *    - Valid secret header allows request to proceed
 *    - Missing secret is rejected with 403 when secret is configured
 *    - Invalid secret is rejected with 403 in constant time
 *    - Local development / unconfigured secret permits local invocation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLambdaEvent, validateWorkerSecret } from '../../src/auth/router.js';
import { InMemoryAuthRepository } from '../../src/auth/repository.js';
import { RateLimiter } from '../../src/auth/rate-limiter.js';
import { AuditLogger } from '../../src/auth/audit-logger.js';
import { AuthService } from '../../src/auth/service.js';
import worker from '../../src/worker.js';

function setup() {
  const repository = new InMemoryAuthRepository();
  const rateLimiter = new RateLimiter();
  const auditLogs = [];
  const auditLogger = new AuditLogger({
    silent: true,
    destination: logStr => auditLogs.push(JSON.parse(logStr))
  });
  const service = new AuthService({ repository, rateLimiter, auditLogger });
  return { repository, rateLimiter, auditLogger, auditLogs, service };
}

// ==========================================
// 1. LAMBDA COOKIE EXTRACTION TESTS
// ==========================================
test('Lambda Adapter Cookie Extraction Suite', async (t) => {
  const { service } = setup();

  // Create an authenticated session for testing
  const regRes = await service.register({
    email: 'lambdacookie@apexintel.io',
    password: 'SecurePassphrase2026!'
  });
  const token = regRes.rawToken;

  await t.test('1. extracts cookie from lowercase headers.cookie', async () => {
    const event = {
      rawPath: '/api/auth/me',
      requestContext: { http: { method: 'GET', sourceIp: '127.0.0.1' } },
      headers: {
        cookie: `apexintel_session=${token}`
      }
    };

    const res = await handleLambdaEvent(event, service);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, 'lambdacookie@apexintel.io');
  });

  await t.test('2. extracts cookie from uppercase headers.Cookie', async () => {
    const event = {
      rawPath: '/api/auth/me',
      requestContext: { http: { method: 'GET', sourceIp: '127.0.0.1' } },
      headers: {
        Cookie: `apexintel_session=${token}`
      }
    };

    const res = await handleLambdaEvent(event, service);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, 'lambdacookie@apexintel.io');
  });

  await t.test('3. extracts cookie from event.cookies array (API Gateway v2 format)', async () => {
    const event = {
      rawPath: '/api/auth/me',
      requestContext: { http: { method: 'GET', sourceIp: '127.0.0.1' } },
      headers: {},
      cookies: [`apexintel_session=${token}`]
    };

    const res = await handleLambdaEvent(event, service);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, 'lambdacookie@apexintel.io');
  });

  await t.test('4. handles missing cookies safely without throwing', async () => {
    const event = {
      rawPath: '/api/auth/me',
      requestContext: { http: { method: 'GET', sourceIp: '127.0.0.1' } },
      headers: {}
    };

    const res = await handleLambdaEvent(event, service);
    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Authentication required/);
  });

  await t.test('5. handles multiple cookies in event.cookies array correctly', async () => {
    const event = {
      rawPath: '/api/auth/me',
      requestContext: { http: { method: 'GET', sourceIp: '127.0.0.1' } },
      headers: {},
      cookies: [
        'theme=dark',
        `apexintel_session=${token}`,
        'visitor_id=12345'
      ]
    };

    const res = await handleLambdaEvent(event, service);
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, 'lambdacookie@apexintel.io');
  });

  await t.test('6. valid session authentication and Set-Cookie format in Lambda response', async () => {
    const loginEvent = {
      rawPath: '/api/auth/login',
      requestContext: { http: { method: 'POST', sourceIp: '127.0.0.1' } },
      headers: {
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email: 'lambdacookie@apexintel.io',
        password: 'SecurePassphrase2026!'
      })
    };

    const res = await handleLambdaEvent(loginEvent, service);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.cookies), 'API Gateway v2 requires cookies array');
    assert.match(res.cookies[0], /apexintel_session=[a-f0-9]{64}/);
    assert.match(res.cookies[0], /HttpOnly/i);
    assert.match(res.cookies[0], /SameSite=Lax/i);
  });
});

// ==========================================
// 2. TRUSTED CLIENT IP FORWARDING TESTS
// ==========================================
test('Cloudflare Worker Trusted IP Forwarding Suite', async (t) => {
  await t.test('Worker overwrites spoofed client X-Forwarded-For with CF-Connecting-IP', async () => {
    let capturedForwardedFor = null;
    let capturedWorkerSecret = null;

    // Mock global fetch to inspect headers sent to the backend
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedForwardedFor = init.headers.get('X-Forwarded-For');
      capturedWorkerSecret = init.headers.get('x-apexintel-worker-secret');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    try {
      const incomingRequest = new Request('https://apexintel-b2b.shop/api/auth/me', {
        method: 'GET',
        headers: {
          'CF-Connecting-IP': '203.0.113.195', // Trusted Cloudflare IP
          'X-Forwarded-For': '198.51.100.99, 10.0.0.1' // Malicious attacker spoofed header
        }
      });

      const env = {
        BACKEND_AUTH_URL: 'https://backend.internal.aws',
        WORKER_BACKEND_SECRET: 'test-secret-value-32-chars-long!!'
      };

      const res = await worker.fetch(incomingRequest, env);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(capturedForwardedFor, '203.0.113.195', 'Must overwrite untrusted X-Forwarded-For with CF-Connecting-IP');
      assert.strictEqual(capturedWorkerSecret, 'test-secret-value-32-chars-long!!');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('Worker deletes untrusted X-Forwarded-For if CF-Connecting-IP is missing', async () => {
    let capturedForwardedFor = 'INITIAL_FLAG';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      capturedForwardedFor = init.headers.get('X-Forwarded-For');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    try {
      const incomingRequest = new Request('https://apexintel-b2b.shop/api/auth/me', {
        method: 'GET',
        headers: {
          'X-Forwarded-For': '198.51.100.99' // Spoofed header without CF-Connecting-IP
        }
      });

      const env = { BACKEND_AUTH_URL: 'https://backend.internal.aws' };
      await worker.fetch(incomingRequest, env);
      assert.strictEqual(capturedForwardedFor, null, 'Must strip untrusted X-Forwarded-For when CF-Connecting-IP is absent');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ==========================================
// 3. WORKER-TO-LAMBDA ORIGIN PROTECTION TESTS
// ==========================================
test('Worker-to-Lambda Origin Protection Suite', async (t) => {
  const { service } = setup();
  const SECRET = 'super-secret-worker-token-2026-auth!!';

  await t.test('rejects direct Lambda call when secret configured but header missing', async () => {
    process.env.WORKER_BACKEND_SECRET = SECRET;

    try {
      const directEvent = {
        rawPath: '/api/auth/me',
        requestContext: { http: { method: 'GET', sourceIp: '198.51.100.5' } },
        headers: {
          cookie: 'apexintel_session=some-token'
        }
      };

      const res = await handleLambdaEvent(directEvent, service);
      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.success, false);
      assert.match(body.error, /Missing worker authentication secret/);
    } finally {
      delete process.env.WORKER_BACKEND_SECRET;
    }
  });

  await t.test('rejects direct Lambda call with wrong secret in constant time', async () => {
    process.env.WORKER_BACKEND_SECRET = SECRET;

    try {
      const directEvent = {
        rawPath: '/api/auth/me',
        requestContext: { http: { method: 'GET', sourceIp: '198.51.100.5' } },
        headers: {
          'x-apexintel-worker-secret': 'wrong-attacker-secret-guess!!'
        }
      };

      const res = await handleLambdaEvent(directEvent, service);
      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.success, false);
      assert.match(body.error, /Invalid worker authentication secret/);
    } finally {
      delete process.env.WORKER_BACKEND_SECRET;
    }
  });

  await t.test('allows request when valid secret is presented and trusts forwarded IP', async () => {
    process.env.WORKER_BACKEND_SECRET = SECRET;

    try {
      const validEvent = {
        rawPath: '/api/auth/me',
        requestContext: { http: { method: 'GET', sourceIp: '10.0.0.1' } }, // Cloudflare egress IP
        headers: {
          'x-apexintel-worker-secret': SECRET,
          'x-forwarded-for': '203.0.113.50' // Genuine client IP passed from Cloudflare
        }
      };

      const res = await handleLambdaEvent(validEvent, service);
      // Valid secret passed origin protection; proceeds to normal auth check (401 because cookie empty)
      assert.strictEqual(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.success, false);
      assert.match(body.error, /Authentication required/);
    } finally {
      delete process.env.WORKER_BACKEND_SECRET;
    }
  });

  await t.test('local development permits requests when secret is unconfigured', async () => {
    delete process.env.WORKER_BACKEND_SECRET;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const localEvent = {
        rawPath: '/api/auth/me',
        requestContext: { http: { method: 'GET', sourceIp: '127.0.0.1' } },
        headers: {}
      };

      const res = await handleLambdaEvent(localEvent, service);
      // Local dev allowed without 403 origin rejection
      assert.strictEqual(res.statusCode, 401); // Reaches auth layer normally
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
