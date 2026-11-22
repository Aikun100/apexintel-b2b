# ApexIntel B2B — Product Evolution Roadmap (2026-2027)
**Document ID:** `ROADMAP-2026-v2.0`  
**Classification:** Strategic Product Roadmap  
**Target Architecture:** Full-Cycle B2B Intelligence & Revenue Platform  

---

## 1. Vision & Core Philosophy

ApexIntel B2B transforms from a static lead list storefront into an end-to-end B2B revenue and intelligence platform. Modern sales agencies and outbound revenue teams require more than raw contact lists; they need actionable intelligence, website diagnostic leverage, automated campaign tracking, and custom extraction workflows.

```mermaid
flowchart LR
    A["DISCOVER"] --> B["ANALYZE"]
    B --> C["ENRICH"]
    C --> D["QUALIFY"]
    D --> E["SAVE"]
    E --> F["CONTACT"]
    F --> G["TRACK"]
    G --> H["CONVERT"]
```

---

## 2. Phased Execution Matrix

### Phase 0: Baseline & System Audit (COMPLETED)
- Complete codebase inspection of frontend SPA, edge deployment, and AWS crawler scripts.
- Creation of comprehensive technical documentation in `/docs`.
- Feature matrix categorization (KEEP, IMPROVE, REBUILD, ADD).

### Phase 1: SaaS Experience & Design Refinement (COMPLETED)
- Dark-first SaaS UI identity (`#070B14` surface, `#0F172A` card layers, fine borders, emerald/cyan accents).
- High-conversion split hero with live lead visualizer and instant search.
- Interactive Diagnostic Suite:
  - Tool 1: Website Intelligence Scanner
  - Tool 2: B2B ROI Calculator
  - Tool 3: Cold Outreach Generator
  - Tool 4: Lead Quality & ICP Scorer
  - Tool 5: Live Dataset Catalog & Search
  - Tool 6: Custom Data Request Builder

### Phase 2: Client Workspace & Prospect CRM (IN PROGRESS)
- Expand customer dashboard into full-featured B2B Workspace.
- Prospect CRM:
  - 11 Pipeline Stages: `New`, `Qualified`, `Ready to Contact`, `Contacted`, `Follow-Up`, `Responded`, `Meeting Scheduled`, `Proposal`, `Won`, `Lost`, `Not Qualified`.
  - Dual View Modes: Interactive Data Table and Kanban Board.
  - "Save to CRM" integration on live table and dataset preview.
  - Lead Profile Drawer with rich metadata, notes journal, tag manager, and follow-up date picker.

### Phase 3: Campaign Management & Follow-up Queue (IN PROGRESS)
- Campaign Tracker:
  - Create, view, and organize campaigns by territory or niche.
  - Real performance counters: Total Leads, Contacted, Replied, Meetings, Won.
- Follow-Up Reminders Queue:
  - Due date alerts, overdue status flags, 1-click "Mark Completed", and 48-hour "Snooze".
- Outbound Generator Integration:
  - Pre-populate outreach emails and pitch scripts directly from lead profile drawer.

### Phase 4: Website Audit Lab & Intelligence Reports (IN PROGRESS)
- Audit Lab Tab inside customer workspace.
- Archive scanned prospects with latency diagnostics, mobile scores, and pixel audit.
- Client-ready exportable audit reports (HTML / Print-to-PDF).

### Phase 5: Custom Data Extraction Lifecycle (IN PROGRESS)
- Customer Custom Request Tracking: `Draft` $\to$ `Submitted` $\to$ `Reviewing` $\to$ `Mining` $\to$ `Delivered`.
- Admin Command Center Custom Queue: View inbound specifications, update status, attach delivery files.

### Phase 6: Cloudflare Edge & AWS Serverless Alignment (COMPLETED)
- Cloudflare Workers static assets engine at `https://apexintel-b2b.shop`.
- Automated daily crawler on AWS Lambda (`apex-web-app`) and DynamoDB (`leads_cache`).
- S3 data lake architecture for master dataset archives.

---

## 3. Milestones & Release Targets

| Milestone | Target Date | Deliverable | Success Criteria |
|---|---|---|---|
| **v1.0.0** | Nov 20, 2026 | Dataset storefront & static downloads | First commercial transactions processed |
| **v1.5.0** | Nov 21, 2026 | Cloudflare Workers edge migration, Card modal | Zero build credit spend, real PayPal card checkout |
| **v2.0.0** | Nov 22, 2026 | Full-Cycle B2B Intelligence SaaS & Prospect CRM | 11-stage CRM, Kanban, Campaigns, Audit Lab, Custom Requests |
| **v2.5.0** | Q1 2027 | Webhook sync with GoHighLevel, Smartlead, Instantly | Direct automated push from CRM into sending tools |
| **v3.0.0** | Q2 2027 | Autonomous AI Voice & LinkedIn Prospecting Agents | Real-time multi-channel automated outbound sequences |
