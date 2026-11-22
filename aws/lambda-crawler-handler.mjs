import dns from 'node:dns/promises';

// Table definition: 'leads_cache' (Partition Key: 'id')
export const handler = async (event) => {
  console.log("⚡ ApexIntel AWS Lead Ingestion & Deduplication Triggered");

  // Sample batch of fresh leads collected by crawler
  const freshLeads = event.leads || [
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
    }
  ];

  const results = [];

  for (const lead of freshLeads) {
    // 1. Live DNS MX Verification check
    let mxValid = false;
    try {
      const domain = lead.email.split('@')[1];
      const records = await dns.resolveMx(domain);
      mxValid = Array.isArray(records) && records.length > 0;
    } catch (e) {
      mxValid = false;
    }

    results.push({
      id: lead.id,
      company_name: lead.company_name,
      email: lead.email,
      mx_verified: mxValid,
      delivered_to: [], // Track buyers who received this lead
      created_at: new Date().toISOString()
    });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Batch processed & verified for DynamoDB leads_cache",
      verified_count: results.filter(r => r.mx_verified).length,
      sample_records: results
    })
  };
};
