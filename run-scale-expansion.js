import { enrichAndAuditBusiness, exportToExcel } from './toolbelt/index.js';
import path from 'node:path';
import fs from 'node:fs';

const FLORIDA_TARGETS = [
  { name: 'Tampa Bay Solar', website: 'https://tampabaysolar.com', category: 'Commercial & Residential Solar', city: 'Tampa', state: 'FL' },
  { name: 'SunVena Solar', website: 'https://sunvena.com', category: 'High-Efficiency Solar & Storage', city: 'Orlando', state: 'FL' },
  { name: 'Goldin Solar', website: 'https://goldinsolar.com', category: 'Hurricane-Resistant Solar', city: 'Miami', state: 'FL' },
  { name: 'Best Roofing Florida', website: 'https://bestroofing.net', category: 'Commercial Storm Restoration', city: 'Fort Lauderdale', state: 'FL' },
  { name: 'RestoreMasters Florida', website: 'https://restoremastersllc.com', category: 'Disaster Relief & Roofing', city: 'Orlando', state: 'FL' },
  { name: 'Top Builder Roofing', website: 'https://topbuilderroofing.com', category: 'Emergency Storm Response', city: 'Orlando', state: 'FL' },
  { name: 'United Roofing Central FL', website: 'https://unitedroofingcfl.com', category: 'Hail & Wind Damage Restoration', city: 'Orlando', state: 'FL' },
  { name: 'Ibis Contracting', website: 'https://ibiscontracting.com', category: 'Hurricane Damage Roof Repair', city: 'Tampa', state: 'FL' }
];

const CALI_MEDSPAS = [
  { name: 'NassifMD Medical Spa', website: 'https://nassifmdmedspa.com', category: 'Beverly Hills Aesthetic MedSpa', city: 'Beverly Hills', state: 'CA' },
  { name: 'SkinSpirit Beverly Hills', website: 'https://skinspirit.com', category: 'Luxury Injectables & Laser', city: 'Beverly Hills', state: 'CA' },
  { name: 'Biomedspa Dr Garth Fisher', website: 'https://biomedspa.com', category: 'High-End Aesthetic Care', city: 'Beverly Hills', state: 'CA' },
  { name: 'Volure MedSpa', website: 'https://voluremedspa.com', category: 'Body Contouring & Injectables', city: 'Beverly Hills', state: 'CA' },
  { name: 'Skin Perfect Medical', website: 'https://skinperfectmedical.com', category: 'Aesthetic Dermatology', city: 'Brea', state: 'CA' },
  { name: 'La Jolla Cosmetic MedSpa', website: 'https://ljcmedspa.com', category: 'Facial Plastic & MedSpa', city: 'San Diego', state: 'CA' },
  { name: 'Epi Center MedSpa', website: 'https://epicentermedspa.com', category: 'Regenerative Aesthetic Medicine', city: 'San Francisco', state: 'CA' },
  { name: 'Serenity Med Spa', website: 'https://serenitymedspa.com', category: 'Laser & Body Contouring', city: 'San Francisco', state: 'CA' },
  { name: 'Nob Hill Aesthetics', website: 'https://nobhillaesthetics.com', category: 'Facial Balancing & Lasers', city: 'San Francisco', state: 'CA' }
];

async function runExpansion() {
  console.log('🚀 Running Multi-Product Expansion Pipeline...');
  const outputDir = path.resolve('./output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 1. Process Florida
  console.log('Processing Florida Solar & Restoration targets...');
  const flResults = await Promise.all(
    FLORIDA_TARGETS.map(t => enrichAndAuditBusiness(t).catch(e => ({ ...t, issues: [e.message] })))
  );
  const flExcel = path.join(outputDir, 'Florida_HighTicket_Solar_Restoration_Enriched.xlsx');
  await exportToExcel(flResults, flExcel, 'Florida Solar & Restoration');
  console.log(`✅ Florida Excel saved to: ${flExcel}`);

  // 2. Process California MedSpas
  console.log('Processing California Luxury MedSpas...');
  const caResults = await Promise.all(
    CALI_MEDSPAS.map(t => enrichAndAuditBusiness(t).catch(e => ({ ...t, issues: [e.message] })))
  );
  const caExcel = path.join(outputDir, 'California_Luxury_MedSpas_Enriched_Audited.xlsx');
  await exportToExcel(caResults, caExcel, 'California Luxury MedSpas');
  console.log(`✅ California MedSpas Excel saved to: ${caExcel}`);

  // 3. Generate Listing copy for Product 2 (Florida)
  const flListing = `# Product 2: Florida High-Ticket Solar & Storm Restoration Intelligence Pack

## 🏷️ Title: Florida Solar & Storm Restoration Contractors (Verified Contacts + Audits) - 2026 Edition
**Price:** $79.00
**Category:** Digital Product / Business Data

### Subtitle:
*Verified intelligence on top-performing hurricane-resistant solar and disaster restoration contractors across Miami, Tampa, and Orlando. Includes direct contacts, speed diagnostics, and ad pixel tracking.*

### Target Buyers:
- Commercial Subcontractors, Solar SDRs, Roofing Marketing Agencies.
- Pre-validated DNS MX emails and direct phone lines.
`;
  fs.writeFileSync(path.join(outputDir, 'PRODUCT_2_FLORIDA_LISTING.md'), flListing, 'utf-8');

  // 4. Generate Listing copy for Product 3 (California MedSpas)
  const caListing = `# Product 3: California Luxury MedSpas & Aesthetic Clinics Intelligence Pack

## 🏷️ Title: California Luxury MedSpas & Aesthetic Clinics (Beverly Hills, SF, SD) - 2026 Edition
**Price:** $89.00
**Category:** Digital Product / Healthcare & Aesthetics Data

### Subtitle:
*Exclusive database of high-margin medical spas and cosmetic dermatology clinics across Beverly Hills, San Diego, and San Francisco. Includes direct doctor/practice emails, tech stack, and booking speed audits.*

### Target Buyers:
- MedSpa Marketing Agencies, Medical Aesthetic Equipment Suppliers, Injectable Reps, Healthcare SDRs.
`;
  fs.writeFileSync(path.join(outputDir, 'PRODUCT_3_CALIFORNIA_MEDSPAS_LISTING.md'), caListing, 'utf-8');

  // 5. Generate Multi-Niche Cold Email Dispatch Stream
  const multiColdPath = path.join(outputDir, 'EXPANDED_COLD_EMAIL_CAMPAIGNS.md');
  const coldContent = `# Expanded Cold Outreach Campaigns (Multi-Niche)

---

## Campaign 1: Pitching Florida Solar & Restoration Leads to Solar Marketing Agencies
**Target Agency Profile:** Agencies offering PPC, Google LSAs, or SEO to solar/roofing installers.
**Subject:** Florida solar & storm restoration prospect pack for {{Agency Name}}?

> Hi team at {{Agency Name}},
>
> With Florida being the most active storm restoration and residential solar market in the Southeast, having clean direct contacts to licensed contractors is critical.
>
> I just finished compiling and DNS-verifying our **2026 Florida Solar & Hurricane Restoration Intelligence Pack** (covering premier commercial and residential outfits in Miami, Tampa, and Orlando).
>
> Alongside verified emails and direct phone numbers, every lead includes:
> - Initial server response speeds (identifying slow mobile sites losing quotes)
> - Advertising pixel detection (showing who isn't currently retargeting)
>
> If your sales development team is looking to expand into Florida contractors this quarter, would you like me to send over a 3-lead sample to review the data quality?
>
> Best regards,  
> Aaron Agbas  
> B2B Intelligence Analyst  
> Instant download: https://gumroad.com/l/eselkd

---

## Campaign 2: Pitching California MedSpa Intelligence to Healthcare & Aesthetic Marketing Agencies
**Target Agency Profile:** Boutique marketing agencies specializing in MedSpas, Botox, and cosmetic clinics.
**Subject:** Verified Beverly Hills & Bay Area MedSpa database for {{Agency Name}}?

> Hi {{First Name}},
>
> I noticed your agency specializes in high-ROI patient acquisition for medical spas and cosmetic practices.
>
> I just finalized a verified intelligence database of **premier luxury MedSpas and aesthetic clinics across California (Beverly Hills, San Diego, and San Francisco)**.
>
> Rather than generic scraped lists, every record includes:
> - DNS MX-verified direct clinic and executive email addresses
> - Practice management tech stacks & Meta pixel tracking verification
> - Mobile booking page response times (highlighting clinics leaking high-ticket patient inquiries)
>
> Would you like me to send over a 3-clinic sample to evaluate for your outbound sales reps?
>
> Best regards,  
> Aaron Agbas  
> Healthcare B2B Analyst  
> Direct portal: https://gumroad.com/l/eselkd

---

## Campaign 3: Direct to Florida Contractors (Pitching Site Speed & Retargeting)
**Subject:** Quick check on {{Company Name}} site response speed in {{City}}

> Hi team at {{Company Name}},
>
> I ran an automated technical performance audit on {{Website}} this morning.
>
> In the competitive {{City}} solar and storm market, mobile load speed is everything. We noticed:
> - Current response time: {{ResponseTime}}ms
> - {{Opportunity}} (e.g., No active retargeting pixel installed for visitors who drop off without requesting a quote)
>
> I put together a 1-page breakdown of how to resolve this to capture more inbound project calls.
>
> Mind if I send the 1-page PDF over for you to review with your web team?
>
> Best,  
> Aaron Agbas
`;
  fs.writeFileSync(multiColdPath, coldContent, 'utf-8');
  console.log(`✅ Multi-Niche Cold Email Dispatch generated at: ${multiColdPath}`);
  console.log('🎉 Multi-Product Expansion Completed Successfully!');
}

runExpansion().catch(console.error);
