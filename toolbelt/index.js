import { validateEmail, validatePhone } from './validators/contact-validator.js';
import { crawlWebsiteContacts } from './extractors/site-crawler.js';
import { auditWebsite } from './auditors/site-auditor.js';
import { exportToExcel } from './formatters/excel-exporter.js';

export {
  validateEmail,
  validatePhone,
  crawlWebsiteContacts,
  auditWebsite,
  exportToExcel
};

/**
 * Runs a complete enrichment & audit pipeline on a business website.
 * @param {object} businessBasic
 * @returns {Promise<object>}
 */
export async function enrichAndAuditBusiness(businessBasic) {
  const { name, website, category, city, state } = businessBasic;

  if (!website) {
    return {
      name,
      category,
      city,
      state,
      error: 'No website provided'
    };
  }

  // Run contact crawler and technical audit concurrently
  const [contacts, audit] = await Promise.all([
    crawlWebsiteContacts(website),
    auditWebsite(website)
  ]);

  return {
    name,
    category: category || 'Uncategorized',
    city: city || '',
    state: state || '',
    website: contacts.website || website,
    primaryEmail: contacts.primaryEmail,
    allEmails: contacts.allEmails,
    primaryPhone: contacts.primaryPhone,
    allPhones: contacts.allPhones,
    socials: contacts.socials,
    techStack: audit.techStack || [],
    responseTimeMs: audit.responseTimeMs || 0,
    isMobileOptimized: audit.isMobileOptimized ?? false,
    issues: audit.issues || [],
    opportunities: audit.opportunities || []
  };
}
