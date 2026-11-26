/**
 * ApexIntel B2B - AWS Lambda Lead Crawler & Ingestion Handler
 * 
 * Pipeline:
 * 1. Accepts an explicit batch of discovered leads; no default/sample pool is injected
 * 2. Performs live DNS MX resolution on target domains
 * 3. Persists enriched, verified leads into DynamoDB 'leads_cache' via DiscoveryRepository
 * 4. Preserves historical buyer delivery tracking (delivered_to) on existing domains
 */

import dns from 'node:dns/promises';
import { getDiscoveryRepository } from '../src/discovery/repository.js';

// No built-in sample leads: ingestion requires an explicit source batch.
export const DEFAULT_CANDIDATE_LEADS = Object.freeze([]);

export async function processLeadIngestionBatch(leadsToProcess, options = {}) {
  const isDryRun = Boolean(options.dryRun);
  const repo = options.repository || getDiscoveryRepository();
  const leads = Array.isArray(leadsToProcess) ? leadsToProcess : [];
  if (leads.length === 0) {
    const error = new Error('A non-empty lead batch is required; no sample records are injected.');
    error.statusCode = 400;
    throw error;
  }

  const resolveMx = options.resolveMx || dns.resolveMx.bind(dns);
  const results = [];
  const now = new Date().toISOString();

  for (const lead of leads) {
    let mxValid = null;
    const email = typeof lead.email === 'string' ? lead.email.trim() : '';
    const emailDomain = email.includes('@') ? email.split('@').pop().trim().toLowerCase() : '';
    const recordDomain = String(lead.domain || lead.id || emailDomain).trim().toLowerCase();

    // A domain MX lookup is performed only when an actual email address is present.
    if (emailDomain) {
      try {
        const records = await resolveMx(emailDomain);
        mxValid = Array.isArray(records) && records.length > 0;
      } catch {
        mxValid = false;
      }
    }

    const enrichedRecord = {
      ...lead,
      id: recordDomain,
      domain: recordDomain,
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
        message: "Batch processed; DNS MX status recorded for supplied email domains.",
        processed_count: result.processedCount,
        verified_count: result.verifiedCount,
        persisted_count: result.persistedCount,
        is_dry_run: result.isDryRun,
        processed_records: result.records.length
      })
    };
  } catch (err) {
    console.error("[Crawler Handler Fatal Error]:", err);
    return {
      statusCode: err.statusCode || 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: err.statusCode === 400 ? err.message : "Crawler pipeline execution failed."
      })
    };
  }
};
