# ApexIntel B2B — Authoritative Commercial Product Catalog

ApexIntel organizes its commercial platform around three products grounded in `src/payments/catalog.js`, `src/requests/service.js`, and the Customer Intelligence Workspace (`public/js/customer-dashboard.js`).

---

## 1. Product A: Business Intelligence Datasets (One-Time Acquisition)

Pre-audited B2B data collections stored privately in Amazon S3 (`apexintel-datasets-production`) and delivered via 15-minute presigned URLs after verified Stripe payment (`src/payments/service.js`).

| Key | Title | Territory | Niche Focus | Verified Rows (`.xlsx`) | Price (USD) | S3 Object Key |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| `texas` | **Texas High-Ticket Contractors** | Austin, Dallas-Fort Worth, Houston, San Antonio | Commercial Roofing & Storm Restoration | 24 | **$79.00** | `datasets/Texas_HighTicket_Contractors_Enriched_Audited.xlsx` |
| `florida` | **Florida Solar & Restoration** | Miami, Tampa Bay, Orlando | Commercial Solar & Hurricane Mitigation | 8 | **$79.00** | `datasets/Florida_HighTicket_Solar_Restoration_Enriched.xlsx` |
| `medspas` | **California Luxury MedSpas** | Beverly Hills, San Francisco, San Diego | Aesthetic Dermatology & Injectable Clinics | 9 | **$89.00** | `datasets/California_Luxury_MedSpas_Enriched_Audited.xlsx` |
| `hvac` | **Commercial HVAC & Mechanical** | Chicago, Dallas-Fort Worth, Atlanta | Industrial Chillers & Mechanical Piping | 12 | **$99.00** | `datasets/Commercial_HVAC_Mechanical_Enriched_Audited.xlsx` |

*Standard 11 spreadsheet columns:* `Company Name`, `Category/Niche`, `City`, `State/Region`, `Primary Phone`, `Verified Email`, `Website`, `Tech Stack`, `SEO/Site Issues`, `Growth Opportunities`, `LinkedIn`.

---

## 2. Product B: ApexIntel Intelligence Workspace (Early Access)

Integrated 10-tab customer portal (`public/js/customer-dashboard.js`):
1. **Overview** — Pipeline breakdown, saved leads count, recent activity.
2. **Discover** — Business search and opportunity filtering (`/api/discovery/search`).
3. **My Leads** — Saved prospect table with pipeline filter and quick add.
4. **Intelligence** — Live website scanner & audit history (`/api/tools/scan-website`).
5. **Datasets** — Purchased dataset access and S3 presigned downloads (`/api/downloads/signed-url`).
6. **Campaigns** — Outreach campaigns and follow-up queue.
7. **CRM** — 11-stage pipeline (Table + Kanban views), notes, tags, priority tiers (`P1`–`P3`).
8. **Custom Research** — Bespoke extraction request submission and status tracking (`/api/requests/custom`).
9. **Billing** — Order history and receipts (`/api/orders`).
10. **Settings** — Account profile, plan badge, and API credentials.

*Data Provenance Taxonomy:* `Verified`, `Publicly Listed`, `Inferred`, `Estimated`, `Unavailable`.

---

## 3. Product C: Custom Intelligence Research (On-Demand)

Authoritative server-side pricing in `src/requests/service.js` (`RequestsService.calculatePrice`):

- **Allowed Volume Range:** `50` to `50,000` records.
- **Volume-Tiered Base Rate:**
  - `50 – 249` records: **$0.65 / record**
  - `250 – 499` records: **$0.55 / record**
  - `500 – 999` records: **$0.45 / record**
  - `1,000 – 2,499` records: **$0.35 / record**
  - `2,500+` records: **$0.25 / record**
- **Optional Enrichment Addons:**
  - Website Speed / Latency Audit: **+$0.08 / record**
  - Ad Pixel Diagnostics: **+$0.08 / record**
  - Direct Owner Mobile Verification: **+$0.12 / record**
- **Lifecycle Stages (`ALLOWED_STATUSES`):** `Submitted` -> `Reviewing` -> `Mining` -> `Delivered` (or `Cancelled`).
