# ApexIntel B2B — Task 05 Implementation & Security Audit Report
## Real Website Intelligence Scanner & SSRF Hardening Engine (P1-03 / SEC-VULN-005)

**Document Reference:** `audits/tools/TASK_05_SCANNER_IMPLEMENTATION_REPORT.md`  
**Execution Date:** November 2026  
**Status:** COMPLETE & PASSING (31/31 Scanner Tests Green, 141/141 Full Platform Tests Green)  
**Security Classification:** Highly Sensitive — Core Infrastructure & Outbound Network Security  

---

### 1. Executive Summary

In Task 05, the ApexIntel B2B engineering team designed, implemented, and verified a production-grade, SSRF-hardened Website Intelligence Scanner. This completes **P1-03** and resolves critical vulnerability **SEC-VULN-005** identified in the architectural audit (`docs/audits/SECURITY_AUDIT.md`).

Prior to Task 05, the website scanner in `public/js/tools-suite.js` was entirely simulated via client-side hardcoded fixtures (`DEMO_SCAN_PROFILES`) and pseudo-random numbers (`Math.random()`). Its naive client-side check (`domain.startsWith('127.') || domain.startsWith('192.168.')`) provided zero defense against Server-Side Request Forgery (SSRF) when ported to a backend, exposing internal services, VPC endpoints, and the AWS Instance Metadata Service (`169.254.169.254` / `fd00:ec2::254`) to exfiltration.

The new architecture enforces a strict **DNS-Resolution-First SSRF Guard**, multi-key rate limiting, 7-day DynamoDB TTL caching, live TLS certificate inspection, HTTP TTFB latency measurement, DOM CMS and pixel auditing, and turnkey B2B sales pitch generation.

---

### 2. Vulnerability Analysis & SSRF Remediation (SEC-VULN-005)

#### 2.1 The Threat Model
When a serverless backend or Node.js server fetches arbitrary user-supplied domains, attackers target:
1. **AWS Instance Metadata Service (IMDSv1 & IMDSv2):** `http://169.254.169.254/latest/meta-data/` or IPv6 `fd00:ec2::254` to steal IAM role credentials and STS session tokens.
2. **Localhost & Loopback Services:** `127.0.0.1`, `::1` accessing local development daemons, admin ports, or internal proxies.
3. **Internal VPC Subnets (RFC 1918):** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` probing internal microservices, databases, or Redis caches.
4. **Obfuscated IP Formats:** Attackers bypass string-matching blacklists using:
   - Decimal integer notation (e.g., `http://2130706433/` -> `127.0.0.1`)
   - Hexadecimal notation (e.g., `http://0x7f.0.0.1/` -> `127.0.0.1`)
   - Octal notation (e.g., `http://017700000001/` -> `127.0.0.1`)
   - IPv4-mapped IPv6 (e.g., `http://[::ffff:127.0.0.1]/`)
5. **DNS Rebinding (TOCTOU):** The attacker sets a low TTL on a domain that resolves to a benign public IP on first lookup, but resolves to `169.254.169.254` when the HTTP client establishes the outbound socket.

#### 2.2 The Defensive Implementation (`src/tools/ssrf-guard.js`)
The `SSRFGuard` engine enforces 4 defense-in-depth barriers:
1. **Strict Syntax & RFC 1123 Hostname Validation:**
   - Strips leading schemes and query fragments.
   - Rejects pure IP literals (both IPv4 and IPv6).
   - Rejects decimal, hex, and octal integer-encoded IPs.
   - Rejects URL credentials (`user:pass@host`).
   - Rejects non-standard ports (enforcing only standard 80/443).
   - Rejects single-label hostnames (`localhost`, `intranet`, `metadata`) and internal TLDs (`.local`, `.internal`, `.localhost`, `.lan`, `.corp`, `.arpa`).
2. **Comprehensive IP Range Inspection (`isPrivateOrReservedIp`):**
   - IPv4 Loopback (`127.0.0.0/8`)
   - RFC 1918 Private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Link-Local & Cloud Metadata (`169.254.0.0/16`, AWS IMDS `169.254.169.254`)
   - Shared Address Space / CGNAT (`100.64.0.0/10`)
   - Multicast & Broadcast (`224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255`)
   - IPv6 Loopback (`::1`), Link-Local (`fe80::/10`), ULA (`fc00::/7` including AWS IMDS IPv6 `fd00:ec2::254`)
   - IPv4-mapped IPv6 (`::ffff:0:0/96`)
3. **DNS-Resolution-First & Fail-Closed Multi-Homing:**
   - Pre-resolves all `A` and `AAAA` records.
   - Evaluates *every* resolved IP. If ANY returned IP falls within a restricted range (split-DNS attack), the request is aborted immediately.
4. **Socket Pinning against DNS Rebinding (TOCTOU):**
   - Direct TLS and HTTP connections connect directly to the verified, pinned IP (`target.ip`).
   - SNI (`servername`) and the HTTP `Host` header retain the original validated domain.

---

### 3. Architecture & Components

```
                                Cloudflare Edge (Worker)
                                           │
                         x-apexintel-worker-secret + Rate Limits
                                           ▼
                                  API Gateway / Lambda
                                (aws/lambda-tools-handler)
                                           │
                                  src/tools/router.js
                       (CSRF/Origin Check + 10 req/min Limiter)
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                     │
           Cache Hit (< 7 Days)                    Cache Miss / Force
                        │                                     │
                        ▼                                     ▼
             src/tools/repository.js                src/tools/ssrf-guard.js
             (apexintel_scans_cache)             (Syntax + DNS + IP Pinning)
                                                              │
                                                              ▼
                                                   src/tools/scanner-service.js
                                                   ├── TLS 1.3 Inspection (tls.connect)
                                                   ├── TTFB & Security Headers (https.request)
                                                   ├── DOM Parser (CMS, Pixels, GTM)
                                                   ├── DNS Deliverability (MX, SPF, DMARC)
                                                   └── Pitch Teardown Generator
```

#### 3.1 DynamoDB Schema (`aws/dynamodb/schema-scans-cache.json`)
- **Table Name:** `apexintel_scans_cache`
- **Partition Key:** `domain` (String)
- **TTL Attribute:** `ttl` (Number, epoch seconds = `now + 7 * 86400`)
- **Billing Mode:** `PAY_PER_REQUEST` (Zero idle cost)
- **Encryption:** AWS KMS Server-Side Encryption (Enabled)
- **PITR:** Point-in-time recovery enabled.

#### 3.2 Real Technical & Commercial Diagnostics
The scanner service captures:
- **Server Latency (TTFB):** Measured via high-resolution socket timing on mobile User-Agent.
- **TLS Certificate Verification:** Handshakes TLS 1.3 via direct socket pinned to verified IP; inspects CA issuer, expiration date, days remaining, protocol, and cipher suite.
- **Security Headers:** Strict audits of `Strict-Transport-Security` (HSTS), `Content-Security-Policy`, `X-Frame-Options`, and `X-Content-Type-Options`.
- **DOM & Tracking Tag Auditing:** Scans the first 120KB of HTML for Meta (Facebook) Pixel (`fbq`), Google Analytics 4 (`gtag`), Google Tag Manager (`gtm.js`), Google Ads Conversion tracking, TikTok Pixel, and CMS technology (WordPress/Elementor/Divi, Shopify, Webflow, Squarespace, Wix).
- **DNS Deliverability:** Audits `MX` mail exchangers, SPF records (`v=spf1`), and DMARC policies (`_dmarc.domain`).
- **Commercial Pitch Generator:** Automatically generates an actionable, high-converting agency cold email pitch identifying the prospect's exact tracking leaks and latency bottlenecks.

#### 3.3 Security & Abuse Controls
- **Rate Limiting:** Enforces a maximum of 10 scans per 60 seconds per client IP via `src/auth/rate-limiter.js`. Excess requests receive `429 Too Many Requests` with a `Retry-After` header.
- **CSRF & Origin Protection:** Mutating `POST` requests require valid `Origin` / `Referer` headers matching the production domain allowlist.
- **Worker-to-Lambda Shared Secret:** Production execution enforces `x-apexintel-worker-secret`, blocking direct internet requests to the backend.

---

### 4. Frontend Migration & XSS Remediation

1. **Elimination of Mock Profiles:**
   - Completely deleted `DEMO_SCAN_PROFILES` and pseudo-random generators (`Math.random()`) from `public/js/tools-suite.js`.
   - Replaced with authenticated `fetch('/api/tools/scan-website')` integration.
2. **XSS Protection:**
   - Implemented strict HTML entity escaping (`escapeHTML()`) across all rendered fields: `domain`, `company`, `title`, `metaDesc`, `cms`, `ssl`, `pitch`, and flaw lists.
3. **Bundle Synchronization:**
   - Bundled all modules into `public/index.html` via `scripts/bundle-all.js`.
   - Replaced legacy inline `runDomainScan` functions with delegations to `window.runDomainScan()`.
   - Verified 0 occurrences of `DEMO_SCAN_PROFILES` and 0 occurrences of scanner `Math.random` mock generators in `public/index.html`.

---

### 5. Verification & Test Results

#### 5.1 Scanner & SSRF Test Suite (`scripts/run-scanner-tests.mjs`)
31 automated test cases executed covering all functional and security layers:

```
🧪 Starting Website Intelligence Scanner & SSRF Hardening Test Suite...

--- 1. SSRF Guard: Domain Syntax Validation ---
  ✅ Rejects empty or non-string domain inputs
  ✅ Rejects pure IPv4 literals (127.0.0.1, 10.0.0.1, 192.168.1.1)
  ✅ Rejects IPv6 literals and bracketed IPv6 ([::1])
  ✅ Rejects integer-obfuscated decimal IPs (2130706433 = 127.0.0.1)
  ✅ Rejects hexadecimal and octal obfuscated IPs (0x7f000001, 017700000001)
  ✅ Rejects URL credentials / userinfo (admin:pass@domain.com)
  ✅ Rejects custom ports (domain.com:8080, domain.com:22)
  ✅ Rejects single-label hostnames without TLD (localhost, intranet, metadata)
  ✅ Rejects internal and reserved TLDs (.local, .internal, .localhost, .lan)
  ✅ Accepts valid public domains and normalizes protocol and path

--- 2. SSRF Guard: IP Range & Cloud Metadata Detection ---
  ✅ Flags IPv4 loopback (127.0.0.0/8) as restricted
  ✅ Flags RFC 1918 Private IPv4 ranges as restricted
  ✅ Flags Link-Local and AWS IMDS (169.254.169.254) as restricted
  ✅ Flags Carrier-Grade NAT (100.64.0.0/10) as restricted
  ✅ Flags Multicast, Broadcast, and Reserved (224.0.0.0/4, 240.0.0.0/4)
  ✅ Flags IPv6 Loopback, Link-Local, and Unique Local (ULA including AWS IMDS fd00:ec2::254)
  ✅ Flags IPv4-mapped IPv6 pointing to private addresses (::ffff:127.0.0.1)
  ✅ Identifies legitimate public IPv4 and IPv6 addresses as safe

--- 3. DNS Resolution & Rebinding Protection ---
  ✅ Throws SSRF violation when domain resolves to 127.0.0.1
  ✅ Throws SSRF violation when domain resolves to AWS IMDS 169.254.169.254
  ✅ Fails closed if ANY IP in a multi-homed / split DNS response is private
  ✅ Pins connection to verified public IP when DNS is valid

--- 4. Scans Repository & 7-Day TTL Caching ---
  ✅ Saves and retrieves cached scan record with 7-day TTL
  ✅ Returns null and purges record when TTL has expired

--- 5. Scanner Service Diagnostics & Pitch Synthesis ---
  ✅ Detects WordPress CMS and Elementor page builder signature
  ✅ Detects Meta Pixel and Google Tag Manager
  ✅ Returns cached scan with fromCache: true without network request

--- 6. Router Security: Rate Limiting & Origin Enforcement ---
  ✅ Enforces rate limiting: 10 allowed, 11th request receives 429 Too Many Requests
  ✅ Rejects state-mutating requests from untrusted origins with 403
  ✅ Blocks SSRF attempts to 127.0.0.1 with 400 and ssrfBlocked flag
  ✅ Enforces Worker shared secret in production Lambda environment

======================================================
Scanner Test Results: 31 passed, 0 failed.
======================================================
```

#### 5.2 Full Platform Test Suite Status
Across all 5 core platform modules, **141 / 141 tests are green**:
1. **Core Authentication (Task 01):** 52 / 52 passed
2. **Multi-Tenant CRM (Task 02):** 24 / 24 passed
3. **Payments & S3 Fulfillment (Task 03):** 19 / 19 passed
4. **Lead Ingestion & Discovery (Task 04):** 15 / 15 passed
5. **Website Scanner & SSRF Guard (Task 05):** 31 / 31 passed

---

### 6. Deliverable Inventory

| File Path | Description |
|:---|:---|
| `aws/dynamodb/schema-scans-cache.json` | DynamoDB schema definition for `apexintel_scans_cache` with TTL |
| `scripts/setup-dynamodb.mjs` | Multi-table provisioning script updated for scans cache |
| `src/tools/ssrf-guard.js` | Core SSRF engine (RFC validation, IP ranges, DNS resolution, IP pinning) |
| `src/tools/repository.js` | In-memory and DynamoDB scans repository with 7-day TTL expiration |
| `src/tools/scanner-service.js` | Network audit orchestrator (TLS, HTTP, DOM, Pixels, DNS, Pitch generation) |
| `src/tools/router.js` | HTTP router with rate limiting, origin protection, and Lambda/Node adapters |
| `aws/lambda-tools-handler.mjs` | AWS Lambda entry point for tools and scanner |
| `aws/iam/apexintel-tools-lambda-policy.json` | Least-privilege IAM policy for DynamoDB and CloudWatch Logs |
| `public/js/tools-suite.js` | Frontend scanner engine updated for live API calls and XSS escaping |
| `public/index.html` | Production bundle with live scanner integration |
| `tests/tools/scanner.test.js` | Comprehensive 31-test suite for SSRF guard, scanner, and router |
| `scripts/run-scanner-tests.mjs` | Automated test runner for scanner suite |
| `audits/tools/TASK_05_SCANNER_IMPLEMENTATION_REPORT.md` | Comprehensive security and implementation audit report |

---

### 7. Conclusion & Next Steps

Task 05 is **100% complete, verified, and audited**. The platform is secure against SSRF attacks targeting AWS IMDS, internal VPC subnets, and loopback endpoints.

All changes remain local in accordance with safety instructions (zero AWS/Cloudflare modifications, zero deployments, zero Git pushes).

Task 06 (End-to-End System Integration & Readiness Audit) is ready to begin upon user confirmation.
