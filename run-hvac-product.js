import { enrichAndAuditBusiness, exportToExcel } from './toolbelt/index.js';
import path from 'node:path';
import fs from 'node:fs';

const HVAC_TARGETS = [
  // Chicago
  { name: 'Amber Mechanical', website: 'https://ambermech.com', category: 'Commercial HVAC & Piping', city: 'Chicago', state: 'IL' },
  { name: 'Air Comfort', website: 'https://aircomfort.com', category: 'Industrial Mechanical Systems', city: 'Chicago', state: 'IL' },
  { name: 'Midwest Mechanical', website: 'https://midwestmech.com', category: 'Energy Solutions & Commercial HVAC', city: 'Chicago', state: 'IL' },
  { name: 'Hayes Mechanical', website: 'https://hayesmechanical.com', category: 'Boiler & Mechanical Piping', city: 'Chicago', state: 'IL' },

  // Dallas
  { name: 'Dallas Mechanical Group', website: 'https://dallasmechanicalgroup.com', category: 'Commercial HVAC Construction', city: 'Dallas', state: 'TX' },
  { name: 'Way Mechanical', website: 'https://waymech.com', category: 'Commercial AC & Plumbing', city: 'Dallas', state: 'TX' },
  { name: 'Kahn Mechanical', website: 'https://kahnmechanical.com', category: 'Design-Build HVAC Systems', city: 'Dallas', state: 'TX' },
  { name: 'NTD Mechanical', website: 'https://ntdmechanical.com', category: 'Building Automation & VRF', city: 'Dallas', state: 'TX' },

  // Atlanta
  { name: 'Mallory & Evans', website: 'https://malloryandevans.com', category: 'Chiller & Commercial HVAC Maintenance', city: 'Atlanta', state: 'GA' },
  { name: 'Maxair Mechanical', website: 'https://maxairmech.com', category: 'Planned Mechanical Maintenance', city: 'Atlanta', state: 'GA' },
  { name: 'Legacy Mechanical Services', website: 'https://legacyservices.biz', category: 'Commercial Energy Services', city: 'Atlanta', state: 'GA' },
  { name: 'Shumate Commercial HVAC', website: 'https://shumatemechanical.com', category: 'Commercial HVAC Replacement', city: 'Atlanta', state: 'GA' }
];

async function runHvac() {
  console.log('❄️ Running Commercial HVAC Intelligence Pipeline...');
  const outputDir = path.resolve('./output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const results = await Promise.all(
    HVAC_TARGETS.map(t => enrichAndAuditBusiness(t).catch(e => ({ ...t, issues: [e.message] })))
  );

  const excelPath = path.join(outputDir, 'Commercial_HVAC_Mechanical_Enriched_Audited.xlsx');
  await exportToExcel(results, excelPath, 'Commercial HVAC & Mechanical');
  console.log(`✅ HVAC Master Excel saved to: ${excelPath}`);

  // Product 4 Listing Copy
  const listingMd = `# Product 4: Commercial HVAC & Mechanical Contractors Intelligence Pack (2026 Edition)

## 🏷️ Title: Premier Commercial HVAC & Mechanical Contractors (Chicago, Dallas, Atlanta) - 2026 Edition
**Price:** $99.00
**Category:** Digital Product / Commercial Industrial Data

### Subtitle:
*Curated database of premier commercial HVAC, chiller, and mechanical piping contractors across Chicago, DFW, and Atlanta. Includes direct executive/project contacts, building automation stack, and site speed audits.*

### Target Buyers:
- Industrial Equipment Suppliers (Trane, Carrier, Daikin distributors)
- Commercial Subcontractors, Sheet Metal Fabricators, Facility SaaS SDRs
- B2B HVAC Lead Generation Agencies
`;
  fs.writeFileSync(path.join(outputDir, 'PRODUCT_4_COMMERCIAL_HVAC_LISTING.md'), listingMd, 'utf-8');
  console.log('🎉 Product 4 Built Successfully!');
}

runHvac().catch(console.error);
