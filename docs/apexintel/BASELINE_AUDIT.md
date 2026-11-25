# APEXINTEL — BASELINE AUDIT & TECHNICAL INVENTORY (PHASE 0)

> **Generated:** 2026-11-25  
> **Repository:** `Aikun100/apexintel-b2b`  
> **Environment:** Node.js v22.18.0 / Cloudflare Workers / AWS Lambda (ESM) / Amazon DynamoDB / Amazon S3  
> **Git Branch:** `main` | **Head Commit:** `7458067`  

---

## 1. Architectural Foundation & Runtime Environment
ApexIntel is an enterprise-grade B2B Sales Intelligence Platform built on a high-efficiency serverless architecture with zero heavy frontend framework runtime dependencies.

### Frontend Layer
- **Architecture:** Modular Vanilla JavaScript (ES6+), HTML5, Tailwind CSS (via CDN runtime), SVG icon system, custom CSS token system (`public/css/apex-tokens.css`).
- **Entry Points:** `public/index.html` (primary SPA storefront and container), `public/js/` (modular frontend scripts):
  - `auth.js`: Authentication, session verification, user dropdown, auth modal.
  - `customer-dashboard.js`: 10-tab authenticated customer workspace.
  - `admin-dashboard.js`: Founder Command Center (revenue, AWS health, custom requests).
  - `payment-engine.js`: Instant buy modal, dataset selection, Stripe checkout triggers.
  - `tools-suite.js`: Lead Finder, Mobile Speed Scanner, Pixel Gap Detector, MX Email Ping, Zero-Duplicate Ledger.
  - `modals-and-knowledge.js`: Product methodology, legal policies, custom extraction modal.
- **Bundling Mechanism:** `scripts/bundle-all.js` bundles all modules in `public/js/` directly into `public/index.html` for self-contained, high-speed execution.

### Edge Proxy Layer
- **File:** `src/worker.js`
- **Platform:** Cloudflare Workers (V8 isolates)
- **Role:** Edge routing, origin verification, security header injection (HSTS, CSP, X-Frame-Options, X-Content-Type-Options), rate limiting, and reverse proxying `/api/*` traffic to AWS compute backend.

### Compute & Application Services
- **Runtime:** Node.js 20 ESM AWS Lambda
- **Core Modules:**
  - `src/auth/`: Scrypt password hashing, session tokens, CSRF protection, rate limiting, and security audit logging.
  - `src/crm/`: Multi-tenant CRM pipeline, lead status management, lead assignment, and deduplication.
  - `src/discovery/`: B2B business discovery engine, industry/location filtering, provenance tagging.
  - `src/payments/`: Stripe Checkout session creation, cryptographic webhook fulfillment, and 15-minute S3 presigned URL generation.
  - `src/requests/`: Bespoke custom intelligence research intake, lifecycle management (`Submitted` &rarr; `Delivered`).
  - `src/tools/`: Website audit engine, anti-SSRF guard (IPv4/IPv6 private IP rejection, AWS metadata block), DNS MX ping validation, and tech stack detection.

### Data Persistence Layer
- **Amazon DynamoDB Tables:**
  - `apexintel_users`: Tenant accounts, hashed passwords, roles (`customer`, `admin`), credits.
  - `apexintel_sessions`: Session token hashes, expiration, client metadata.
  - `apexintel_leads`: Prospect database, territory tags, contact details, mobile speed, pixel status.
  - `apexintel_orders`: Order records, Stripe session IDs, amounts, currencies, S3 artifact references.
  - `apexintel_custom_requests`: Custom research submissions, specifications, status queue.
  - `apexintel_scans_cache`: Cached domain audit and latency reports.
- **Amazon S3:**
  - Bucket: `apexintel-datasets-production`
  - Datasets: Texas Contractors (`datasets/texas_contractors_q4_2026.xlsx`), Florida Solar (`datasets/florida_solar_storm_2026.xlsx`), California MedSpas (`datasets/california_medspas_2026.xlsx`), Commercial HVAC (`datasets/commercial_hvac_2026.xlsx`).

---

## 2. Test Suite Baseline
Execution of `scripts/run-all-tests.mjs` verifies **189 tests passing across 7 suites with 0 failures**:
1. `tests/auth/auth.test.js`: 25 passed
2. `tests/crm/crm.test.js`: 47 passed
3. `tests/payments/payments.test.js`: 29 passed
4. `tests/auth/lambda-and-worker.test.js`: 18 passed
5. `tests/tools/scanner.test.js`: 44 passed
6. `tests/requests/custom-requests.test.js`: 17 passed
7. `tests/e2e/customer-journey.test.js`: 9 passed

---

## 3. Discovered Vulnerabilities & Priority Hardening Areas
1. **Payments Webhook Parameter Bypasses:** In `src/payments/service.js`, missing `amount_total`, missing `currency`, and missing `session.id` checks conditionally passed when undefined. Strict requirement and exact equality checks are needed.
2. **Missing Webhook Regression Tests:** Need test coverage for missing amount, missing currency, and missing session ID.
3. **Modal Trigger Compatibility:** Header buttons require unified binding across desktop and mobile to ensure seamless auth triggering.
