# ApexIntel B2B — Product Changelog & Release History

---

## [Unreleased] - 2026-11-25
### Documentation & Quality
- Consolidated overlapping documentation across `docs/apexintel/`, `docs/product/`, `docs/audits/`, and root `.md` files into a single conflict-free `docs/` source of truth aligned with `src/`, `public/`, and `output/*.xlsx`.
- Verified 192/192 automated tests across 7 suites (`scripts/run-all-tests.mjs`) and 46/46 Auth Lambda package checks (`scripts/verify-auth-lambda-package.mjs`).

---

## [v2.1.0] - 2026-11-23 (Tasks 01–07 Serverless Transformation)
### Added
- **Server-Authoritative Auth (`src/auth/`, `aws/lambda-auth-handler.mjs`):** Scrypt password hashing, SHA-256 `HttpOnly` cookie sessions, CSRF protection, rate limiting, and audit logging.
- **Multi-Tenant CRM (`src/crm/`):** DynamoDB-backed prospect persistence isolated by `userId`.
- **Stripe Checkout & S3 Fulfillment (`src/payments/`):** Authoritative product catalog (`catalog.js`), HMAC-SHA256 webhook verification with idempotent deduplication, and 15-minute S3 presigned download URLs.
- **Discovery & SSRF-Hardened Scanner (`src/discovery/`, `src/tools/`):** IPv4/IPv6 SSRF firewall, TLS trust validation, DNS MX verification, and DynamoDB scan caching.
- **Custom Research API (`src/requests/`):** Volume-tiered pricing engine and admin lifecycle queue.
- **Cloudflare Edge Proxy (`src/worker.js`):** `/api/*` routing, `x-apexintel-worker-secret` injection, and security headers.

---

## [v2.0.0] - 2026-11-22
### Added
- 11-stage CRM Workspace (`public/js/customer-dashboard.js`), Kanban & Table views, Audit Lab, and bundled SPA build (`scripts/bundle-all.js`).

---

## [v1.0.0] - 2026-11-20
### Initial Release
- Initial B2B datasets (Texas, Florida, MedSpas, HVAC) and static showcase.
