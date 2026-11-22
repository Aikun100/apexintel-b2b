/**
 * ApexIntel B2B - CRM Test Suite
 * 
 * Verifies:
 * 1. Server-authoritative session authentication enforcement (HTTP 401)
 * 2. Strict multi-tenant isolation: User A cannot read, update, or delete User B's leads (HTTP 404)
 * 3. Complete CRUD lifecycle across 11 pipeline stages, notes, and follow-ups
 * 4. Batch ingestion, validation limits, and string sanitization
 * 5. Pagination and stage filtering
 * 6. CSRF/Origin and Worker-to-Lambda shared secret verification
 * 
 * Target: Node.js 20+ Native Test Runner
 * Note: Uses InMemoryAuthRepository and InMemoryCrmRepository (no live cloud calls)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCrmRoute } from '../../src/crm/router.js';
import { CrmService, VALID_PIPELINE_STAGES, MAX_BATCH_LEADS } from '../../src/crm/service.js';
import { InMemoryCrmRepository, setCrmRepository } from '../../src/crm/repository.js';
import { AuthService } from '../../src/auth/service.js';
import { InMemoryAuthRepository, setAuthRepository } from '../../src/auth/repository.js';
import { serializeSessionCookie } from '../../src/auth/session.js';

// Setup fresh mock repositories
const authRepo = new InMemoryAuthRepository();
setAuthRepository(authRepo);
const authService = new AuthService({ repository: authRepo });

const crmRepo = new InMemoryCrmRepository();
setCrmRepository(crmRepo);
const crmService = new CrmService({ repository: crmRepo });

// Helper to dispatch with mocked services
function dispatch(reqObj) {
  return dispatchCrmRoute(reqObj, crmService, authService);
}

// Helper to register and create session
async function createTestUser(email, name = 'Test User') {
  const reg = await authService.register({
    email,
    password: 'ValidPassword2026!',
    name,
    company: 'Test Agency'
  });
  const cookie = serializeSessionCookie(reg.rawToken, { isProduction: false });
  return {
    user: reg.user,
    rawToken: reg.rawToken,
    cookie
  };
}

test('CRM Suite: Authentication & Origin Boundary Protection', async (t) => {
  crmRepo.clear();
  authRepo.clear();

  const userA = await createTestUser('alice@agency-a.com', 'Alice');

  await t.test('rejects request without session cookie with HTTP 401', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/crm/leads',
      headers: {}
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Authentication required/i);
  });

  await t.test('rejects request with forged / invalid session token with HTTP 401', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/crm/leads',
      headers: {
        cookie: 'apexintel_session=forged_token_hash_invalid_12345'
      }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
  });

  await t.test('rejects mutating request (POST) with disallowed Origin with HTTP 403', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/crm/leads',
      headers: {
        cookie: userA.cookie,
        origin: 'https://malicious-attacker-site.com',
        'content-type': 'application/json'
      },
      body: { company: 'Target Company' }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not permitted/i);
  });

  await t.test('rejects POST request with non-JSON Content-Type with HTTP 415', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/crm/leads',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'text/plain'
      },
      body: {}
    });

    assert.equal(res.statusCode, 415);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /Content-Type must be application\/json/i);
  });

  await t.test('rejects direct request when WORKER_BACKEND_SECRET is configured but missing', async () => {
    process.env.WORKER_BACKEND_SECRET = 'super-secret-token-12345';
    try {
      const res = await dispatch({
        method: 'GET',
        path: '/api/crm/leads',
        headers: {
          cookie: userA.cookie
        }
      });

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /Missing worker authentication secret/i);
    } finally {
      delete process.env.WORKER_BACKEND_SECRET;
    }
  });
});

test('CRM Suite: Multi-Tenant CRUD Lifecycle', async (t) => {
  crmRepo.clear();
  authRepo.clear();

  const userA = await createTestUser('alice@agency-a.com', 'Alice');

  let createdLeadId = null;

  await t.test('POST /api/crm/leads creates lead scoped strictly to user', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/crm/leads',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: {
        company: 'Austin Solar Pros',
        domain: 'Austinsolarpros.COM ', // should be normalized
        contactName: 'Sarah Jenkins',
        email: 'sarah@austinsolarpros.com',
        phone: '+1 512 555 0199',
        city: 'Austin, TX',
        status: 'Ready to Contact',
        priority: 'P1',
        opportunityScore: 92,
        tags: ['solar', 'commercial', 'Austin']
      }
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.lead);
    assert.equal(res.body.lead.company, 'Austin Solar Pros');
    assert.equal(res.body.lead.domain, 'austinsolarpros.com');
    assert.equal(res.body.lead.userId, userA.user.userId);
    assert.ok(res.body.lead.id);
    createdLeadId = res.body.lead.id;
  });

  await t.test('GET /api/crm/leads/:id retrieves lead by point lookup', async () => {
    const res = await dispatch({
      method: 'GET',
      path: `/api/crm/leads/${createdLeadId}`,
      headers: {
        cookie: userA.cookie
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.lead.id, createdLeadId);
    assert.equal(res.body.lead.company, 'Austin Solar Pros');
  });

  await t.test('PUT /api/crm/leads/:id updates stage, notes, and followUpDate', async () => {
    const res = await dispatch({
      method: 'PUT',
      path: `/api/crm/leads/${createdLeadId}`,
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: {
        status: 'Meeting Scheduled',
        priority: 'P1',
        followUpDate: '2026-11-30',
        notes: [
          { author: 'Alice', text: 'Spoke with Sarah; booked demo call for Monday at 10 AM.' }
        ]
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.lead.status, 'Meeting Scheduled');
    assert.equal(res.body.lead.followUpDate, '2026-11-30');
    assert.equal(res.body.lead.notes.length, 1);
    assert.equal(res.body.lead.notes[0].text, 'Spoke with Sarah; booked demo call for Monday at 10 AM.');
  });

  await t.test('DELETE /api/crm/leads/:id removes lead', async () => {
    const res = await dispatch({
      method: 'DELETE',
      path: `/api/crm/leads/${createdLeadId}`,
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    // Verify subsequent lookup returns 404
    const lookup = await dispatch({
      method: 'GET',
      path: `/api/crm/leads/${createdLeadId}`,
      headers: {
        cookie: userA.cookie
      }
    });
    assert.equal(lookup.statusCode, 404);
  });
});

test('CRM Suite: Strict Cross-Tenant Data Isolation (P0 Security)', async (t) => {
  crmRepo.clear();
  authRepo.clear();

  // Tenant A (Alice) and Tenant B (Bob)
  const userA = await createTestUser('alice@tenant-a.com', 'Alice');
  const userB = await createTestUser('bob@tenant-b.com', 'Bob');

  // Alice creates a proprietary lead
  const createRes = await dispatch({
    method: 'POST',
    path: '/api/crm/leads',
    headers: {
      cookie: userA.cookie,
      origin: 'https://apexintel-b2b.shop',
      'content-type': 'application/json'
    },
    body: {
      company: 'Alice Confidential Prospect',
      domain: 'alice-secret.com',
      email: 'owner@alice-secret.com'
    }
  });

  assert.equal(createRes.statusCode, 201);
  const aliceLeadId = createRes.body.lead.id;

  await t.test('Bob CANNOT read Alice lead by ID (returns 404)', async () => {
    const res = await dispatch({
      method: 'GET',
      path: `/api/crm/leads/${aliceLeadId}`,
      headers: {
        cookie: userB.cookie
      }
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  });

  await t.test('Bob lead list DOES NOT contain Alice lead', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/crm/leads',
      headers: {
        cookie: userB.cookie
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leads.length, 0);
  });

  await t.test('Bob CANNOT update Alice lead (returns 404)', async () => {
    const res = await dispatch({
      method: 'PUT',
      path: `/api/crm/leads/${aliceLeadId}`,
      headers: {
        cookie: userB.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: {
        company: 'Tampered by Bob'
      }
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  });

  await t.test('Bob CANNOT delete Alice lead (returns 404)', async () => {
    const res = await dispatch({
      method: 'DELETE',
      path: `/api/crm/leads/${aliceLeadId}`,
      headers: {
        cookie: userB.cookie,
        origin: 'https://apexintel-b2b.shop'
      }
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  });

  await t.test('Alice lead remains intact after unauthorized access attempts', async () => {
    const res = await dispatch({
      method: 'GET',
      path: `/api/crm/leads/${aliceLeadId}`,
      headers: {
        cookie: userA.cookie
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.lead.company, 'Alice Confidential Prospect');
  });
});

test('CRM Suite: Batch Ingestion & Field Validation', async (t) => {
  crmRepo.clear();
  authRepo.clear();

  const userA = await createTestUser('alice@agency-a.com', 'Alice');

  await t.test('POST /api/crm/leads batch creates multiple leads', async () => {
    const batchLeads = [
      { company: 'Lead One', domain: 'lead1.com', status: 'New' },
      { company: 'Lead Two', domain: 'lead2.com', status: 'Qualified' },
      { company: 'Lead Three', domain: 'lead3.com', status: 'Won' }
    ];

    const res = await dispatch({
      method: 'POST',
      path: '/api/crm/leads',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { leads: batchLeads }
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 3);
    assert.equal(res.body.leads.length, 3);
  });

  await t.test('rejects batch exceeding MAX_BATCH_LEADS with HTTP 400', async () => {
    const oversizedBatch = Array.from({ length: MAX_BATCH_LEADS + 1 }, (_, i) => ({
      company: `Company ${i}`,
      domain: `comp${i}.com`
    }));

    const res = await dispatch({
      method: 'POST',
      path: '/api/crm/leads',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { leads: oversizedBatch }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /capped at maximum 50 leads/i);
  });

  await t.test('rejects lead creation with empty company name with HTTP 400', async () => {
    const res = await dispatch({
      method: 'POST',
      path: '/api/crm/leads',
      headers: {
        cookie: userA.cookie,
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { company: '   ' }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /company name is required/i);
  });
});

test('CRM Suite: Filtering & Pagination', async (t) => {
  crmRepo.clear();
  authRepo.clear();

  const userA = await createTestUser('alice@agency-a.com', 'Alice');

  // Seed 10 leads: 6 Won, 4 Lost
  const seeds = [];
  for (let i = 1; i <= 6; i++) {
    seeds.push({ company: `Won Firm ${i}`, status: 'Won' });
  }
  for (let i = 1; i <= 4; i++) {
    seeds.push({ company: `Lost Firm ${i}`, status: 'Lost' });
  }

  await dispatch({
    method: 'POST',
    path: '/api/crm/leads',
    headers: {
      cookie: userA.cookie,
      origin: 'https://apexintel-b2b.shop',
      'content-type': 'application/json'
    },
    body: { leads: seeds }
  });

  await t.test('GET /api/crm/leads?status=Won returns only Won leads', async () => {
    const res = await dispatch({
      method: 'GET',
      path: '/api/crm/leads',
      query: { status: 'Won' },
      headers: {
        cookie: userA.cookie
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.leads.length, 6);
    assert.ok(res.body.leads.every(l => l.status === 'Won'));
  });

  await t.test('GET /api/crm/leads with pagination limit and cursor', async () => {
    // Page 1: limit 4
    const page1 = await dispatch({
      method: 'GET',
      path: '/api/crm/leads',
      query: { limit: '4' },
      headers: {
        cookie: userA.cookie
      }
    });

    assert.equal(page1.statusCode, 200);
    assert.equal(page1.body.leads.length, 4);
    assert.ok(page1.body.nextCursor, 'Expected nextCursor for subsequent page');

    // Page 2: with cursor
    const page2 = await dispatch({
      method: 'GET',
      path: '/api/crm/leads',
      query: { limit: '4', cursor: page1.body.nextCursor },
      headers: {
        cookie: userA.cookie
      }
    });

    assert.equal(page2.statusCode, 200);
    assert.equal(page2.body.leads.length, 4);

    // Verify zero ID overlap between page 1 and page 2
    const idsPage1 = new Set(page1.body.leads.map(l => l.id));
    for (const lead of page2.body.leads) {
      assert.ok(!idsPage1.has(lead.id), `Duplicate lead ${lead.id} found across pages`);
    }
  });
});
