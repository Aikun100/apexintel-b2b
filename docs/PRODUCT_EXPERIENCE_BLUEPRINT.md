# ApexIntel B2B — Product Experience Blueprint

Status: Phase 1 — Product and information architecture
Target branch: feature/apexintel-complete-overhaul
Production protection: Planning document only. Do not merge to main or deploy without explicit approval.

## 1. Product positioning

ApexIntel is a B2B sales intelligence platform for agencies, consultants, and B2B sales teams. It helps customers discover relevant businesses, understand publicly observable digital opportunities, organize prospects, and acquire researched business datasets.

Suggested positioning:
> Find the right businesses. Understand the opportunity. Turn intelligence into growth.

Avoid unsupported promises such as guaranteed inbox placement, guaranteed conversions, universal data exclusivity, or fully autonomous crawling. Explain what each verification step actually establishes.

## 2. Commercial product lines

### A. Business Intelligence Datasets

One-time digital purchases fulfilled through authenticated orders and short-lived S3 download links after verified Stripe payment.

Current server catalog:
- Texas High-Ticket Contractors — $79
- Florida Solar & Restoration — $79
- California Luxury MedSpas — $89
- Commercial HVAC & Mechanical — $99

Each product detail page should show territory and niche coverage, record count and field dictionary, contact-field coverage, redacted sample rows, freshness and provenance notes, known limitations, price, purchase CTA, and delivery explanation.

Do not expose S3 object keys, private URLs, or customer-only files in public markup. The server catalog remains the checkout price authority.

### B. ApexIntel Intelligence Workspace

Preserve the existing ten application areas:
1. Overview
2. Discover
3. My Leads
4. Intelligence
5. Datasets
6. Campaigns
7. CRM
8. Custom Research
9. Billing
10. Settings

Preserve API contracts, authentication, tenant isolation, and role checks. Improve navigation and visual hierarchy without removing working functions.

### C. Custom Intelligence Research

Build a guided request builder explaining scope, volume, optional enrichment, review, and delivery.

Current server-side volume tiers:
- 50–249: $0.65 per record
- 250–499: $0.55 per record
- 500–999: $0.45 per record
- 1,000–2,499: $0.35 per record
- 2,500+: $0.25 per record

Current optional add-ons:
- Website speed / latency audit: +$0.08 per record
- Ad pixel diagnostics: +$0.08 per record
- Direct owner mobile verification: +$0.12 per record

The backend remains the pricing authority. Frontend estimates are provisional until confirmed by the backend. Explain the lifecycle: Submitted → Reviewing → Mining → Delivered, or Cancelled.

## 3. Public website information architecture

Build a multi-page public experience using the existing Vanilla JavaScript, Cloudflare Worker/static-asset setup, and CSS system. Do not introduce a new frontend framework unless a documented technical blocker justifies it.

Proposed pages:
- / — focused homepage and product overview
- /datasets/ — dataset catalog
- /datasets/<slug>/ — individual dataset detail pages
- /custom-research/ — custom research explanation and request entry
- /platform/ — Intelligence Workspace features and real product previews
- /methodology/ — provenance, verification definitions, and limitations
- /resources/ — educational content and playbooks
- /about/ — product story and support information
- /pricing/ — product and service pricing
- /login/ and /register/ — authentication entry points reusing current auth behavior

Choose static pages or a small compatible client-side router only after inspecting Worker asset routing and build scripts. Keep the existing root entry working during migration.

## 4. Homepage structure

1. Clear hero: who ApexIntel serves, what it helps them do, and one primary CTA.
2. Product preview: an accurate visual of the Intelligence Workspace.
3. Three product lines: datasets, workspace, custom research.
4. Featured datasets using current catalog values.
5. How it works: discover/review → purchase or request → secure delivery/use in workspace.
6. Verification and provenance explanation, including limitations.
7. Use cases for agencies, consultants, and B2B sales teams.
8. FAQ, support, and final CTA.

Avoid generic claims, invented testimonials, fake customer logos, fabricated usage statistics, or fake live activity indicators.

## 5. Visual direction

Retain the established dark obsidian foundation and semantic tokens in public/css/apex-tokens.css, but refine the visual system:
- Dark navy/obsidian canvas with restrained cyan/indigo accents and emerald for successful/verified states.
- Strong typography and clear spacing; reduce excessive gradients, glows, and glass panels.
- High-quality product imagery and real interface previews, not generic stock imagery as a substitute for the product.
- Consistent cards, buttons, forms, tables, badges, navigation, and responsive states.
- Subtle motion only where it improves comprehension; respect prefers-reduced-motion.
- Mobile-first responsive behavior and visible keyboard focus states.

## 6. Product delivery and trust communication

Explain the actual purchase lifecycle:
1. Customer signs in.
2. Customer selects a dataset and starts Stripe Checkout.
3. Stripe webhook verifies payment and records fulfillment idempotently.
4. Customer sees the order in the workspace.
5. Authorized customer requests a short-lived download link.
6. Backend checks ownership and paid status before signing the private S3 object URL.

Do not imply files are emailed automatically unless implementation proves that. Do not reveal private bucket names or signed URLs before authorization.

## 7. Non-negotiable preservation rules

- Work only on feature/apexintel-complete-overhaul.
- Never commit directly to main, force-push, or deploy production during redesign.
- Inspect source and tests before changing behavior.
- Preserve Vanilla JS + Cloudflare Worker + AWS Lambda + DynamoDB + S3 + Stripe architecture.
- Preserve authentication/session/CSRF behavior, tenant ownership checks, payment verification, webhook idempotency, and private download authorization.
- Keep backend product catalog and custom research pricing authoritative.
- Do not remove, stub, or visually fake existing application functions.
- Do not invent backend capabilities, data coverage, customer claims, or verification guarantees.
- Reuse existing components and styles where appropriate; avoid competing duplicate implementations.
- Rebuild generated bundles using documented scripts where required.
- Add or update tests for changed behavior and run full documented test and syntax-validation commands.
- Review diffs for secrets, environment values, production configuration changes, and unrelated churn.

## 8. Acceptance criteria

- Public pages have coherent navigation and distinct page purposes.
- Product prices and metadata match the server catalog.
- Dataset pages disclose actual coverage and limitations.
- Checkout and download flows use existing authenticated backend endpoints.
- Login/register and workspace entry continue to work.
- All ten workspace areas remain reachable and functional.
- Custom research estimates are provisional until backend confirmation.
- Layouts work on mobile, tablet, and desktop.
- Keyboard navigation, focus states, and reduced-motion behavior are preserved.
- Existing tests pass; new tests cover changed routing and interactions.
- No production deployment or merge to main occurs without explicit approval.

## 9. Implementation sequence

1. Inspect route handling, Worker asset routing, build scripts, and current public-page sections.
2. Map DOM IDs, global functions, and script dependencies that must remain compatible.
3. Implement shared public shell: header, footer, navigation, and design tokens.
4. Build homepage and dataset catalog/detail pages from authoritative catalog data.
5. Build custom research and methodology pages.
6. Connect login/register and workspace entry without replacing existing auth.
7. Refine platform presentation and existing workspace UI without breaking workflows.
8. Add responsive polish, real product visuals, accessibility, and motion.
9. Run full tests, syntax validation, bundle verification, and route smoke tests.
10. Report changed files, test evidence, known limitations, and production steps requiring approval.
