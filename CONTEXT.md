# ApexIntel B2B — Agent Fast-Reference Context

> **READ THIS FIRST.** This file encodes complete architectural knowledge of the codebase.
> An agent that reads CONTEXT.md + AGENTS.md should need zero additional file reads before starting work.
> Keep this file updated whenever the architecture changes.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Product | ApexIntel B2B Sales Intelligence Platform |
| Repo | `Aikun100/apexintel-b2b` |
| Production URL | `https://apexintel-b2b.shop/` |
| Local Dev URL | `http://localhost:3000` (`node serve.js`) |
| Working Directory | `c:\laragon\www\browser-agent` |
| Stack | Vanilla JS ES6+, HTML, Tailwind CSS (CDN), Node.js 20 ESM |
| DB | Amazon DynamoDB (`ap-southeast-2`) |
| Storage | Amazon S3 (`apexintel-datasets-production`) |
| Payments | Stripe Checkout + Webhooks |
| Edge | Cloudflare Workers |
| Compute | AWS Lambda (Node.js 20 ESM, 6 functions) |

**Hard constraints:** Zero React/Next.js/Vue. Preserve existing architecture. No new NPM dependencies without approval.

---

## 2. Full File Map

### Root Files
| File | Purpose |
|---|---|
| `serve.js` | Local Node.js dev server. Serves `public/` as static + proxies `/api/*` to same-process Lambda handlers. Has path-traversal guards, full MIME map (`.svg`, `.webp`, `.woff2`, `.json`), CSP headers matching Worker, unauthenticated route guard. |
| `src/worker.js` | Cloudflare Worker edge proxy. `resolveBackendTarget()` routes domain prefixes to `BACKEND_AUTH_URL`, `BACKEND_CRM_URL`, `BACKEND_PAYMENTS_URL`, `BACKEND_DISCOVERY_URL`, `BACKEND_TOOLS_URL`, `BACKEND_REQUESTS_URL` with fallback to `BACKEND_API_URL`. Injects `x-apexintel-worker-secret` header. |
| `wrangler.jsonc` | Cloudflare deployment config. `name: apexintel-b2b`, `main: src/worker.js`, `assets: { directory: public }` |
| `.env.example` | Template for all required env vars. Never commit real values. |
| `AGENTS.md` | Engineering rules, approval gates, and reporting format. Always read. |
| `CONTEXT.md` | This file. Fast-reference architecture. |

### Frontend — `public/`
| File | Purpose |
|---|---|
| `public/index.html` | Single-page app. Contains inlined compiled JS from all `public/js/*.js` modules. **Always run `node scripts/bundle-all.js` after editing any `public/js/*.js` file.** |
| `public/css/apex-tokens.css` | Design token CSS variables: `--apex-bg`, `--apex-surface`, `--apex-cyan`, `--apex-text-*`. Tailwind-compatible. |
| `public/js/auth.js` | Login, register, password reset, `window.getCsrfToken()`, logout, `#customerDashboard` modal lifecycle. |
| `public/js/customer-dashboard.js` | 10-tab workspace: CRM, Opportunity Scoring, Lead Discovery, Outreach, Analytics, Settings, Downloads, Help, Intelligence, Campaigns. Handlers: `openLeadProfileDrawer`, `generateOutreachForLead`, `openCreateCampaignModal`, `openStripeCustomerPortal`. |
| `public/js/modals-and-knowledge.js` | `#productDetailModal` with `#dataset=texas\|florida\|medspas\|hvac` hash routing, 11-col field dictionary, sample preview table, 5-tier provenance legend, `#pdmNiche`. |
| `public/js/payment-engine.js` | Stripe Checkout session creation, order listing, `#checkoutSuccessScreen` with dynamic `#succOrderId/#succPackTitle/#succEmail/#succRecordCount`. |
| `public/js/tools-suite.js` | Tools 1–6: (1) Scanner, (2) ROI calculator `#roiResCac`, (3) Outreach caller `#outreachCall`, (4) Lead Scorer `#lqMargin/#lqScoreBreakdown`, (5) Discovery `#tool5Badge`, (6) Custom Quote `#collectionDesc/#buyBtn`. |
| `public/js/admin-dashboard.js` | Admin command center, `loadAdminOverviewFromBackend()` → `GET /api/admin/overview`. |
| `public/assets/visuals/*.svg` | 3 SVG hero visuals. No hardcoded mock numbers allowed. |

### Backend — `src/`
| Module | Files | Key Facts |
|---|---|---|
| **Auth** | `router.js`, `service.js`, `repository.js`, `session.js`, `csrf.js`, `middleware.js`, `password.js`, `rate-limiter.js`, `audit-logger.js` | Sessions in `apexintel_sessions` DynamoDB. CSRF: double-submit `x-csrf-token` + `Origin` check. `PUT /api/auth/profile`, `GET /api/auth/api-key`, `POST /api/auth/api-key/rotate`. Password reset tokens have numeric `ttl`. `devResetToken` in non-prod. |
| **CRM** | `router.js`, `service.js`, `repository.js` | Multi-tenant, strictly scoped to `userId`. `apexintel_leads` table. `GET/POST /api/crm/campaigns`. |
| **Payments** | `router.js`, `service.js`, `catalog.js`, `repository.js` | 4 products: TX (24 leads), FL (8 leads), CA MedSpas (9 leads), HVAC (12 leads). Catalog has `fieldCoverage`, `freshness`, `provenanceSummary`, `limitations`, `fieldDictionary`, `sampleRows`. Webhook: `stripe-signature` HMAC-SHA256 raw body verify. Dev mock checkout fallback. |
| **Discovery** | `router.js`, `service.js`, `repository.js` | Trade filters: `texas`, `florida`, `medspas`, `hvac` (normalized). `GET /api/admin/overview` (admin-only, real metrics: users/orders/revenue/requests/lead pool). |
| **Requests** | `router.js`, `service.js`, `repository.js` | Custom research. Price: `$0.65–$0.25/rec + addons`. Lifecycle: `Submitted→Reviewing→Mining→Delivered/Cancelled`. `GET /api/requests/custom/:id/download` (authorized). CSRF + JSON content-type validated. |
| **Tools** | `router.js`, `scanner-service.js`, `ssrf-guard.js`, `repository.js`, `opportunity-scorer.js` | Scanner: HTTP:80 fallback, max-3 SSRF-safe 3xx redirects, no fake `info@`/`750ms` fallbacks. `opportunity-scorer.js`: 5-tier taxonomy `Verified/PubliclyListed/Inferred/Estimated/Unavailable`. `scoreOpportunity()`, `scoreLead()`. `USE_MOCK_STORAGE` env var for local dev. |

### AWS Lambda Handlers — `aws/`
| Handler | Lambda ZIP | Packages |
|---|---|---|
| `aws/lambda-auth-handler.mjs` | `dist/auth-lambda.zip` | src/auth/* |
| `aws/lambda-crm-handler.mjs` | `dist/crm-lambda.zip` | src/crm/* |
| `aws/lambda-payments-handler.mjs` | `dist/payments-lambda.zip` | src/payments/* |
| `aws/lambda-crawler-handler.mjs` | `dist/crawler-lambda.zip` | src/discovery/*, src/tools/opportunity-scorer.js, src/payments/repository.js, src/requests/repository.js (NOT src/payments/service.js — requires Stripe SDK) |
| `aws/lambda-tools-handler.mjs` | `dist/tools-lambda.zip` | src/tools/* |
| `aws/lambda-requests-handler.mjs` | `dist/requests-lambda.zip` | src/requests/* |

### Scripts — `scripts/`
| Script | Purpose |
|---|---|
| `bundle-all.js` | Slices `public/index.html` at `<!-- Modular SaaS Application Engine` and concatenates `public/js/{auth,customer-dashboard,admin-dashboard,payment-engine,tools-suite,modals-and-knowledge}.js`. **Must run after any JS module edit.** |
| `validate-scripts-syntax.js` | AST check for `public/index.html` script blocks, `node --check` for ESM `src/` files. Must exit non-zero on invalid JS. |
| `run-all-tests.mjs` | 192 tests across 7 suites. 100% pass required. |
| `package-all-lambdas.mjs` | Builds all 6 Lambda ZIPs to `dist/`. |
| `verify-all-lambda-packages.mjs` | 151 package checks across all 6 ZIPs. |
| `verify-auth-lambda-package.mjs` | 46 checks for auth ZIP only. |

---

## 3. DynamoDB Tables

| Table | Key | Usage |
|---|---|---|
| `apexintel_users` | `userId` (string) | User accounts |
| `apexintel_sessions` | `sessionId` (string) | HttpOnly session tokens |
| `apexintel_leads` | `userId` + `leadId` | CRM leads per user |
| `apexintel_orders` | `userId` + `orderId` | Purchase records |
| `apexintel_custom_requests` | `userId` + `requestId` | Custom research requests |

---

## 4. Product Catalog (Source of Truth)

| Product Key | Title | Records | Territory | Niche |
|---|---|---|---|---|
| `texas-contractors-v1` | Texas High-Ticket Contractors & Restoration | 24 | TX | Contractors / Restoration |
| `florida-contractors-v1` | Florida Premium Contractor Intelligence | 8 | FL | Contractors |
| `california-medspas-v1` | California Medical Spa & Aesthetics Intelligence | 9 | CA | MedSpas / Aesthetics |
| `hvac-mechanical-v1` | Commercial HVAC & Mechanical Intelligence | 12 | National | HVAC |

**All 4 products:** `fieldCoverage`, `freshness`, `provenanceSummary`, `limitations`, `fieldDictionary`, `sampleRows` defined in `src/payments/catalog.js`.

---

## 5. Data Provenance 5-Tier Taxonomy

| Tier | Label | Meaning |
|---|---|---|
| 1 | Verified | Confirmed via primary source (official registries) |
| 2 | Publicly Listed | Active public web listing |
| 3 | Inferred | Derived from adjacent verified data |
| 4 | Estimated | Computed estimate with stated methodology |
| 5 | Unavailable | Not collected / redacted |

**Rule:** Zero fake `info@` emails or `+1 555` phone numbers allowed anywhere.

---

## 6. Key Architecture Patterns

### Shell Commands (Windows PowerShell)
- Use `;` as statement separator, NOT `&&` (PowerShell rejects `&&`)
- Example: `node scripts/bundle-all.js ; node scripts/validate-scripts-syntax.js`

### Bundling Invariant
1. Edit `public/js/<module>.js`
2. Run `node scripts/bundle-all.js`
3. Verify with `node scripts/validate-scripts-syntax.js`
4. Run `node scripts/run-all-tests.mjs`

### CSRF Pattern
- All mutating requests: `x-csrf-token` header (from `apexintel_csrf` cookie) + `Origin` header validation
- `window.getCsrfToken()` exposed in `public/js/auth.js`

### Mock Storage (Local Dev)
- Set `USE_MOCK_STORAGE=true` in `.env` to bypass DynamoDB/S3 during local development
- In-memory Maps used for sessions, leads, orders, etc.

### Approval Gates (Never Do Without User Confirmation)
1. Deploy to AWS Lambda or Cloudflare Workers
2. Modify production IAM policies or cloud credentials
3. Provision/scale/delete DynamoDB tables or S3 buckets
4. Modify live Stripe keys, prices, or webhook configs
5. Destructive git operations (`--force`, `reset --hard`)

---

## 7. Test Suite Map

| Suite | File | Tests | Coverage |
|---|---|---|---|
| Auth | `scripts/run-auth-tests.mjs` | ~40 | register, login, CSRF, sessions, password reset |
| CRM | `scripts/run-crm-tests.mjs` | ~25 | CRUD leads, campaign create, tenant isolation |
| Payments | `scripts/run-payment-tests.mjs` | ~30 | checkout, webhook HMAC, S3 download URL |
| Discovery | `scripts/run-discovery-tests.mjs` | ~20 | search filters, trade normalization, admin overview |
| Scanner | `scripts/run-scanner-tests.mjs` | ~25 | SSRF guard, TLS check, opportunity scorer |
| Requests | `scripts/run-requests-tests.mjs` | ~30 | pricing, lifecycle, CSRF, authorized download |
| E2E | `scripts/run-e2e-tests.mjs` | ~22 | serve.js MIME/headers, worker routing, bundle integrity |

---

## 8. Routing Map

### Cloudflare Worker (`src/worker.js`)
```
apexintel-b2b.shop/api/auth/*      → BACKEND_AUTH_URL
apexintel-b2b.shop/api/crm/*       → BACKEND_CRM_URL
apexintel-b2b.shop/api/orders/*    → BACKEND_PAYMENTS_URL
apexintel-b2b.shop/api/webhooks/*  → BACKEND_PAYMENTS_URL
apexintel-b2b.shop/api/downloads/* → BACKEND_PAYMENTS_URL
apexintel-b2b.shop/api/discovery/* → BACKEND_DISCOVERY_URL
apexintel-b2b.shop/api/admin/*     → BACKEND_DISCOVERY_URL
apexintel-b2b.shop/api/tools/*     → BACKEND_TOOLS_URL
apexintel-b2b.shop/api/requests/*  → BACKEND_REQUESTS_URL
(fallback)                          → BACKEND_API_URL
```

### Local Dev (`serve.js`)
- Same routing, all handlers in-process via `require()`
- Serves `public/` as static files

---

## 9. Git Status Summary (Last Verified: 2026-11-25)

**Deleted (redundant docs consolidated):** 40 obsolete markdown files in `docs/apexintel/`, `docs/audits/`, `docs/product/`, `BUSINESS_EMPIRE_OVERVIEW.md`, `PROMPT_MANDATE.md`, `REVENUE_CHANNELS.md`, `SALES_PLAYBOOK_MASTER.md`, `SOP_OPERATIONS.md`

**Modified (all implementation work):**
- `public/index.html` — Bundled SPA + all feature wiring
- `public/js/*.js` — All 6 JS modules
- `public/css/apex-tokens.css` — Design tokens
- `public/assets/visuals/*.svg` — 3 hero visuals (no mock data)
- `src/worker.js`, `serve.js` — Multi-target routing + security
- `src/auth/`, `src/crm/`, `src/payments/`, `src/discovery/`, `src/requests/`, `src/tools/` — All backend modules
- `docs/API_DOCUMENTATION.md`, `docs/DEPLOYMENT.md`, `docs/CHANGELOG.md`, `docs/ARCHITECTURE.md` — Updated docs
- `output/Commercial_HVAC_Mechanical_Enriched_Audited.xlsx` — Cleaned malformed email row 3

**Untracked (new files):**
- `src/tools/opportunity-scorer.js` — New explainable scoring engine
- `docs/PRODUCT_CATALOG.md` — New canonical product reference

---

## 10. Quick Verification Commands

```powershell
# Verify syntax and tests (run after any code change)
node scripts/bundle-all.js ; node scripts/validate-scripts-syntax.js

# Run all 192 tests
node scripts/run-all-tests.mjs

# Package all 6 Lambda ZIPs
node scripts/package-all-lambdas.mjs

# Verify all Lambda packages (151 checks)
node scripts/verify-all-lambda-packages.mjs

# Start local dev server
node serve.js

# Check git status
git status --short

# Commit all verified work
git add -A ; git commit -m "feat: [description]"
```

---

## 11. Known Gotchas

1. **PowerShell `&&` fails** — Use `;` instead
2. **Bundling required** — Any edit to `public/js/*.js` requires `node scripts/bundle-all.js` before the change is live in `public/index.html`
3. **Crawler Lambda cannot import `src/payments/service.js`** — That file requires the `stripe` SDK which is not in crawler's bundle. Use `extraSrcFiles` in `package-all-lambdas.mjs` to include only `src/payments/repository.js`
4. **`USE_MOCK_STORAGE=true`** — Mandatory for local dev; DynamoDB/S3 are not accessible without real AWS credentials
5. **SVG MIME type** — `serve.js` must return `Content-Type: image/svg+xml` for `.svg` files (already fixed)
6. **`new vm.Script()` vs `node --check`** — `validate-scripts-syntax.js` uses `new vm.Script()` for inline `<script>` blocks (CommonJS) and `execSync('node --check ...')` for ESM files in `src/`
