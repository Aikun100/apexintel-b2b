# APEXINTEL — KNOWN LIMITATIONS & ARCHITECTURAL BOUNDARIES (PHASE 12)

> **Document Type:** Production Readiness & Limitations Report  
> **Platform:** ApexIntel B2B Sales Intelligence Platform  
> **Status:** Active Reference  

---

## 1. External Cloud & Service Boundaries (Gated Operations)
Per the strict directives in `AGENTS.md` (Explicit Approval Boundaries), the following operations require live cloud credentials and explicit user authorization before execution:

1. **Live Stripe Production Webhook Delivery:**
   - *Status:* Tested and verified with cryptographic HMAC-SHA256 signatures in test mode using mock Stripe clients.
   - *Limitation:* Connecting live production Stripe webhooks (`https://apexintel-b2b.shop/api/webhooks/payment`) requires deploying the live webhook secret (`whsec_...`) in Cloudflare Worker environment variables.
2. **AWS Lambda Cloud Deployment:**
   - *Status:* Package built and verified in `dist/apexintel-auth-lambda.zip` (3.09 MB) with 46/46 checks passed.
   - *Limitation:* Deploying the zip artifact to the live AWS Lambda console (`aws lambda update-function-code`) requires explicit user deployment authorization.
3. **Live Amazon S3 Bucket Provisioning:**
   - *Status:* S3 presigned URL generation and paid order delivery gating are 100% verified locally with mock AWS credentials.
   - *Limitation:* Real S3 object downloads require uploading the raw `.xlsx` dataset files to the production bucket `apexintel-datasets-production`.
4. **Cloudflare Production Worker Deployment:**
   - *Status:* `src/worker.js` is fully implemented and tested with 18 route tests.
   - *Limitation:* Deploying changes via `wrangler deploy` requires live Cloudflare API tokens.

---

## 2. Frontend & Local UI Boundaries
1. **Third-Party CDN Dependencies:**
   - Tailwind CSS is currently loaded via CDN script (`https://cdn.tailwindcss.com`). In high-security offline enterprise environments, this can be pre-compiled into a static CSS stylesheet.
   - Google Fonts (`Plus Jakarta Sans`, `JetBrains Mono`, `Space Grotesk`) are loaded from Google Fonts CDN.
2. **Local Showcase Seed Data:**
   - When running locally without live DynamoDB connections, the client application utilizes mock order ledgers in `localStorage` (`apexintel_orders`) to provide immediate, zero-friction demonstration accounts (Alex Rivera / Sarah Chen / Admin).
