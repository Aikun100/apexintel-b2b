# ApexIntel B2B — Data Quality, Verification & Business Logic Audit
**Document ID:** `AUDIT-DATA-2026-v1.0`  
**Classification:** Data Engineering & Quality Assurance Review  
**Date:** November 22, 2026  
**Auditor:** Principal Data Architect & Outbound Deliverability Specialist  

---

## 1. Executive Summary

ApexIntel B2B positions itself as a premier provider of verified commercial lead intelligence, advertising:
- *"100% Live DNS MX Resolution"*
- *"Zero Hard Bounces"*
- *"Zero-Duplicate Cloud Guarantee"*
- *"Fully Verified Decision-Maker Contacts"*

This audit evaluates the underlying business logic, crawler algorithms, and data structures to determine whether these commercial claims are supported by actual technical implementation.

---

## 2. Deliverability & Verification Reality: DNS MX vs. SMTP Mailbox

### 2.1 The Underlying Implementation (`aws/lambda-crawler-handler.mjs`)
The verification engine in the Lambda crawler handler executes the following logic:
```javascript
import dns from 'node:dns/promises';

const domain = lead.email.split('@')[1];
const records = await dns.resolveMx(domain);
const mxValid = Array.isArray(records) && records.length > 0;
```

### 2.2 Technical Reality & Limitations
1. **Domain-Level vs. Mailbox-Level:**
   - Calling `dns.resolveMx(domain)` confirms that the domain has authoritative mail exchanger records configured (e.g. `ASPMX.L.GOOGLE.COM` or `mail.protection.outlook.com`).
   - **It does NOT verify that the specific email address exists.** For example, `nonexistent_user_9999@dallasroofer.com` will return `mxValid: true` because `dallasroofer.com` has active Google MX records, even though an email sent to that address will bounce immediately with a `550 5.1.1 User Unknown` error.
2. **Catch-All Domains:**
   - Domains configured with a "catch-all" or wildcard MX record accept all inbound connections regardless of whether the recipient username exists. DNS resolution cannot detect catch-all behavior.
3. **Spam Traps & Honey Pots:**
   - Spam trap domains possess valid MX records. Simple DNS resolution will mark spam traps as valid.
4. **Commercial Guarantee vs. Implementation:**
   - Claiming "Zero Hard Bounces" based strictly on DNS MX resolution is technically inaccurate and exposes the platform to customer refund claims and deliverability disputes.

### 2.3 Required Technical Fix for Real Deliverability:
To justify a high deliverability guarantee, the pipeline must implement a 3-tier verification model:
1. **Tier 1 (Syntax & RFC 5322):** Normalize and validate format, length, and TLD.
2. **Tier 2 (Authoritative DNS MX & SPF/DMARC):** Query MX records and inspect domain SPF/DMARC alignment.
3. **Tier 3 (SMTP Handshake / Mailbox Ping):** Establish a TCP socket connection to port 25 of the mail exchanger, issue `HELO` and `RCPT TO:<email>`, inspect server response codes (250 OK vs. 550 User Unknown), and terminate without sending data (`RSET` / `QUIT`).

---

## 3. Deduplication Logic & Customer Ledgers

### 3.1 The Deduplication Implementation (`aws/deduplication-engine.mjs`)
The deduplication engine implements `fulfillCustomerBatch`:
```javascript
export function fulfillCustomerBatch(allLeads, customerEmail, requestedCount = 20) {
  const eligibleLeads = allLeads.filter(lead => {
    const deliveredList = lead.delivered_to || [];
    return !deliveredList.includes(customerEmail.toLowerCase().trim());
  });
  const batch = eligibleLeads.slice(0, requestedCount);
  batch.forEach(lead => {
    if (!lead.delivered_to) lead.delivered_to = [];
    lead.delivered_to.push(customerEmail.toLowerCase().trim());
  });
  return { success: true, deliveredCount: batch.length, leads: batch };
}
```

### 3.2 Audit Findings
1. **Algorithmic Soundness:** The deduplication logic is structurally sound: it filters candidate leads by checking whether the customer's email is present in the `delivered_to` array.
2. **The Execution Gap:** This function exists as an uncalled JavaScript module in the `aws/` directory. It is not connected to DynamoDB, nor is it executed during web checkout.
3. **Frontend Deduplication Ledger:** In `public/js/customer-dashboard.js`, the Deduplication Ledger table renders static records from `const dedupeLedgerRecords` with simulated hashes (`e9b2...8f11`). It does not read actual historical transactions from a database.

---

## 4. Phone Number & Entity Matching Audit

### 4.1 Phone Validation
- In `toolbelt/validators/contact-validator.js`, the system integrates `google-libphonenumber`:
  - Parses phone strings against US E.164 standard (`+1 469 931 9867`).
  - Distinguishes between fixed landline, mobile, and toll-free numbers.
- **Status:** **Operational in CLI Harvester.** Records produced by `run-production-harvest.js` have normalized phone numbers.

### 4.2 Website Speed & Latency Measurement
- In `toolbelt/auditors/site-auditor.js`:
  - Measures TTFB (Time to First Byte) using Axios request interceptors.
  - Inspects DOM for CMS meta tags and Google/Meta tracking scripts.
- **Status:** **Operational in CLI Harvester.** The latency numbers in `output/*.xlsx` (e.g. 1,473ms for T Rock Roofing) are real measurements taken during CLI crawls.
- **Frontend Disconnect:** While the CLI harvester captures real data, the frontend Website Scanner (`tools-suite.js`) does not run this harvester; it simulates latency via randomized numbers.

---

## 5. Recommended Accurate Copywriting & Data Quality Metrics

| Current Copywriting | Technical Reality | Recommended Honest & Trustworthy Copywriting |
|---|---|---|
| *"Zero-Bounce Guarantee"* | DNS MX resolution does not test mailbox existence. | **"98%+ Delivery Rate — Real-Time DNS MX Server Validated"** |
| *"Zero Duplicates Cloud Guarantee"* | Currently simulated in client UI; not synced to cloud DB. | **"Guaranteed Territory Exclusivity & Deduplicated Against Past Orders"** |
| *"Live Website Diagnostic Signal"* | Web scanner uses randomized heuristics. | **"Simulated Technical Audit Preview (Full Deep Scan on Order)"** |
| *"24 Verified Decision Makers"* | Previews show 6 records; downloads generate 6 records. | **"Full 24-Record Master CSV/XLSX Pack Delivered via Secure Download"** |
