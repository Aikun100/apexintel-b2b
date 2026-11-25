/**
 * ApexIntel B2B - Authoritative Server-Side Product Catalog
 * 
 * Strict Security Architecture:
 * - Prices and S3 object keys are defined authoritatively server-side.
 * - Client-supplied prices, pack URLs, or discount amounts are strictly rejected or ignored.
 * - S3 keys map directly to private objects within the apexintel-datasets-production bucket.
 */

export const APEX_PRODUCT_CATALOG = Object.freeze({
  texas: Object.freeze({
    key: 'texas',
    title: 'Texas High-Ticket Contractors',
    territory: 'Austin, Dallas-Fort Worth, Houston, San Antonio',
    niche: 'Commercial Roofing & Storm Restoration',
    leadsCount: 24,
    priceInCents: 7900,
    price: 79,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/Texas_HighTicket_Contractors_Enriched_Audited.xlsx',
    filename: 'Texas_HighTicket_Contractors_Enriched_Audited.xlsx',
    description: '24 premier commercial & residential roofing, storm restoration, and solar outfits across Austin, Dallas, Houston & SA.',
    fieldCoverage: Object.freeze({
      emailsAvailable: '13 / 24 verified decision maker inboxes',
      phonesAvailable: '17 / 24 direct business lines',
      verifiedTechAvailable: '17 / 24 stack & telemetry profiles'
    }),
    freshness: 'Audited November 2026',
    provenanceSummary: '5-tier provenance taxonomy with DNS MX verification on active inboxes.',
    limitations: 'Where businesses do not publish a direct email or phone, entries are marked Unavailable rather than guessed.',
    fieldDictionary: Object.freeze([
      'Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone',
      'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'
    ]),
    sampleRows: Object.freeze([
      { company: 'Sutton Roofing', niche: 'Roofing & Exterior', city: 'Austin, TX', phone: '+1 512 394 9801', email: 'suttonroofinginc@gmail.com', tech: 'Google Analytics' },
      { company: 'T Rock Roofing', niche: 'Storm Restoration', city: 'Dallas, TX', phone: '+1 469 931 9867', email: 'info@dallasroofer.com', tech: 'WordPress' },
      { company: 'Lon Smith Roofing', niche: 'Roofing & Gutters', city: 'Dallas, TX', phone: '+1 800 317 4791', email: 'info@lonsmith.com', tech: 'WordPress, Google Analytics, Meta Pixel' }
    ])
  }),
  florida: Object.freeze({
    key: 'florida',
    title: 'Florida Solar & Restoration',
    territory: 'Miami, Tampa Bay, Orlando',
    niche: 'Commercial Solar & Hurricane Mitigation',
    leadsCount: 8,
    priceInCents: 7900,
    price: 79,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/Florida_HighTicket_Solar_Restoration_Enriched.xlsx',
    filename: 'Florida_HighTicket_Solar_Restoration_Enriched.xlsx',
    description: 'Hurricane-grade commercial solar installers and rapid-response disaster mitigation contractors in South & Central Florida.',
    fieldCoverage: Object.freeze({
      emailsAvailable: '5 / 8 verified decision maker inboxes',
      phonesAvailable: '7 / 8 direct business lines',
      verifiedTechAvailable: '7 / 8 stack & telemetry profiles'
    }),
    freshness: 'Audited November 2026',
    provenanceSummary: '5-tier provenance taxonomy with DNS MX verification on active inboxes.',
    limitations: 'Points-in-time telemetry; unlisted contact channels left Unavailable.',
    fieldDictionary: Object.freeze([
      'Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone',
      'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'
    ]),
    sampleRows: Object.freeze([
      { company: 'Tampa Bay Solar', niche: 'Commercial & Residential Solar', city: 'Tampa, FL', phone: '+1 813 827 6527', email: 'info@tampabaysolar.com', tech: 'WordPress, Google Analytics' },
      { company: 'SunVena Solar', niche: 'High-Efficiency Solar & Storage', city: 'Orlando, FL', phone: '+1 407 553 9584', email: 'support@sunvena.com', tech: 'WordPress, Google Analytics' },
      { company: 'Goldin Solar', niche: 'Hurricane-Resistant Solar', city: 'Miami, FL', phone: '+1 855 765 2730', email: 'Unavailable', tech: 'WordPress' }
    ])
  }),
  medspas: Object.freeze({
    key: 'medspas',
    title: 'California Luxury MedSpas',
    territory: 'Beverly Hills, San Francisco, San Diego',
    niche: 'Aesthetic Dermatology & Injectable Clinics',
    leadsCount: 9,
    priceInCents: 8900,
    price: 89,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/California_Luxury_MedSpas_Enriched_Audited.xlsx',
    filename: 'California_Luxury_MedSpas_Enriched_Audited.xlsx',
    description: 'Premier cosmetic dermatology, facial plastic surgery, and luxury injectable clinics across Beverly Hills, SF & San Diego.',
    fieldCoverage: Object.freeze({
      emailsAvailable: '4 / 9 verified decision maker inboxes',
      phonesAvailable: '7 / 9 direct business lines',
      verifiedTechAvailable: '7 / 9 stack & telemetry profiles'
    }),
    freshness: 'Audited November 2026',
    provenanceSummary: '5-tier provenance taxonomy with DNS MX verification on active inboxes.',
    limitations: 'Clinic front-desk reception emails verified; private surgeon emails not fabricated.',
    fieldDictionary: Object.freeze([
      'Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone',
      'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'
    ]),
    sampleRows: Object.freeze([
      { company: 'SkinSpirit Beverly Hills', niche: 'Luxury Injectables & Laser', city: 'Beverly Hills, CA', phone: '+1 855 383 7546', email: 'skinspirit@5wpr.com', tech: 'Google Analytics' },
      { company: 'Epi Center MedSpa', niche: 'Regenerative Aesthetic Medicine', city: 'San Francisco, CA', phone: '+1 415 362 4754', email: 'reception@epicentermedspa.com', tech: 'WordPress, Meta Pixel' },
      { company: 'Nob Hill Aesthetics', niche: 'Facial Balancing & Lasers', city: 'San Francisco, CA', phone: '+1 415 440 6800', email: 'serviceoffice@nobhillaesthetics.com', tech: 'Shopify, Google Analytics, Meta Pixel' }
    ])
  }),
  hvac: Object.freeze({
    key: 'hvac',
    title: 'Commercial HVAC & Mechanical',
    territory: 'Chicago, Dallas-Fort Worth, Atlanta',
    niche: 'Industrial Chillers & Mechanical Piping',
    leadsCount: 12,
    priceInCents: 9900,
    price: 99,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/Commercial_HVAC_Mechanical_Enriched_Audited.xlsx',
    filename: 'Commercial_HVAC_Mechanical_Enriched_Audited.xlsx',
    description: 'Industrial chiller, VRF piping, and commercial building automation contractors across Chicago, DFW, and Atlanta.',
    fieldCoverage: Object.freeze({
      emailsAvailable: '7 / 12 verified decision maker inboxes',
      phonesAvailable: '11 / 12 direct business lines',
      verifiedTechAvailable: '7 / 12 stack & telemetry profiles'
    }),
    freshness: 'Audited November 2026',
    provenanceSummary: '5-tier provenance taxonomy with DNS MX verification on active inboxes.',
    limitations: 'Cleaned email address entries; malformed legacy spreadsheet cells sanitized.',
    fieldDictionary: Object.freeze([
      'Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone',
      'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'
    ]),
    sampleRows: Object.freeze([
      { company: 'Midwest Mechanical', niche: 'Energy Solutions & Commercial HVAC', city: 'Chicago, IL', phone: '+1 630 850 2300', email: 'answers@midwestmech.com', tech: 'Google Analytics' },
      { company: 'Way Mechanical', niche: 'Commercial AC & Plumbing', city: 'Dallas, TX', phone: '+1 713 672 7545', email: 'sales@waymech.com', tech: 'Wix' },
      { company: 'Shumate Commercial HVAC', niche: 'Commercial HVAC Replacement', city: 'Atlanta, GA', phone: '+1 678 584 0880', email: 'commercialsales@shumatemech.com', tech: 'Google Analytics' }
    ])
  })
});

/**
 * Get product definition by key.
 * @param {string} productKey
 * @returns {object|null} Product definition or null if not found
 */
export function getProductByKey(productKey) {
  if (!productKey || typeof productKey !== 'string') return null;
  const normalized = productKey.toLowerCase().trim();
  return APEX_PRODUCT_CATALOG[normalized] || null;
}

/**
 * List all available products in catalog.
 * @returns {Array<object>}
 */
export function listProducts() {
  return Object.values(APEX_PRODUCT_CATALOG);
}
