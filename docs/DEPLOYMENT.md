# ApexIntel B2B — Deployment & Edge Infrastructure Guide

- **Production Domain:** `https://apexintel-b2b.shop`
- **Edge Runtime:** Cloudflare Workers (`src/worker.js` + static assets in `public/`)
- **Backend Compute:** AWS Lambda (Node.js 20 ESM, `ap-southeast-2`)

---

## 1. Wrangler Configuration (`wrangler.jsonc`)

- `"name"`: `apexintel-b2b`
- `"main"`: `src/worker.js`
- `"assets"`: `{ "directory": "public" }`
- Custom domains: `apexintel-b2b.shop`, `www.apexintel-b2b.shop`

---

## 2. Build & Local Verification

```powershell
# 1. Recompile modular JS files into public/index.html
node scripts/bundle-all.js

# 2. Validate frontend script syntax
node scripts/validate-scripts-syntax.js

# 3. Run full automated test suite (192 tests)
node scripts/run-all-tests.mjs

# 4. Build and verify all 6 AWS Lambda ZIP packages (auth, crm, payments, crawler, tools, requests)
node scripts/package-all-lambdas.mjs
node scripts/verify-all-lambda-packages.mjs
```

---

## 3. Production Deployment (Gated)

Production deployments to Cloudflare Workers (`npx wrangler deploy`) and AWS Lambda require explicit operator approval and configured environment secrets (`WORKER_BACKEND_SECRET`, `BACKEND_AUTH_URL`, Stripe keys, AWS IAM role).

For step-by-step cloud provisioning, DynamoDB table verification, S3 bucket setup, and rollback commands, see:
- [Operator Deployment Runbook](OPERATOR_DEPLOYMENT_RUNBOOK.md)
- [Lambda Deployment Guide](authentication/LAMBDA_DEPLOYMENT_GUIDE.md)
- [Stripe Webhook & S3 Setup](payments/STRIPE_WEBHOOK_AND_S3_SETUP.md)
