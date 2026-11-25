# ApexIntel B2B — Database & Storage Schema Specification

**Region:** `ap-southeast-2` (Sydney)  
**Storage Engines:** Amazon DynamoDB (On-Demand) & Private Amazon S3 (`apexintel-datasets-production`)

---

## 1. Amazon DynamoDB Tables

Table names below match `src/*/repository.js` defaults (overridable via environment variables):

| Table Name | Env Variable | Primary Key | GSIs / Purpose | Source Module |
| :--- | :--- | :--- | :--- | :--- |
| `apexintel_users` | `DYNAMODB_USERS_TABLE` | `userId` (S) | `normalizedEmail-index`: Accounts, scrypt hashes, roles, plans, credits | `src/auth/repository.js` |
| `apexintel_sessions` | `DYNAMODB_SESSIONS_TABLE` | `tokenHash` (S) | `userId-index`: SHA-256 hashed session tokens with TTL expiration | `src/auth/repository.js` |
| `apexintel_rate_limits` | `DYNAMODB_RATE_LIMITS_TABLE` | `key` (S) | Sliding-window auth/scanner/request abuse rate limits with TTL | `src/auth/repository.js` |
| `apexintel_password_resets` | `DYNAMODB_RESETS_TABLE` | `tokenHash` (S) | Single-use hashed password reset tokens with TTL | `src/auth/repository.js` |
| `apexintel_user_crm` | `DYNAMODB_CRM_TABLE` | `userId` (PK), `leadId` (SK) | Multi-tenant customer CRM leads, pipeline stage, priority, notes, tags | `src/crm/repository.js` |
| `apexintel_orders` | `DYNAMODB_ORDERS_TABLE` | `orderId` (S) | `userId-createdAt-index`, `stripeSessionId-index`: Stripe orders, `paid` status, S3 keys | `src/payments/repository.js` |
| `apexintel_custom_requests` | `CUSTOM_REQUESTS_TABLE_NAME` | `requestId` (S) | `userId-createdAt-index`: Custom research orders and lifecycle statuses | `src/requests/repository.js` |
| `apexintel_scans_cache` | `SCANS_TABLE_NAME` | `domain` (S) | Cached website intelligence audit results (TTFB, TLS, MX, pixels) with TTL | `src/tools/repository.js` |
| `leads_cache` | `DYNAMODB_LEADS_TABLE` | `id` (S, domain) | `trade-createdAt-index`, `city-createdAt-index`: Discovered B2B records & delivery ledger | `src/discovery/repository.js` |

---

## 2. Amazon S3 Private Dataset Bucket

- **Bucket:** `apexintel-datasets-production` (Block Public Access enabled; private ACL)
- **Fulfillment Objects (`src/payments/catalog.js`):**
  - `datasets/Texas_HighTicket_Contractors_Enriched_Audited.xlsx`
  - `datasets/Florida_HighTicket_Solar_Restoration_Enriched.xlsx`
  - `datasets/California_Luxury_MedSpas_Enriched_Audited.xlsx`
  - `datasets/Commercial_HVAC_Mechanical_Enriched_Audited.xlsx`
- **Access Control:** Objects are never publicly readable. Downloads are served only after `order.status === 'paid'` and `order.userId === user.userId` via a 15-minute S3 presigned URL.

---

## 3. Client-Side Fallback / UI State (`localStorage`)

Authenticated CRM leads, orders, and custom requests sync to backend APIs. Secondary UI preferences/showcase helpers in `public/js/customer-dashboard.js` and `public/js/auth.js` use `localStorage` keys such as `apexintel_crm_campaigns`, `apexintel_audit_scans`, `apexintel_api_key`, and `apexintel_orders` when offline or unauthenticated.
