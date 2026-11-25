# ApexIntel B2B — Customer Product Experience Specification
**Document ID:** `SPEC-CUST-2026-V1`  
**Phase:** Phase 4 Customer Product Experience  
**Date:** November 24, 2026  

---

## 1. Unified Intelligence Workspace Overview

The customer portal (`public/js/customer-dashboard.js`) is an integrated B2B prospecting workspace providing 10 unified operational modules. Every view is server-authoritative and scoped strictly to the authenticated tenant (`userId`).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ApexIntel Intelligence Workspace                    │
│  [Overview] [Discover] [My Leads] [Intelligence] [Datasets]            │
│  [Campaigns] [CRM] [Custom Research] [Billing] [Settings]               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      │                              │                              │
      ▼                              ▼                              ▼
[ Lead Discovery ]           [ 11-Stage CRM ]             [ Research Intake ]
- 50-State Filtering         - Kanban / Table Views       - Real-Time Quotations
- Latency & Pixel Flags      - Notes & Follow-Up Dates    - Lifecycle Tracking
- One-Click CRM Ingestion    - Tenant-Scoped Isolation    - S3 Presigned Delivery
```

---

## 2. The 10 Unified Workspace Modules

### Module 1: Overview (`#custTab-overview`)
- **4 Key Metric Gauges:** Total Saved Prospects, Active Opportunities, High-Priority (P1) Hot Leads, and Datasets Owned.
- **11-Stage Pipeline Summary Bar:** Real-time visual progress across New, Qualified, Ready to Contact, Contacted, Follow-Up, Responded, Meeting Scheduled, Proposal, Won, Lost, and Not Qualified.
- **Recent Activity Stream:** Chronological event log of newly ingested leads, stage transitions, and research updates.

### Module 2: Discover (`#custTab-discover`)
- **Search & Filter Matrix:** Filter leads by geographic territory (Texas, Florida, California, etc.), industry trade, and diagnostic signals (`Slow Mobile Speed > 1,000ms`, `Missing Meta Pixel`, `Active Google Ads`).
- **One-Click Ingestion:** "+ Add to CRM" action creates an isolated prospect in the tenant's DynamoDB collection with zero duplicates.
- **Instant Audit Trigger:** "Audit" button immediately pipes domain into the socket scanner for real-time diagnostics.

### Module 3: My Leads (`#custTab-myleads`)
- **Persisted Prospect Table:** Displays company, verified decision-maker email, direct phone, geographic city, pipeline stage, opportunity score, and scheduled follow-up dates.
- **Search & Status Filtering:** Search across names, domains, and cities, or filter by specific pipeline stages.
- **Empty State Display:** Branded radar sweep empty state graphic when zero records match filters.

### Module 4: Intelligence (`#custTab-intelligence`)
- **Full Diagnostic Auditor:** Live socket connection verifying TLS certificate trust, cipher suite, HTTP headers, Time-To-First-Byte speed, and retargeting pixel tracking.
- **Historical Memory:** Local session cache of recent domain audits with instant HTML report export.

### Module 5: Datasets (`#custTab-datasets`)
- **Dataset Library:** Displays purchased collections and available catalog packages.
- **Secure S3 Fulfillment:** 15-minute time-bound presigned URL generator enabled strictly for paid orders.
- **Zero-Duplicate Ledger List:** Displays allocated domains protected by cryptographic SHA-256 deduplication.

### Module 6: Campaigns (`#custTab-campaigns`)
- **Campaign Grouping:** Multi-touch campaign categorization (e.g., Texas Commercial Roofing Outbound Q4).
- **Deliverability Integration:** Documented hooks for cold email dispatchers (Instantly, Smartlead).

### Module 7: CRM (`#custTab-crm`)
- **11-Stage Pipeline Lifecycle:** Kanban board and dense table modes.
- **Lead Profile Drawer:** Sliding modal detailing company metadata, verified contacts, diagnostic flags, follow-up scheduler, and timestamped notes thread.
- **Data Integrity:** Strict multi-tenant backend scoping on `PUT /api/crm/leads/:id` and `DELETE /api/crm/leads/:id`.

### Module 8: Custom Research (`#custTab-customreq`)
- **Interactive Intake Calculator:** Real-time rate calculation based on requested volume and selected enrichment add-ons.
- **Lifecycle Status Board:** Transparent tracking through `Submitted` &rarr; `Reviewing` &rarr; `Mining` &rarr; `Delivered`.
- **Fulfillment Download:** Direct CSV retrieval upon status transition to `Delivered`.

### Module 9: Billing & Usage (`#custTab-billing`)
- **Plan Entitlement:** Active subscription details (Starter, Professional, Agency Growth).
- **Quota Progress Bars:** Lead discovery monthly quotas and live audit usage meters.
- **Invoice Receipts:** Transaction history with Stripe payment confirmations.

### Module 10: Settings (`#custTab-settings`)
- **Profile Configuration:** Name, company, delivery email address.
- **API Credentials:** Server-generated API keys with copy and one-click regeneration.
- **Webhook Subscriptions:** Custom outbound webhook endpoint configuration.
