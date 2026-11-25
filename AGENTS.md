# APEXINTEL — PERMANENT DEVELOPMENT WORKFLOW & AGENT DIRECTIVES

> **Repository:** `https://github.com/Aikun100/apexintel-b2b`  
> **Platform:** ApexIntel B2B Sales Intelligence Platform  
> **Status:** Active Engineering Directives  

---

## 1. Planning Before Implementation

For every complex task, follow this strict 8-step workflow before altering code:

1. **Understand Requested Outcome:** Formulate the precise commercial and technical objective.
2. **Inspect Existing Implementation:** Read existing files, routes, schemas, and tests before writing new logic.
3. **Identify Dependencies & Integrations:** Map all upstream edge proxies (Cloudflare), compute handlers (AWS Lambda), and data persistence layers (DynamoDB / S3).
4. **Identify Regressions & Edge Cases:** Check multi-tenant boundary risks, CSRF requirements, and backwards compatibility.
5. **Define Implementation Approach:** Choose the most direct, least disruptive architecture.
6. **Break Into Verifiable Milestones:** Chunk work into atomic, testable steps.
7. **Define Acceptance Criteria & Tests:** Identify exact test commands and success conditions.
8. **Present the Plan:** Present the plan clearly before making changes.

*For minor or single-line fixes, use a concise, lightweight plan.*

---

## 2. Architecture Awareness & Framework Restraint

ApexIntel operates on a high-efficiency serverless architecture:
- **Frontend:** Modular Vanilla JavaScript (ES6+), Tailwind CSS, Single Page Application (`public/index.html`, `public/js/`). Zero heavy framework dependencies (no React, Next.js, or Vue runtime bloat).
- **Edge Routing:** Cloudflare Workers edge proxy (`src/worker.js`) enforcing edge origin secrets and security headers.
- **Compute Backend:** Node.js 20 ESM AWS Lambda (`aws/lambda-auth-handler.mjs`, `src/auth/`, `src/crm/`, `src/payments/`, `src/requests/`, `src/tools/`).
- **Data Stores:** Amazon DynamoDB (`apexintel_users`, `apexintel_sessions`, `apexintel_leads`, `apexintel_orders`, `apexintel_custom_requests`) and Amazon S3 (`apexintel-datasets-production`).
- **Payments:** Stripe Checkout & Cryptographic Webhooks (`src/payments/`).

**Engineering Rules:**
- Reuse existing working components before introducing new code.
- Avoid duplicate utilities; adhere to project patterns.
- Never introduce a new framework or runtime library without explicit justification and approval.
- Never assume a feature works without verifying it against real code or tests.

---

## 3. Implementation Strategy

Work in structured, sequential milestones:
1. Explain the intended changes.
2. Implement only within the agreed milestone scope.
3. Run relevant automated test suites (`scripts/run-all-tests.mjs`).
4. Inspect the resulting git diff to eliminate unintentional changes or formatting noise.
5. Address any discovered regressions immediately.
6. Report exactly what was completed.
7. Avoid rewriting entire files when targeted, surgical edits are sufficient.

---

## 4. Specialist Review & Subagent Delegation

When available and advantageous, delegate review tasks to specialist subagents:
- **Architect Specialist:** Evaluates architectural integrity, data flows, and cross-system compatibility.
- **Frontend Specialist:** Audits UI, UX, responsive layouts, accessibility (WCAG AA), and CSS tokens.
- **Backend Specialist:** Verifies API contracts, multi-tenant DynamoDB isolation, CSRF/origin enforcement, and cryptographic signatures.
- **QA Specialist:** Verifies test coverage, failure modes, and edge cases.

*Rules:*
- Subagents must not make uncoordinated modifications to the same files simultaneously.
- The primary agent coordinates, validates, and remains accountable for all merged output.

---

## 5. Product-First Development & Genuine Intelligence

ApexIntel is a commercial B2B Sales Intelligence Platform built to help businesses discover, evaluate, and approach high-value sales prospects.

- **Product Over Infrastructure:** Do not allow infrastructure tasks to displace user-facing product delivery.
- **Genuine Intelligence Only:** Never display mock data, fabricated latency figures, or simulated scanner outputs as real capabilities.
- **3-Product Catalog Focus:**
  - **Product A (Datasets):** High-integrity business intelligence collections (Texas, Florida, California, HVAC) with verifiable provenance.
  - **Product B (Intelligence Workspace):** 10-tab customer portal with CRM, opportunity scoring, and lead discovery.
  - **Product C (Custom Research):** On-demand bespoke mining with clear lifecycle stages (`Submitted` -> `Reviewing` -> `Mining` -> `Delivered`).
- **Data Provenance Standards:** Enforce the 5-tier taxonomy: `Verified`, `Publicly Listed`, `Inferred`, `Estimated`, `Unavailable`.

---

## 6. Design Quality & Visual Polish

When modifying user-facing pages, adhere strictly to `.agents/rules/web-design-system.md` and `docs/UI_UX_DESIGN_SYSTEM_BLUEPRINT.md`:
- **Visual Hierarchy:** Establish clear typographic scale before writing markup.
- **Dark Obsidian Canvas:** Standard dark theme canvas (`#070B14`, `#0B0F19`), translucent glass cards (`bg-slate-900/75 border-white/[0.08]`), and ambient lighting.
- **Typography:** Google Fonts `Plus Jakarta Sans` / `Inter` for interface copy, `JetBrains Mono` for stats and code.
- **Bento Grids:** Use asymmetric Bento grids over repetitive symmetric cards.
- **Micro-Interactions:** Purposeful transitions (`duration-200`) and active click feedback.
- **No Generic Placeholders:** Zero "Lorem Ipsum" or generic placeholder text. Use authentic, high-converting B2B intelligence copy.

---

## 7. Verification & Reporting

Completion is determined by verification, not file modification:
- Clearly distinguish between **Implemented**, **Locally Tested**, **Integration Tested**, and **Production Verified**.
- Run automated suites (`scripts/run-all-tests.mjs`, `scripts/verify-auth-lambda-package.mjs`).
- Test edge cases (unauthenticated requests, cross-tenant leaks, rate limits).
- Report technical limitations, trade-offs, and open questions transparently.

---

## 8. Explicit Approval Boundaries

The following operations are **strictly gated** and require explicit user approval before execution:
1. Deploying to AWS Lambda, Cloudflare Workers, or production domains.
2. Modifying production IAM policies, roles, or cloud credentials.
3. Provisioning, scaling, or deleting cloud resources (DynamoDB tables, S3 buckets, EventBridge rules).
4. Modifying live Stripe payment keys, prices, or webhook configurations.
5. Performing destructive file, database, or git repository operations (`git reset --hard`, `git push --force`).

---

## 9. Final Response Format

Every completed engineering task must conclude with a structured report following this format:

1. **Objective:** Summary of the user request and commercial goal.
2. **Implementation Summary:** Concise technical description of changes made.
3. **Files Changed:** Clickable file links with line references.
4. **Tests Executed & Results:** Test suite names, test counts, durations, and pass/fail statuses.
5. **Remaining Issues / Technical Debt:** Any discovered limitations or edge cases.
6. **Acceptance Criteria Status:** Explicit confirmation of each criterion.
7. **Recommended Next Task:** Logical next engineering step.
