# ApexIntel B2B — Known Limitations & Operational Boundary Disclosures
**Document ID:** `LIMIT-OPS-2026-V1`  
**Phase:** Phase 8 Final Documentation & Synthesis  
**Date:** November 24, 2026  

---

## 1. Transparency & Operational Boundaries

In strict alignment with the ApexIntel Product Blueprint, this document discloses all known technical limitations, dependencies requiring external provider configuration, and unmocked environment requirements. We never claim a feature is fully operational in production if external credentials or cloud infrastructure are required.

---

## 2. Disclosed Limitations & External Prerequisites

### 2.1 Live AWS Cloud Deployment
- **Local State:** The Lambda package `dist/apexintel-auth-lambda.zip` is 100% compiled, verified, and smoke-tested offline against in-memory adapters.
- **Production Prerequisite:** Deployment to the live AWS Lambda Function URL (`ap-southeast-2`) requires executing the deployment script (`aws/deploy-lambda.sh`) with active AWS credentials having permissions defined in [apexintel-auth-lambda-policy.json](file:///c:/laragon/www/browser-agent/aws/iam/apexintel-auth-lambda-policy.json).
- **Cloudflare Edge Prerequisite:** Updating the Cloudflare Worker requires running `npx wrangler deploy` with valid Cloudflare API tokens and setting `WORKER_BACKEND_SECRET` in both Cloudflare and Lambda environment variables.

### 2.2 Live Stripe Payment Processing
- **Local State:** Full Stripe Checkout session creation, authoritative catalog price enforcement, cryptographic webhook HMAC verification, and idempotent fulfillment are completely implemented and tested.
- **Production Prerequisite:** Live real-money card processing requires setting production environment variables: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the Lambda configuration and setting up the Stripe webhook endpoint (`POST /api/webhooks/payment`).

### 2.3 Outbound Email Delivery (SES / Campaigns)
- **Local State:** The Campaigns UI in the customer dashboard allows creating campaigns, grouping prospects, and viewing follow-up queues. Password reset token generation and rate limiting are implemented.
- **Production Prerequisite:** Automated dispatch of transactional password reset emails and marketing outreach requires configuring an AWS SES verified sending identity (e.g. `noreply@apexintel-b2b.shop`) in `ap-southeast-2` and verifying domain DKIM records.

### 2.4 Private S3 Dataset Storage
- **Local State:** S3 presigned URL generation with strict payment gating (`order.status === 'paid'`), tenant verification (`order.userId === session.userId`), and 15-minute expiration is implemented and verified.
- **Production Prerequisite:** The private S3 bucket `apexintel-datasets-production` in `ap-southeast-2` must contain the 4 production Excel/CSV datasets uploaded to their respective paths (`datasets/Texas_HighTicket_Contractors_Enriched_Audited.xlsx`, etc.).

---

## 3. Product Integrity Guarantees

1. **No Simulated Diagnostics:** When a user enters a domain in the website scanner, real network sockets are opened to inspect real TLS certificates and measure actual latency. No synthetic numbers are generated.
2. **Honest Nulls:** Where data cannot be verified or contact details are unlisted, fields are honestly marked as `Unavailable` rather than fabricated.
3. **Multi-Tenant Protection:** Cross-tenant reads and downloads are structurally gated by the DynamoDB repository layer and verified by automated regression tests.
