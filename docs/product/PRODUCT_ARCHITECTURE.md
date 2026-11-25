# ApexIntel B2B — Product Architecture Specification
**Document ID:** `SPEC-ARCH-2026-V1`  
**Phase:** Phase 1 Product Discovery & Codebase Inspection  
**Date:** November 24, 2026  

---

## 1. Architectural Philosophy

ApexIntel B2B is built on three core engineering principles:

1. **Ultra-Low Latency & Zero Hydration Churn:** The client is written in modular Vanilla JavaScript (ES6+) with Tailwind CSS. It loads in <350ms, operates without framework runtime bloat, and provides seamless offline-first stability.
2. **Defense-in-Depth Edge & Serverless Core:** The Cloudflare Worker edge enforces strict security boundaries, CORS policies, rate limiting, and shared worker authentication secrets before passing API requests to the AWS Lambda compute backend.
3. **Strict Multi-Tenant Isolation:** DynamoDB partition keys (`userId`) strictly isolate all customer data (leads, notes, orders, requests). Cross-tenant queries are structurally impossible and verified by automated regression tests.

---

## 2. Infrastructure & Compute Layer

```
                           ┌────────────────────────┐
                           │      Client Browser    │
                           │   (Vanilla ES6+ SPA)   │
                           └───────────┬────────────┘
                                       │ HTTPS / TLS 1.3
                                       ▼
                     ┌──────────────────────────────────┐
                     │   Cloudflare Workers (Edge)      │
                     │  - Security Headers (HSTS, CSP)  │
                     │  - Origin Secret Verification    │
                     │  - Asset Edge Caching            │
                     └─────────────────┬────────────────┘
                                       │ Function URL + x-apexintel-worker-secret
                                       ▼
                     ┌──────────────────────────────────┐
                     │   AWS Lambda (ap-southeast-2)    │
                     │  - Node.js 20 ESM Handlers       │
                     │  - Cryptographic Auth (scrypt)   │
                     │  - Authoritative Stripe Payments │
                     │  - SSRF-Hardened Domain Scanner  │
                     └──────┬──────────┬──────────┬─────┘
                            │          │          │
              ┌─────────────┘          │          └─────────────┐
              ▼                        ▼                        ▼
  ┌───────────────────────┐┌───────────────────────┐┌───────────────────────┐
  │   Amazon DynamoDB     ││    Amazon S3 Bucket   ││     Stripe API        │
  │  - apexintel_users    ││  - Lead Datasets Lake ││  - Checkout Sessions  │
  │  - apexintel_sessions ││  - Presigned 15m URLs ││  - Webhook Signatures │
  │  - apexintel_leads    ││  (Private ACL)        ││  - Payment Intents    │
  │  - apexintel_orders   │└───────────────────────┘└───────────────────────┘
  │  - apexintel_requests │
  └───────────────────────┘
```

---

## 3. Data Model & DynamoDB Schemas

### 3.1 Users (`apexintel_users`)
- `userId` (String, PK): Cryptographically generated UUIDv4.
- `email` (String, GSI): Normalized lowercase email address.
- `passwordHash` (String): Secure scrypt-derived hash with 32-byte salt.
- `role` (String): Strictly `'customer'` (immutable on public registration) or `'admin'`.
- `company` (String): Sanitized business name.
- `plan` (String): Workspace subscription tier (`'starter'`, `'pro'`, `'enterprise'`).
- `createdAt` / `updatedAt` (ISO8601 Strings).

### 3.2 Sessions (`apexintel_sessions`)
- `tokenHash` (String, PK): SHA-256 hash of raw session token (raw token NEVER stored).
- `userId` (String): Foreign key to user record.
- `expiresAt` (Number): Unix epoch timestamp with DynamoDB TTL.
- `ip` / `userAgent` (String): Audit metadata.

### 3.3 Leads & CRM (`apexintel_leads`)
- `userId#leadId` (String, Composite PK): Strict tenant encapsulation.
- `userId` (String, Partition Key): Used for GSI listing.
- `company` (String): Business name.
- `domain` (String): Canonical domain name.
- `status` / `stage` (String): One of 11 pipeline stages.
- `priority` (String): `'P1'`, `'P2'`, or `'P3'`.
- `opportunityScore` (Number): 0–100 calculated score.
- `notes` (Array of Objects): `{ id, timestamp, author, text }`.
- `followUpDate` (String): `YYYY-MM-DD` or null.

### 3.4 Orders & Fulfillment (`apexintel_orders`)
- `orderId` (String, PK): Cryptographic order identifier.
- `userId` (String): Customer identifier.
- `productKey` (String): Authoritative product key (e.g. `'texas'`, `'florida'`).
- `amountInCents` (Number): Server-authoritative integer amount.
- `status` (String): `'pending_payment'`, `'paid'`, `'failed'`.
- `stripeSessionId` (String): Stripe checkout identifier.
- `s3Key` (String): Private S3 storage key.
- `paidAt` (String): ISO8601 confirmation timestamp.

---

## 4. Operational Boundaries

1. **No External Framework Dependencies:** The SPA runtime is completely self-contained.
2. **Safe Local Verification:** Full offline mock repositories (`InMemoryAuthRepository`, `InMemoryCrmRepository`, `InMemoryOrdersRepository`, `InMemoryRequestsRepository`) enable 100% test pass rates without live network calls during development.
3. **Production Deployment Gating:** All live cloud mutations require explicit operator approval.
