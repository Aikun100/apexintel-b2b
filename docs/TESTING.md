# ApexIntel B2B — Quality Assurance & Testing Runbook

---

## 1. Automated Test Commands

### Full Backend & E2E Test Suite (`scripts/run-all-tests.mjs`)
Runs 7 modular suites using Node's native test runner (`node --test`) with `USE_MOCK_STORAGE=true`:

```powershell
node scripts/run-all-tests.mjs
```

| Suite | Script | Tests |
| :--- | :--- | :---: |
| Authentication & Session Lifecycle | `scripts/run-auth-tests.mjs` | 60 |
| Multi-Tenant CRM Backend | `scripts/run-crm-tests.mjs` | 24 |
| Stripe Payments & S3 Fulfillment | `scripts/run-payment-tests.mjs` | 30 |
| Discovery API & Crawler Ingestion | `scripts/run-discovery-tests.mjs` | 15 |
| Website Intelligence Scanner & SSRF | `scripts/run-scanner-tests.mjs` | 37 |
| Custom Extraction Requests & Queue | `scripts/run-requests-tests.mjs` | 17 |
| End-to-End Customer Purchase Journey | `scripts/run-e2e-tests.mjs` | 9 |
| **Total** | | **192** |

### Auth Lambda Deployment Package Verifier (`scripts/verify-auth-lambda-package.mjs`)
Verifies archive integrity, required runtime files, exclusion of secrets/docs/devDependencies, ESM handler exports, and local smoke invocations (**46 checks**):

```powershell
node scripts/verify-auth-lambda-package.mjs
```

### Frontend Syntax Validation (`scripts/validate-scripts-syntax.js`)
Validates AST syntax across frontend modules:

```powershell
node scripts/validate-scripts-syntax.js
```

---

## 2. Manual & Browser QA Checklist

1. **Public Landing & Catalog:** Verify `http://localhost:3000` loads with zero console errors, dataset preview search/tabs work (`#tableFilterInput`), and Product Detail / Comparison modals open cleanly.
2. **Authentication:** Sign In / Create Account modal opens, login/logout transitions navbar and closes `#customerDashboard`.
3. **10-Tab Customer Workspace:** Verify all 10 tabs (`overview`, `discover`, `myleads`, `intelligence`, `datasets`, `campaigns`, `crm`, `customreq`, `billing`, `settings`) switch cleanly and sync with backend endpoints when authenticated.
4. **Checkout & Custom Research:** Verify dataset checkout opens `/api/orders/checkout` and Custom Research pricing matches `src/requests/service.js`.
