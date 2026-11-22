import { crawlWebsiteContacts, exportToExcel } from './toolbelt/index.js';
import path from 'node:path';
import fs from 'node:fs';

const AGENCY_TARGETS = [
  { name: 'Hook Agency', website: 'https://hookagency.com', category: 'Roofing SEO & Web Design', city: 'Minneapolis', state: 'MN' },
  { name: 'Roofing Webmasters', website: 'https://www.roofingwebmasters.com', category: 'Roofing Marketing Exclusively', city: 'Fort Worth', state: 'TX' },
  { name: 'Built-Right Digital', website: 'https://builtrightdigital.com', category: 'Roofing Lead Generation', city: 'Tampa', state: 'FL' },
  { name: 'Jives Media', website: 'https://jivesmedia.com', category: 'Contractor Marketing & SEO', city: 'San Francisco', state: 'CA' },
  { name: 'Thrive Agency', website: 'https://thriveagency.com', category: 'Home Services SEO & Ads', city: 'Arlington', state: 'TX' },
  { name: 'Contractor Dynamics', website: 'https://www.contractordynamics.com', category: 'Contractor Marketing Coaching', city: 'Belmar', state: 'NJ' },
  { name: 'Intellibright', website: 'https://intellibright.com', category: 'Pay-Per-Sale Roofing Ads', city: 'Austin', state: 'TX' },
  { name: 'Blue Corona', website: 'https://www.bluecorona.com', category: 'HVAC & Roofing Digital Marketing', city: 'Charlotte', state: 'NC' },
  { name: 'Cibirix', website: 'https://cibirix.com', category: 'Home Services Web Growth', city: 'Greensboro', state: 'NC' },
  { name: 'BlackStorm Design', website: 'https://blackstormdm.com', category: 'Roofing PPC & SEO', city: 'Knoxville', state: 'TN' },
  { name: 'Top Marketing Agency', website: 'https://topmarketingagency.com', category: 'Contractor SEO & Reputation', city: 'Seattle', state: 'WA' },
  { name: 'Scorpion', website: 'https://www.scorpion.co', category: 'Enterprise Home Services Marketing', city: 'Lehi', state: 'UT' }
];

async function harvestAgencies() {
  console.log(`🎯 Harvesting & Enriching ${AGENCY_TARGETS.length} Marketing Agency Buyers...`);
  const startTime = Date.now();

  const enrichedAgencies = [];
  for (const agency of AGENCY_TARGETS) {
    console.log(`Processing agency: ${agency.name}...`);
    try {
      const contacts = await crawlWebsiteContacts(agency.website);
      enrichedAgencies.push({
        name: agency.name,
        category: agency.category,
        city: agency.city,
        state: agency.state,
        website: agency.website,
        primaryEmail: contacts.primaryEmail || 'Contact form on site',
        allEmails: contacts.allEmails || [],
        primaryPhone: contacts.primaryPhone || 'N/A',
        allPhones: contacts.allPhones || [],
        linkedin: contacts.socials?.linkedin || ''
      });
    } catch (err) {
      console.warn(`Failed to process ${agency.name}: ${err.message}`);
      enrichedAgencies.push({
        ...agency,
        primaryEmail: 'Contact form on site',
        primaryPhone: 'N/A'
      });
    }
  }

  const outputDir = path.resolve('./output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Export Excel
  const excelPath = path.join(outputDir, 'Roofing_Marketing_Agencies_Target_Buyers.xlsx');
  await exportToExcel(enrichedAgencies, excelPath, 'Agency Buyers');
  console.log(`✅ Agency buyers Excel saved to: ${excelPath}`);

  // 2. Generate Dispatch Sheet
  const dispatchPath = path.join(outputDir, 'AGENCY_OUTREACH_DISPATCH.md');
  let dispatchMd = `# Agency Buyers: Direct Outreach Dispatch Sheet

These digital marketing agencies specialize in roofing, home services, and contractor growth. They buy leads, cold prospect lists, and digital audits to feed their sales pipelines.

---

`;

  for (const a of enrichedAgencies) {
    dispatchMd += `### 🏢 ${a.name} (${a.city}, ${a.state})
- **Focus:** ${a.category}
- **Website:** ${a.website}
- **Direct Phone:** ${a.primaryPhone}
- **Email / Intake:** ${a.primaryEmail}
- **LinkedIn:** ${a.linkedin || 'None'}

**Outreach Email:**
> **Subject:** Pre-audited Texas roofer prospect list for ${a.name}?
>
> Hi team at ${a.name},
>
> I know your agency focuses on driving revenue and search visibility for roofing and contractor businesses.
>
> I just finished compiling and DNS-verifying a clean intelligence dataset of **24 premier commercial & residential contractors across Texas (Austin, Dallas, Houston, San Antonio)**.
>
> Along with verified emails and direct phone numbers, every lead includes:
> - Detected CMS platforms & ad pixel tracking status (revealing who isn't running retargeting)
> - Technical site response speeds (in ms) for instant audit pitches
>
> If your sales development team is looking to sign more Texas contractors this quarter, would you like me to send over a 3-lead sample to review the data quality?
>
> Best regards,  
> [Your Name]  
> B2B Intelligence Analyst  
> *Full pack instant download:* https://gumroad.com/l/eselkd

---

`;
  }

  fs.writeFileSync(dispatchPath, dispatchMd, 'utf-8');
  console.log(`✅ Dispatch Markdown generated at: ${dispatchPath}`);

  const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`🎉 Agency Harvest completed in ${totalSeconds} seconds!`);
}

harvestAgencies().catch(console.error);
