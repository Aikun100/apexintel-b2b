# ApexIntel B2B — Deployment & Edge Infrastructure Guide
**Document ID:** `DEP-2026-v2.0`  
**Classification:** DevOps & Production Runbook  
**Hosting Provider:** Cloudflare Workers (Static Assets Engine)  
**Edge URL:** `https://apexintel-b2b.shop`  
**Fallback URL:** `https://apexintel-b2b.aaronagbas102.workers.dev`  

---

## 1. Hosting Topology & DNS Configuration

ApexIntel B2B utilizes Cloudflare's globally distributed edge network for sub-30ms global content delivery and zero build-credit consumption.

### DNS Records & Registrar Setup:
- **Registrar:** Hostinger
- **Delegated Nameservers:**
  - `aria.ns.cloudflare.com`
  - `ram.ns.cloudflare.com`
- **Cloudflare DNS Zone:** `apexintel-b2b.shop`
  - Hostinger parked records removed to avoid routing conflicts.
  - Custom domain bindings attached via Cloudflare Workers routing.

---

## 2. Wrangler Configuration (`wrangler.jsonc`)

The root `wrangler.jsonc` defines edge worker configuration:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "apexintel-b2b",
  "main": "public/index.html",
  "compatibility_date": "2024-09-23",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  },
  "routes": [
    { "pattern": "apexintel-b2b.shop/*", "zone_name": "apexintel-b2b.shop" },
    { "pattern": "www.apexintel-b2b.shop/*", "zone_name": "apexintel-b2b.shop" }
  ]
}
```

---

## 3. Build & Deployment Pipeline

### Step 1: Bundle all modules
Execute the automated compiler script that bundles all subsystem JavaScript engines into `public/index.html`:
```powershell
node scripts/bundle-all.js
```

### Step 2: Validate syntax and integrity
Execute synthetic JavaScript compilation checks to verify zero unhandled syntax errors:
```powershell
node scripts/validate-scripts-syntax.js
```

### Step 3: Deploy to Cloudflare Workers Edge
Publish updated assets directly to 300+ global edge points of presence:
```powershell
npx wrangler deploy
```

### Step 4: Verify Live Edge Status
```powershell
node scripts/verify-live-deployment.js
```

---

## 4. Rollback & Disaster Recovery Runbook

1. If an edge deployment displays unexpected styling or behavioral regressions:
   - Git commit history tracks all changes.
   - Run `git checkout HEAD~1 -- public/` to revert assets.
   - Re-run `node scripts/bundle-all.js && npx wrangler deploy`.
2. Cloudflare Instant Purge:
   - Run `npx wrangler pages deployment list` or purge cache via Cloudflare dashboard to clear edge cache in seconds.
