# ApexIntel B2B — Platform Architecture Specification
**Document ID:** `ARCH-2026-v2.0`  
**Classification:** Technical System Architecture  
**Date:** November 22, 2026  

---

## 1. System Architecture Overview

ApexIntel B2B is built on an ultra-low-latency, resilient, and cost-efficient hybrid cloud architecture combining **Cloudflare Workers (Edge Engine)** for static frontend delivery with an **AWS Serverless Backend (Lambda, DynamoDB, EventBridge)** for asynchronous data mining, verification, and lead deduplication.

```mermaid
graph TD
    subgraph Client["Client Browser / End User"]
        SPA["Single Page App (HTML5 / Tailwind / Vanilla ES6+)"]
        CRM["Client-Side Prospect CRM & Kanban"]
        Tools["Diagnostic Tools Suite"]
        Storage["Relational LocalStorage & Session Cache"]
    end

    subgraph Edge["Cloudflare Edge Network"]
        CF_Worker["Cloudflare Worker (Static Assets Engine)"]
        CF_DNS["Cloudflare DNS (DNSSEC, TLS 1.3, DDoS Defense)"]
        CustomDomain["apexintel-b2b.shop & www"]
    end

    subgraph AWS["AWS Serverless Cloud (ap-southeast-2)"]
        Cron["EventBridge Scheduled Rule (Daily Crawler)"]
        Lambda["AWS Lambda (apex-web-app)"]
        Dynamo["Amazon DynamoDB (leads_cache)"]
        S3["Amazon S3 (Lead Datasets Lake)"]
    end

    subgraph Payments["Payment & Gateway Systems"]
        PayPal["PayPal Merchant Gateway (Direct Card / Wallet)"]
    end

    Client -->|HTTPS / TLS 1.3| CF_DNS
    CF_DNS --> CF_Worker
    CF_Worker --> SPA
    SPA --> Tools
    SPA --> CRM
    CRM <--> Storage
    SPA -->|Order & Checkout Flow| PayPal
    Cron -->|Scheduled Trigger| Lambda
    Lambda -->|DNS MX Verification & Dedup| Dynamo
    Lambda -->|Territory CSV/JSON Sync| S3
```

---

## 2. Frontend Subsystems Architecture

The client application is intentionally designed with zero heavy framework bloat (no React, Next.js, or Vue runtime dependencies) to ensure:
- Sub-500ms initial load times worldwide.
- Flawless offline-first and edge-cached execution.
- Total protection against runtime hydrate crashes and version mismatches.
- High resilience against privacy extension script blocking.

### Core Frontend Subsystem Modules:

```
public/
├── index.html                   # Master SPA shell with dark-first SaaS UI & bundled scripts
├── css/
│   └── (Tailwind Play CDN with dark utility configuration)
└── js/
    ├── auth.js                  # Authentication, session tokens, demo user state
    ├── customer-dashboard.js    # Client Workspace, Prospect CRM, Pipeline, Campaigns, Audit Lab
    ├── admin-dashboard.js       # Executive Command Center, Revenue Metrics, AWS Fleet Monitor
    ├── payment-engine.js        # Dataset catalog, Card modal with auto-format, PayPal checkout
    ├── tools-suite.js           # 6 interactive tools (Scanner, ROI, Outreach, ICP, Catalog, Custom)
    └── modals-and-knowledge.js  # Product detail modals, comparison matrix, 4 outbound playbooks
```

---

## 3. Bundling & Distribution Architecture

To prevent ad-blockers, tracking shields (Brave Shields, uBlock Origin), and network firewalls from blocking scripts named `auth.js` or `tools.js`, a discrete build pipeline compiles all modules directly into `public/index.html`:

```mermaid
flowchart LR
    M1["auth.js"] --> B["scripts/bundle-all.js"]
    M2["customer-dashboard.js"] --> B
    M3["admin-dashboard.js"] --> B
    M4["payment-engine.js"] --> B
    M5["tools-suite.js"] --> B
    M6["modals-and-knowledge.js"] --> B
    B --> OUT["public/index.html (Production Ready)"]
    OUT --> WRANGLER["Wrangler Deploy"]
    WRANGLER --> CF["Cloudflare Global Edge"]
```

---

## 4. State Management & Relational Client Storage

ApexIntel uses structured `localStorage` partitions for high responsiveness, privacy-first data handling, and instant UI state changes without blocking network round-trips:

| Key | Type | Description |
|---|---|---|
| `apexintel_session` | Object | Active user profile, plan tier, remaining credits |
| `apexintel_api_key` | String | Bearer token for CRM and external API integrations |
| `apexintel_crm_leads` | Array | CRM lead database (contact details, status, notes, tags) |
| `apexintel_crm_campaigns` | Array | Active outbound campaigns, target quotas, lead links |
| `apexintel_audit_scans` | Array | Scanned prospect domains, diagnostic audit results |
| `apexintel_custom_requests`| Array | Inbound custom extraction requests and specifications |
| `apexintel_purchases` | Array | Unlocked datasets, download tokens, invoices |

---

## 5. Security Architecture
- **Content Security Policy**: Restricts script execution to approved CDNs (Tailwind, Lucide, FontAwesome).
- **Safe Link Formatting**: External URLs sanitize protocol and use `rel="noopener noreferrer"`.
- **Payment Token Separation**: Credit card inputs do not touch any backend server; formatted client-side and routed securely through PayPal's merchant payment rail.
- **SSRF Hardening**: URL scanner strips dangerous protocols and validates domain structure against RFC standards before execution.
