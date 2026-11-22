# ApexIntel B2B — Authentication Security Model & Threat Analysis

**Task ID:** APEX-P0-01  
**Audit Standard:** OWASP Top 10 / ASVS Level 2  
**Target:** Authentication & Identity Subsystem

---

## 1. Threat Model & Vulnerability Remediation Matrix

The table below details how each specific vulnerability identified in the initial security audit has been addressed by the new authentication architecture.

| Audit Finding ID | Severity | Previous Vulnerability Vector | Remediation Applied | Verification Status |
| :--- | :---: | :--- | :--- | :---: |
| **SEC-VULN-002** | **CRITICAL** | Client-side role spoofing in `sessionStorage` (`{ role: 'admin' }`) unlocked Owner Revenue & Admin features. | Roles are authoritative from DynamoDB user record. Client storage values are completely ignored by backend APIs and UI gates. | **RESOLVED & TESTED** |
| **SEC-VULN-003** | **HIGH** | Plaintext user & admin passwords stored in `localStorage.getItem('apexintel_accounts')`. | Plaintext passwords eliminated. Passwords hashed via scrypt with 32-byte salt; hashes never returned to clients. | **RESOLVED & TESTED** |
| **SEC-VULN-AUTH-04** | **CRITICAL** | Public registration permitted passing arbitrary roles, or could be modified to claim administrator status. | Public registration role hardcoded server-side to `customer`. Input `role` attribute is explicitly stripped. | **RESOLVED & TESTED** |
| **SEC-VULN-AUTH-05** | **HIGH** | Opaque session tokens and credentials accessible to JavaScript (`document.cookie` / `localStorage`). | Session tokens delivered via `HttpOnly; Secure; SameSite=Lax` cookies. JavaScript cannot read the token. | **RESOLVED & TESTED** |
| **SEC-VULN-AUTH-06** | **HIGH** | Credential stuffing & brute-force login attempts had zero rate limiting or throttling. | Multi-key sliding-window rate limiter throttles by client IP (15 attempts/15m) and target email (5 attempts/15m). | **RESOLVED & TESTED** |
| **SEC-VULN-AUTH-07** | **MEDIUM** | Account enumeration via differentiated login / password reset error messages. | Uniform generic error message (`Invalid email or password.`) returned for unknown emails and wrong passwords. Constant-time dummy hash on missing user. | **RESOLVED & TESTED** |
| **SEC-VULN-AUTH-08** | **HIGH** | Stored session tokens in database allowed session hijacking if database was compromised. | Raw session tokens are NEVER stored in DynamoDB; only SHA-256 cryptographic hashes (`tokenHash`) are persisted. | **RESOLVED & TESTED** |
| **SEC-VULN-AUTH-09** | **MEDIUM** | Cross-Site Request Forgery (CSRF) on mutation endpoints. | Strict `Origin` / `Referer` allowlist validation, `Content-Type: application/json` enforcement, and `SameSite=Lax` cookie defense. | **RESOLVED & TESTED** |

---

## 2. In-Depth Security Controls

### 2.1 Password Hashing: Memory-Hard Scrypt
- **Implementation:** `src/auth/password.js`
- **Resistance:** Designed specifically to resist custom ASIC and GPU parallel cracking attacks by requiring significant memory (16MB per hash computation).
- **Entropy:** Unique 32-byte (256-bit) cryptographically random salt per user prevents rainbow table lookups.
- **Timing Protection:** Candidate password verification uses `crypto.timingSafeEqual` over the derived key buffer to neutralize microarchitectural cache and timing side-channels.

### 2.2 Session Security & Token Hashing
- **Implementation:** `src/auth/session.js`
- **Token Generation:** 256 bits of entropy via `crypto.randomBytes(32).toString('hex')`.
- **Database Hygiene:** The database stores `tokenHash = SHA256(rawToken)`. Even with read access to the `apexintel_sessions` table, an attacker cannot forge the browser cookie required to authenticate.
- **Revocation:** Logout updates the session status to `revoked` and records `revokedAt`. Subsequent requests with the same token fail immediately.
- **Session Rotation:** Changing a password invalidates all existing active sessions and issues a new session token, terminating any potentially hijacked sessions on other devices.

### 2.3 Rate Limiting & Abuse Defense
- **Implementation:** `src/auth/rate-limiter.js`
- **Dual-Key Strategy:** Tracks failed attempts both by client IP address and normalized target email. This simultaneously prevents single-IP brute force attacks and distributed botnet attacks targeting a single VIP account.
- **Lockout Window:** 15-minute sliding window. Exceeded attempts receive `429 Too Many Requests` with a `Retry-After` header.

### 2.4 CSRF & Origin Validation
- **Implementation:** `src/auth/csrf.js`
- **Allowlist:** Only exact matches from `https://apexintel-b2b.shop`, `https://www.apexintel-b2b.shop`, and `http://localhost:3000` (in dev) are permitted.
- **Payload Sanitization:** Rejects non-JSON content types with `415 Unsupported Media Type` and caps payload size at 64KB (`413 Payload Too Large`).

### 2.5 Security Event Logging
- **Implementation:** `src/auth/audit-logger.js`
- **Sanitization:** All security logs are processed through an explicit key deletion filter that strips passwords, current passwords, new passwords, hashes, tokens, raw tokens, and cookies.
- **Email Masking:** Target email addresses are masked (`al***@velocitygrowth.io`) to prevent PII exposure in centralized logging systems.

---

## 3. Known Limitations & Future Roadmap (Post-Task 1)

1. **Email Delivery (SES):** Password reset requests generate secure single-use tokens, but because Amazon SES credentials are not yet configured in production, the reset email is currently logged as an audit event. Task 4 will complete SES production transport.
2. **Multi-Factor Authentication (MFA):** TOTP (RFC 6238) MFA is recommended for administrator accounts prior to general enterprise release (Roadmap item P2).
