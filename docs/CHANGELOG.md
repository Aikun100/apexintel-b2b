# ApexIntel B2B — Product Changelog & Release History
**Document ID:** `CHANGELOG-2026`  
**Repository:** `browser-agent / apexintel-b2b`  

---

## [v2.0.0] - 2026-11-22 (Current Master Release)
### Added
- **Prospect CRM & Pipeline Workspace (`customer-dashboard.js`):**
  - Interactive 11-stage pipeline (`New`, `Qualified`, `Ready to Contact`, `Contacted`, `Follow-Up`, `Responded`, `Meeting Scheduled`, `Proposal`, `Won`, `Lost`, `Not Qualified`).
  - Dual view toggle: Interactive Data Table and Visual Kanban Board.
  - "Save to CRM" quick-action on live dataset preview rows.
  - Lead Profile Drawer with contact details, speed latency, pixel status, notes journal, tag manager, and follow-up scheduler.
- **Campaign Management & Follow-up Queue:**
  - Campaign creator and real progress tracker.
  - Actionable Follow-up Reminders queue with overdue flagging, mark complete, and 48-hour snooze.
  - Direct integration between CRM lead cards and Cold Outreach Generator.
- **Website Audit Lab:**
  - Historical domain scan archive with latency diagnostics and pixel audit.
  - Exportable formatted client audit report.
- **Custom Data Extraction Lifecycle:**
  - Customer workspace request tracker (`Submitted` $\to$ `Delivered`).
  - Admin Command Center fulfillment manager.
- **Comprehensive Documentation Suite (`/docs`):**
  - `PROJECT_AUDIT.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `AWS_ARCHITECTURE.md`, `AWS_COST_ESTIMATE.md`, `SECURITY.md`, `DATA_PIPELINE.md`, `API_DOCUMENTATION.md`, `DATABASE_SCHEMA.md`, `DEPLOYMENT.md`, `TESTING.md`, `CHANGELOG.md`.

---

## [v1.5.0] - 2026-11-21
### Added
- Cloudflare Workers static asset hosting at `https://apexintel-b2b.shop`.
- Automated script compiler (`scripts/bundle-all.js`) to eliminate privacy extension script blocking.
- Credit/Debit Card input auto-formatter with real-time brand detection (VISA, Mastercard, AMEX, Discover).
- Dedicated product modals, comparison matrix, and 4 outbound playbooks.
- Strict PayPal merchant gateway routing with order confirmation gate.

---

## [v1.0.0] - 2026-11-20
### Initial Release
- Texas, Florida, MedSpa, and HVAC B2B intelligence datasets.
- Interactive website scanner and ROI calculator.
- Client download generation engine.
