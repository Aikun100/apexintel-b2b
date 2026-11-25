# APEXINTEL — COMPLETE 20-STEP CUSTOMER JOURNEY (PHASE 0)

This document establishes the commercial and technical customer journey for all three ApexIntel product lines:
- **Product A:** Pre-Audited Intelligence Datasets
- **Product B:** Intelligence Workspace & Prospect CRM
- **Product C:** Bespoke Custom Intelligence Mining

---

## End-to-End Workflow Stages

### Stage 1: Public Discovery & Value Realization
1. **Homepage Arrival:** Visitor lands on `https://apexintel-b2b.shop/` (or local dev environment). The dark obsidian canvas, dual CTAs, and authentic intelligence visual establish immediate B2B sales positioning.
2. **Product Understanding:** Visitor scrolls through the 5-step methodology ("Discover &rarr; Audit &rarr; Score &rarr; Pipeline &rarr; Convert") and evaluates the problem statement (generic contact lists vs. evidence-backed sales intelligence).
3. **Interactive Tools Suite:** Visitor tests the live Mobile Speed Scanner or DNS MX Ping Verifier on their target domain to experience authentic diagnostic capabilities.
4. **Dataset Catalog Exploration:** Visitor navigates to `#catalog`, filters by territory (Texas, Florida, California, HVAC), inspects sample fields, verified lead counts, and mobile latency metrics.
5. **Detailed Dataset Preview:** Visitor clicks "Inspect Sample Data" on Texas Contractors ($79), opening the preview modal displaying authenticated business records and 5-tier data provenance labels.

### Stage 2: Account Onboarding & Authentication
6. **Account Registration:** Customer clicks "Create Account" (+50 free credits) or "Sign In" in the header. The auth modal opens with clear validation requirements.
7. **Secure Credential Intake:** Customer enters work email, 12+ char password, company name, and target niche. Scrypt password hashing is performed server-side with zero plaintext storage.
8. **Session Establishment:** Server issues a cryptographically secure, HttpOnly, SameSite session cookie and stores the hashed token in `apexintel_sessions`.
9. **Navbar State Transition:** The header dynamically updates to display the customer's initial avatar, company name, 50-credit balance meter, and account dropdown.

### Stage 3: Workspace Utilization & Intelligence Mining
10. **Workspace Entry:** Customer enters the 10-tab authenticated workspace (`customer-dashboard.js`).
11. **Prospect CRM Pipeline:** Customer navigates to "Prospect CRM & Pipeline", viewing pre-loaded target contractors categorized across `New`, `Researching`, `Contacted`, `Qualified`, and `Won`.
12. **Lead Opportunity Drawer:** Customer clicks a contractor row, opening the lead intelligence drawer with mobile latency (ms), missing pixel diagnostics, and direct mail contact.
13. **Status & Note Updating:** Customer moves a contractor from `New` to `Contacted`, appends outreach notes ("Pitch sent focusing on 4.2s mobile lag"), and saves changes with strict multi-tenant isolation.
14. **Website Audit Lab:** Customer runs an audit on a prospective client's URL to extract CMS stack, server response times, and DNS MX deliverability indicators.

### Stage 4: Dataset Commerce & Secure Fulfillment
15. **Dataset Checkout Initiation:** Customer selects the "Texas High-Ticket Contractors" pack ($79) and clicks "Instant Access".
16. **Stripe Checkout Session:** Server validates authoritative catalog pricing from `src/payments/catalog.js`, creates a pending order in DynamoDB, and provides the Stripe Checkout session.
17. **Payment Confirmation & Webhook:** Customer completes payment. Stripe issues a cryptographic webhook (`checkout.session.completed`) with HMAC-SHA256 signature.
18. **Atomic Fulfillment & Entitlement:** Server verifies webhook signature, session ID, currency, and exact amount match, marking the order as `paid` and creating an account entitlement.
19. **Secure Download Delivery:** Customer accesses "My Datasets & Downloads", requests a download, and receives a time-limited (15-minute) Amazon S3 presigned URL for the raw `.xlsx` / `.csv` artifact.

### Stage 5: Custom Research & Expansion
20. **Bespoke Request Submission:** Customer navigates to "Custom Research Requests", submits exact mining criteria (e.g., "50 commercial roofing contractors in Orlando with >3s mobile load times"), and monitors the lifecycle queue (`Submitted` &rarr; `Delivered`) directly in their dashboard.
