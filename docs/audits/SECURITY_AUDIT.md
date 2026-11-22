# ApexIntel B2B — Application Security Audit & Vulnerability Assessment
**Document ID:** `AUDIT-SEC-2026-v1.0`  
**Classification:** Information Security Code Review & Threat Model  
**Date:** November 22, 2026  
**Auditor:** Application Security Lead & Ethical Pentester  

---

## 1. Threat Modeling Overview

ApexIntel B2B processes commercial dataset purchases, user registrations, prospect CRM pipelines, and domain diagnostic audits. A threat model evaluation reveals several severe client-side vulnerabilities arising from the absence of a server-side authorization layer.

```mermaid
flowchart TD
    Attacker["Malicious User / Browser DevTools"]
    Attacker -->|1. Manipulate sessionStorage| Auth["Elevate Role to 'admin' (CRITICAL)"]
    Attacker -->|2. Invoke confirmManualPayment()| Pay["Bypass Payment & Download Datasets (CRITICAL)"]
    Attacker -->|3. View Public Source Code| Data["Scrape 24 Lead Records Free (HIGH)"]
    Attacker -->|4. View SEED_ACCOUNTS| Passwords["Harvest Plaintext Passwords (CRITICAL)"]
    Attacker -->|5. Malicious URL in Scanner| SSRF["SSRF Risk if Web Proxy Connected (MEDIUM)"]
```

---

## 2. Granular Vulnerability Findings

### Finding 1: Unauthenticated Dataset Download & Payment Bypass
- **Vulnerability ID:** `SEC-VULN-001`
- **Classification:** **CRITICAL (CVSS 9.8)**
- **Affected File:** `public/js/payment-engine.js` (lines 322–350)
- **Affected Function:** `window.confirmManualPayment(packKey, invId, email, name, processor)`
- **Mechanism:**
  When a buyer initiates checkout, the application opens PayPal in an external tab and renders a manual confirmation button in the modal. Clicking this button calls `window.confirmManualPayment()`, which immediately executes `window.downloadDatasetPacks(pack.key, 'xlsx')`.
- **Proof of Concept:**
  Any user can open the browser console and type:
  ```javascript
  window.downloadDatasetPacks('texas', 'csv');
  window.downloadDatasetPacks('florida', 'csv');
  window.downloadDatasetPacks('medspas', 'csv');
  window.downloadDatasetPacks('hvac', 'csv');
  ```
  The browser immediately generates and downloads all commercial datasets without making any payment or creating an account.
- **Remediation:**
  1. Remove client-side CSV Blob generators.
  2. Implement a server-side webhook listener (Stripe or PayPal IPN) on Cloudflare Workers.
  3. Store master datasets in a private S3 bucket (`apexintel-datasets-production`).
  4. Generate short-lived (15-minute) presigned S3 URLs only after the webhook verifies payment settlement.

---

### Finding 2: Client-Side Authentication Bypass & Admin Privilege Escalation
- **Vulnerability ID:** `SEC-VULN-002`
- **Classification:** **CRITICAL (CVSS 9.1)**
- **Affected File:** `public/js/auth.js` (lines 249–256) & `public/js/admin-dashboard.js` (lines 450–472)
- **Affected Functions:** `ApexAuth.getCurrentUser()`, `window.openAdminDashboard()`
- **Mechanism:**
  Administrative access is gated strictly by a client-side check on `sessionStorage`:
  ```javascript
  const user = window.ApexAuth.getCurrentUser();
  if (!user || user.role !== 'admin') { ... }
  ```
- **Proof of Concept:**
  An unauthenticated visitor can open DevTools and run:
  ```javascript
  sessionStorage.setItem('apexintel_session', JSON.stringify({
    role: 'admin',
    name: 'Attacker',
    email: 'admin@apexintel.io',
    plan: 'Admin'
  }));
  window.updateNavbarState();
  window.openAdminDashboard();
  ```
  The Admin Command Center immediately unlocks, exposing customer transaction feeds, revenue summaries, and lead inventory panels.
- **Remediation:**
  1. Implement server-side authentication using HTTP-only, secure, `SameSite=Strict` cookies or signed JWTs.
  2. Validate session roles on every API request.
  3. Remove the Admin Command Center UI from the public client bundle.

---

### Finding 3: Plaintext Credentials Exposed in Public JavaScript
- **Vulnerability ID:** `SEC-VULN-003`
- **Classification:** **CRITICAL (CVSS 8.5)**
- **Affected File:** `public/js/auth.js` (lines 16–47)
- **Affected Variable:** `SEED_ACCOUNTS`
- **Mechanism:**
  The source code hardcodes demo and administrator credentials in plaintext:
  ```javascript
  { email: 'alex@velocitygrowth.io', password: 'demo123', role: 'customer' },
  { email: 'sarah@outboundsprint.com', password: 'demo123', role: 'customer' },
  { email: 'admin@apexintel.io', password: 'apex2026', role: 'admin' }
  ```
- **Proof of Concept:**
  Anyone visiting `https://apexintel-b2b.shop/` can open DevTools or view page source, search for `SEED_ACCOUNTS`, and read the administrative password (`apex2026`).
- **Remediation:**
  1. Purge `SEED_ACCOUNTS` from client-side bundles immediately.
  2. Store user accounts in a secure database (DynamoDB or Cloudflare D1) with salted password hashing (Argon2id or bcrypt, cost factor $\ge 12$).

---

### Finding 4: B2B Contact Records Scraped Free from Page Source
- **Vulnerability ID:** `SEC-VULN-004`
- **Classification:** **HIGH (CVSS 7.5)**
- **Affected File:** `public/index.html` (lines 2042–2099)
- **Affected Variable:** `dataCollections`
- **Mechanism:**
  All 24 core B2B company records (company names, direct telephone numbers, decision-maker emails, and website speeds) are bundled unencrypted into `public/index.html`.
- **Proof of Concept:**
  A competitor or scraper can curl `https://apexintel-b2b.shop/` and extract all 24 verified contractor records via regex without paying the $79–$99 retail price.
- **Remediation:**
  1. Obfuscate preview records in the public HTML (e.g., `in**@dallasroofer.com`, `+1 469 *** 9867`).
  2. Deliver full unmasked records only through authenticated, server-gated downloads.

---

### Finding 5: Website Scanner SSRF Vulnerability Analysis
- **Vulnerability ID:** `SEC-VULN-005`
- **Classification:** **MEDIUM (CVSS 6.5)**
- **Affected File:** `public/js/tools-suite.js` (lines 77–86)
- **Affected Function:** `window.runDomainScan()`
- **Mechanism:**
  The current scanner is simulated in the browser and does not issue real HTTP requests. However, line 82 contains a rudimentary blacklist:
  ```javascript
  if (domain === 'localhost' || domain.startsWith('127.') || domain.startsWith('192.168.') || domain.startsWith('10.') || domain.includes('..')) { ... }
  ```
- **Vulnerability if Connected to a Backend:**
  If a backend proxy endpoint is built using this naive blacklist, it would be vulnerable to:
  1. **IPv6 Loopback:** `[::1]`, `[0:0:0:0:0:0:0:1]`
  2. **Hex / Octal IP Obfuscation:** `0x7f000001` (127.0.0.1) or `2130706433`
  3. **Cloud Metadata Endpoints:** `169.254.169.254` (AWS IMDSv2 / EC2 metadata service)
  4. **DNS Rebinding:** Domain resolving to a public IP on first lookup and `127.0.0.1` on second lookup.
- **Remediation:**
  When connecting the Website Scanner to a real backend, enforce strict network controls:
  - Perform DNS resolution before issuing HTTP requests.
  - Reject private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Reject link-local and cloud metadata addresses (`169.254.0.0/16`).
  - Enforce a 4-second timeout and disallow non-standard ports (allow only 80 and 443).

---

### Finding 6: Cross-Tenant Data Leakage via Shared LocalStorage
- **Vulnerability ID:** `SEC-VULN-006`
- **Classification:** **HIGH (CVSS 7.2)**
- **Affected File:** `public/js/customer-dashboard.js` (lines 160–175)
- **Mechanism:**
  All CRM data is stored under generic keys (`apexintel_crm_leads`, `apexintel_custom_requests`) in browser `localStorage`.
- **Proof of Concept:**
  On a shared office computer, Agency A logs out. Agency B logs in on the same browser. Agency B automatically inherits all of Agency A's leads, confidential client notes, and follow-up reminders.
- **Remediation:**
  1. Store all CRM data server-side in DynamoDB with a partition key combining `customer_id` and `lead_id`.
  2. Scope any client-side caching to `apexintel_crm_leads_${userId}` and clear cache on sign-out.
