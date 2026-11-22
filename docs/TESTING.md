# ApexIntel B2B — Quality Assurance & Testing Runbook
**Document ID:** `QA-2026-v2.0`  
**Classification:** Quality Assurance & Testing Runbook  
**Target Environments:** Local (`http://localhost:3000`) & Production (`https://apexintel-b2b.shop`)  

---

## 1. Testing Strategy Overview

The testing regimen for ApexIntel B2B spans:
1. **Static Syntax & AST Validation:** Verification that all JavaScript files parse with zero errors.
2. **Automated Assertion Suite:** Automated HTTP status, DOM elements, and modal functionality checks.
3. **End-to-End User Journeys:** Step-by-step verification of core conversion and workflow paths.

---

## 2. Automated Test Commands

### 2.1 Syntax Validation
```powershell
node scripts/validate-scripts-syntax.js
```
*Expected Result:* All modules (`auth.js`, `customer-dashboard.js`, `admin-dashboard.js`, `payment-engine.js`, `tools-suite.js`, `modals-and-knowledge.js`) pass Node.js AST compilation with 0 errors.

### 2.2 Live Edge Verification
```powershell
node scripts/verify-live-deployment.js
```
*Expected Result:* `https://apexintel-b2b.shop` returns HTTP 200 OK with SSL active and essential DOM elements detected.

---

## 3. Manual QA Checklist

### A. Discovery & Lead Catalog
- [ ] Open homepage at `https://apexintel-b2b.shop`.
- [ ] In the Live Data Table, type "Dallas" in the search box; table instantly filters to Dallas contractors.
- [ ] Switch between tabs: Texas, Florida, MedSpas, HVAC. Table updates with correct territory records.
- [ ] Click "Save to CRM" on any lead; verify toast confirms lead is added to active CRM.

### B. Diagnostic Tools Suite
- [ ] **Website Scanner:** Enter `precisionroof.com` and click "Run Diagnostic Scan". Verify 5-step progress animation finishes and renders 4 diagnostic cards with copyable outreach pitch.
- [ ] **ROI Calculator:** Switch presets between Conservative (1.5%), Moderate (3.5%), and Aggressive (6%). Verify Projected Revenue and ROI Multiple update dynamically.
- [ ] **Cold Outreach Generator:** Click "Generate Multi-Channel Copy". Switch between Direct, Consultative, and LinkedIn tabs. Click "Copy to Clipboard"; verify button shows "Copied! ✓".
- [ ] **ICP Scorer:** Toggle "Has Google Ads" and "Missing Retargeting Pixel". Verify score shifts dynamically and displays correct Priority Badge (P1/P2/P3).
- [ ] **Custom Request Builder:** Slide target leads to 250. Verify Estimated Budget recalculates. Click "Submit Extraction Spec"; verify request is logged in Customer Workspace.

### C. Client Workspace & Prospect CRM
- [ ] Click "Customer Workspace" or "Login" in top navigation.
- [ ] Switch to **CRM & Pipeline** tab.
- [ ] Toggle between **Table View** and **Kanban Board View**.
- [ ] On Kanban board, click or change status on a lead card; verify card moves to new column.
- [ ] Click on a lead to open the **Lead Profile Drawer**; add a note, change priority to P1, select follow-up date, and save.
- [ ] Click "Generate Outreach" from inside drawer; verify Outreach Generator opens pre-filled with this lead's company and domain.
- [ ] Switch to **Campaigns** tab; create a new campaign and verify real metrics counter updates.
- [ ] Switch to **Audit Lab** tab; verify past scanner audits are listed and can be exported.

### D. Monetization & Checkout
- [ ] Click "Buy Pack" ($79.00) on Texas Contractors.
- [ ] Verify Checkout Modal opens showing $79.00.
- [ ] Click "Credit / Debit Card" tab; enter card number `4111 2222 3333 4444`. Verify VISA badge appears and number formats with spaces.
- [ ] Click "Proceed to Secure PayPal Checkout"; verify redirect opens PayPal merchant portal with correct amount.

### E. Owner / Admin Command Center
- [ ] Click "Admin Portal" or open via session toggle.
- [ ] Verify Gross Revenue, Unique Buyers, and AWS Cloud Cost display accurate operational metrics.
- [ ] Check AWS Fleet Monitor card (Lambda status, DynamoDB status, EventBridge cron status).
- [ ] Switch to Custom Requests tab; verify pending customer extraction specs appear with status change controls.
