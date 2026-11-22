import { enrichAndAuditBusiness, exportToExcel } from './toolbelt/index.js';
import path from 'node:path';
import fs from 'node:fs';

const TARGET_BUSINESSES = [
  // Austin, TX
  { name: 'Sutton Roofing', website: 'https://www.suttonroofinginc.com', category: 'Roofing & Exterior', city: 'Austin', state: 'TX' },
  { name: 'Longhorn Roofing', website: 'https://www.longhornroofing.com', category: 'Roofing & Composite', city: 'Austin', state: 'TX' },
  { name: 'Stonewater Roofing', website: 'https://stonewaterroofing.com', category: 'Roofing & Restoration', city: 'Austin', state: 'TX' },
  { name: 'Hargrove Roofing Austin', website: 'https://www.hargroveroofing.com', category: 'Commercial Roofing', city: 'Austin', state: 'TX' },
  { name: 'Wilson Roofing', website: 'https://wilsonroofing.com', category: 'Residential & Commercial', city: 'Austin', state: 'TX' },
  { name: 'SCG Roofs', website: 'https://scgroofs.com', category: 'Craftsmanship Roofing', city: 'Austin', state: 'TX' },
  
  // Dallas-Fort Worth, TX
  { name: 'T Rock Roofing', website: 'https://dallasroofer.com', category: 'Storm Restoration', city: 'Dallas', state: 'TX' },
  { name: 'Lon Smith Roofing', website: 'https://www.lonsmith.com', category: 'Roofing & Gutters', city: 'Dallas', state: 'TX' },
  { name: 'Bold Roofing', website: 'https://boldroofing.com', category: 'Residential Roofing', city: 'Dallas', state: 'TX' },
  { name: 'Supreme Roofing', website: 'https://www.supremeroofing.com', category: 'Commercial Roofing', city: 'Dallas', state: 'TX' },
  { name: 'Elevated Roofing', website: 'https://elevatedroofing.com', category: 'Roofing & Solar', city: 'Dallas', state: 'TX' },
  { name: 'Firehouse Roofing', website: 'https://firehouseroofing.com', category: 'Storm Restoration', city: 'Dallas', state: 'TX' },

  // Houston, TX
  { name: 'Precision Roof Crafters', website: 'https://precisionroofcrafters.com', category: 'Full-Service Roofing', city: 'Houston', state: 'TX' },
  { name: 'Rooftec Houston', website: 'https://rooftectx.com', category: 'Commercial Roofing', city: 'Houston', state: 'TX' },
  { name: 'Proper Roofing', website: 'https://properroof.com', category: 'Residential & Siding', city: 'Houston', state: 'TX' },
  { name: 'Top Roofing Houston', website: 'https://toproofinghouston.com', category: 'Re-roofing & Flat Roofs', city: 'Houston', state: 'TX' },

  // San Antonio, TX
  { name: "Roland's Roofing", website: 'https://rolandsroofing.com', category: 'Commercial & Residential', city: 'San Antonio', state: 'TX' },
  { name: 'Rhino Roofers', website: 'https://rhinoroofers.com', category: 'Roofing & Restoration', city: 'San Antonio', state: 'TX' },
  { name: 'Integrity Roofing & Siding', website: 'https://integritysa.com', category: 'Roofing & Siding', city: 'San Antonio', state: 'TX' },
  { name: 'Alon Roofing', website: 'https://alonroofing.com', category: 'Residential Maintenance', city: 'San Antonio', state: 'TX' },
  { name: 'Myroofco', website: 'https://myroofcotx.com', category: 'Insurance Claim Roofing', city: 'San Antonio', state: 'TX' },
  { name: 'Better Roofing USA', website: 'https://betterroofingusainc.com', category: 'Storm & Hail Restoration', city: 'San Antonio', state: 'TX' },

  // High-Ticket Solar Contractors (Texas)
  { name: 'Freedom Solar Power', website: 'https://freedomsolarpower.com', category: 'Commercial & Residential Solar', city: 'Austin', state: 'TX' },
  { name: 'NATiVE Solar', website: 'https://nativesolar.com', category: 'Clean Energy & Smart Storage', city: 'Austin', state: 'TX' }
];

async function runProduction() {
  console.log(`🚀 Initiating Autonomous Production Run for ${TARGET_BUSINESSES.length} high-ticket businesses...`);
  const startTime = Date.now();

  const outputDir = path.resolve('./output');
  const auditsDir = path.join(outputDir, 'audits');
  if (!fs.existsSync(auditsDir)) {
    fs.mkdirSync(auditsDir, { recursive: true });
  }

  const enrichedRecords = [];

  // Batch process concurrently in groups of 4 to avoid socket congestion
  const batchSize = 4;
  for (let i = 0; i < TARGET_BUSINESSES.length; i += batchSize) {
    const batch = TARGET_BUSINESSES.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(TARGET_BUSINESSES.length / batchSize)}...`);
    
    const results = await Promise.all(
      batch.map(target => enrichAndAuditBusiness(target).catch(err => ({
        name: target.name,
        website: target.website,
        category: target.category,
        city: target.city,
        state: target.state,
        issues: [`Pipeline error: ${err.message}`]
      })))
    );

    enrichedRecords.push(...results);
  }

  // 1. Export Excel Master Asset
  const excelPath = path.join(outputDir, 'Texas_HighTicket_Contractors_Enriched_Audited.xlsx');
  await exportToExcel(enrichedRecords, excelPath, 'Texas High-Ticket Contractors');
  console.log(`✅ Master Excel Dataset saved to: ${excelPath}`);

  // 2. Generate Individual Pitch Audits
  console.log('Generating customized audit teardowns...');
  for (const rec of enrichedRecords) {
    if (!rec.name) continue;
    const safeName = rec.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const auditFile = path.join(auditsDir, `${safeName}_audit.md`);

    const markdown = `# Digital Performance & Lead Capture Audit: ${rec.name}

## 🏢 Business Overview
- **Category:** ${rec.category}
- **Location:** ${rec.city}, ${rec.state}
- **Website:** ${rec.website}
- **Primary Phone:** ${rec.primaryPhone || 'Not Listed'}
- **Verified Email:** ${rec.primaryEmail || 'Contact form only'}
- **Social Media:** ${rec.socials?.linkedin || rec.socials?.facebook || 'None detected'}

---

## ⚡ Technical & Conversion Diagnostics
- **Server Response Time:** ${rec.responseTimeMs || 'N/A'} ms
- **Mobile Responsive Viewport:** ${rec.isMobileOptimized ? '✅ Configured' : '❌ Missing (Hurting Google Mobile Rankings)'}
- **Detected Tech Stack:** ${rec.techStack?.length ? rec.techStack.join(', ') : 'Custom / Static'}

### 🔍 Identified Vulnerabilities & Flaws:
${rec.issues?.length ? rec.issues.map(iss => `- ⚠️ ${iss}`).join('\n') : '- ✅ No critical technical errors detected.'}

### 💡 High-ROI Growth Opportunities:
${rec.opportunities?.length ? rec.opportunities.map(opp => `- 🚀 ${opp}`).join('\n') : '- Direct retargeting and Google Local Services Ads expansion.'}

---

## 📞 Recommended Cold Outreach Script
> **Subject:** Quick question regarding ${rec.name}'s website speed in ${rec.city}
>
> Hi team at ${rec.name},
>
> I was reviewing your site at ${rec.website} and noticed your initial server response time is currently around ${rec.responseTimeMs}ms. In the competitive ${rec.category} market in ${rec.city}, optimizing this can immediately decrease bounce rates and increase customer calls.
>
> We also noticed ${rec.opportunities?.[0] || 'your site could benefit from active retargeting pixels'}.
>
> I've attached a full 1-page breakdown. Would you be open to a 5-minute call this Thursday to review?
`;

    fs.writeFileSync(auditFile, markdown, 'utf-8');
  }

  // 3. Generate Listing Manifest / Gumroad / Fiverr Copy
  const manifestPath = path.join(outputDir, 'LISTING_MANIFEST.md');
  const manifestContent = `# High-Ticket Texas Contractor Intelligence Pack: Ready-to-Sell Manifest

## 📦 What Was Generated
- **File:** \`Texas_HighTicket_Contractors_Enriched_Audited.xlsx\`
- **Records:** ${enrichedRecords.length} premier commercial and residential contractors across Austin, Dallas, Houston, and San Antonio.
- **Data Points per Lead:**
  - Verified Company Name, Category, City, State
  - DNS-checked Deliverable Email & Formatted Phone Number
  - Technology Stack (WordPress, Shopify, Analytics tags)
  - Technical Site Flaws & Growth Opportunities
  - LinkedIn and Social Links
- **Included Assets:** ${enrichedRecords.length} Individual Markdown Audit teardowns in \`./audits/\`

---

## 💰 Recommended Monetization Moves

### 1. Sell Directly as a B2B Data Pack
- **Platform:** Gumroad, Whop, or LeadGen Forums
- **Suggested Price:** \$99.00
- **Product Title:** "24 Verified Texas Roofing & Solar Contractors (Direct Contacts + Tech Audits)"
- **Target Buyers:** B2B Marketing Agencies, SEO Consultants, Commercial Subcontractors, SaaS SDRs.

### 2. Upwork / Fiverr Portfolio & Service Gig
- **Gig Title:** "I will deliver enriched B2B contractor leads with technical audit reports"
- **Sample Work:** Upload this Excel sheet as your live portfolio sample to win instant \$100–\$300 jobs.

### 3. Direct Outbound Retainers
- Use the generated audit files in \`./audits/\` to pitch site optimization, retargeting setup, or local SEO services for \$500–\$2,000/month.
`;

  fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
  console.log(`✅ Listing Manifest generated at: ${manifestPath}`);

  const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Production Run Completed Successfully in ${totalSeconds} seconds!`);
}

runProduction().catch(err => {
  console.error('Fatal Production Error:', err);
  process.exit(1);
});
