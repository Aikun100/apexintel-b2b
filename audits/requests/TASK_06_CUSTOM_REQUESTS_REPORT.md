# ApexIntel B2B — Task 06 Implementation & Security Audit Report
## Custom Extraction Requests Backend & Admin Queue (P1-04)

**Document Reference:** `audits/requests/TASK_06_CUSTOM_REQUESTS_REPORT.md`  
**Execution Date:** November 2026  
**Status:** COMPLETE & PASSING (17/17 Custom Requests Tests Green, 158/158 Full Platform Tests Green)  
**Security Classification:** Highly Sensitive — Multi-Tenant Data Isolation & B2B Pipeline Integrity  

---

### 1. Executive Summary

In Task 06, the engineering team designed, implemented, and verified the serverless backend, multi-tenant isolation, and administrative fulfillment queue for **Custom B2B Data Extraction Requests (P1-04)**.

Prior to Task 06, Tool 6 in the Intelligence Suite (`public/js/tools-suite.js`) stored submitted extraction orders purely inside the visitor's browser `localStorage` (`apex_custom_requests` and `apexintel_custom_requests`). This created severe architectural failures:
1. **Lost High-Ticket Enterprise Leads:** Custom extraction orders ($150–$3,500+ bespoke datasets) never reached the server or administrators; if the user closed their tab or used private browsing, high-value enterprise prospect requests were permanently lost.
2. **Cross-Tenant & Data Spoofing Exposure:** Users on shared machines could inspect or overwrite requests from other users; client-submitted prices and simulated statuses could be forged.
3. **No Operational Queue:** Administrative staff in `public/js/admin-dashboard.js` had no centralized, persistent queue to inspect, claim, or deliver custom datasets.

The new architecture migrates custom requests to **DynamoDB (`apexintel_custom_requests`)**, enforces **server-authoritative pricing**, generates **cryptographically secure order IDs**, guarantees **strict multi-tenant customer isolation**, provides an **admin-only lifecycle queue**, and hooks into an asynchronous, non-blocking **SES notification adapter**.

---

### 2. Architectural Root-Cause & Security Analysis

#### 2.1 The Vulnerability of Client-Side Storage
```
Legacy Flow (VULNERABLE):
User Submits Form ──► Math.random() ID ──► localStorage ──► Trapped in Browser
                                                                 │
                                                       Admin Never Sees Order
                                                       Client Can Tamper Price
```

- **Price Tampering:** A malicious user could edit the DOM or payload to submit a 10,000-lead custom crawl for `$5.00`.
- **Client-Side Order Spoofing:** `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}` produced predictable, easily guessable order IDs prone to collisions.
- **Unauthenticated Status Modification:** Status changes (`Delivered`) were client-side string mutations that did not reflect actual dataset availability on S3.

#### 2.2 Server-Authoritative Architecture
```
New Flow (HARDENED & MULTI-TENANT):
User Submits Form ──► Rate Limiter + Origin/CSRF + Worker Secret
                                  │
                       Server-Authoritative Pricing
                      (Discards Client-Supplied Price)
                                  │
                   Cryptographic UUID (REQ-2026-<hex>)
                                  │
               DynamoDB (apexintel_custom_requests)
              ├── GSI: userId-createdAt-index (Customer View)
              └── GSI: status-createdAt-index (Admin Queue)
                                  │
                      Non-Blocking SES Notification
```

---

### 3. Component & Schema Specifications

#### 3.1 DynamoDB Schema (`aws/dynamodb/schema-custom-requests.json`)
- **Table Name:** `apexintel_custom_requests`
- **Partition Key:** `requestId` (String, e.g. `REQ-2026-9969C2`)
- **Global Secondary Index 1 (`userId-createdAt-index`):**
  - Partition Key: `userId` (S)
  - Sort Key: `createdAt` (S)
  - Projection: `ALL` (Powers fast, tenant-isolated queries for customer dashboards)
- **Global Secondary Index 2 (`status-createdAt-index`):**
  - Partition Key: `status` (S)
  - Sort Key: `createdAt` (S)
  - Projection: `ALL` (Powers administrative queue filtering by lifecycle stage)
- **Billing Mode:** `PAY_PER_REQUEST` (Zero idle cost)
- **Encryption:** AWS KMS Server-Side Encryption (Enabled)
- **PITR:** Point-in-time recovery enabled.

#### 3.2 Authoritative Pricing Engine (`src/requests/service.js`)
All pricing is computed server-side via `calculatePrice(volume, enrichments)`:
- **Base Tiered Rates:**
  - `< 250` leads: `$0.65` / record
  - `250 – 499` leads: `$0.55` / record
  - `500 – 999` leads: `$0.45` / record
  - `1,000 – 2,499` leads: `$0.35` / record
  - `>= 2,500` leads: `$0.25` / record
- **Add-on Enrichments:**
  - Latency / TTFB Verification: `+$0.08` / record
  - Meta & Google Retargeting Pixel Audit: `+$0.08` / record
  - Verified Mobile Phone Number: `+$0.12` / record
- **Output:** Formatted currency string (`$365.00`), exact integer cents (`36500`), and rate per record (`$0.73`). Client-submitted price inputs are discarded.

#### 3.3 Access Control & Multi-Tenant Rules (`src/requests/router.js`)
| Endpoint | Method | Authentication | Authorization / Tenant Policy |
|:---|:---:|:---:|:---|
| `/api/requests/custom` | `POST` | Optional Session | Public submission allowed; attaches `userId` if authenticated; enforces 5 req/15 min rate limit + Origin/CSRF. |
| `/api/requests/custom` | `GET` | Required (`401` if missing) | **Customers:** Restricted to records matching `userId === session.userId`.<br>**Admins:** Access full queue (`?status=...&userId=...`). |
| `/api/requests/custom/:id` | `GET` | Required (`401` if missing) | Returns single request; returns `403 Forbidden` if customer attempts to read another user's request. |
| `/api/requests/custom/:id` | `PATCH` | Required Admin (`403` if customer) | Validates lifecycle transition (`Submitted`, `Reviewing`, `Mining`, `Delivered`, `Cancelled`). |

---

### 4. Frontend Migration & XSS Hardening

1. **Custom Request Builder (`public/js/tools-suite.js`):**
   - Replaced `localStorage` operations in `window.handleCustomRequestBuilderSubmit` with `fetch('/api/requests/custom', { method: 'POST', credentials: 'include' })`.
   - Disabled submit button during transmission to prevent duplicate double-clicks.
   - Clean UI receipt confirmation with real server-generated `requestId`.
2. **Customer Dashboard (`public/js/customer-dashboard.js`):**
   - Removed `DEFAULT_CUSTOM_REQUESTS` mock constants.
   - Implemented `window.loadCustomRequestsFromBackend()` fetching from `GET /api/requests/custom`.
   - Added strict `escapeHTML()` entity sanitization across all rendered fields (`requestId`, `status`, `industry`, `territory`, `notes`, `estimatedPrice`).
3. **Admin Dashboard (`public/js/admin-dashboard.js`):**
   - Removed `localStorage` read/write helpers (`getCustomRequestsForAdmin`, `saveCustomRequestsFromAdmin`).
   - Implemented `window.loadAdminCustomRequestsFromBackend()` fetching from `GET /api/requests/custom`.
   - Wired dropdown changes directly to `PATCH /api/requests/custom/:id` with CSRF headers.
4. **Bundle Verification:**
   - Bundled all modules into `public/index.html` via `node scripts/bundle-all.js`.
   - Verified **zero occurrences** of `apexintel_custom_requests` or `apex_custom_requests` in `public/`.

---

### 5. Automated Verification Results

#### 5.1 Custom Requests Test Suite (`scripts/run-requests-tests.mjs`)
17 automated test cases verified with zero failures:

```
🧪 Starting Custom Extraction Requests Test Suite...

--- 1. Authoritative Pricing & Server-Side ID Generation ---
  ✅ Computes tiered base volume rate correctly
  ✅ Correctly applies optional enrichment addons (latency, pixel, mobile)
  ✅ Generates cryptographically random REQ-2026-<hex> ID and ignores client-submitted price

--- 2. Request Input Validation ---
  ✅ Rejects request with invalid or missing email
  ✅ Rejects request with empty territory
  ✅ Rejects volume outside 50 - 50,000 bounds

--- 3. API Authentication & Tenant Isolation ---
  ✅ POST /api/requests/custom allows submission and attaches authenticated user
  ✅ GET /api/requests/custom returns 401 when unauthenticated
  ✅ Customer Alice sees ONLY her own requests (tenant isolation)
  ✅ Customer Bob CANNOT view Alice's requests (tenant isolation cross-check)
  ✅ Customer Bob CANNOT modify request status via PATCH (403 Forbidden)

--- 4. Admin Queue & Lifecycle State Transitions ---
  ✅ Admin can view the complete custom requests queue
  ✅ Admin transitions lifecycle: Submitted -> Reviewing -> Mining -> Delivered
  ✅ Admin PATCH rejects invalid status with 400

--- 5. Security Controls: Rate Limiting, Origin & Worker Secret ---
  ✅ Enforces rate limiting on POST /api/requests/custom (5 allowed, 6th blocked)
  ✅ Rejects request from untrusted Origin with 403
  ✅ Enforces Worker secret in production Lambda environment

Custom Requests Test Results: 17 passed, 0 failed.
```

#### 5.2 Full Platform Test Suite Status (Tasks 01–06)
Across all 6 core platform modules, **158 / 158 automated tests are green**:

| Module | Scope | Tests Passed | Status |
|:---|:---|:---:|:---:|
| **Task 01** | Core Authentication, Scrypt, Sessions & CSRF | 52 / 52 | **PASS** |
| **Task 02** | Multi-Tenant CRM Backend & Optimistic UI | 24 / 24 | **PASS** |
| **Task 03** | Stripe Checkout, Webhooks & Presigned S3 Downloads | 19 / 19 | **PASS** |
| **Task 04** | DynamoDB Ingestion Pipeline & Masked Discovery API | 15 / 15 | **PASS** |
| **Task 05** | Website Intelligence Scanner & SSRF Guard | 31 / 31 | **PASS** |
| **Task 06** | Custom Extraction Requests & Admin Queue | 17 / 17 | **PASS** |
| **TOTAL** | **Entire ApexIntel B2B Platform** | **158 / 158** | **100% GREEN** |

---

### 6. Deliverable Inventory

| File Path | Description |
|:---|:---|
| `aws/dynamodb/schema-custom-requests.json` | DynamoDB schema definition for `apexintel_custom_requests` with GSIs |
| `scripts/setup-dynamodb.mjs` | Multi-table provisioning script updated for custom requests table |
| `src/requests/repository.js` | In-memory and DynamoDB requests repository with GSI queries |
| `src/requests/service.js` | Authoritative pricing, validation, tenant access, and lifecycle manager |
| `src/requests/router.js` | HTTP router with rate limiting, origin protection, and Lambda/Node adapters |
| `aws/lambda-requests-handler.mjs` | AWS Lambda entry point for custom extraction requests |
| `aws/iam/apexintel-requests-lambda-policy.json` | Least-privilege IAM policy for DynamoDB, SES, and CloudWatch Logs |
| `public/js/tools-suite.js` | Custom request builder updated for live API submission |
| `public/js/customer-dashboard.js` | Customer requests tab updated for backend fetch & XSS escaping |
| `public/js/admin-dashboard.js` | Admin fulfillment queue updated for backend fetch & PATCH actions |
| `public/index.html` | Bundled single-page application |
| `tests/requests/custom-requests.test.js` | Comprehensive 17-test suite for pricing, isolation, and lifecycle |
| `scripts/run-requests-tests.mjs` | Automated test runner for requests suite |
| `audits/requests/TASK_06_CUSTOM_REQUESTS_REPORT.md` | Comprehensive security and implementation audit report |

---

### 7. Conclusion & Next Steps

Task 06 is **100% complete, verified, and audited**. All enterprise custom lead requests are now reliably persisted in DynamoDB, protected by tenant isolation, priced authoritatively, and managed through an administrative queue.

All modifications remain local in accordance with security constraints (zero deployments to AWS/Cloudflare, zero live mutations, zero remote Git pushes).

The platform is ready for the **Final End-to-End System Integration & Deployment Readiness Audit**.
