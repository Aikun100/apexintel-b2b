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
    description: '24 premier commercial & residential roofing, storm restoration, and solar outfits across Austin, Dallas, Houston & SA.'
  }),
  florida: Object.freeze({
    key: 'florida',
    title: 'Florida Solar & Restoration',
    territory: 'Miami, Tampa Bay, Orlando',
    niche: 'Commercial Solar & Hurricane Mitigation',
    leadsCount: 24,
    priceInCents: 7900,
    price: 79,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/Florida_HighTicket_Solar_Restoration_Enriched.xlsx',
    filename: 'Florida_HighTicket_Solar_Restoration_Enriched.xlsx',
    description: 'Hurricane-grade commercial solar installers and rapid-response disaster mitigation contractors in South & Central Florida.'
  }),
  medspas: Object.freeze({
    key: 'medspas',
    title: 'California Luxury MedSpas',
    territory: 'Beverly Hills, San Francisco, San Diego',
    niche: 'Aesthetic Dermatology & Injectable Clinics',
    leadsCount: 24,
    priceInCents: 8900,
    price: 89,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/California_Luxury_MedSpas_Enriched_Audited.xlsx',
    filename: 'California_Luxury_MedSpas_Enriched_Audited.xlsx',
    description: 'Premier cosmetic dermatology, facial plastic surgery, and luxury injectable clinics across Beverly Hills, SF & San Diego.'
  }),
  hvac: Object.freeze({
    key: 'hvac',
    title: 'Commercial HVAC & Mechanical',
    territory: 'Chicago, Dallas-Fort Worth, Atlanta',
    niche: 'Industrial Chillers & Mechanical Piping',
    leadsCount: 24,
    priceInCents: 9900,
    price: 99,
    currency: 'usd',
    s3Bucket: 'apexintel-datasets-production',
    s3Key: 'datasets/Commercial_HVAC_Mechanical_Enriched_Audited.xlsx',
    filename: 'Commercial_HVAC_Mechanical_Enriched_Audited.xlsx',
    description: 'Industrial chiller, VRF piping, and commercial building automation contractors across Chicago, DFW, and Atlanta.'
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
