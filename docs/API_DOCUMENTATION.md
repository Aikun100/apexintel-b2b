# ApexIntel B2B — API & Integration Specification

- **Production Base URL:** `https://apexintel-b2b.shop`
- **Local Dev Server:** `http://localhost:3000` (`node serve.js`)
- **Authentication:** `HttpOnly` session cookie (`apexintel_session`) + CSRF `Origin` check and double-submit `x-csrf-token` header (`apexintel_csrf` cookie) for mutating requests.
- **Edge-to-Origin Header:** `x-apexintel-worker-secret` (injected by `src/worker.js` in production).

---

## 1. Authentication (`/api/auth/*`)

Handled by `src/auth/router.js` and `aws/lambda-auth-handler.mjs`:

- `POST /api/auth/register` — Create customer account (min 12-char password, scrypt hashed, role locked to `customer`). Sets `HttpOnly` session cookie.
- `POST /api/auth/login` — Authenticate email/password with rate limiting and timing-safe verification.
- `POST /api/auth/logout` — Revoke server-side session and clear cookie.
- `GET /api/auth/me` — Return authenticated user profile (`401` if unauthenticated).
- `POST /api/auth/change-password` — Update password for authenticated user and rotate sessions.
- `POST /api/auth/forgot-password` — Request password reset token.
- `POST /api/auth/reset-password` — Reset password using valid token.
- `PUT /api/auth/profile` — Update user name and company.
- `GET /api/auth/api-key` — Retrieve active API key metadata for authenticated user.
- `POST /api/auth/api-key/rotate` — Generate and persist new API key.

---

## 2. Multi-Tenant CRM (`/api/crm/*`)

Handled by `src/crm/router.js` (requires authenticated session; strictly scoped to `user.userId`):

- `GET /api/crm/leads` — List customer's saved CRM leads (`?limit=` supported).
- `POST /api/crm/leads` — Create single lead or batch seed leads (`{ leads: [...] }`).
- `GET /api/crm/leads/:leadId` — Get single lead owned by user.
- `PUT /api/crm/leads/:leadId` — Update status, priority, notes, tags, or follow-up date.
- `DELETE /api/crm/leads/:leadId` — Delete lead owned by user.
- `GET /api/crm/campaigns` — List user's outreach campaigns.
- `POST /api/crm/campaigns` — Create new outreach campaign.

---

## 3. Payments, Webhooks & S3 Downloads (`/api/orders*`, `/api/webhooks/*`, `/api/downloads/*`)

Handled by `src/payments/router.js`:

- `POST /api/orders/checkout` — Create Stripe Checkout session from server-authoritative `productKey` (authenticated).
- `GET /api/orders` — List orders belonging to authenticated user.
- `POST /api/webhooks/payment` — Stripe webhook endpoint (`stripe-signature` HMAC-SHA256 verified against raw body; enforces `session.id`, `amount_total`, `currency`, and idempotent event deduplication).
- `GET /api/downloads/signed-url?orderId=...` — Verify order ownership and `paid` status, then generate a 15-minute Amazon S3 presigned download URL.

---

## 4. Discovery & Crawler (`/api/discovery/*`, `/api/admin/*`)

Handled by `src/discovery/router.js`:

- `GET /api/discovery/search` — Filter business records in `leads_cache` by trade, city/territory, opportunity signals, and keyword.
- `GET /api/admin/overview` — Admin-only endpoint returning system-wide counts for users, orders, revenue, custom requests, and lead inventory.
- `POST /api/admin/recrawl` — Admin-only endpoint to trigger crawler ingestion/refresh.

---

## 5. Website Intelligence Scanner (`/api/tools/*`)

Handled by `src/tools/router.js`:

- `POST /api/tools/scan-website` — Validate domain via `src/tools/ssrf-guard.js` (blocks private IPv4/IPv6, loopback, IMDSv2 metadata), inspect TLS certificate chain, measure TTFB latency, resolve DNS MX records, detect tracking pixels, and cache results in `apexintel_scans_cache`.

---

## 6. Custom Research Requests (`/api/requests/*`)

Handled by `src/requests/router.js`:

- `POST /api/requests/custom` — Calculate server-authoritative price via `RequestsService.calculatePrice`, validate territory/industry/volume (`50`–`50,000`), and persist request with ID `REQ-2026-<HEX>`.
- `GET /api/requests/custom` — List requests for the authenticated customer (or all requests when role is `admin`).
- `GET /api/requests/custom/:id/download` — Authorized download of delivered research dataset.
- `PATCH /api/requests/custom/:requestId` — Admin-only status transition (`Submitted` -> `Reviewing` -> `Mining` -> `Delivered` / `Cancelled`).
