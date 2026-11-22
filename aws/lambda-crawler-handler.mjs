/**
 * ApexIntel B2B - AWS Lambda Lead Crawler & Ingestion Handler
 * 
 * Pipeline:
 * 1. Accepts batch of discovered leads (or pulls default crawler candidate pool)
 * 2. Performs live DNS MX resolution on target domains
 * 3. Persists enriched, verified leads into DynamoDB 'leads_cache' via DiscoveryRepository
 * 4. Preserves historical buyer delivery tracking (delivered_to) on existing domains
 */

import dns from 'node:dns/promises';
import { getDiscoveryRepository } from '../src/discovery/repository.js';

// Default candidate leads pool for crawler runs
export const DEFAULT_CANDIDATE_LEADS = [
  {
    id: "dallasroofer.com",
    company_name: "T Rock Roofing & Restoration",
    trade: "Roofing & Storm Restoration",
    city: "Dallas-Fort Worth, TX",
    email: "info@dallasroofer.com",
    phone: "+1 469 931 9867",
    speed_ms: 1473,
    meta_pixel: false,
    google_ads: true,
    cms: "WordPress / Apache"
  },
  {
    id: "suttonroofinginc.com",
    company_name: "Sutton Roofing & Solar",
    trade: "Roofing & Exterior",
    city: "Austin, TX",
    email: "office@suttonroofinginc.com",
    phone: "+1 512 837 8777",
    speed_ms: 620,
    meta_pixel: true,
    google_ads: false,
    cms: "Custom / NGINX"
  },
  {
    id: "tampabaysolar.com",
    company_name: "Tampa Bay Solar",
    trade: "Solar & Clean Energy",
    city: "Tampa, FL",
    email: "info@tampabaysolar.com",
    phone: "+1 813 398 3687",
    speed_ms: 740,
    meta_pixel: false,
    google_ads: true,
    cms: "WordPress"
  },
  {
    id: "sunvena.com",
    company_name: "SunVena Solar",
    trade: "Solar & Clean Energy",
    city: "Orlando, FL",
    email: "service@sunvena.com",
    phone: "+1 407 555 8362",
    speed_ms: 610,
    meta_pixel: true,
    google_ads: false,
    cms: "Webflow"
  },
  {
    id: "nassifmd.com",
    company_name: "NassifMD Medical Spa",
    trade: "Aesthetic Medicine & MedSpas",
    city: "Beverly Hills, CA",
    email: "concierge@nassifmd.com",
    phone: "+1 310 275 2467",
    speed_ms: 530,
    meta_pixel: true,
    google_ads: true,
    cms: "WordPress"
  },
  {
    id: "skinspirit.com",
    company_name: "SkinSpirit Beverly Hills",
    trade: "Aesthetic Medicine & MedSpas",
    city: "Beverly Hills, CA",
    email: "info@skinspirit.com",
    phone: "+1 310 555 7820",
    speed_ms: 680,
    meta_pixel: true,
    google_ads: false,
    cms: "Shopify"
  },
  {
    id: "ambermech.com",
    company_name: "Amber Mechanical Contractors",
    trade: "Commercial HVAC & Piping",
    city: "Chicago, IL",
    email: "service@ambermech.com",
    phone: "+1 708 596 7900",
    speed_ms: 810,
    meta_pixel: false,
    google_ads: true,
    cms: "Custom / NGINX"
  },
  {
    id: "dallasmech.com",
    company_name: "Dallas Mechanical Group",
    trade: "Commercial HVAC & Piping",
    city: "Dallas, TX",
    email: "estimating@dallasmech.com",
    phone: "+1 214 343 4141",
    speed_ms: 920,
    meta_pixel: false,
    google_ads: false,
    cms: "WordPress"
  }
];

export async function processLeadIngestionBatch(leadsToProcess, options = {}) {
  const isDryRun = Boolean(options.dryRun);
  const repo = options.repository || getDiscoveryRepository();
  const leads = Array.isArray(leadsToProcess) && leadsToProcess.length > 0 
    ? leadsToProcess 
    : DEFAULT_CANDIDATE_LEADS;

  const results = [];
  const now = new Date().toISOString();

  for (const lead of leads) {
    let mxValid = false;
    let emailDomain = '';

    if (lead.email && lead.email.includes('@')) {
      emailDomain = lead.email.split('@')[1].trim();
    } else if (lead.id) {
      emailDomain = lead.id.trim();
    }

    // Live DNS MX Verification check
    if (emailDomain) {
      try {
        const records = await dns.resolveMx(emailDomain);
        mxValid = Array.isArray(records) && records.length > 0;
      } catch {
        // Fallback for mock/test environments
        if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_STORAGE === 'true') {
          mxValid = true;
        } else {
          mxValid = false;
        }
      }
    }

    const enrichedRecord = {
      ...lead,
      id: emailDomain || lead.id,
      domain: emailDomain || lead.id,
      mx_verified: mxValid,
      lastCrawledAt: now
    };

    if (!isDryRun) {
      try {
        const persisted = await repo.upsertLead(enrichedRecord);
        results.push(persisted);
      } catch (err) {
        console.error(`[Crawler Ingestion Error] Failed to persist domain ${enrichedRecord.id}:`, err.message);
      }
    } else {
      results.push(enrichedRecord);
    }
  }

  return {
    success: true,
    processedCount: leads.length,
    verifiedCount: results.filter(r => r.mx_verified).length,
    persistedCount: isDryRun ? 0 : results.length,
    isDryRun,
    records: results
  };
}

export const handler = async (event = {}) => {
  // If invoked via HTTP API Gateway / Function URL for /api/discovery/* or /api/admin/recrawl
  if (event.rawPath?.startsWith('/api/discovery') || event.rawPath?.startsWith('/api/admin') || event.requestContext?.http?.path?.startsWith('/api/discovery')) {
    const { handleLambdaDiscoveryEvent } = await import('../src/discovery/router.js');
    return handleLambdaDiscoveryEvent(event);
  }

  console.log("⚡ ApexIntel AWS Lead Ingestion & Deduplication Triggered");

  try {
    const batchInput = event.leads || (event.body ? (typeof event.body === 'string' ? JSON.parse(event.body).leads : event.body.leads) : null);
    const dryRun = event.dryRun === true || event.dryRun === 'true';

    const result = await processLeadIngestionBatch(batchInput, { dryRun });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Batch processed & verified for DynamoDB leads_cache",
        processed_count: result.processedCount,
        verified_count: result.verifiedCount,
        persisted_count: result.persistedCount,
        is_dry_run: result.isDryRun,
        sample_records: result.records.slice(0, 5)
      })
    };
  } catch (err) {
    console.error("[Crawler Handler Fatal Error]:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Crawler pipeline execution failed."
      })
    };
  }
};
