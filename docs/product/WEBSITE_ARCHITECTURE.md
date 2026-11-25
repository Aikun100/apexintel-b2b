# ApexIntel B2B — Website & Marketing Architecture
**Document ID:** `SPEC-WEB-2026-V1`  
**Phase:** Phase 3 Public Website Redesign  
**Date:** November 24, 2026  

---

## 1. Public Information Architecture

The ApexIntel public site is engineered as an ultra-fast, single-page application (SPA) with smooth hash navigation, optimized anchor targets, and responsive modal subsystems.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ApexIntel Fixed Header                          │
│  Logo | Intelligence | Datasets | Solutions | Pricing | Methodology    │
│  [ Sign In ]                                            [ Get Started ]│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
 ┌─────────────────────────────────┼──────────────────────────────────┐
 │                                 │                                  │
 ▼                                 ▼                                  ▼
[ 1. Hero Section ]       [ 2. Product Demo ]               [ 3. How It Works ]
- Value Proposition       - Interactive Record Preview      - 5-Stage Lifecycle
- Original Visual Asset   - Live Opportunity Card           - Discover to Convert
 │                                 │                                  │
 ├─────────────────────────────────┼──────────────────────────────────┤
 │                                 │                                  │
 ▼                                 ▼                                  ▼
[ 4. Product Capabilities ] [ 5. Dataset Catalog ]          [ 6. Industry Solutions ]
- 6 Functional Pillars    - 4 Pre-Audited Packs             - 5 B2B Personas
- Discovery to Sales      - Verified Preview & Download     - Turnkey Value Angles
 │                                 │                                  │
 ├─────────────────────────────────┼──────────────────────────────────┤
 │                                 │                                  │
 ▼                                 ▼                                  ▼
[ 7. Pricing Matrix ]     [ 8. Trust & Provenance ]         [ 9. FAQ & Conversion ]
- Product A: Datasets     - 3-Stage Pipeline                - 8 Enterprise FAQs
- Product B: Workspace    - 5-Tier Integrity Taxonomy       - Final Conversion CTA
- Product C: Custom       - S3 Presigned & Ledger           - Footer & Modals
```

---

## 2. Section Specifications

### Section 1: Hero (`#hero`)
- **Primary Headline:** "Find Your Next Business Opportunity."
- **Core Sub-Headline:** "Discover businesses, uncover sales opportunities, and turn business intelligence into your next customer."
- **Dual Direct Actions:** "Explore Intelligence" (scrolls to `#tools-suite`), "View Datasets" (scrolls to `#catalog`).
- **Visual:** [hero-intelligence-visual.svg](file:///c:/laragon/www/browser-agent/public/assets/visuals/hero-intelligence-visual.svg) alongside real-time prospect intelligence card.

### Section 2: Product Demonstration
- Live preview showing actual prospect diagnostics: Time-To-First-Byte (TTFB) latency, missing Meta Pixel flags, Google Ads spending, verified decision-maker names, and actionable sales pitch angles.

### Section 3: How It Works
- 5 Sequential Stages:
  1. **Discover:** Search verified entities in high-ticket trades.
  2. **Analyze:** Inspect live network sockets, TLS certificates, TTFB latency, and ad pixels.
  3. **Qualify:** Calculated 0–100 opportunity score highlighting active conversion leaks.
  4. **Organize:** Save prospects to 11-stage CRM, assign priority tags, and append notes.
  5. **Convert:** Deploy tailored cold emails and LinkedIn messages referencing exact technical gaps.

### Section 4: Product Capabilities
- 6 Core Capabilities:
  1. **Business Discovery:** Multi-state, multi-industry entity exploration.
  2. **Website Intelligence:** Socket-level latency, DNS MX, and TLS auditing.
  3. **Opportunity Analysis:** Quantitative scoring algorithm for client acquisition.
  4. **Lead Management:** Multi-tenant CRM with follow-up scheduling.
  5. **Business Datasets:** Instant delivery with zero-duplicate ledger protection.
  6. **Sales Workspace:** Comprehensive outbound campaign management.

### Section 5: Dataset Showcase (`#catalog`)
- Four flagship datasets:
  - **Texas High-Ticket Contractors:** Commercial roofing, solar, storm restoration ($79.00).
  - **Florida Solar & Restoration:** Commercial solar EPCs and disaster mitigation ($79.00).
  - **California Luxury MedSpas:** Aesthetic surgery and wellness clinics ($89.00).
  - **Commercial HVAC & Mechanical:** Industrial refrigeration and piping ($99.00).
- Instant S3 presigned fulfillment with SHA-256 deduplication allocation.

### Section 6: Industry Solutions (`#solutions`)
- Persona-tailored pitch strategies:
  - **Digital Marketing Agencies:** Meta pixel and retargeting recapture offers.
  - **Web Development Studios:** Guaranteed 350ms TTFB speed overhaul pitches.
  - **B2B Sales Teams:** High-ticket direct decision-maker outbound.
  - **Lead Generation Agencies:** Turnkey pre-audited campaigns with high reply rates.
  - **Business Consultants:** Strategic technology and conversion audits.

### Section 7: Pricing Matrix (`#pricing`)
- **Product A (Datasets):** $79–$149 one-time purchase with instant S3 presigned downloads.
- **Product B (Intelligence Workspace):** $79/month professional subscription with 500 verified leads, 11-stage CRM, and 250 website audits.
- **Product C (Custom Research):** Bespoke extraction starting at $299 with tracked fulfillment.

### Section 8: Trust, Methodology & Provenance (`#methodology`)
- Visual display of the 5-Tier Data Provenance Taxonomy: `Verified`, `Publicly Listed`, `Inferred`, `Estimated`, `Unavailable`.
- Strict guarantee against fabricated data or simulated analytics.
