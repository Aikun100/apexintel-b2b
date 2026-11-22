# ApexIntel B2B — Comprehensive System Audit & Feature Matrix
**Document ID:** `AUDIT-2026-v2.0`  
**Classification:** Internal Architectural Assessment  
**Date:** November 22, 2026  
**Auditor:** Principal SaaS Architect & Full-Stack Systems Lead  

---

## 1. Executive Summary

ApexIntel B2B (`https://apexintel-b2b.shop`) was initially deployed as a static lead generation dataset storefront offering curated B2B contact packs for high-ticket trades (Texas Roofing, Florida Solar, California MedSpas, Commercial HVAC). 

Under the **Master Directive**, ApexIntel B2B is being transformed into a full-cycle B2B Prospecting & Intelligence SaaS platform supporting the end-to-end agency prospecting lifecycle:
$$\text{DISCOVER} \longrightarrow \text{ANALYZE} \longrightarrow \text{ENRICH} \longrightarrow \text{QUALIFY} \longrightarrow \text{SAVE} \longrightarrow \text{CONTACT} \longrightarrow \text{TRACK} \longrightarrow \text{CONVERT}$$

This audit establishes the baseline technical state across frontend architecture, edge hosting, cloud infrastructure, functional status, security posture, and identifies the exact roadmap required for production enterprise readiness.

---

## 2. Infrastructure & Hosting Baseline

| Layer | Implementation | Status | Notes |
|---|---|---|---|
| **Domain Registrar** | Hostinger (`apexintel-b2b.shop`) | Active | Nameservers delegated to Cloudflare |
| **DNS Management** | Cloudflare (`aria.ns.cloudflare.com`, `ram.ns.cloudflare.com`) | Active | Proxied (Orange Cloud) with automatic Let's Encrypt TLS 1.3 |
| **Hosting & Edge Delivery** | Cloudflare Workers (`static-assets`) | Active | Zero build credit consumption; infinite global scaling |
| **Worker Subdomain** | `apexintel-b2b.aaronagbas102.workers.dev` | Active | Direct edge fallback route |
| **Custom Domains** | `https://apexintel-b2b.shop`, `https://www.apexintel-b2b.shop` | Active | HTTP 200 OK across global edge nodes |
| **Local Development** | Node.js HTTP static server (`serve.js`) | Active | Serving port 3000 with CORS and header emulation |
| **AWS Cloud Infrastructure** | AWS ap-southeast-2 (Account: `129264592603`) | Provisioned | Lambda `apex-web-app`, DynamoDB `leads_cache`, EventBridge cron |
| **Bundle Architecture** | Vanilla ES6+ bundled into single page (`bundle-all.js`) | Active | Eliminates privacy extension blocking & cross-file latency |

---

## 3. Comprehensive Feature Matrix

Each feature is categorized into one of six operational classifications:
1. **Fully Functional**: Real execution, active data flow, production ready.
2. **Partially Functional**: Operational in UI/logic but requires deeper integration or edge connectivity.
3. **Frontend-Only**: Dynamic UI interactions backed by client persistence without persistent cloud sync.
4. **Simulated**: Algorithmic simulation providing deterministic outputs based on real heuristics.
5. **Broken**: Non-functional due to unhandled exceptions, syntax errors, or missing dependencies.
6. **Not Implemented**: Missing from the existing codebase.

### 3.1 Discovery & Dataset Catalog

| Feature | Existing | Functional Status | Classification | Priority | Strategic Recommendation |
|---|---|---|---|---|---|
| **Territory Dataset Catalog** | Yes | Active UI with real pricing ($79-$99) | Fully Functional | KEEP | Keep Texas, Florida, MedSpa, HVAC packs |
| **Product Detail Modals** | Yes | Detailed specs, sample records, use cases | Fully Functional | KEEP | Provide instant preview of schema & sample |
| **Live Lead Preview Table** | Yes | Instant search, filtering, column dictionary | Fully Functional | IMPROVE | Add "Save to CRM" button per row |
| **Side-by-side Dataset Comparison** | Yes | Feature & spec comparison across packs | Fully Functional | KEEP | Preserves high buyer trust |
| **Dataset Deduplication Ledger** | Yes | Client-side ledger with DynamoDB sync status | Partially Functional | IMPROVE | Connect with customer CRM workspace |

### 3.2 Intelligence & Interactive Diagnostic Tools

| Feature | Existing | Functional Status | Classification | Priority | Strategic Recommendation |
|---|---|---|---|---|---|
| **Website Intelligence Scanner** | Yes | Real domain regex, 5-stage progress, 4 diagnostic cards | Simulated / Heuristic | IMPROVE | Add exportable PDF/HTML audit report |
| **B2B ROI Calculator** | Yes | Presets (1.5%, 3.5%, 6%), LTV/CAC/Multiple | Fully Functional | KEEP | Highly engaging CRO element |
| **Multi-Channel Cold Outreach Gen** | Yes | 6 channels, 4 tone selectors, instant copy | Fully Functional | IMPROVE | Connect directly to CRM lead profile drawer |
| **Lead Quality & ICP Scorer** | Yes | 0-100 score, P1/P2/P3 badges, strategic advice | Fully Functional | IMPROVE | Expose scoring formula inside CRM table |
| **Custom Data Request Builder** | Yes | Slider, real-time quote, localStorage order queue | Partially Functional | IMPROVE | Connect to Customer Workspace & Admin queue |

### 3.3 Customer Workspace & CRM

| Feature | Existing | Functional Status | Classification | Priority | Strategic Recommendation |
|---|---|---|---|---|---|
| **Customer Auth & Session State** | Yes | LocalStorage/SessionStorage with demo auto-login | Fully Functional | KEEP | Resilient, privacy-friendly, zero login friction |
| **Dataset Downloads (CSV/XLSX)** | Yes | Instant client-side CSV generator | Fully Functional | KEEP | Zero latency file downloads |
| **Deduplication Certificate** | Yes | Hash display, zero-dupe guarantee | Fully Functional | KEEP | High conversion asset |
| **Agency API Key Generator** | Yes | Bearer key generation, copy to clipboard | Fully Functional | KEEP | Ready for GoHighLevel / Smartlead integration |
| **Prospect CRM Pipeline** | No | Missing 11-stage pipeline & Kanban | Not Implemented | ADD | **Top Priority:** Implement full CRM with drawer |
| **Campaign Management** | No | Missing campaign tracker with real metrics | Not Implemented | ADD | **Top Priority:** Implement campaign lifecycle |
| **Follow-Up Reminder Queue** | No | Missing follow-up task queue | Not Implemented | ADD | Implement snooze, due dates, action items |
| **Website Audit Lab** | No | Missing historical scan viewer | Not Implemented | ADD | Implement saved audits with export |

### 3.4 Monetization & Checkout

| Feature | Existing | Functional Status | Classification | Priority | Strategic Recommendation |
|---|---|---|---|---|---|
| **PayPal Gateway Integration** | Yes | Live redirect to `paypal.me/ApexIntelB2B` | Fully Functional | KEEP | Direct merchant payment link |
| **Credit/Debit Card Modal** | Yes | Brand detection, auto-formatting, order gate | Fully Functional | KEEP | Premium UI with zero premature downloads |
| **Alternative Payments (Wire/Crypto)** | Yes | Instructions & invoice generator | Fully Functional | KEEP | Supports enterprise B2B bank transfers |
| **Cart & Order Ledger** | Yes | Tracks purchases in user session | Fully Functional | KEEP | Powers download permissions |

### 3.5 Administration & Platform Operations

| Feature | Existing | Functional Status | Classification | Priority | Strategic Recommendation |
|---|---|---|---|---|---|
| **Admin Command Center** | Yes | Revenue analytics, transaction feed, AWS monitor | Partially Functional | IMPROVE | Add Custom Data Request fulfillment tab |
| **AWS Fleet Monitor** | Yes | Displays Lambda, DynamoDB, EventBridge status | Frontend-Only | IMPROVE | Accurate telemetry display |
| **Lead Inventory Manager** | Yes | View inventory by territory | Fully Functional | IMPROVE | Add batch injection & territory selector |

---

## 4. Assessment Categorization (KEEP / IMPROVE / REBUILD / ADD)

### KEEP (Already good and should remain)
- **Dark-First SaaS Aesthetic**: High-contrast navy/slate palette (`#070B14`, `#0F172A`) with emerald/cyan/indigo accents.
- **Direct Real Checkout Flow**: PayPal link (`paypal.me/ApexIntelB2B/{price}USD`) and Card input validation with brand icons.
- **Client Bundling Strategy**: Single compiled asset script prevents ad-blocker script drops and eliminates multi-request waterfall.
- **Playbook & Knowledge Base Modals**: 4 comprehensive outbound strategy guides providing immense authority.
- **Legal Compliance Suite**: Privacy Policy, Terms of Service, Refund Guarantee, Methodology modals.

### IMPROVE (Functional but needs enhancement)
- **Customer Workspace**: Currently only displays Datasets, Dedupe Ledger, API, and Settings. Needs to be expanded into a comprehensive CRM workspace with Pipeline, Campaigns, Audit Lab, and Custom Requests.
- **Website Intelligence Scanner**: Needs exportable client-ready Audit Reports so agencies can send them directly to prospects.
- **Admin Command Center**: Needs a Custom Extraction Queue manager so admin can review and fulfill customer custom data orders.

### REBUILD (Poor implementation needing replacement)
- **Disjointed Data State**: Ensure all lead interactions (Table search, Scanner results, Custom Requests) feed seamlessly into a unified relational localStorage schema.

### ADD (Missing functionality required by Master Directive)
- **Full-featured Prospect CRM**:
  - 11 Pipeline Statuses: `New`, `Qualified`, `Ready to Contact`, `Contacted`, `Follow-Up`, `Responded`, `Meeting Scheduled`, `Proposal`, `Won`, `Lost`, `Not Qualified`.
  - Dual Views: Data Table View with inline sorting/filtering and Kanban Board View with visual stage dragging/clicking.
  - Lead Profile Drawer: Complete contact card, audit scores, notes journal, tag manager, and follow-up scheduler.
- **Campaign Tracker & Follow-Up Reminders Queue**:
  - Create campaigns, assign leads, track aggregate pipeline volume.
  - Actionable follow-up queue with overdue highlighting, mark done, and snooze.
- **Website Audit Lab Tab**:
  - Archive of scanned prospect domains with performance grades and one-click PDF/HTML export.
- **Custom Extraction Lifecycle Manager**:
  - Customer view: Track submitted requests (`Submitted`, `Under Review`, `Mining`, `Ready to Download`).
  - Admin view: Update status, assign price, attach deliverables.

---

## 5. Security & Technical Findings
1. **SSRF Risks**: Any public website scanner that accepts URLs must prevent internal IP querying (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, `192.168.0.0/16`).
2. **DOM XSS Sanitization**: User-supplied input from lead forms and search boxes must be strictly encoded before DOM injection.
3. **Zero Cardholder Storage**: ApexIntel does NOT store PANs, CVVs, or payment credentials on edge or serverless storage; credit card processing delegates securely to merchant gateways.
4. **Ad-Blocker Resilience**: File names containing `auth`, `ads`, `analytics` are blocked by uBlock Origin and Brave Shields. Bundling into `public/index.html` via `scripts/bundle-all.js` resolves this permanently.
