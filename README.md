# ApexIntel B2B — Sales Intelligence Platform

ApexIntel is a B2B Sales Intelligence Platform helping agencies, B2B sales teams, and consultants discover businesses, audit digital conversion gaps, manage prospects, and acquire pre-audited US business datasets.

**Core positioning:** *"Find the right businesses. Understand the opportunity. Turn intelligence into growth."*

---

## Architecture Overview

- **Frontend (`public/`):** Modular Vanilla JavaScript (ES6+), Tailwind CSS, Single Page Application (`public/index.html` compiled via `scripts/bundle-all.js`).
- **Edge Proxy (`src/worker.js`):** Cloudflare Workers (`wrangler.jsonc`) serving static assets, enforcing security headers (CSP, HSTS, X-Frame-Options), forwarding trusted client IPs, and injecting `x-apexintel-worker-secret` for `/api/*` requests.
- **Compute Backend (`src/`, `aws/`):** Node.js 20 ESM handlers for AWS Lambda (`aws/lambda-auth-handler.mjs` and modular routers/services for Auth, CRM, Payments, Discovery, Tools/Scanner, and Custom Research Requests).
- **Data Stores:** Amazon DynamoDB (`apexintel_users`, `apexintel_sessions`, `apexintel_rate_limits`, `apexintel_password_resets`, `apexintel_user_crm`, `apexintel_orders`, `apexintel_custom_requests`, `apexintel_scans_cache`, `leads_cache`) and private Amazon S3 (`apexintel-datasets-production`).
- **Payments:** Stripe Checkout and HMAC-SHA256 webhook verification (`src/payments/`).

---

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Run local HTTP + API development server (http://localhost:3000)
node serve.js

# Re-bundle frontend modules into public/index.html after editing public/js/*
node scripts/bundle-all.js
```

---

## Automated Verification

```bash
# Run all 7 backend & E2E test suites (192 tests)
node scripts/run-all-tests.mjs

# Validate JavaScript syntax across frontend modules
node scripts/validate-scripts-syntax.js

# Build and verify Auth Lambda deployment package (46 checks)
node scripts/package-auth-lambda.mjs
node scripts/verify-auth-lambda-package.mjs
```

---

## Documentation Index

- [Architecture](docs/ARCHITECTURE.md)
- [Product Catalog](docs/PRODUCT_CATALOG.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Data Pipeline](docs/DATA_PIPELINE.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md) & [Operator Runbook](docs/OPERATOR_DEPLOYMENT_RUNBOOK.md)
- [Testing](docs/TESTING.md)
- [AWS Cost Estimate](docs/AWS_COST_ESTIMATE.md)
- [UI/UX Design System](docs/UI_UX_DESIGN_SYSTEM_BLUEPRINT.md)
- [Changelog](docs/CHANGELOG.md)
