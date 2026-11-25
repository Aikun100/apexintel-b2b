# APEXINTEL B2B — PRODUCT & EXPERIENCE BLUEPRINT (V1.0)
## Strategic Product-First SaaS Roadmap & Implementation Architecture

**Document Version:** 1.0  
**Status:** Approved for Implementation  
**Target Environment:** Vanilla JavaScript Frontend, Cloudflare Workers, Node.js 20 AWS Lambda, Amazon DynamoDB, Amazon S3, Stripe  
**Core Value Proposition:** *"Find the right businesses. Understand the opportunity. Turn intelligence into growth."*

---

## 1. STRATEGIC POSITIONING & CORE VALUE PROPOSITION

ApexIntel B2B fundamentally departs from commodity contact-scraping directories. The core philosophy is **intelligence-first**: sales teams, marketing agencies, and consultants do not lack contact records—they lack **context, technical qualification, and actionable reasons to reach out**.

### The 3 Core Pillars:
1. **Discover (High Precision):** Target specific niches and locations where decision-maker contact details are publicly available and DNS MX-verified.
2. **Understand (Opportunity Context):** Audit target companies for observable technical flaws—slow mobile server response times (TTFB > 1,000ms), missing Meta/Google retargeting pixels, outdated web infrastructure, and missing SSL/security headers.
3. **Convert (Tactical Outreach):** Arm the salesperson with consultative pitch angles derived directly from empirical audit data, managed through an integrated 11-stage CRM and campaign pipeline.

---

## 2. THE THREE-PRODUCT ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               APEXINTEL B2B                                  │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│    PRODUCT A     │         │    PRODUCT B     │         │    PRODUCT C     │
│ Business Datasets│         │ SaaS Workspace   │         │ Custom Research  │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ • Starter ($79)  │         │ • Starter ($29/m)│         │ • Custom Intake  │
│ • Pro ($99-$149) │         │ • Pro ($79/m)    │         │ • Scope & Quote  │
│ • S3 Presigned   │         │ • Agency ($199/m)│         │ • Queue Delivery │
│   XLSX Download  │         │ • 11-Stage CRM   │         │   Starting $299  │
│ • Instant Access │         │ • Scanner & Tools│         │ • Admin Verified │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

### Product A: Business Intelligence Datasets (One-Time Purchase)
- **Format:** Curated collections of business intelligence records (Texas Contractors, Florida Solar & Mitigation, California Luxury MedSpas, Commercial HVAC & Mechanical).
- **Pricing:** $79 (Starter Packs) to $99–$149 (Specialized Deep-Niche Packs).
- **Data Points:** Business Name, Website, Location (City/State), Industry Classification, Public Phone, Public Contact/Owner Name, Verified Email, Mobile TTFB Latency (ms), Retargeting Pixel Status (Meta Pixel / Google Ads), Technology Stack, Audit Date.
- **Fulfillment Engine:** Server-authoritative Stripe Checkout Session (`/api/orders/checkout`) -> Cryptographically signed Webhook (`/api/webhooks/payment`) -> Atomic order update in DynamoDB (`apexintel_orders`) -> Time-limited S3 presigned download URL (`/api/downloads/signed-url`).

### Product B: ApexIntel Intelligence Workspace (Subscription SaaS)
- **Format:** Monthly recurring subscription granting full access to web-based prospect discovery, CRM pipeline, website audits, and pitch generation.
- **Proposed Pricing:**
  - *Starter ($29/month):* 100 leads/mo, 50 website scans, single-user pipeline, basic export.
  - *Professional ($79/month):* 500 leads/mo, 250 website scans, 11-stage CRM, multi-channel outreach generator, custom tags, full XLSX exports.
  - *Agency ($199/month):* 2,500 leads/mo, unlimited website scans, team workspaces, bulk domain auditor, priority research queuing.
- **Fulfillment Engine:** Stripe Billing / Subscription Checkout -> Webhook provisioning -> DynamoDB user role/tier update (`tier: 'pro' | 'agency'`) -> Instant portal access.

### Product C: Custom Intelligence Research (On-Demand Bespoke)
- **Format:** Targeted extraction service where clients define custom criteria (e.g., "Commercial roofing companies in Florida with mobile speed > 1,500ms and active Google Ads").
- **Pricing:** Dynamic volume-tiered base rate ($0.60–$0.40/lead) + enrichment addons (latency testing, pixel audits, mobile verification), starting at $299.
- **Fulfillment Engine:** Interactive client request builder (`/api/requests/custom`) -> Automated server pricing validation -> Customer submission -> Admin lifecycle queue (`Submitted` -> `Reviewing` -> `Mining` -> `Delivered`) -> S3 deliverable upload -> In-app customer notification and download.

---

## 3. EXISTING CODEBASE COMPONENT AUDIT & REUSABILITY MATRIX

An exhaustive audit of the existing codebase confirms that **the vast majority of core backend engines, security layers, and data structures are already implemented, tested, and fully functional**. The primary task is aligning the frontend UI/UX and experience flow with Version 1.0 of the Blueprint.

| Capability / Component | Codebase Location | Current Status | Reusability & Alignment Action |
|---|---|:---:|---|
| **Authentication & IAM** | `src/auth/*`<br>`aws/lambda-auth-handler.mjs` | **100% Production Ready** | Fully tested (60/60 tests pass). Scrypt hashing, timing-safe equality, opaque sessions, CSRF guard, worker secret, DynamoDB `TransactWriteItems`. **Reuse as-is.** |
| **Stripe Checkout & S3 Downloads** | `src/payments/*`<br>`public/js/payment-engine.js` | **100% Production Ready** | Server-authoritative Stripe checkout, webhook atomic deduplication, fail-closed secrets, time-limited S3 presigned downloads. **Reuse as-is; style checkout modal to match design tokens.** |
| **Website Intelligence Scanner** | `src/tools/scanner-service.js`<br>`src/tools/ssrf-guard.js` | **100% Production Ready** | Real DNS, TLS 1.3 trust validation, TTFB measurement, ad pixel inspection, SSRF loopback guard (IPv4 & expanded IPv6). **Reuse as core of 'Intelligence' tab.** |
| **Multi-Tenant CRM Backend** | `src/crm/*`<br>`public/js/customer-dashboard.js` | **100% Production Ready** | 11-stage sales pipeline (`New` to `Won`/`Lost`), dual Kanban/Table views, Lead Profile Drawer, notes, tags, follow-ups. **Align dashboard navigation tabs with Blueprint Section 7.** |
| **Custom Request Builder & Queue** | `src/requests/*`<br>`public/js/admin-dashboard.js` | **100% Production Ready** | Client budget estimator, cryptographically generated `REQ-2026-<hex>` IDs, tenant-isolated submission, admin status progression. **Reuse as 'Custom Research' tab.** |
| **Lead Discovery & Crawling** | `src/discovery/*`<br>`data/` | **100% Production Ready** | Curated Texas, Florida, California, and HVAC datasets. Point search, territory filtering, opportunity scoring. **Connect directly to 'Discover' tab.** |
| **Frontend Monolithic Bundle** | `public/index.html`<br>`scripts/bundle-all.js` | **Functional (Needs UI Polish)** | 7,938-line bundle. Re-organize homepage sections into the 10 clean Blueprint sections and reorganize customer dashboard into the 10 Blueprint tabs. |

---

## 4. BRAND & VISUAL DESIGN SYSTEM

In strict alignment with the blueprint and `web-design-mastery`:

### Color Palette (Dark Theme Default)
- **Deep Charcoal / Midnight Background:** `#070B14` (Canvas) and `#0B1120` (Elevated surface).
- **Glass / Translucent Card Surface:** `rgba(15, 23, 42, 0.70)` with `backdrop-blur-xl` and `border border-white/[0.08]`.
- **Primary Brand Accent (Electric Cyan):** `#06B6D4` (Highlights, technical badges, active tabs).
- **Secondary Brand Accent (Electric Indigo):** `#6366F1` (Action buttons, brand glow, category chips).
- **Conversion / Positive Indicator (Emerald Mint):** `#10B981` (Checkout CTAs, verified badges, won deals).
- **Warning / Alert Indicator (Amber/Rose):** `#F59E0B` (High latency warnings), `#F43F5E` (Missing pixels, lost deals).
- **Typography Colors:**
  - Headlines: `#FFFFFF` (Weight: 800/900, `tracking-tight`).
  - Body / Subtext: `#94A3B8` (Slate-400, `leading-relaxed`).
  - Meta / Badges: `#64748B` (Slate-500, uppercase, `tracking-wider`).

### Typography Stack
- **Headings & Navigation:** `Plus Jakarta Sans`, sans-serif (`font-sans`).
- **Data Tables, Latency & Technical Readouts:** `JetBrains Mono`, monospace (`font-mono`).
- **Brand Wordmark:** `Space Grotesk`, sans-serif (`font-display`).

### Anti-Pattern Directives (Strict "No AI Clichés")
- ❌ **No generic purple gradient soup:** Replaced with crisp, purposeful cyan/slate micro-strokes and deep midnight backgrounds.
- ❌ **No fake analytics or fabricated counters:** Every number must represent actual audited records, verified latency, or genuine database counts.
- ❌ **No excessive floating cards or useless animations:** Animations must be subtle, tactile (`active:scale-[0.98]`, `transition duration-200`), and performance-optimized.

---

## 5. PUBLIC WEBSITE STRUCTURE (10 HOMEPAGE SECTIONS)

The public homepage (`public/index.html`) is structured into 10 high-converting, content-rich sections:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. Sticky Navigation Bar & Announcement Pill (Logo, Links, Portal, CTA)      │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. High-Impact Hero Section (Punchy Value Prop, Proof Badges, Dual CTA)      │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. Product Interface Preview (Live interactive viewport of Workspace)        │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. Business Intelligence Capabilities (Bento Grid: Speed, Pixels, Tech Stack)│
├──────────────────────────────────────────────────────────────────────────────┤
│ 5. How ApexIntel Works (3-Step Diagram: Crawl/Audit -> Score -> Pitch)       │
├──────────────────────────────────────────────────────────────────────────────┤
│ 6. Featured Intelligence Datasets (Texas, Florida, California, HVAC Packs)   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 7. Industry Solutions (Agencies, Web Devs, B2B Sales, Lead Gen, Consultants) │
├──────────────────────────────────────────────────────────────────────────────┤
│ 8. Interactive ROI & Pipeline Calculator (Mathematical Value Transparency)   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 9. Data Methodology & Trust Framework (Verified vs Publicly Listed vs Inferred)│
├──────────────────────────────────────────────────────────────────────────────┤
│ 10. Final Conversion CTA, FAQ Accordion & Legal Footer                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. CUSTOMER DASHBOARD ARCHITECTURE (10 WORKSPACE TABS)

The customer dashboard (`#customerDashboard`) integrates 10 functional modules:

1. **Overview:**
   - Metric cards: Total Saved Prospects, New Discoveries, High-Opportunity Leads (Score > 85), Active Custom Requests.
   - Quick Actions: "Audit a Website", "Explore Datasets", "New Custom Request".
   - Sales Pipeline Summary widget & Recent Outbound Activity feed.
2. **Discover:**
   - Live searchable and filterable database of business records.
   - Filters: Territory (TX, FL, CA, IL), Industry (Roofing, Solar, MedSpa, HVAC), Mobile Speed (<800ms vs >1200ms), Meta Pixel (Active vs Missing), Google Ads (Active vs Inactive).
   - Instant "Add to CRM" and "Quick Audit" actions.
3. **My Leads:**
   - Saved prospect repository with custom tags, contact notes, and direct email copy.
4. **Intelligence (Audit Lab):**
   - Full domain scanner interface: DNS resolution, TLS handshake, TTFB latency measurement, CMS detection, retargeting pixel diagnostics, and instant sales pitch generation.
5. **Datasets:**
   - Library of purchased dataset packs.
   - One-click S3 presigned XLSX/CSV download triggers with expiration countdown.
   - Catalog view for acquiring additional specialized datasets.
6. **Campaigns:**
   - Outbound campaign organizer with multi-touch follow-up queues and cold pitch template generators.
7. **CRM (Pipeline):**
   - Dual-view (11-Stage Kanban board & Interactive Data Table) with drag-and-drop or dropdown status transitions.
   - Lead Profile Drawer with deal size estimates, notes timeline, and interaction history.
8. **Custom Research:**
   - Interactive custom extraction inquiry form with instant pricing estimation.
   - Status tracker for active requests (`Submitted`, `Reviewing`, `Mining`, `Delivered`).
   - Download link for completed research deliverables.
9. **Billing & Subscriptions:**
   - Active plan details, Stripe customer portal redirect, dataset order receipts, and usage quotas.
10. **Settings:**
    - Profile settings, password rotation, API keys, and notification preferences.

---

## 7. PRODUCT INTEGRITY & DATA TRANSPARENCY SPECIFICATION

To guarantee trust and long-term brand equity, all data presented in the catalog and workspace must carry clear metadata labels:

| Label | Definition | Example in ApexIntel |
|---|---|---|
| **Verified** | Confirmed by direct technical handshake or verified response. | TLS certificate valid, DNS MX server responds, HTTP 200 returned. |
| **Publicly Listed** | Collected from official public filings, business websites, or public registries. | Business legal name, office telephone, physical address, published email. |
| **Inferred / Observed** | Derived by deterministic static analysis of public assets. | Missing Meta pixel (tag absent in DOM), Tech stack (WordPress/Shopify signatures). |
| **Estimated** | Statistically computed based on empirical models. | Mobile latency percentile, Estimated pipeline ROI, Opportunity Score (0–100). |
| **Unavailable** | Data point could not be verified or is not public. | Explicit `N/A` or null badge; never placeholder or fabricated names/numbers. |

---

## 8. PHASED IMPLEMENTATION ROADMAP

- [x] **Priority 1: Codebase & Architecture Inspection** (Completed — verified all 6 engines pass 180 tests).
- [x] **Priority 2: Product Positioning & 3-Product Catalog Specification** (Completed — documented in Blueprint V1).
- [x] **Priority 3: Brand & Visual Design System Definition** (Completed — established design tokens & anti-pattern rules).
- [ ] **Priority 4: Public Homepage Modernization** (Refactor `public/index.html` to render the clean 10-section layout).
- [ ] **Priority 5: Dataset Catalog & Product Detail Experience** (Ensure dataset modals and cards provide transparent metadata and sample rows).
- [ ] **Priority 6: Checkout & Customer Fulfillment Polish** (Verify Stripe checkout and S3 download flow seamlessly from homepage and dashboard).
- [ ] **Priority 7: Customer Dashboard Navigation & Module Alignment** (Update `public/js/customer-dashboard.js` to support the 10 unified tabs).
- [ ] **Priority 8: Advertised Feature Connectivity** (Ensure every button, filter, and drawer connects to genuine backend endpoints).
- [ ] **Priority 9: End-to-End Customer Purchase Journey Validation** (Run automated browser and API smoke tests covering register -> purchase -> CRM -> export).
- [ ] **Priority 10: Production Readiness & Quality Assurance** (Re-bundle assets, execute `node scripts/run-all-tests.mjs`, and verify zero console errors).
