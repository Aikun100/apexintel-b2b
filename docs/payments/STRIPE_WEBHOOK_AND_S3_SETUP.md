# ApexIntel B2B — Stripe Webhook & Private S3 Setup Guide

**Module:** Payments & Dataset Fulfillment (Task 03)  
**Target AWS Region:** `ap-southeast-2` (Sydney)  
**Private S3 Bucket:** `apexintel-datasets-production`  
**DynamoDB Table:** `apexintel_orders`  

---

## 1. Overview

ApexIntel B2B uses a zero-trust, server-authoritative payment and fulfillment pipeline:
1. **Stripe Checkout Sessions** created by AWS Lambda `/api/orders/checkout` with server catalog pricing.
2. **Cryptographically Signed Webhooks** sent by Stripe to `/api/webhooks/payment`, verified using `STRIPE_WEBHOOK_SECRET`.
3. **Idempotent Order Fulfillment** in DynamoDB table `apexintel_orders`.
4. **Time-Limited S3 Presigned URLs** (15-minute expiry) generated via `@aws-sdk/s3-request-presigner` against private S3 bucket `apexintel-datasets-production`.

---

## 2. Environment Variables Reference

Configure these environment variables in AWS Lambda and Cloudflare Workers (or local `.env` for development):

| Variable Name | Environment | Description | Example / Note |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Lambda / Local | Stripe Restricted API Key (`rk_live_...` or `sk_test_...`) with permissions: `checkout.sessions:write`. | Keep strictly confidential in AWS Secrets Manager / Parameter Store. |
| `STRIPE_WEBHOOK_SECRET` | Lambda / Local | Stripe Webhook Signing Secret (`whsec_...`) used to verify webhook event integrity. | Generated when creating webhook endpoint in Stripe Dashboard. |
| `S3_DATASETS_BUCKET` | Lambda | Private Amazon S3 bucket name containing verified dataset files. | Default: `apexintel-datasets-production` |
| `AWS_REGION` | Lambda / Worker | Target AWS deployment region. | `ap-southeast-2` |
| `DYNAMODB_ORDERS_TABLE` | Lambda | DynamoDB table name for order state. | Default: `apexintel_orders` |
| `WORKER_BACKEND_SECRET` | Worker / Lambda | Shared 256-bit high-entropy secret between Cloudflare Worker and AWS Lambda. | Transmitted via `x-apexintel-worker-secret`. |

---

## 3. Stripe Dashboard Webhook Configuration

To receive live payment confirmations from Stripe:

1. Log into your **Stripe Dashboard** -> **Developers** -> **Webhooks**.
2. Click **Add destination** / **Add an endpoint**.
3. **Endpoint URL:** `https://apexintel-b2b.shop/api/webhooks/payment`
4. **Events to listen for:**
   - `checkout.session.completed`
5. Click **Add endpoint**.
6. Under **Signing secret**, click **Reveal** to obtain your `whsec_...` value.
7. Save this value as the `STRIPE_WEBHOOK_SECRET` environment variable in your AWS Lambda configuration.

---

## 4. Private Amazon S3 Bucket Architecture

The production dataset bucket **MUST NEVER** have public read access enabled.

### 4.1 Bucket Security Checklist
- [x] **Block Public Access:** All 4 settings (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`) must be set to `TRUE`.
- [x] **Default Encryption:** Server-Side Encryption with Amazon S3 managed keys (SSE-S3) or AWS KMS (SSE-KMS).
- [x] **Versioning:** Recommended to prevent accidental file deletion or tampering.

### 4.2 S3 Bucket File Structure
Upload the authoritative commercial dataset files into the private bucket under the `datasets/` prefix:

```
s3://apexintel-datasets-production/
  └── datasets/
      ├── Texas_HighTicket_Contractors_Enriched_Audited.xlsx
      ├── Florida_HighTicket_Solar_Restoration_Enriched.xlsx
      ├── California_Luxury_MedSpas_Enriched_Audited.xlsx
      └── Commercial_HVAC_Mechanical_Enriched_Audited.xlsx
```

### 4.3 IAM Least-Privilege Policy
Attach the IAM policy defined in `aws/iam/apexintel-payments-lambda-policy.json` to the Lambda execution role. It grants:
- `s3:GetObject` strictly scoped to `arn:aws:s3:::apexintel-datasets-production/*`.
- Read and write access to `apexintel_orders` and its GSIs (`userId-createdAt-index`, `stripeSessionId-index`).
- Read-only access to `apexintel_sessions` and `apexintel_users` for auth middleware session verification.
- CloudWatch Logs permissions scoped to `/aws/lambda/apexintel-payments`.

---

## 5. Local Development & Testing

Run all automated payment and fulfillment tests offline without requiring live AWS or Stripe calls:

```powershell
node scripts/run-payment-tests.mjs
```

To run the complete platform verification test suite:

```powershell
node scripts/run-auth-tests.mjs ; node scripts/run-crm-tests.mjs ; node scripts/run-payment-tests.mjs
```
