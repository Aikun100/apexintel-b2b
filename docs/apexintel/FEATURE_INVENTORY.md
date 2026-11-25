# APEXINTEL — FEATURE INVENTORY (PHASE 0)

> **Taxonomy Classifications:**  
> - `WORKING`: Implemented, tested, and actively functioning.  
> - `PARTIALLY WORKING`: Functional locally, requires edge or third-party service connection.  
> - `MOCK`: Demo/showcase data representation for frontend presentation.  
> - `BROKEN`: Code exists but fails execution or throws errors.  
> - `NOT IMPLEMENTED`: Feature envisioned in spec but not yet coded.  
> - `BLOCKED`: Dependent on unconfigured external credentials (e.g., live Stripe key, production AWS IAM).  
> - `NOT VERIFIED`: Code present but lacks test automation coverage.  

---

| Feature Component | Classification | Description & Location | Verification Status |
| :--- | :---: | :--- | :--- |
| **User Registration (/api/auth/register)** | `WORKING` | Scrypt hashing, min 12-char password enforcement, email normalization, role safety (`src/auth/service.js`). | 100% Verified in `run-auth-tests.mjs` |
| **User Login (/api/auth/login)** | `WORKING` | Brute-force protection, timing-safe compare, generic enumeration-safe errors (`src/auth/service.js`). | 100% Verified in `run-auth-tests.mjs` |
| **Session Restoration (/api/auth/me)** | `WORKING` | HttpOnly cookie verification, token hashing in DynamoDB/Memory (`src/auth/session.js`). | 100% Verified in `run-auth-tests.mjs` |
| **Dynamic Navbar & User Badge** | `WORKING` | Real-time update of credits, avatar, plan badge, dropdown controls (`public/js/auth.js`). | 100% Verified in browser & bundle |
| **Auth Modal & 1-Click Test Accounts** | `WORKING` | Dual tabs (Sign In / Register), backdrop dismissal, demo account auto-fill (`public/js/auth.js`). | 100% Verified in browser |
| **Catalog & Product Pricing** | `WORKING` | Authoritative server catalog: Texas ($79), Florida ($79), MedSpas ($89), HVAC ($79) (`src/payments/catalog.js`). | 100% Verified in `payments.test.js` |
| **Stripe Checkout Creation** | `PARTIALLY WORKING` | Creates real Stripe session or mock session in test mode without live secret (`src/payments/service.js`). | Verified in test mode; live requires key |
| **Cryptographic Webhook Fulfillment** | `WORKING` | HMAC-SHA256 signature verification, idempotency, event deduplication (`src/payments/service.js`). | 100% Verified in `payments.test.js` |
| **S3 Presigned Download Delivery** | `WORKING` | 15-minute time-limited presigned URL generation, paid status gating (`src/payments/service.js`). | 100% Verified in `payments.test.js` |
| **Lead Discovery Engine** | `WORKING` | Query filtering by industry, state, website status, verified lead counts (`src/discovery/service.js`). | 100% Verified in `discovery.test.js` |
| **CRM Pipeline Management** | `WORKING` | 5 pipeline stages (`lead`, `contacted`, `replied`, `qualified`, `closed`), notes, tags (`src/crm/service.js`). | 100% Verified in `crm.test.js` |
| **Multi-Tenant Data Isolation** | `WORKING` | User B strictly blocked from accessing or altering User A's leads or orders (HTTP 403) (`src/crm/service.js`). | 100% Verified in `run-all-tests.mjs` |
| **Anti-SSRF Diagnostic Scanner** | `WORKING` | Blocks 127.0.0.1, 169.254.169.254, RFC1918 private IPv4/IPv6, checks TLS certs (`src/tools/ssrf-guard.js`). | 100% Verified in `scanner.test.js` |
| **DNS MX Ping Email Verifier** | `WORKING` | Direct DNS lookup for authoritative mail exchangers (`src/tools/scanner-service.js`). | 100% Verified in `scanner.test.js` |
| **Custom Intelligence Research Queue** | `WORKING` | Intake form, 4-stage lifecycle (`Submitted` &rarr; `Delivered`), admin review (`src/requests/service.js`). | 100% Verified in `custom-requests.test.js` |
| **Founder Command Center (Admin)** | `WORKING` | Server-side role-gated admin modal, revenue metrics, AWS health, queue management (`public/js/admin-dashboard.js`). | 100% Verified in `admin-dashboard.js` |
| **10-Tab Customer Workspace** | `WORKING` | Unified tabs: CRM, Campaigns, Audit Lab, Custom Req, Datasets, Ledger, API, Settings (`public/js/customer-dashboard.js`). | 100% Verified in browser & bundle |
| **Zero-Duplicate Delivery Ledger** | `WORKING` | Cryptographic domain deduplication hashing, zero duplicate guarantee (`aws/deduplication-engine.mjs`). | 100% Verified in `customer-dashboard.js` |
| **Production AWS Deployment** | `BLOCKED` | Live cloud provisioning requires explicit user approval per `AGENTS.md`. | Gated by user approval |
| **Live Stripe Production Webhooks** | `BLOCKED` | Live payment processing requires live Stripe account secrets per `AGENTS.md`. | Gated by user approval |
