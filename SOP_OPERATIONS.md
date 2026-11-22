# Standard Operating Procedure (SOP): Autonomous B2B Intelligence Engine

## 1. Workflow Architecture
```
[ Input Targets / Seeds ]
          │
          ▼
 [ 1. Site Crawler ] ───▶ Scrapes /contact, /about, /team, mailto, tel, socials
          │
          ▼
[ 2. Validator Engine ] ─▶ Tests DNS MX records & formats international phone numbers
          │
          ▼
 [ 3. Site Auditor ] ───▶ Tests SSL, mobile meta, response speed, CMS & Pixel tags
          │
          ▼
 [ 4. Excel Formatter ] ─▶ Generates styled, client-ready .xlsx spreadsheet
```

---

## 2. Running an Autonomous Pipeline

### Programmatic Usage
```javascript
import { enrichAndAuditBusiness, exportToExcel } from './toolbelt/index.js';

const leads = [
  { name: 'Example Roofing Co', website: 'https://example.com', city: 'Austin', state: 'TX' }
];

const enriched = await Promise.all(leads.map(lead => enrichAndAuditBusiness(lead)));
await exportToExcel(enriched, './output/Austin_Roofers_Enriched.xlsx');
```

---

## 3. Quality Assurance Standards
1. **Email Deliverability:** Every email is validated using DNS MX resolution. Never deliver dead addresses.
2. **Actionable Insights:** Every lead includes detected site issues and growth opportunities to empower immediate pitch angles.
3. **Data Polish:** All output files use frozen headers, professional styling, and proper column widths.
