# ApexIntel B2B — Authentication Architecture & System Specification

**Task ID:** APEX-P0-01  
**Status:** Implemented (Local Verification Complete)  
**Security Level:** Production Grade  
**Target Runtime:** Node.js 20+ ES Modules (AWS Lambda / Cloudflare Workers / Node Local Dev)

---

## 1. Executive Overview

ApexIntel B2B previously relied on simulated client-side authentication stored in `localStorage`, which compared plaintext passwords directly in the browser and permitted unauthorized role escalation to administrator.

This architecture completely eliminates simulated authentication, replacing it with an authoritative, server-verified session model backed by AWS Lambda and Amazon DynamoDB.

```
+-----------------------------------------------------------------------------------------+
|                                CLIENT TIER (Browser)                                    |
|   • Vanilla JS SPA                                                                      |
|   • In-Memory Identity State (window.ApexAuth._currentUser)                            |
|   • Zero Plaintext Passwords / Zero Session Tokens in localStorage                     |
+-----------------------------------------------------------------------------------------+
                                           │
                        HTTPS with SameSite=Lax HttpOnly Cookie
                                           ▼
+-----------------------------------------------------------------------------------------+
|                              EDGE TIER (Cloudflare Worker)                              |
|   • Static Asset Pipeline: Serves ./public assets for non-API requests                 |
|   • Route Proxy: Intercepts /api/auth/* and proxies to AWS Lambda / Function URL        |
|   • Strict Host & Origin Verification (Rejects unauthorized CORS / CSRF)                |
+-----------------------------------------------------------------------------------------+
                                           │
                            Signed HTTPS / IAM Proxy
                                           ▼
+-----------------------------------------------------------------------------------------+
|                             BACKEND API TIER (AWS Lambda)                               |
|   • Lambda Handler (aws/lambda-auth-handler.mjs)                                        |
|   • Unified Router (src/auth/router.js)                                                 |
|   • Central Auth Service (src/auth/service.js)                                          |
|   • Scrypt Key Derivation & Constant-Time Verification (src/auth/password.js)           |
|   • Cryptographic Session Engine & Token Hashing (src/auth/session.js)                  |
|   • Multi-Key Rate Limiter & Abuse Defense (src/auth/rate-limiter.js)                   |
|   • Structured Security Audit Logging (src/auth/audit-logger.js)                        |
+-----------------------------------------------------------------------------------------+
                                           │
                         AWS SDK v3 DocumentClient TransactWrite
                                           ▼
+-----------------------------------------------------------------------------------------+
|                             DATABASE TIER (Amazon DynamoDB)                             |
|   • apexintel_users: Partition key userId, atomic uniqueness via email# lock            |
|   • apexintel_sessions: Partition key tokenHash (O(1) point lookup, raw token omitted)  |
|   • apexintel_rate_limits: Dynamic IP and email throttling with TTL auto-expiry         |
|   • apexintel_password_resets: Single-use reset tokens with 1-hour expiration          |
+-----------------------------------------------------------------------------------------+
```

---

## 2. API Endpoints Specification

All authentication endpoints reside under `/api/auth/*`. Responses follow a standard JSON envelope:

```json
{
  "success": true,
  "message": "Human readable confirmation",
  "user": { ... },
  "error": "Error description (if success is false)"
}
```

### 2.1 POST /api/auth/register
- **Purpose:** Create a new customer account.
- **Input:**
  ```json
  {
    "email": "user@agency.com",
    "password": "SecurePassword2026!",
    "passwordConfirmation": "SecurePassword2026!",
    "name": "Alex Rivera",
    "company": "Agency Alpha",
    "targetNiche": "Commercial Roofing"
  }
  ```
- **Guarantees:**
  - Password policy: 12 to 128 characters.
  - Role: Hardcoded server-side to `customer` (public input role claims are completely ignored).
  - Atomic email uniqueness enforced via DynamoDB `TransactWriteItems`.
  - Automatically issues an authenticated session, setting `Set-Cookie: apexintel_session=...; HttpOnly; Secure; SameSite=Lax; Path=/`.
  - HTTP Status: `201 Created` on success, `409 Conflict` on duplicate email, `400 Bad Request` on validation failure.

### 2.2 POST /api/auth/login
- **Purpose:** Authenticate an existing account.
- **Input:**
  ```json
  {
    "email": "user@agency.com",
    "password": "SecurePassword2026!"
  }
  ```
- **Guarantees:**
  - Normalized email lookup (`email.trim().toLowerCase()`).
  - Constant-time verification using `crypto.timingSafeEqual` over scrypt derived key.
  - Account status check: Rejects `suspended` or `disabled` accounts with `403 Forbidden`.
  - Dual-key rate limiting (max 15 attempts/15m per IP; max 5 attempts/15m per email).
  - Returns identical error message (`Invalid email or password.`) for non-existent accounts and wrong passwords to resist account enumeration.
  - Issues fresh random session token and returns `Set-Cookie` header.
  - HTTP Status: `200 OK` on success, `401 Unauthorized` on bad credentials, `429 Too Many Requests` when throttled.

### 2.3 POST /api/auth/logout
- **Purpose:** Terminate current session.
- **Headers:** `Cookie: apexintel_session=<rawToken>`
- **Guarantees:**
  - Hashes raw token with SHA-256 and updates DynamoDB session record (`sessionStatus = 'revoked', revokedAt = now`).
  - Clears browser cookie: `Set-Cookie: apexintel_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`.
  - HTTP Status: `200 OK`.

### 2.4 GET /api/auth/me
- **Purpose:** Validate session and retrieve current user identity.
- **Headers:** `Cookie: apexintel_session=<rawToken>`
- **Guarantees:**
  - Computes SHA-256 hash of token, executes point lookup in `apexintel_sessions`.
  - Enforces session expiration: Max 7 days lifetime; 24h idle expiration for customers; 30m idle expiration for administrators.
  - Confirms user account status is `active`.
  - Refreshes session `lastActivityAt`.
  - Returns sanitized profile (`userId`, `email`, `name`, `company`, `plan`, `credits`, `role`, `apiKey`, `targetNiche`).
  - HTTP Status: `200 OK` on success, `401 Unauthorized` on missing, expired, or revoked session.

### 2.5 POST /api/auth/change-password
- **Purpose:** Update account password.
- **Requirements:** Authenticated session.
- **Input:**
  ```json
  {
    "currentPassword": "OldPassword2026!",
    "newPassword": "BrandNewPassword2026!",
    "newPasswordConfirmation": "BrandNewPassword2026!"
  }
  ```
- **Guarantees:**
  - Verifies current password before applying changes.
  - Enforces 12-character minimum password policy on new password.
  - Invalidates all existing sessions for the user (`revokeAllUserSessions`).
  - Automatically rotates the calling user's session, issuing a new session token in `Set-Cookie`.
  - HTTP Status: `200 OK` on success, `400 Bad Request` on incorrect current password or policy failure.

### 2.6 POST /api/auth/forgot-password
- **Purpose:** Initiate password recovery.
- **Input:** `{ "email": "user@agency.com" }`
- **Guarantees:**
  - Returns an identical generic success message whether the email exists or not to prevent account enumeration.
  - Generates a 256-bit cryptographically secure reset token, storing only its SHA-256 hash in `apexintel_password_resets` with a 1-hour expiration.
  - HTTP Status: `200 OK`.

### 2.7 POST /api/auth/reset-password
- **Purpose:** Complete password reset.
- **Input:**
  ```json
  {
    "resetToken": "<opaque_token>",
    "newPassword": "NewStrongPassword2026!",
    "newPasswordConfirmation": "NewStrongPassword2026!"
  }
  ```
- **Guarantees:**
  - Hashes token, validates expiration and single-use `status: 'active'`.
  - Immediately marks token `status: 'used'`.
  - Hashes new password with scrypt and revokes all active user sessions.
  - HTTP Status: `200 OK`.

---

## 3. Cryptography & Password Security

### 3.1 Hashing Specification
- **Algorithm:** Native Node.js `crypto.scrypt` (hardware-accelerated, memory-hard, ASIC-resistant).
- **Cost Parameters:**
  - `N` (CPU/memory cost): `16384`
  - `r` (block size): `8`
  - `p` (parallelization): `1`
  - `keylen`: `64 bytes` (512 bits)
- **Salt:** 32 bytes (256 bits) of cryptographically secure pseudorandom entropy generated via `crypto.randomBytes(32)`.
- **Serialized Format:**
  `scrypt$N=16384,r=8,p=1$<salt_hex>$<derived_key_hex>`
- **Constant-Time Verification:** Candidate passwords are scrypt-derived and compared against stored keys using `crypto.timingSafeEqual` to prevent timing side-channel attacks.

### 3.2 Password Policy
- Minimum length: 12 characters.
- Maximum length: 128 characters.
- Passphrases explicitly supported and encouraged.
- Zero truncation.

---

## 4. Session Management & Cookie Configuration

| Parameter | Value | Reason |
| :--- | :--- | :--- |
| **Token Entropy** | 256 bits (`crypto.randomBytes(32)`) | Unguessable, brute-force proof. |
| **Database Storage** | `SHA-256(rawToken)` | A database breach does not compromise active user sessions. |
| **Cookie Name** | `apexintel_session` | Standard namespacing. |
| **HttpOnly** | `true` | Prevents access via client JavaScript (`document.cookie`), mitigating XSS theft. |
| **Secure** | `true` (HTTPS / Production) | Transmitted only over encrypted TLS connections. |
| **SameSite** | `Lax` | Protects against Cross-Site Request Forgery while permitting top-level navigation. |
| **Path** | `/` | Accessible across entire domain. |
| **Maximum Lifetime** | 7 Days (`604,800s`) | Absolute expiration ceiling. |
| **Customer Idle Timeout** | 24 Hours (`86,400s`) | Terminates inactive sessions. |
| **Admin Idle Timeout** | 30 Minutes (`1,800s`) | High-security window for administrative accounts. |

---

## 5. Amazon DynamoDB Data Model

### 5.1 Table: `apexintel_users`
- **Partition Key:** `userId` (String)
- **Global Secondary Index:** `normalizedEmail-index` (PK: `normalizedEmail`)
- **Atomic Uniqueness Pattern:**
  When a user registers, DynamoDB executes `TransactWriteItems`:
  1. `Item: { userId: "email#" + normalizedEmail, targetUserId: userId, type: "EMAIL_LOCK" }` with `ConditionExpression: "attribute_not_exists(userId)"`.
  2. `Item: { userId: <uuid>, email, normalizedEmail, passwordHash, passwordSalt, role: "customer", ... }` with `ConditionExpression: "attribute_not_exists(userId)"`.
  If two users register the same email concurrently, DynamoDB cancels the transaction with `TransactionCanceledException`, guaranteeing zero duplicate accounts without race conditions.

### 5.2 Table: `apexintel_sessions`
- **Partition Key:** `tokenHash` (String, SHA-256 hex)
- **Global Secondary Index:** `userId-index` (PK: `userId`)
- **Time To Live (TTL):** Attribute `ttl` (epoch seconds) for automatic deletion of expired sessions.
- **Lookup Cost:** 1 DynamoDB Read Capacity Unit (point lookup).

### 5.3 Table: `apexintel_rate_limits`
- **Partition Key:** `rateKey` (String, e.g. `ratelimit:LOGIN:ip:1.2.3.4`)
- **Time To Live (TTL):** Attribute `ttl` for automatic sliding-window cleanup.

### 5.4 Table: `apexintel_password_resets`
- **Partition Key:** `tokenHash` (String, SHA-256 hex)
- **Time To Live (TTL):** Attribute `ttl` (1 hour).

---

## 6. Role-Based Access Control (RBAC)

1. **Roles:** `customer`, `staff`, `admin`.
2. **Authority:** Role claims originate **exclusively** from the backend database record retrieved via session validation.
3. **Public Registration:** Explicitly hardcoded to assign `role: 'customer'`. Any browser-supplied `role` parameter in registration payloads is discarded.
4. **Admin Provisioning:** Controlled operator script (`scripts/bootstrap-admin.mjs`) with interactive passphrase prompts or environment injection. No default administrative accounts exist.

---

## 7. CSRF & Request Security

1. **Origin Verification:** Mutation requests (POST) inspect `Origin` and `Referer` headers against the allowed origins allowlist (`apexintel-b2b.shop`, `www.apexintel-b2b.shop`, `localhost:3000`). Unauthorized origins receive `403 Forbidden`.
2. **Content-Type Enforcement:** POST requests must specify `Content-Type: application/json`. Non-JSON payloads are rejected with `415 Unsupported Media Type`.
3. **Payload Size Limit:** Request bodies are restricted to 64KB (`MAX_BODY_BYTES`) to prevent memory exhaustion and denial-of-service attacks.
