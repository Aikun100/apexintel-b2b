# ApexIntel B2B — Database & Storage Schema Specification
**Document ID:** `DB-2026-v2.0`  
**Classification:** Data Modeling & Schema Design  
**Storage Engines:** Amazon DynamoDB (Cloud) & Relational LocalStorage / IndexedDB (Client)  

---

## 1. Amazon DynamoDB Schema

### 1.1 Primary Table: `leads_cache`
- **Table Name:** `leads_cache`
- **Billing Mode:** PAY_PER_REQUEST (On-Demand)
- **Partition Key (`PK`):** `id` (String - Canonical Domain Name, e.g. `dallasroofer.com`)
- **Global Secondary Index 1 (`GSI_Territory`):**
  - Partition Key: `territory` (String)
  - Sort Key: `opportunity_score` (Number - Descending)
- **Global Secondary Index 2 (`GSI_Created`):**
  - Partition Key: `trade` (String)
  - Sort Key: `created_at` (String - ISO 8601)

#### Document Attribute Definition:
```json
{
  "id": "dallasroofer.com",
  "company_name": "T Rock Roofing & Restoration",
  "trade": "Roofing & Storm Restoration",
  "territory": "texas",
  "city": "Dallas-Fort Worth, TX",
  "state": "TX",
  "email": "info@dallasroofer.com",
  "phone": "+1 469 931 9867",
  "address": "123 Commerce St, Dallas, TX 75201",
  "speed_ms": 1473,
  "cms": "WordPress / Apache",
  "meta_pixel": false,
  "google_ads": true,
  "mx_verified": true,
  "opportunity_score": 92,
  "priority": "P1",
  "delivered_to": [
    "alex@velocitygrowth.io",
    "marcus@leadcraft.agency"
  ],
  "created_at": "2026-11-20T10:15:00.000Z",
  "last_crawled_at": "2026-11-22T00:00:00.000Z"
}
```

---

## 2. Client-Side Relational LocalStorage Schema

The client workspace maintains structured relational collections inside the browser:

### 2.1 Collection: `apexintel_crm_leads`
Array of prospect lead records managed in the CRM workspace.

```typescript
interface CrmLead {
  id: string;               // e.g. "crm_lead_1732274400_abc"
  company: string;          // e.g. "T Rock Roofing & Restoration"
  domain: string;           // e.g. "dallasroofer.com"
  contactName?: string;     // e.g. "Operations Manager"
  email: string;            // e.g. "info@dallasroofer.com"
  phone: string;            // e.g. "+1 469 931 9867"
  city: string;             // e.g. "Dallas, TX"
  territory: string;        // e.g. "texas"
  industry: string;         // e.g. "Roofing"
  status: PipelineStatus;   // One of 11 pipeline statuses
  priority: 'P1' | 'P2' | 'P3';
  opportunityScore: number; // 0 - 100
  speed_ms: number;
  metaPixel: boolean;
  googleAds: boolean;
  campaignId?: string;      // Foreign key to apexintel_crm_campaigns
  tags: string[];           // e.g. ["urgent", "call-first", "solar"]
  notes: LeadNote[];        // Journal of timestamps and notes
  followUpDate?: string;    // YYYY-MM-DD
  savedAt: string;          // ISO 8601
  updatedAt: string;        // ISO 8601
}

type PipelineStatus = 
  | 'New'
  | 'Qualified'
  | 'Ready to Contact'
  | 'Contacted'
  | 'Follow-Up'
  | 'Responded'
  | 'Meeting Scheduled'
  | 'Proposal'
  | 'Won'
  | 'Lost'
  | 'Not Qualified';

interface LeadNote {
  id: string;
  timestamp: string;
  author: string;
  text: string;
}
```

### 2.2 Collection: `apexintel_crm_campaigns`
```typescript
interface CrmCampaign {
  id: string;               // e.g. "camp_tx_outbound_q4"
  title: string;            // e.g. "Texas Q4 High-Ticket Roofers"
  territory: string;        // e.g. "Texas"
  targetCount: number;      // e.g. 50
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
  createdAt: string;        // ISO 8601
}
```

### 2.3 Collection: `apexintel_audit_scans`
```typescript
interface AuditScanRecord {
  id: string;
  domain: string;
  scannedAt: string;
  speed_ms: number;
  cms: string;
  metaPixel: boolean;
  googleAds: boolean;
  mxVerified: boolean;
  icpScore: number;
  pitch: string;
}
```

### 2.4 Collection: `apexintel_custom_requests`
```typescript
interface CustomRequestRecord {
  id: string;               // e.g. "REQ-2026-8910"
  customerEmail: string;
  industry: string;
  territory: string;
  volume: number;
  budget: number;
  techFilters: string;
  notes: string;
  status: 'Draft' | 'Submitted' | 'Reviewing' | 'Mining' | 'Delivered';
  submittedAt: string;
  deliverableUrl?: string;  // Downloadable CSV link once delivered
}
```
