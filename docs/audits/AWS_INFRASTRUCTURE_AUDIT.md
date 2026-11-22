# ApexIntel B2B — AWS Infrastructure Audit & Cloud Gap Analysis
**Document ID:** `AUDIT-AWS-2026-v1.0`  
**Classification:** Cloud Infrastructure & Security Verification  
**AWS Account ID:** `129264592603`  
**Target Region:** `ap-southeast-2` (Asia Pacific - Sydney)  
**Auditor:** Principal Cloud Infrastructure Engineer  

---

## 1. Local Configuration & Credential Assessment

### Configuration Profile (`~/.aws/config`):
```ini
[profile apexintel]
region = ap-southeast-2
output = json
login_session = arn:aws:sts::129264592603:assumed-role/AccountFullAccessRole/847834a8-e0d1-70cd-122b-0660578d1be3
```

### Authentication Reality:
- **SSO Session Status:** **EXPIRED.** The temporary STS security token granted to role `AccountFullAccessRole` has expired.
- **Impact:** Local CLI commands (e.g. `aws lambda list-functions --profile apexintel`, `aws dynamodb describe-table --profile apexintel`) fail with:
  `[ERROR]: Your session has expired. Please reauthenticate using 'aws login'`.
- **Action Required:** Re-authentication via AWS SSO is required before executing live AWS CLI inspection or redeployment.

---

## 2. Serverless Architecture Inventory & Code Inspection

### 2.1 AWS Lambda Function: `apex-web-app`
- **Location:** `aws/lambda-crawler-handler.mjs` (67 lines)
- **Deployment Archive:** `aws/lambda_payload.zip` (1,708 bytes)
- **Runtime:** `nodejs20.x` on ARM64 (Graviton2)
- **Handler Code Inspection:**
  ```javascript
  import dns from 'node:dns/promises';

  export const handler = async (event) => {
    console.log("⚡ ApexIntel AWS Lead Ingestion & Deduplication Triggered");
    const freshLeads = event.leads || [ ... ];
    const results = [];
    for (const lead of freshLeads) {
      let mxValid = false;
      try {
        const domain = lead.email.split('@')[1];
        const records = await dns.resolveMx(domain);
        mxValid = Array.isArray(records) && records.length > 0;
      } catch (e) {
        mxValid = false;
      }
      results.push({ id: lead.id, company_name: lead.company_name, email: lead.email, mx_verified: mxValid, delivered_to: [], created_at: new Date().toISOString() });
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Batch processed & verified for DynamoDB leads_cache", verified_count: results.filter(r => r.mx_verified).length, sample_records: results })
    };
  };
  ```
- **Audit Findings:**
  1. **Missing DynamoDB Integration:** The code only imports `node:dns/promises`. It does **not** import `@aws-sdk/client-dynamodb` or `@aws-sdk/lib-dynamodb`. It never executes a `PutItem` or `BatchWriteItem` call.
  2. **In-Memory Operation:** The function verifies DNS MX records in memory and returns a JSON HTTP response string, but discards the verified leads when execution completes.
  3. **No Batch Error Handling:** If DNS resolution times out on a domain, it sets `mxValid = false` but does not record network retry metrics.

### 2.2 Amazon DynamoDB Table: `leads_cache`
- **Target Primary Key:** `id` (String - Canonical Domain Name)
- **Billing Mode:** Pay-per-request (On-Demand Capacity)
- **Audit Findings:**
  1. **Zero Active Connections:** The user-facing website has no DynamoDB client or proxy. All data displayed in the web app originates from static JavaScript objects in `public/index.html`.
  2. **Deduplication Engine Isolation:** `aws/deduplication-engine.mjs` implements customer deduplication filtering in an exported function `fulfillCustomerBatch()`. However, this function is never imported or called by the Lambda handler or the web application.

### 2.3 Amazon EventBridge: `apex-daily-lead-crawler`
- **Schedule Expression:** `cron(0 0 ? * MON-FRI *)` (Midnight UTC, Mon–Fri)
- **Target:** ARN of Lambda `apex-web-app`
- **Audit Findings:**
  1. EventBridge triggers Lambda on schedule, but because the Lambda handler does not commit records to DynamoDB or S3, the nightly run acts as an ephemeral execution with no persistent data artifacts produced.

### 2.4 Amazon S3 Bucket: `apexintel-datasets-production`
- **Documented Purpose:** Raw JSON crawl artifacts and packaged CSV/XLSX territories.
- **Audit Findings:**
  1. S3 bucket exists or is documented, but the frontend application never requests presigned S3 URLs (`s3:GetObject`).
  2. When customers click "Download Dataset" in the workspace, the browser generates a 6-row CSV dynamically from memory rather than retrieving the verified master files from S3.

### 2.5 Cloudflare Workers Edge Integration: `apexintel-b2b`
- **Configuration:** `wrangler.jsonc`
  ```jsonc
  {
    "name": "apexintel-b2b",
    "compatibility_date": "2026-11-20",
    "assets": { "directory": "public" },
    "routes": [
      { "pattern": "apexintel-b2b.shop", "custom_domain": true },
      { "pattern": "www.apexintel-b2b.shop", "custom_domain": true }
    ]
  }
  ```
- **Audit Findings:**
  1. **Static Host Only:** Cloudflare Workers is operating exclusively as a static asset server.
  2. **Zero API Routing:** There is no Worker entry point (`worker.js` / `main`) intercepting `/api/*` routes. As a result, no backend processing can take place at the edge.

---

## 3. Discrepancy Matrix: Documented vs. Implemented Architecture

| Architectural Feature | Documented Architecture | Code-Verified Reality | Gap Severity |
|---|---|---|:---:|
| **DynamoDB Lead Persistence** | Continuous automated ingestion into `leads_cache` | Zero DynamoDB SDK calls in Lambda handler; records discarded | **CRITICAL** |
| **Zero-Duplicate Delivery** | DynamoDB ledger updates `delivered_to` array | Handled via static mock hashes in client `localStorage` | **HIGH** |
| **Dataset Download Rail** | Secure S3 presigned URLs with AES-256 encryption | In-memory 6-record client Blob generator | **CRITICAL** |
| **AWS Telemetry in Admin** | Live CloudWatch / DynamoDB monitoring | Static HTML strings hardcoded in `admin-dashboard.js` | **MEDIUM** |
| **Edge API Gateway** | REST API endpoints on Cloudflare Workers edge | Cloudflare Workers serves only static files; no API logic | **HIGH** |
| **AWS CLI Automation** | Active developer CLI deployment profile | Session expired; requires SSO reauthentication | **LOW** |
