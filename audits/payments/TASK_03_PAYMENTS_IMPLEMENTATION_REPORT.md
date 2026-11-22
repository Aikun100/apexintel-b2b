# ApexIntel B2B — Task 03 Payments Implementation Report
**Document ID:** `APEX-AUDIT-2026-PAY-01`  
**Classification:** Internal Engineering & Security Audit  
**Status:** COMPLETED & VERIFIED  
**Auditor:** Senior Full-Stack Engineer, AWS Serverless Architect, Application Security Engineer  
**Date:** 2026-11-22  
**Target AWS Region:** `ap-southeast-2` (Sydney)  
**Target DynamoDB Table:** `apexintel_orders`  
**Target S3 Bucket:** `apexintel-datasets-production` (Private, Block Public Access ON)  

---

## 1. Executive Summary

Task 03 resolves the critical payment and dataset fulfillment security vulnerabilities identified in the initial security audit (Finding `P0-01`):
1. **Elimination of Client-Side Payment Bypasses:** The legacy client-side confirmation method `window.confirmManualPayment()` and manual bypass buttons (`"✓ I Have Completed My PayPal Payment"`, `"✓ I Have Completed My Card Payment"`) have been **completely eliminated**. Zero occurrences of `confirmManualPayment` remain anywhere in `public/`.
2. **Elimination of In-Browser Mock CSV Generation:** `window.downloadDatasetPacks()` and `defaultPurchases` hardcoded arrays have been purged from the client dashboard. Unauthenticated users can no longer generate or download free lead CSVs directly from browser memory.
3. **Data Leakage Remediation:** The 24 decision-maker contact records in `public/index.html` (`dataCollections`) have been masked (`in**@...`, `+1 469 *** ...`), preventing scrapers and unauthorized visitors from harvesting proprietary prospect emails and phone numbers.
4. **Server-Authoritative Stripe Checkout:** Endpoints `/api/orders/checkout` strictly resolve prices and private S3 object keys from server-side catalog `src/payments/catalog.js`. Client-injected prices or discounts are strictly ignored.
5. **Cryptographic Webhook Verification & Idempotency:** Webhooks at `POST /api/webhooks/payment` verify raw request bodies against `stripe-signature` using `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent`. Retried webhooks are processed idempotently without double-fulfillment.
6. **Time-Limited S3 Presigned URLs with Tenant Isolation:** Downloads via `GET /api/downloads/signed-url?orderId=...` require authenticated session cookies, verify ownership (`order.userId === session.userId`), enforce `status === 'paid'`, and generate time-limited (15-minute / 900-second) S3 presigned URLs from private bucket `apexintel-datasets-production`.

---

## 2. Security Vulnerabilities Remediated

| Vulnerability ID | Component | Risk Severity | Before (Vulnerable State) | After (Secured State) |
|---|---|---|---|---|
| **VULN-PAY-01** | `public/js/payment-engine.js` | **Critical (P0)** | Anyone clicking `"I Have Completed My Payment"` executed `confirmManualPayment()`, synthesized a fake transaction, and unlocked files with $0 paid. | Function and bypass UI completely removed. Orders require real Stripe Checkout creation and server-side webhook fulfillment. |
| **VULN-PAY-02** | `public/js/customer-dashboard.js` | **High (P0)** | `downloadDatasetPacks()` generated CSV blobs in browser memory using bundled `defaultPurchases` data without checking login or payment status. | Replaced by `downloadDatasetOrder(orderId)` calling `/api/downloads/signed-url`. Downloads strictly require verified paid order ownership. |
| **VULN-PAY-03** | `public/index.html` | **High (P1)** | `dataCollections` exposed 24 complete, unmasked B2B email addresses and phone numbers in plaintext client-side JavaScript. | All 24 records masked (`in**@...`, `+1 469 *** ...`). Marketing preview functions without leaking valuable proprietary contact data. |
| **VULN-PAY-04** | Client Price Tampering | **High (P1)** | Client could submit modified prices or pack details. | Server catalog `src/payments/catalog.js` authoritatively controls price, currency, leads count, and S3 keys. |
| **VULN-PAY-05** | S3 Public Access | **Critical (P0)** | Public dataset downloads or predictable URLs risk bulk dataset theft. | Datasets reside in private S3 bucket `apexintel-datasets-production`. Downloads only accessible via 15-minute presigned URLs generated server-side. |

---

## 3. Architecture & Data Flow

```
[ Browser / Client ]
         |
         | 1. POST /api/orders/checkout { productKey: 'texas' }
         |    (HttpOnly session cookie + CSRF Origin verified)
         v
[ Cloudflare Worker (src/worker.js) ]
         |
         | (Adds trusted CF-Connecting-IP, Worker Secret header)
         v
[ AWS Lambda / Payments Router (src/payments/router.js) ]
         |
         |-- Checks session & authoritative price ($79 in src/payments/catalog.js)
         |-- Inserts pending order into DynamoDB (apexintel_orders, status: 'pending_payment')
         |-- Calls Stripe API: creates Checkout Session with client_reference_id = orderId
         v
[ Browser Redirects to Stripe Checkout (session.url) ]
         |
         | 2. Customer completes card payment on Stripe
         v
[ Stripe Webhook Dispatch ]
         |
         | 3. POST /api/webhooks/payment
         |    (Raw body preserved; header: stripe-signature)
         v
[ Cloudflare Worker -> Payments Router ]
         |
         |-- Verifies raw body against signature with STRIPE_WEBHOOK_SECRET
         |-- Verifies order exists in DynamoDB apexintel_orders
         |-- Idempotent fulfillment: updates status -> 'paid', records payment_intent & paidAt
         v
[ Customer Dashboard (public/js/customer-dashboard.js) ]
         |
         | 4. User views purchase history via GET /api/orders
         | 5. User clicks Download: GET /api/downloads/signed-url?orderId=...
         v
[ Payments Service (src/payments/service.js) ]
         |
         |-- Validates user owns the order (userId === order.userId)
         |-- Validates order.status === 'paid' (unpaid orders rejected with 403)
         |-- Generates 15-minute S3 presigned URL via @aws-sdk/s3-request-presigner
         v
[ Direct Download from Private S3: apexintel-datasets-production ]
```

---

## 4. Test Suite Execution & Verification

Automated tests in `tests/payments/payments.test.js` executed via `node scripts/run-payment-tests.mjs`:

```
🧪 Starting ApexIntel B2B Payments & S3 Fulfillment Test Suite...

TAP version 13
# Subtest: Payments Suite: Authentication & Origin Boundary Protection
    ok 1 - rejects unauthenticated POST /api/orders/checkout with HTTP 401
    ok 2 - rejects unauthenticated GET /api/orders with HTTP 401
    ok 3 - rejects unauthenticated GET /api/downloads/signed-url with HTTP 401
    ok 4 - rejects checkout request from disallowed Origin with HTTP 403
ok 1 - Payments Suite: Authentication & Origin Boundary Protection

# Subtest: Payments Suite: Authoritative Pricing & Checkout Session Creation
    ok 1 - creates pending order with authoritative catalog price ($79 for texas)
    ok 2 - strictly ignores client-side tampered price amounts
    ok 3 - rejects unknown productKey with HTTP 400
ok 2 - Payments Suite: Authoritative Pricing & Checkout Session Creation

# Subtest: Payments Suite: Cryptographic Webhook Verification & Idempotent Fulfillment
    ok 1 - rejects webhook with missing stripe-signature header with HTTP 400
    ok 2 - rejects webhook with forged / invalid cryptographic signature with HTTP 400
    ok 3 - accepts valid cryptographic signature and fulfills order to paid status
    ok 4 - handles retried webhook idempotently without double-fulfillment
ok 3 - Payments Suite: Cryptographic Webhook Verification & Idempotent Fulfillment

# Subtest: Payments Suite: Strict Cross-Tenant Isolation & S3 Fulfillment Gating
    ok 1 - Bob CANNOT download Alice paid order (returns HTTP 403 Forbidden)
    ok 2 - Bob CANNOT download his own order while status is unpaid (returns HTTP 403)
    ok 3 - Alice CAN download her own paid order (returns time-limited S3 presigned URL)
    ok 4 - Order listing strictly isolates orders per tenant
ok 4 - Payments Suite: Strict Cross-Tenant Isolation & S3 Fulfillment Gating

1..4
# tests 19
# suites 0
# pass 19
# fail 0
```

### Cumulative Platform Verification Status:
- **Authentication Suite:** 52 / 52 passing
- **CRM Multi-Tenant Suite:** 24 / 24 passing
- **Payments & S3 Fulfillment Suite:** 19 / 19 passing
- **Total Passing Tests:** **95 / 95 (100% pass rate, 0 failures)**

---

## 5. Deliverables Created & Updated

1. `aws/dynamodb/schema-orders.json` (PK `orderId`, GSIs: `userId-createdAt-index`, `stripeSessionId-index`)
2. `scripts/setup-dynamodb.mjs` (Added `schema-orders.json`, verified `--dry-run`)
3. `src/payments/catalog.js` (Authoritative server-side pricing and private S3 key mapping)
4. `src/payments/repository.js` (`InMemoryOrdersRepository` + `DynamoDBOrdersRepository` fail-closed in production)
5. `src/payments/service.js` (Stripe checkout session, cryptographic webhook signature verification, presigned S3 URL generator)
6. `src/payments/router.js` (HTTP dispatcher with CSRF/Origin enforcement and raw body webhook routing)
7. `aws/iam/apexintel-payments-lambda-policy.json` (Least-privilege IAM policy for DynamoDB, S3 `GetObject`, and CloudWatch Logs)
8. `aws/lambda-payments-handler.mjs` (AWS Lambda Node.js 20 adapter)
9. `src/worker.js` & `serve.js` (Wired `/api/orders/*`, `/api/webhooks/payment`, `/api/downloads/*`)
10. `public/js/payment-engine.js` (Removed manual bypasses; wired to `/api/orders/checkout`)
11. `public/js/customer-dashboard.js` (Purged client CSV generator and mock data; wired to `/api/orders` & `/api/downloads/signed-url`)
12. `public/index.html` (Masked preview contact records in `dataCollections`; bundled via `bundle-all.js`)
13. `tests/payments/payments.test.js` & `scripts/run-payment-tests.mjs` (19 automated tests)
14. `docs/payments/STRIPE_WEBHOOK_AND_S3_SETUP.md` (Operational setup guide)
