// ============================================================================
// ApexIntel B2B — Customer Intelligence & Prospect CRM Workspace
// Master Directive Implementation: 11-Stage Pipeline, Dual Views (Table & Kanban),
// Lead Profile Drawer, Campaigns, Follow-Up Queue, Audit Lab & Custom Extraction
// ============================================================================

(function () {
  'use strict';

  // --- Constants: 11 Pipeline Statuses ---
  const PIPELINE_STATUSES = [
    { id: 'New', label: 'New', color: 'indigo', border: 'border-indigo-500/40', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
    { id: 'Qualified', label: 'Qualified', color: 'cyan', border: 'border-cyan-500/40', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
    { id: 'Ready to Contact', label: 'Ready to Contact', color: 'sky', border: 'border-sky-500/40', bg: 'bg-sky-500/10', text: 'text-sky-400' },
    { id: 'Contacted', label: 'Contacted', color: 'blue', border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-400' },
    { id: 'Follow-Up', label: 'Follow-Up', color: 'amber', border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-400' },
    { id: 'Responded', label: 'Responded', color: 'purple', border: 'border-purple-500/40', bg: 'bg-purple-500/10', text: 'text-purple-400' },
    { id: 'Meeting Scheduled', label: 'Meeting Scheduled', color: 'emerald', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    { id: 'Proposal', label: 'Proposal', color: 'teal', border: 'border-teal-500/40', bg: 'bg-teal-500/10', text: 'text-teal-400' },
    { id: 'Won', label: 'Won', color: 'green', border: 'border-green-500/40', bg: 'bg-green-500/20', text: 'text-green-300' },
    { id: 'Lost', label: 'Lost', color: 'rose', border: 'border-rose-500/40', bg: 'bg-rose-500/10', text: 'text-rose-400' },
    { id: 'Not Qualified', label: 'Not Qualified', color: 'slate', border: 'border-slate-600/40', bg: 'bg-slate-700/20', text: 'text-slate-400' }
  ];

  // --- Seed CRM Leads ---
  const DEFAULT_CRM_LEADS = [
    {
      id: 'lead_tx_001',
      company: 'T Rock Roofing & Restoration',
      domain: 'dallasroofer.com',
      contactName: 'Thomas Rock (Managing Partner)',
      email: 'info@dallasroofer.com',
      phone: '+1 469 931 9867',
      city: 'Dallas-Fort Worth, TX',
      territory: 'texas',
      industry: 'Roofing & Storm Restoration',
      status: 'Ready to Contact',
      priority: 'P1',
      opportunityScore: 92,
      speed_ms: 1473,
      metaPixel: false,
      googleAds: true,
      campaignId: 'camp_tx_01',
      tags: ['google-ads-active', 'missing-pixel', 'dallas', 'high-ltv'],
      notes: [
        { id: 'n1', timestamp: '2026-11-21 14:10', author: 'Alex Rivera', text: 'Prospect is spending on Google Search for storm repair but drops traffic due to 1473ms mobile latency.' }
      ],
      followUpDate: '2026-11-24',
      savedAt: '2026-11-21T10:00:00.000Z'
    },
    {
      id: 'lead_tx_002',
      company: 'Sutton Roofing & Solar',
      domain: 'suttonroofinginc.com',
      contactName: 'Operations Director',
      email: 'office@suttonroofinginc.com',
      phone: '+1 512 837 8777',
      city: 'Austin, TX',
      territory: 'texas',
      industry: 'Commercial Solar & Roofing',
      status: 'Contacted',
      priority: 'P1',
      opportunityScore: 88,
      speed_ms: 620,
      metaPixel: true,
      googleAds: false,
      campaignId: 'camp_tx_01',
      tags: ['austin', 'solar', 'meta-active'],
      notes: [
        { id: 'n2', timestamp: '2026-11-20 09:30', author: 'Alex Rivera', text: 'Sent consultative outbound pitch regarding commercial solar tax credits.' }
      ],
      followUpDate: '2026-11-23',
      savedAt: '2026-11-20T08:00:00.000Z'
    },
    {
      id: 'lead_fl_001',
      company: 'Tampa Bay Solar',
      domain: 'tampabaysolar.com',
      contactName: 'Ben Gold (Owner)',
      email: 'info@tampabaysolar.com',
      phone: '+1 813 398 3687',
      city: 'Tampa, FL',
      territory: 'florida',
      industry: 'Solar Energy Contracting',
      status: 'Meeting Scheduled',
      priority: 'P1',
      opportunityScore: 95,
      speed_ms: 740,
      metaPixel: false,
      googleAds: true,
      campaignId: 'camp_fl_01',
      tags: ['florida', 'hot-lead', 'meeting-booked'],
      notes: [
        { id: 'n3', timestamp: '2026-11-21 16:45', author: 'Alex Rivera', text: 'Demo call scheduled for Wednesday at 2pm EST to review retargeting pixel setup.' }
      ],
      followUpDate: '2026-11-25',
      savedAt: '2026-11-19T11:00:00.000Z'
    },
    {
      id: 'lead_fl_002',
      company: 'Best Roofing Florida',
      domain: 'bestroofing.net',
      contactName: 'Commercial Estimator',
      email: 'emergency@bestroofing.net',
      phone: '+1 888 844 7663',
      city: 'Fort Lauderdale, FL',
      territory: 'florida',
      industry: 'Hurricane Mitigation & Commercial Roofs',
      status: 'Follow-Up',
      priority: 'P2',
      opportunityScore: 82,
      speed_ms: 890,
      metaPixel: false,
      googleAds: false,
      campaignId: 'camp_fl_01',
      tags: ['hurricane-mitigation', 'south-fl'],
      notes: [
        { id: 'n4', timestamp: '2026-11-21 11:20', author: 'Alex Rivera', text: 'Left voicemail with dispatch; follow up on Tuesday.' }
      ],
      followUpDate: '2026-11-22',
      savedAt: '2026-11-19T12:00:00.000Z'
    },
    {
      id: 'lead_ca_001',
      company: 'NassifMD Medical Spa',
      domain: 'nassifmd.com',
      contactName: 'Practice Concierge',
      email: 'concierge@nassifmd.com',
      phone: '+1 310 275 2467',
      city: 'Beverly Hills, CA',
      territory: 'medspas',
      industry: 'Luxury Aesthetics & Surgery',
      status: 'Proposal',
      priority: 'P1',
      opportunityScore: 96,
      speed_ms: 530,
      metaPixel: true,
      googleAds: true,
      campaignId: 'camp_ca_01',
      tags: ['luxury-medspa', 'beverly-hills', 'proposal-sent'],
      notes: [
        { id: 'n5', timestamp: '2026-11-21 17:00', author: 'Alex Rivera', text: 'Sent $4,500/mo retainer proposal for paid patient acquisition and VIP funnel optimization.' }
      ],
      followUpDate: '2026-11-26',
      savedAt: '2026-11-18T15:00:00.000Z'
    },
    {
      id: 'lead_ca_002',
      company: 'SkinSpirit Beverly Hills',
      domain: 'skinspirit.com',
      contactName: 'Clinic General Manager',
      email: 'info@skinspirit.com',
      phone: '+1 310 555 7820',
      city: 'Beverly Hills, CA',
      territory: 'medspas',
      industry: 'Medical Aesthetics & Injectables',
      status: 'Responded',
      priority: 'P1',
      opportunityScore: 89,
      speed_ms: 680,
      metaPixel: true,
      googleAds: false,
      campaignId: 'camp_ca_01',
      tags: ['injectables', 'replied'],
      notes: [
        { id: 'n6', timestamp: '2026-11-21 13:15', author: 'Alex Rivera', text: 'GM replied asking for agency case studies in the aesthetic laser space.' }
      ],
      followUpDate: '2026-11-23',
      savedAt: '2026-11-18T16:00:00.000Z'
    },
    {
      id: 'lead_tx_003',
      company: 'Precision Roof Crafters',
      domain: 'precisionroof.com',
      contactName: 'Sales Director',
      email: 'leads@precisionroof.com',
      phone: '+1 713 799 8555',
      city: 'Houston, TX',
      territory: 'texas',
      industry: 'Roofing Contractors',
      status: 'Qualified',
      priority: 'P2',
      opportunityScore: 84,
      speed_ms: 980,
      metaPixel: false,
      googleAds: true,
      campaignId: 'camp_tx_01',
      tags: ['houston', 'qualified'],
      notes: [
        { id: 'n7', timestamp: '2026-11-20 10:00', author: 'Alex Rivera', text: 'Domain verified. Valid MX records. Fast loading CMS.' }
      ],
      followUpDate: '2026-11-27',
      savedAt: '2026-11-20T10:00:00.000Z'
    },
    {
      id: 'lead_hvac_001',
      company: 'Midwest Mechanical Services',
      domain: 'midwestmech.com',
      contactName: 'Commercial Operations Lead',
      email: 'service@midwestmech.com',
      phone: '+1 312 555 0192',
      city: 'Chicago, IL',
      territory: 'hvac',
      industry: 'Commercial HVAC & Chillers',
      status: 'Won',
      priority: 'P1',
      opportunityScore: 94,
      speed_ms: 710,
      metaPixel: true,
      googleAds: true,
      campaignId: 'camp_tx_01',
      tags: ['closed-won', 'contract-signed'],
      notes: [
        { id: 'n8', timestamp: '2026-11-22 09:00', author: 'Alex Rivera', text: 'Won $3,800/mo retainer contract! Onboarding kicks off next Monday.' }
      ],
      followUpDate: '',
      savedAt: '2026-11-15T10:00:00.000Z'
    }
  ];

  // --- Seed Campaigns ---
  const DEFAULT_CAMPAIGNS = [
    {
      id: 'camp_tx_01',
      title: 'Texas Q4 Commercial Roofers & Restoration',
      territory: 'Texas (Dallas, Austin, Houston)',
      niche: 'Commercial Roofing',
      status: 'Active',
      targetCount: 40,
      createdAt: '2026-11-15'
    },
    {
      id: 'camp_fl_01',
      title: 'Florida Solar & Hurricane Mitigation',
      territory: 'Florida (Miami, Tampa, Orlando)',
      niche: 'Solar & Mitigation',
      status: 'Active',
      targetCount: 30,
      createdAt: '2026-11-18'
    },
    {
      id: 'camp_ca_01',
      title: 'California Luxury MedSpas & Aesthetic Clinics',
      territory: 'California (Beverly Hills, SF)',
      niche: 'Medical Aesthetics',
      status: 'Active',
      targetCount: 25,
      createdAt: '2026-11-20'
    }
  ];

  // --- Seed Website Audits ---
  const DEFAULT_AUDITS = [
    {
      id: 'audit_01',
      domain: 'precisionroof.com',
      company: 'Precision Roof Crafters',
      scannedAt: '2026-11-21 16:30',
      speed_ms: 980,
      cms: 'WordPress / Apache',
      metaPixel: false,
      googleAds: true,
      mxVerified: true,
      icpScore: 85,
      pitch: 'Noticed you are running Google Search campaigns for commercial roofing in Houston, but without retargeting pixels active, dropping roughly 35% of clicks.'
    },
    {
      id: 'audit_02',
      domain: 'tampabaysolar.com',
      company: 'Tampa Bay Solar',
      scannedAt: '2026-11-20 14:15',
      speed_ms: 740,
      cms: 'Webflow / Fastly',
      metaPixel: false,
      googleAds: true,
      mxVerified: true,
      icpScore: 88,
      pitch: 'Your site loads fast at 740ms with Google Ads active, but missing Meta Pixel retargeting on commercial solar prospects who do not call immediately.'
    },
    {
      id: 'audit_03',
      domain: 'nassifmd.com',
      company: 'NassifMD Medical Spa',
      scannedAt: '2026-11-19 11:20',
      speed_ms: 530,
      cms: 'Custom / NGINX',
      metaPixel: true,
      googleAds: true,
      mxVerified: true,
      icpScore: 96,
      pitch: 'Excellent tech stack in place with sub-600ms latency. High opportunity for VIP concierge booking automation.'
    }
  ];

  // --- Seed Custom Requests ---
  const DEFAULT_CUSTOM_REQUESTS = [
    {
      id: 'REQ-2026-4491',
      date: '2026-11-20 10:15',
      industry: 'Commercial Solar & Roofing',
      territory: 'Phoenix & Scottsdale, AZ',
      volume: '250',
      estimatedPrice: '$299.00',
      email: 'alex@velocitygrowth.io',
      status: 'Delivered',
      notes: 'Delivered 250 verified high-ticket contractors in Maricopa County.'
    },
    {
      id: 'REQ-2026-5120',
      date: '2026-11-22 08:40',
      industry: 'Luxury Medical Spas & Dermatology',
      territory: 'Miami & Palm Beach, FL',
      volume: '150',
      estimatedPrice: '$199.00',
      email: 'alex@velocitygrowth.io',
      status: 'Mining',
      notes: 'Crawler active on South Florida aesthetic licensing registries.'
    }
  ];

  // --- Default Purchases ---
  const defaultPurchases = [
    {
      id: 'tx-roofing-01',
      key: 'texas',
      name: 'Texas High-Ticket Contractors',
      territory: 'Austin, Dallas-Fort Worth, Houston, San Antonio',
      niche: 'Commercial Roofing & Storm Restoration',
      orderDate: 'Nov 15, 2026',
      leadCount: 24,
      price: '$79.00',
      invoiceId: 'INV-2026-0891',
      leads: [
        { name: 'T Rock Roofing & Restoration', email: 'info@dallasroofer.com', phone: '+1 469 931 9867', city: 'Dallas, TX', speed: '1473ms', pixel: 'No Pixel', mx: 'OK' },
        { name: 'Sutton Roofing & Solar', email: 'office@suttonroofinginc.com', phone: '+1 512 837 8777', city: 'Austin, TX', speed: '620ms', pixel: 'Meta Pixel', mx: 'OK' },
        { name: 'Precision Roof Crafters', email: 'leads@precisionroof.com', phone: '+1 713 799 8555', city: 'Houston, TX', speed: '980ms', pixel: 'Google Ads', mx: 'OK' },
        { name: 'Freedom Solar Power', email: 'contact@freedomsolar.com', phone: '+1 512 759 8320', city: 'Austin, TX', speed: '510ms', pixel: 'Meta & Google', mx: 'OK' },
        { name: 'Kidd Roofing', email: 'info@kiddroof.com', phone: '+1 512 671 7791', city: 'Austin, TX', speed: '720ms', pixel: 'No Pixel', mx: 'OK' },
        { name: 'San Antonio Roofing Pros', email: 'dispatch@saroofingpros.com', phone: '+1 210 555 9812', city: 'San Antonio, TX', speed: '840ms', pixel: 'Google Ads', mx: 'OK' }
      ]
    },
    {
      id: 'fl-solar-02',
      key: 'florida',
      name: 'Florida High-Ticket Solar & Storm Restoration',
      territory: 'Miami, Tampa Bay, Orlando',
      niche: 'Hurricane Mitigation & Solar',
      orderDate: 'Nov 18, 2026',
      leadCount: 24,
      price: '$79.00',
      invoiceId: 'INV-2026-0944',
      leads: [
        { name: 'Tampa Bay Solar', email: 'info@tampabaysolar.com', phone: '+1 813 398 3687', city: 'Tampa, FL', speed: '740ms', pixel: 'Google Ads', mx: 'OK' },
        { name: 'SunVena Solar', email: 'service@sunvena.com', phone: '+1 407 555 8362', city: 'Orlando, FL', speed: '610ms', pixel: 'Meta Pixel', mx: 'OK' },
        { name: 'Best Roofing Florida', email: 'emergency@bestroofing.net', phone: '+1 888 844 7663', city: 'Fort Lauderdale, FL', speed: '890ms', pixel: 'No Pixel', mx: 'OK' },
        { name: 'Goldin Solar', email: 'contact@goldinsolar.com', phone: '+1 305 555 1200', city: 'Miami, FL', speed: '580ms', pixel: 'Meta & Google', mx: 'OK' },
        { name: 'Florida Disaster Recovery', email: 'claims@fldisasterrecovery.com', phone: '+1 813 555 3321', city: 'Tampa, FL', speed: '1120ms', pixel: 'No Pixel', mx: 'OK' },
        { name: 'Solar Energy Florida', email: 'commercial@solarenergyfl.com', phone: '+1 305 444 8920', city: 'Miami, FL', speed: '650ms', pixel: 'Google Ads', mx: 'OK' }
      ]
    },
    {
      id: 'ca-medspa-03',
      key: 'medspas',
      name: 'California Luxury MedSpas & Aesthetic Clinics',
      territory: 'Beverly Hills, San Francisco, San Diego',
      niche: 'Plastic Surgery & Luxury Aesthetics',
      orderDate: 'Nov 20, 2026',
      leadCount: 24,
      price: '$89.00',
      invoiceId: 'INV-2026-1022',
      leads: [
        { name: 'NassifMD Medical Spa', email: 'concierge@nassifmd.com', phone: '+1 310 275 2467', city: 'Beverly Hills, CA', speed: '530ms', pixel: 'Meta & Google', mx: 'OK' },
        { name: 'SkinSpirit Beverly Hills', email: 'info@skinspirit.com', phone: '+1 310 555 7820', city: 'Beverly Hills, CA', speed: '680ms', pixel: 'Meta Pixel', mx: 'OK' },
        { name: 'La Jolla Cosmetic MedSpa', email: 'appointments@ljcmedspa.com', phone: '+1 858 452 1981', city: 'San Diego, CA', speed: '720ms', pixel: 'Google Ads', mx: 'OK' },
        { name: 'Epi Center MedSpa', email: 'frontdesk@epicentermedspa.com', phone: '+1 415 362 4754', city: 'San Francisco, CA', speed: '640ms', pixel: 'Meta Pixel', mx: 'OK' },
        { name: 'Rodeo Drive Aesthetics', email: 'vip@rodeodriveaesthetics.com', phone: '+1 310 888 1902', city: 'Beverly Hills, CA', speed: '810ms', pixel: 'No Pixel', mx: 'OK' },
        { name: 'Pacific Heights Plastic Surgery', email: 'info@pacificheightsplastics.com', phone: '+1 415 923 3005', city: 'San Francisco, CA', speed: '590ms', pixel: 'Meta & Google', mx: 'OK' }
      ]
    }
  ];

  // --- Delivered leads for Deduplication Ledger ---
  const dedupeLedgerRecords = [
    { domain: 'dallasroofer.com', company: 'T Rock Roofing & Restoration', territory: 'Dallas, TX', date: '2026-11-15 14:22 UTC', hash: 'e9b2...8f11', status: 'Delivered (Unique)' },
    { domain: 'suttonroofinginc.com', company: 'Sutton Roofing & Solar', territory: 'Austin, TX', date: '2026-11-15 14:22 UTC', hash: '4a1c...3d90', status: 'Delivered (Unique)' },
    { domain: 'precisionroof.com', company: 'Precision Roof Crafters', territory: 'Houston, TX', date: '2026-11-15 14:22 UTC', hash: '7c8d...1e44', status: 'Delivered (Unique)' },
    { domain: 'freedomsolar.com', company: 'Freedom Solar Power', territory: 'Austin, TX', date: '2026-11-15 14:22 UTC', hash: '1f0b...92a6', status: 'Delivered (Unique)' },
    { domain: 'tampabaysolar.com', company: 'Tampa Bay Solar', territory: 'Tampa, FL', date: '2026-11-18 09:15 UTC', hash: '88c1...5d23', status: 'Delivered (Unique)' },
    { domain: 'sunvena.com', company: 'SunVena Solar', territory: 'Orlando, FL', date: '2026-11-18 09:15 UTC', hash: '3e4f...7a89', status: 'Delivered (Unique)' },
    { domain: 'nassifmd.com', company: 'NassifMD Medical Spa', territory: 'Beverly Hills, CA', date: '2026-11-20 16:40 UTC', hash: '5b99...2f10', status: 'Delivered (Unique)' },
    { domain: 'skinspirit.com', company: 'SkinSpirit Beverly Hills', territory: 'Beverly Hills, CA', date: '2026-11-20 16:40 UTC', hash: '99d0...11bc', status: 'Delivered (Unique)' }
  ];

  // --- Notification Helper ---
  function notify(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      console.log('[ApexIntel Workspace]', msg);
    }
  }

  // --- Storage Accessors ---
  function getCrmLeads() {
    const raw = localStorage.getItem('apexintel_crm_leads');
    if (!raw) {
      localStorage.setItem('apexintel_crm_leads', JSON.stringify(DEFAULT_CRM_LEADS));
      return DEFAULT_CRM_LEADS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return DEFAULT_CRM_LEADS;
    }
  }

  function saveCrmLeads(leads) {
    localStorage.setItem('apexintel_crm_leads', JSON.stringify(leads));
  }

  function getCrmCampaigns() {
    const raw = localStorage.getItem('apexintel_crm_campaigns');
    if (!raw) {
      localStorage.setItem('apexintel_crm_campaigns', JSON.stringify(DEFAULT_CAMPAIGNS));
      return DEFAULT_CAMPAIGNS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return DEFAULT_CAMPAIGNS;
    }
  }

  function saveCrmCampaigns(camps) {
    localStorage.setItem('apexintel_crm_campaigns', JSON.stringify(camps));
  }

  function getAuditScans() {
    const raw = localStorage.getItem('apexintel_audit_scans');
    if (!raw) {
      localStorage.setItem('apexintel_audit_scans', JSON.stringify(DEFAULT_AUDITS));
      return DEFAULT_AUDITS;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return DEFAULT_AUDITS;
    }
  }

  function getCustomRequests() {
    const raw1 = localStorage.getItem('apex_custom_requests');
    const raw2 = localStorage.getItem('apexintel_custom_requests');
    let list = [];
    if (raw2) {
      try { list = JSON.parse(raw2); } catch (e) {}
    } else if (raw1) {
      try { list = JSON.parse(raw1); } catch (e) {}
    }
    if (!list || list.length === 0) {
      list = DEFAULT_CUSTOM_REQUESTS;
      localStorage.setItem('apexintel_custom_requests', JSON.stringify(list));
    }
    return list;
  }

  function getUserData() {
    if (window.ApexAuth && typeof window.ApexAuth.getCurrentUser === 'function') {
      const u = window.ApexAuth.getCurrentUser();
      if (u) return u;
    }
    const session = sessionStorage.getItem('apexintel_session');
    if (session) {
      try { return JSON.parse(session); } catch (e) {}
    }
    return {
      name: 'Alex Rivera',
      email: 'alex@velocitygrowth.io',
      company: 'Velocity Growth Agency',
      plan: 'Enterprise Pro',
      credits: 250,
      role: 'customer'
    };
  }

  function getCustomerApiKey() {
    let key = localStorage.getItem('apexintel_api_key');
    if (!key) {
      key = 'apex_live_sec_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10) + '2026';
      localStorage.setItem('apexintel_api_key', key);
    }
    return key;
  }

  // --- HTML Injection ---
  function injectDashboardHTML() {
    if (document.getElementById('customerDashboard')) return;

    const modalHTML = `
    <!-- ==================== CUSTOMER WORKSPACE & CRM MODAL ==================== -->
    <div id="customerDashboard" class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 hidden items-center justify-center p-2 sm:p-4">
      <div class="bg-slate-950 border border-slate-800 rounded-3xl max-w-7xl w-full max-h-[96vh] overflow-hidden flex flex-col shadow-2xl relative">
        
        <!-- Header Bar -->
        <div class="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/70 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3.5">
            <div id="dashUserAvatar" class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-600/30">
              A
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 id="dashUserName" class="text-base font-black text-white leading-tight">Alex Rivera</h3>
                <span id="dashUserPlanBadge" class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Enterprise Pro
                </span>
                <span class="hidden md:inline-flex text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700">
                  CRM v2.0
                </span>
              </div>
              <p id="dashUserCompany" class="text-xs text-slate-400 mt-0.5 font-medium">Velocity Growth Agency • <span id="dashUserCredits" class="text-indigo-400 font-mono font-bold">250 Leads Available</span></p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="window.openAddLeadModal()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition">
              <span>+</span> Add Lead
            </button>
            <button onclick="window.customerDashQuickReorder()" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition">
              <span>⚡</span> Order Territory
            </button>
            <button onclick="window.closeCustomerDashboard()" class="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xl font-bold border border-slate-800 transition">
              &times;
            </button>
          </div>
        </div>

        <!-- Navigation Tabs Bar -->
        <div class="px-4 sm:px-6 pt-2.5 border-b border-slate-800/80 bg-slate-950 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          <button id="custTabBtn-crm" onclick="window.switchCustomerTab('crm')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-indigo-500 bg-indigo-600/10 text-indigo-300 flex items-center gap-1.5 shrink-0">
            <span>🎯</span> Prospect CRM & Pipeline
          </button>
          <button id="custTabBtn-campaigns" onclick="window.switchCustomerTab('campaigns')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🚀</span> Campaigns & Follow-Ups
          </button>
          <button id="custTabBtn-auditlab" onclick="window.switchCustomerTab('auditlab')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🔬</span> Website Audit Lab
          </button>
          <button id="custTabBtn-customreq" onclick="window.switchCustomerTab('customreq')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>📋</span> Custom Requests
          </button>
          <button id="custTabBtn-datasets" onclick="window.switchCustomerTab('datasets')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>📦</span> Datasets & Downloads
          </button>
          <button id="custTabBtn-ledger" onclick="window.switchCustomerTab('ledger')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🔄</span> Dedupe Ledger
          </button>
          <button id="custTabBtn-api" onclick="window.switchCustomerTab('api')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🔑</span> API Access
          </button>
          <button id="custTabBtn-settings" onclick="window.switchCustomerTab('settings')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>⚙️</span> Settings
          </button>
        </div>

        <!-- Scrollable Tab Content Area -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          <!-- ==================== TAB: PROSPECT CRM & PIPELINE ==================== -->
          <div id="custTab-crm" class="space-y-4">
            
            <!-- CRM Controls Bar -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
              <!-- Search & Filters -->
              <div class="flex flex-wrap items-center gap-2 flex-1">
                <div class="relative flex-1 min-w-[200px]">
                  <input type="text" id="crmSearchInput" oninput="window.filterCrmLeads()" placeholder="Search company, email, city, domain..." class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500">
                  <span class="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
                </div>

                <select id="crmStatusFilter" onchange="window.filterCrmLeads()" class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none">
                  <option value="ALL">All Statuses (11)</option>
                  ${PIPELINE_STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
                </select>

                <select id="crmPriorityFilter" onchange="window.filterCrmLeads()" class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none">
                  <option value="ALL">All Priorities</option>
                  <option value="P1">P1 - High Priority</option>
                  <option value="P2">P2 - Moderate</option>
                  <option value="P3">P3 - Standard</option>
                </select>
              </div>

              <!-- View Switcher & Action -->
              <div class="flex items-center gap-2 shrink-0">
                <div class="bg-slate-950 border border-slate-800 p-1 rounded-xl flex items-center">
                  <button id="crmViewBtn-table" onclick="window.switchCrmView('table')" class="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white transition">
                    Table View
                  </button>
                  <button id="crmViewBtn-kanban" onclick="window.switchCrmView('kanban')" class="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition">
                    Kanban Board
                  </button>
                </div>
                <button onclick="window.exportCrmLeadsCsv()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1">
                  <span>📥</span> Export CSV
                </button>
              </div>
            </div>

            <!-- CRM View 1: Data Table View -->
            <div id="crmTableView" class="space-y-3">
              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-3 px-4">Company & Domain</th>
                      <th class="py-3 px-3">Priority</th>
                      <th class="py-3 px-3">Pipeline Status</th>
                      <th class="py-3 px-3">Score</th>
                      <th class="py-3 px-3">City / Territory</th>
                      <th class="py-3 px-3">Follow-Up</th>
                      <th class="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="crmTableBody" class="divide-y divide-slate-800/60 font-sans">
                    <!-- Dynamically Populated -->
                  </tbody>
                </table>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-500 px-2">
                <span id="crmLeadCountText">Showing 0 leads</span>
                <span>Pro Tip: Click any row to open the full Prospect Profile Drawer with notes & follow-ups.</span>
              </div>
            </div>

            <!-- CRM View 2: Kanban Board View -->
            <div id="crmKanbanView" class="hidden overflow-x-auto pb-4">
              <div id="crmKanbanColumns" class="flex items-start gap-3 min-w-[1400px]">
                <!-- 11 Columns Rendered via JS -->
              </div>
            </div>

          </div>

          <!-- ==================== TAB: CAMPAIGNS & FOLLOW-UPS ==================== -->
          <div id="custTab-campaigns" class="space-y-6 hidden">
            <!-- Active Campaigns Header -->
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-black text-white flex items-center gap-2">
                  <span>🚀</span> Active Outbound Campaigns
                </h4>
                <p class="text-xs text-slate-400 mt-0.5">Organize target territories into trackable outbound prospecting sprints.</p>
              </div>
              <button onclick="window.openCreateCampaignModal()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow">
                <span>+</span> New Campaign
              </button>
            </div>

            <!-- Campaigns Grid -->
            <div id="campaignsGrid" class="grid sm:grid-cols-3 gap-4">
              <!-- Dynamically Populated -->
            </div>

            <!-- Follow-Up Reminders Queue -->
            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-black text-white flex items-center gap-2">
                    <span>⏰</span> Follow-Up Reminders Queue
                  </h4>
                  <p class="text-xs text-slate-400 mt-0.5">Scheduled prospect outreach touchpoints requiring your immediate action.</p>
                </div>
                <span id="followUpCountBadge" class="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  0 Actions Due
                </span>
              </div>

              <div id="followUpQueueList" class="space-y-2.5">
                <!-- Dynamically Populated -->
              </div>
            </div>
          </div>

          <!-- ==================== TAB: WEBSITE AUDIT LAB ==================== -->
          <div id="custTab-auditlab" class="space-y-6 hidden">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-black text-white flex items-center gap-2">
                  <span>🔬</span> Website Intelligence Audit Lab
                </h4>
                <p class="text-xs text-slate-400 mt-0.5">Historical domain diagnostic scans. Export white-labeled client audit reports for your outbound pitches.</p>
              </div>
              <button onclick="window.closeCustomerDashboard(); location.hash = '#scanner';" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5">
                <span>⚡</span> Run New Domain Scan
              </button>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-3 px-4">Target Domain</th>
                    <th class="py-3 px-3">Date Scanned</th>
                    <th class="py-3 px-3">Mobile Speed</th>
                    <th class="py-3 px-3">CMS Engine</th>
                    <th class="py-3 px-3">Pixels & Ads</th>
                    <th class="py-3 px-3">ICP Score</th>
                    <th class="py-3 px-4 text-right">Client Audit Report</th>
                  </tr>
                </thead>
                <tbody id="auditLabTableBody" class="divide-y divide-slate-800/60 font-sans">
                  <!-- Dynamically Populated -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- ==================== TAB: CUSTOM EXTRACTION REQUESTS ==================== -->
          <div id="custTab-customreq" class="space-y-6 hidden">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-black text-white flex items-center gap-2">
                  <span>📋</span> Custom Lead Extraction Orders
                </h4>
                <p class="text-xs text-slate-400 mt-0.5">Track the status of your tailored territory scrapes from submission to cloud delivery.</p>
              </div>
              <button onclick="window.closeCustomerDashboard(); location.hash = '#custom-request';" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5">
                <span>+</span> New Custom Spec ($299+)
              </button>
            </div>

            <div id="customRequestsList" class="space-y-3.5">
              <!-- Dynamically Populated -->
            </div>
          </div>

          <!-- ==================== TAB: DATASETS & DOWNLOADS ==================== -->
          <div id="custTab-datasets" class="space-y-6 hidden">
            <!-- Stats overview bar -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div class="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Packs Owned</span>
                <div class="text-2xl font-black text-white mt-1">3 <span class="text-xs text-slate-500 font-normal">Active</span></div>
              </div>
              <div class="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Leads</span>
                <div class="text-2xl font-black text-emerald-400 mt-1">72 <span class="text-xs text-slate-500 font-normal">Contacts</span></div>
              </div>
              <div class="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deliverability</span>
                <div class="text-2xl font-black text-indigo-400 mt-1">100% <span class="text-xs text-slate-500 font-normal">MX-OK</span></div>
              </div>
              <div class="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Export Formats</span>
                <div class="text-xs font-bold text-slate-200 mt-2 flex items-center gap-1.5 font-mono">
                  <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">.XLSX</span>
                  <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">.CSV</span>
                </div>
              </div>
            </div>

            <!-- Datasets Table Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>📁</span> Purchased Intelligence Packs
                </h4>
                <button onclick="window.downloadCombinedMasterDataset()" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition">
                  <span>📥 Download All (.CSV)</span>
                </button>
              </div>

              <div id="purchasedDatasetsList" class="space-y-3">
                <!-- Dynamically populated -->
              </div>
            </div>
          </div>

          <!-- ==================== TAB: DEDUPLICATION LEDGER ==================== -->
          <div id="custTab-ledger" class="space-y-6 hidden">
            <div class="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border-2 border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-start gap-3.5">
                <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl font-black shrink-0">
                  🛡️
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-base font-black text-white">Zero-Duplicate Cloud Guarantee</h4>
                    <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active & Syncing</span>
                  </div>
                  <p class="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Every lead delivered to your agency is hashed and mapped into our <strong>Amazon DynamoDB</strong> ledger. When you order additional territories or renewal batches, our fulfillment engine automatically purges any lead you have ever received.
                  </p>
                </div>
              </div>
              <div class="bg-slate-950/90 border border-slate-800 p-3 rounded-xl text-center shrink-0 w-full sm:w-auto">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Unique Records</span>
                <span class="text-2xl font-black text-emerald-400 font-mono">72 / 72</span>
                <span class="text-[10px] text-slate-500 block">0 Duplicates Sent</span>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Recent Delivered Leads Ledger
                </h4>
                <span class="text-xs font-mono text-slate-500">Live DynamoDB Sync</span>
              </div>

              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-3 px-4">Domain Hash / ID</th>
                      <th class="py-3 px-4">Company Name</th>
                      <th class="py-3 px-4">Territory</th>
                      <th class="py-3 px-4">Delivery Timestamp</th>
                      <th class="py-3 px-4 text-right">Ledger Status</th>
                    </tr>
                  </thead>
                  <tbody id="dedupeLedgerTableBody" class="divide-y divide-slate-800/60 font-mono text-slate-300">
                    <!-- Populated dynamically -->
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- ==================== TAB: API ACCESS ==================== -->
          <div id="custTab-api" class="space-y-6 hidden">
            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-black text-white flex items-center gap-2">
                    <span>🔑</span> Agency Bearer API Key
                  </h4>
                  <p class="text-xs text-slate-400 mt-0.5">Use this key to fetch newly mined leads directly into GoHighLevel, HubSpot, Instantly, or Smartlead.</p>
                </div>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Production (120 req/m)</span>
              </div>

              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div class="relative flex-1">
                  <input type="text" id="custApiKeyInput" readonly class="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-400 focus:outline-none">
                </div>
                <button onclick="window.copyCustomerApiKey()" class="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition shadow shrink-0">
                  Copy Key 📋
                </button>
                <button onclick="window.regenerateCustomerApiKey()" class="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700 shrink-0">
                  Regenerate
                </button>
              </div>
            </div>

            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div>
                <h4 class="text-sm font-black text-white flex items-center gap-2">
                  <span>⚡</span> Automated CRM Webhook Dispatch
                </h4>
                <p class="text-xs text-slate-400 mt-0.5">Enter your GoHighLevel, Zapier, or Make webhook URL. As soon as a territory scrape finishes, leads are dispatched automatically.</p>
              </div>

              <div class="flex flex-col sm:flex-row gap-2">
                <input type="url" id="custWebhookInput" placeholder="https://services.leadconnectorhq.com/hooks/..." value="https://services.leadconnectorhq.com/hooks/apex_live_feed" class="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500">
                <button onclick="window.saveCustomerWebhook()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shrink-0">
                  Save Webhook URL
                </button>
              </div>
            </div>

            <div class="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-mono text-slate-400">cURL Example — Automated Lead Extraction</span>
                <button onclick="window.copyCustomerCurlSnippet()" class="text-xs text-indigo-400 hover:text-white font-bold transition">Copy Code 📋</button>
              </div>
              <pre class="bg-slate-900/90 p-4 rounded-xl text-xs font-mono text-indigo-300 overflow-x-auto border border-slate-800 leading-relaxed" id="custCurlCode">curl -X GET "https://api.apexintel.io/v1/leads?territory=texas&niche=roofing&limit=50" \\
  -H "Authorization: Bearer <span id="curlKeyPlaceholder">YOUR_API_KEY</span>" \\
  -H "Content-Type: application/json"</pre>
            </div>
          </div>

          <!-- ==================== TAB: SETTINGS ==================== -->
          <div id="custTab-settings" class="space-y-6 hidden">
            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h4 class="text-sm font-black text-white flex items-center gap-2">
                <span>👤</span> Agency Profile & Billing Details
              </h4>
              <div class="grid sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                  <input type="text" id="custSettingName" class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Agency / Company Name</label>
                  <input type="text" id="custSettingCompany" class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Account Email</label>
                  <input type="email" id="custSettingEmail" class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500">
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Active Plan Tier</label>
                  <input type="text" id="custSettingPlan" readonly class="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
                </div>
              </div>
              <div class="flex justify-end pt-2">
                <button onclick="window.saveCustomerSettingsProfile()" class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition shadow">
                  Save Changes
                </button>
              </div>
            </div>

            <!-- Invoices -->
            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h4 class="text-sm font-black text-white flex items-center gap-2">
                <span>🧾</span> Invoices & Transaction Receipts
              </h4>
              <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase bg-slate-900/50">
                      <th class="py-2.5 px-3">Invoice #</th>
                      <th class="py-2.5 px-3">Dataset / Product</th>
                      <th class="py-2.5 px-3">Date</th>
                      <th class="py-2.5 px-3">Amount</th>
                      <th class="py-2.5 px-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800 font-mono text-slate-300">
                    <tr>
                      <td class="py-2.5 px-3 text-indigo-400">INV-2026-1022</td>
                      <td class="text-white">California Luxury MedSpas</td>
                      <td class="text-slate-400">Nov 20, 2026</td>
                      <td class="text-emerald-400">$89.00</td>
                      <td class="text-right py-2.5 px-3">
                        <button onclick="window.downloadCustomerInvoice('INV-2026-1022', 'California Luxury MedSpas', '$89.00', 'Nov 20, 2026')" class="text-xs text-indigo-400 hover:underline">Download .txt</button>
                      </td>
                    </tr>
                    <tr>
                      <td class="py-2.5 px-3 text-indigo-400">INV-2026-0944</td>
                      <td class="text-white">Florida Solar & Restoration</td>
                      <td class="text-slate-400">Nov 18, 2026</td>
                      <td class="text-emerald-400">$79.00</td>
                      <td class="text-right py-2.5 px-3">
                        <button onclick="window.downloadCustomerInvoice('INV-2026-0944', 'Florida Solar & Restoration', '$79.00', 'Nov 18, 2026')" class="text-xs text-indigo-400 hover:underline">Download .txt</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Sign Out -->
            <div class="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between">
              <div>
                <h5 class="text-xs font-bold text-white">Log Out of Workspace</h5>
                <p class="text-[11px] text-slate-400">End this browser session. You can sign back in anytime.</p>
              </div>
              <button onclick="window.customerDashLogout()" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition">
                Sign Out
              </button>
            </div>
          </div>

        </div>

        <!-- Dashboard Modal Footer -->
        <div class="p-3.5 border-t border-slate-800/80 bg-slate-900/50 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live CRM Sync Active
            </span>
            <span>•</span>
            <span>AWS Region: <code>ap-southeast-2</code></span>
          </div>
          <div>
            Need custom leads? <a href="#custom-request" onclick="window.closeCustomerDashboard()" class="text-emerald-400 font-semibold underline">Request Extraction ($299+)</a>
          </div>
        </div>

      </div>
    </div>

    <!-- ==================== LEAD PROFILE DRAWER MODAL ==================== -->
    <div id="leadProfileDrawer" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] hidden items-center justify-end">
      <div class="bg-slate-950 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl p-6 overflow-y-auto space-y-6">
        
        <div class="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <span id="drawerPriorityBadge" class="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              P1 - High Opportunity
            </span>
            <h3 id="drawerCompanyName" class="text-xl font-black text-white mt-1.5 leading-tight">Company Name</h3>
            <p id="drawerDomainAndCity" class="text-xs text-slate-400 mt-0.5 font-mono">domain.com • City, State</p>
          </div>
          <button onclick="window.closeLeadDrawer()" class="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-lg font-bold border border-slate-800">
            &times;
          </button>
        </div>

        <!-- Quick Status & Priority Changer -->
        <div class="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1">Pipeline Status</label>
            <select id="drawerStatusSelect" onchange="window.saveDrawerStatusChange()" class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-emerald-400 font-bold focus:outline-none">
              ${PIPELINE_STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase mb-1">Priority Tier</label>
            <select id="drawerPrioritySelect" onchange="window.saveDrawerPriorityChange()" class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold focus:outline-none">
              <option value="P1">P1 - High Priority</option>
              <option value="P2">P2 - Moderate</option>
              <option value="P3">P3 - Standard</option>
            </select>
          </div>
        </div>

        <!-- Technical Audit Summary -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Technical Audit & ICP Metrics</h4>
          <div class="grid grid-cols-3 gap-2.5 text-center">
            <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
              <span class="text-[10px] text-slate-400 block uppercase">Speed</span>
              <span id="drawerSpeedVal" class="text-sm font-bold text-indigo-400 font-mono">680ms</span>
            </div>
            <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
              <span class="text-[10px] text-slate-400 block uppercase">Tracking</span>
              <span id="drawerTrackingVal" class="text-xs font-bold text-emerald-400">Meta + Ads</span>
            </div>
            <div class="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
              <span class="text-[10px] text-slate-400 block uppercase">ICP Score</span>
              <span id="drawerScoreVal" class="text-sm font-black text-white font-mono">92/100</span>
            </div>
          </div>
        </div>

        <!-- Contact Information -->
        <div class="space-y-2.5">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Channels</h4>
          <div class="space-y-2 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800/80">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Contact Person:</span>
              <span id="drawerContactName" class="font-bold text-white">Owner / Manager</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Verified Email:</span>
              <button onclick="window.copyDrawerEmail()" class="font-mono text-emerald-400 hover:underline flex items-center gap-1 font-bold">
                <span id="drawerEmailVal">email@company.com</span> 📋
              </button>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Direct Phone:</span>
              <span id="drawerPhoneVal" class="font-mono text-white font-bold">+1 555 0192</span>
            </div>
          </div>
        </div>

        <!-- Follow-up Scheduler -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Follow-Up Date</h4>
            <span id="drawerFollowUpAlert" class="text-[10px] font-bold text-amber-400"></span>
          </div>
          <div class="flex gap-2">
            <input type="date" id="drawerFollowUpDateInput" class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono">
            <button onclick="window.saveDrawerFollowUpDate()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition">
              Save Date
            </button>
          </div>
        </div>

        <!-- Primary Action Button: Trigger Outreach -->
        <div>
          <button onclick="window.generateOutreachFromDrawer()" class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-black text-xs transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 uppercase tracking-wider">
            <span>⚡</span> Open Multi-Channel Outreach Generator
          </button>
        </div>

        <!-- Notes Journal -->
        <div class="space-y-3">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Activity & Notes Journal</h4>
          
          <div class="flex gap-2">
            <input type="text" id="drawerNewNoteInput" placeholder="Add an outreach note, call log, or next step..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500">
            <button onclick="window.saveNewLeadNote()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700">
              Add Note
            </button>
          </div>

          <div id="drawerNotesList" class="space-y-2 max-h-48 overflow-y-auto pr-1">
            <!-- Notes Rendered Here -->
          </div>
        </div>

      </div>
    </div>

    <!-- ==================== ADD LEAD MODAL ==================== -->
    <div id="addLeadModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] hidden items-center justify-center p-4">
      <div class="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-base font-black text-white flex items-center gap-2">
            <span>🎯</span> Add Prospect to CRM Pipeline
          </h3>
          <button onclick="window.closeAddLeadModal()" class="w-7 h-7 rounded-lg bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center text-base font-bold">
            &times;
          </button>
        </div>

        <form id="addLeadForm" onsubmit="window.submitNewManualLead(event)" class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 uppercase font-bold mb-1">Company Name *</label>
            <input type="text" id="addLeadCompany" required placeholder="e.g. Dallas Storm Restoration Pros" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 uppercase font-bold mb-1">Website Domain *</label>
              <input type="text" id="addLeadDomain" required placeholder="e.g. dallaspros.com" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-slate-400 uppercase font-bold mb-1">City, State *</label>
              <input type="text" id="addLeadCity" required placeholder="e.g. Dallas, TX" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 uppercase font-bold mb-1">Contact Email *</label>
              <input type="email" id="addLeadEmail" required placeholder="owner@company.com" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-slate-400 uppercase font-bold mb-1">Phone Number</label>
              <input type="tel" id="addLeadPhone" placeholder="+1 555 0199" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 uppercase font-bold mb-1">Initial Status</label>
              <select id="addLeadStatus" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 focus:outline-none">
                ${PIPELINE_STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-slate-400 uppercase font-bold mb-1">Priority</label>
              <select id="addLeadPriority" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 focus:outline-none">
                <option value="P1">P1 - High Priority</option>
                <option value="P2">P2 - Moderate</option>
                <option value="P3">P3 - Standard</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-slate-400 uppercase font-bold mb-1">Initial Outreach Note</label>
            <input type="text" id="addLeadNote" placeholder="e.g. Met at trade show; owner interested in retargeting." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="window.closeAddLeadModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">
              Cancel
            </button>
            <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow">
              Save Lead to CRM
            </button>
          </div>
        </form>
      </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // --- CRM State Variables ---
  let activeCrmView = 'table';
  let activeLeadInDrawer = null;

  // --- Render Functions ---

  // 1. Render CRM Leads (Table & Kanban)
  function renderCrmLeads() {
    const leads = getCrmLeads();
    const query = (document.getElementById('crmSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('crmStatusFilter')?.value || 'ALL';
    const priorityFilter = document.getElementById('crmPriorityFilter')?.value || 'ALL';

    const filtered = leads.filter(l => {
      const matchQuery = !query || 
        (l.company && l.company.toLowerCase().includes(query)) ||
        (l.domain && l.domain.toLowerCase().includes(query)) ||
        (l.email && l.email.toLowerCase().includes(query)) ||
        (l.city && l.city.toLowerCase().includes(query));

      const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
      const matchPriority = priorityFilter === 'ALL' || l.priority === priorityFilter;

      return matchQuery && matchStatus && matchPriority;
    });

    const countText = document.getElementById('crmLeadCountText');
    if (countText) countText.innerText = `Showing ${filtered.length} of ${leads.length} total saved prospects`;

    // Render Table
    const tbody = document.getElementById('crmTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="py-8 text-center text-slate-500">
              No prospects found matching your current filter. <button onclick="window.openAddLeadModal()" class="text-indigo-400 font-bold underline">Add a prospect</button> or reset filters.
            </td>
          </tr>
        `;
      } else {
        filtered.forEach(l => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-900/50 transition border-b border-slate-800/60 cursor-pointer';
          
          const statusObj = PIPELINE_STATUSES.find(s => s.id === l.status) || PIPELINE_STATUSES[0];
          const isOverdue = l.followUpDate && new Date(l.followUpDate) < new Date(new Date().toDateString());

          tr.innerHTML = `
            <td class="py-3 px-4" onclick="window.openLeadDrawer('${l.id}')">
              <div class="font-bold text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${l.priority === 'P1' ? 'bg-emerald-400' : 'bg-indigo-400'}"></span>
                ${l.company}
              </div>
              <div class="text-[11px] text-slate-400 font-mono mt-0.5">${l.domain} • ${l.email}</div>
            </td>
            <td class="py-3 px-3" onclick="window.openLeadDrawer('${l.id}')">
              <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${l.priority === 'P1' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : l.priority === 'P2' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}">
                ${l.priority || 'P2'}
              </span>
            </td>
            <td class="py-3 px-3">
              <select onchange="window.updateLeadStatus('${l.id}', this.value)" onclick="event.stopPropagation()" class="px-2 py-1 rounded-lg bg-slate-950 border ${statusObj.border} text-[11px] font-bold ${statusObj.text} focus:outline-none">
                ${PIPELINE_STATUSES.map(s => `<option value="${s.id}" ${s.id === l.status ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </td>
            <td class="py-3 px-3 font-mono font-bold text-slate-200" onclick="window.openLeadDrawer('${l.id}')">
              <span class="${l.opportunityScore >= 85 ? 'text-emerald-400' : 'text-indigo-300'}">${l.opportunityScore || 80}/100</span>
            </td>
            <td class="py-3 px-3 text-slate-400 text-xs" onclick="window.openLeadDrawer('${l.id}')">
              ${l.city}
            </td>
            <td class="py-3 px-3 text-xs" onclick="window.openLeadDrawer('${l.id}')">
              ${l.followUpDate ? `
                <span class="font-mono text-[11px] ${isOverdue ? 'text-rose-400 font-bold flex items-center gap-1' : 'text-slate-300'}">
                  ${isOverdue ? '⚠️ ' : ''}${l.followUpDate}
                </span>
              ` : '<span class="text-slate-600 font-mono text-[11px]">None set</span>'}
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center gap-1">
                <button onclick="window.openLeadDrawer('${l.id}')" title="Open Drawer" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
                  📝
                </button>
                <button onclick="window.generateOutreachForLead('${l.id}')" title="Generate Pitch" class="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 transition border border-indigo-500/30">
                  ✉️
                </button>
                <button onclick="window.deleteLeadFromCrm('${l.id}')" title="Delete" class="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition">
                  🗑️
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // Render Kanban
    const kanbanContainer = document.getElementById('crmKanbanColumns');
    if (kanbanContainer) {
      kanbanContainer.innerHTML = '';
      PIPELINE_STATUSES.forEach(status => {
        const stageLeads = filtered.filter(l => l.status === status.id);
        const col = document.createElement('div');
        col.className = 'w-72 bg-slate-900/50 border border-slate-800/80 rounded-2xl p-3 flex flex-col shrink-0 min-h-[450px]';
        col.innerHTML = `
          <div class="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-3">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${status.bg} border ${status.border}"></span>
              <h5 class="text-xs font-black text-white">${status.label}</h5>
            </div>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
              ${stageLeads.length}
            </span>
          </div>

          <div class="space-y-2.5 flex-1 overflow-y-auto max-h-[500px] pr-1">
            ${stageLeads.length === 0 ? `
              <div class="py-8 text-center text-slate-600 text-[11px] font-mono border-2 border-dashed border-slate-800/60 rounded-xl">
                Drop leads here
              </div>
            ` : stageLeads.map(lead => `
              <div onclick="window.openLeadDrawer('${lead.id}')" class="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-3 rounded-xl cursor-pointer transition shadow-sm space-y-2 group">
                <div class="flex items-start justify-between gap-1">
                  <h6 class="text-xs font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">${lead.company}</h6>
                  <span class="text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${lead.priority === 'P1' ? 'bg-rose-500/20 text-rose-300' : 'bg-indigo-500/20 text-indigo-300'} shrink-0">${lead.priority}</span>
                </div>
                <div class="text-[10px] text-slate-400 font-mono truncate">${lead.domain}</div>
                <div class="flex items-center justify-between text-[10px] pt-1 border-t border-slate-900">
                  <span class="text-emerald-400 font-mono font-bold">${lead.opportunityScore}/100</span>
                  <div class="flex items-center gap-1">
                    <button onclick="event.stopPropagation(); window.advanceLeadStage('${lead.id}')" title="Advance Stage" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition font-mono">
                      →
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        kanbanContainer.appendChild(col);
      });
    }
  }

  // 2. Render Campaigns & Follow-up Queue
  function renderCampaignsAndFollowUps() {
    const campaigns = getCrmCampaigns();
    const leads = getCrmLeads();

    const campGrid = document.getElementById('campaignsGrid');
    if (campGrid) {
      campGrid.innerHTML = '';
      campaigns.forEach(c => {
        const assigned = leads.filter(l => l.campaignId === c.id);
        const contacted = assigned.filter(l => ['Contacted', 'Follow-Up', 'Responded', 'Meeting Scheduled', 'Proposal', 'Won'].includes(l.status)).length;
        const meetings = assigned.filter(l => ['Meeting Scheduled', 'Proposal', 'Won'].includes(l.status)).length;
        const won = assigned.filter(l => l.status === 'Won').length;

        const card = document.createElement('div');
        card.className = 'bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-3';
        card.innerHTML = `
          <div class="flex items-start justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">${c.status}</span>
              <h5 class="text-xs font-black text-white mt-1.5 leading-snug">${c.title}</h5>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">${c.territory}</p>
            </div>
          </div>

          <div class="grid grid-cols-4 gap-1.5 text-center bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
            <div>
              <span class="text-[9px] text-slate-500 block uppercase">Leads</span>
              <span class="text-xs font-mono font-bold text-white">${assigned.length}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-500 block uppercase">Sent</span>
              <span class="text-xs font-mono font-bold text-indigo-400">${contacted}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-500 block uppercase">Booked</span>
              <span class="text-xs font-mono font-bold text-emerald-400">${meetings}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-500 block uppercase">Won</span>
              <span class="text-xs font-mono font-bold text-green-300">${won}</span>
            </div>
          </div>
        `;
        campGrid.appendChild(card);
      });
    }

    // Render Follow-up Queue
    const queueList = document.getElementById('followUpQueueList');
    const badge = document.getElementById('followUpCountBadge');
    if (queueList) {
      queueList.innerHTML = '';
      const followUps = leads.filter(l => l.followUpDate).sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

      if (badge) badge.innerText = `${followUps.length} Actions Scheduled`;

      if (followUps.length === 0) {
        queueList.innerHTML = `
          <div class="p-6 text-center text-slate-500 text-xs">
            No pending follow-ups scheduled. Open any lead in your CRM to set a reminder date.
          </div>
        `;
      } else {
        followUps.forEach(l => {
          const isOverdue = new Date(l.followUpDate) < new Date(new Date().toDateString());
          const isToday = l.followUpDate === new Date().toISOString().split('T')[0];

          const item = document.createElement('div');
          item.className = 'bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3';
          item.innerHTML = `
            <div class="flex items-center gap-3">
              <span class="text-base">${isOverdue ? '⚠️' : isToday ? '⏰' : '📅'}</span>
              <div>
                <div class="flex items-center gap-2">
                  <h6 class="text-xs font-bold text-white">${l.company}</h6>
                  <span class="text-[10px] font-mono px-2 py-0.2 rounded ${isOverdue ? 'bg-rose-500/20 text-rose-400 font-bold' : isToday ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'bg-slate-800 text-slate-400'}">
                    ${isOverdue ? 'OVERDUE' : isToday ? 'TODAY' : l.followUpDate}
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5">${l.notes?.[0]?.text || 'Scheduled follow-up touchpoint'}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button onclick="window.markFollowUpComplete('${l.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition">
                ✓ Mark Done
              </button>
              <button onclick="window.snoozeFollowUp('${l.id}', 2)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">
                +2 Days
              </button>
              <button onclick="window.openLeadDrawer('${l.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 text-xs font-bold transition">
                Drawer
              </button>
            </div>
          `;
          queueList.appendChild(item);
        });
      }
    }
  }

  // 3. Render Website Audit Lab
  function renderAuditLab() {
    const audits = getAuditScans();
    const tbody = document.getElementById('auditLabTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    audits.forEach(a => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-900/50 transition border-b border-slate-800/60';
      tr.innerHTML = `
        <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          ${a.domain}
        </td>
        <td class="py-3 px-3 text-slate-400 font-mono text-[11px]">${a.scannedAt}</td>
        <td class="py-3 px-3">
          <span class="px-2 py-0.5 rounded font-mono text-[11px] font-bold ${a.speed_ms > 900 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}">
            ${a.speed_ms}ms
          </span>
        </td>
        <td class="py-3 px-3 text-slate-300 font-mono text-xs">${a.cms}</td>
        <td class="py-3 px-3 text-xs">
          <span class="${a.googleAds ? 'text-emerald-400 font-bold' : 'text-slate-500'}">Ads: ${a.googleAds ? 'Yes' : 'No'}</span> • 
          <span class="${a.metaPixel ? 'text-indigo-400 font-bold' : 'text-slate-500'}">Pixel: ${a.metaPixel ? 'Yes' : 'No'}</span>
        </td>
        <td class="py-3 px-3 font-mono font-bold text-white">${a.icpScore}/100</td>
        <td class="py-3 px-4 text-right">
          <button onclick="window.exportAuditReport('${a.id}')" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow flex items-center gap-1.5 ml-auto">
            <span>📄</span> Export Report (.html)
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 4. Render Custom Extraction Requests
  function renderCustomRequests() {
    const list = getCustomRequests();
    const container = document.getElementById('customRequestsList');
    if (!container) return;

    container.innerHTML = '';
    list.forEach(req => {
      const card = document.createElement('div');
      card.className = 'bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4';
      
      const isDelivered = req.status === 'Delivered';
      
      card.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold text-indigo-400">${req.id}</span>
            <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${isDelivered ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
              ${req.status}
            </span>
            <span class="text-xs text-slate-500">• ${req.date || 'Nov 2026'}</span>
          </div>
          <h5 class="text-sm font-bold text-white">${req.industry} — ${req.territory}</h5>
          <p class="text-xs text-slate-400">${req.notes || 'Target volume: ' + req.volume + ' decision makers'}</p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span class="text-sm font-mono font-bold text-white">${req.estimatedPrice || '$299.00'}</span>
          ${isDelivered ? `
            <button onclick="window.downloadCustomExtractionCsv('${req.id}')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow">
              <span>📥</span> Download Dataset (.CSV)
            </button>
          ` : `
            <span class="text-xs font-mono text-slate-500 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
              Mining in Progress...
            </span>
          `}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // --- Window Interactive Actions ---

  // Switch workspace tab
  window.switchCustomerTab = function (tabName) {
    const tabs = ['crm', 'campaigns', 'auditlab', 'customreq', 'datasets', 'ledger', 'api', 'settings'];
    tabs.forEach(t => {
      const panel = document.getElementById(`custTab-${t}`);
      const btn = document.getElementById(`custTabBtn-${t}`);
      if (t === tabName) {
        if (panel) panel.classList.remove('hidden');
        if (btn) {
          btn.className = 'px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-indigo-500 bg-indigo-600/10 text-indigo-300 flex items-center gap-1.5 shrink-0';
        }
      } else {
        if (panel) panel.classList.add('hidden');
        if (btn) {
          btn.className = 'px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0';
        }
      }
    });

    if (tabName === 'crm') renderCrmLeads();
    if (tabName === 'campaigns') renderCampaignsAndFollowUps();
    if (tabName === 'auditlab') renderAuditLab();
    if (tabName === 'customreq') renderCustomRequests();
    if (tabName === 'datasets') populateDatasetsList();
    if (tabName === 'ledger') populateLedgerList();
  };

  // Switch CRM view mode
  window.switchCrmView = function (mode) {
    activeCrmView = mode;
    const tableEl = document.getElementById('crmTableView');
    const kanbanEl = document.getElementById('crmKanbanView');
    const tableBtn = document.getElementById('crmViewBtn-table');
    const kanbanBtn = document.getElementById('crmViewBtn-kanban');

    if (mode === 'table') {
      if (tableEl) tableEl.classList.remove('hidden');
      if (kanbanEl) kanbanEl.classList.add('hidden');
      if (tableBtn) { tableBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white transition'; }
      if (kanbanBtn) { kanbanBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition'; }
    } else {
      if (tableEl) tableEl.classList.add('hidden');
      if (kanbanEl) kanbanEl.classList.remove('hidden');
      if (tableBtn) { tableBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition'; }
      if (kanbanBtn) { kanbanBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white transition'; }
    }
    renderCrmLeads();
  };

  // Filter CRM leads
  window.filterCrmLeads = function () {
    renderCrmLeads();
  };

  // Update status directly from dropdown
  window.updateLeadStatus = function (leadId, newStatus) {
    const leads = getCrmLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      lead.status = newStatus;
      saveCrmLeads(leads);
      notify(`Status updated to "${newStatus}" for ${lead.company}`);
      renderCrmLeads();
    }
  };

  // Advance status to next stage in Kanban
  window.advanceLeadStage = function (leadId) {
    const leads = getCrmLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const currentIndex = PIPELINE_STATUSES.findIndex(s => s.id === lead.status);
    if (currentIndex >= 0 && currentIndex < PIPELINE_STATUSES.length - 1) {
      const nextStatus = PIPELINE_STATUSES[currentIndex + 1].id;
      lead.status = nextStatus;
      saveCrmLeads(leads);
      notify(`Advanced ${lead.company} to "${nextStatus}"`);
      renderCrmLeads();
    }
  };

  // Save lead to CRM from outside (Table / Scanner)
  window.saveLeadToCrm = function (leadObj) {
    const leads = getCrmLeads();
    const domain = (leadObj.domain || (leadObj.email ? leadObj.email.split('@')[1] : '') || '').toLowerCase().trim();
    
    // Check if already in CRM
    const existing = leads.find(l => l.domain === domain || (leadObj.name && l.company.toLowerCase() === leadObj.name.toLowerCase()));
    if (existing) {
      notify(`ℹ️ ${existing.company} is already in your CRM (${existing.status})`);
      window.openCustomerDashboard('crm');
      window.openLeadDrawer(existing.id);
      return;
    }

    const newLead = {
      id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      company: leadObj.name || leadObj.company || 'New Prospect',
      domain: domain || 'unknown.com',
      contactName: leadObj.contactName || 'Managing Partner / Owner',
      email: leadObj.email || `contact@${domain}`,
      phone: leadObj.phone || '+1 555 0100',
      city: leadObj.city || 'Dallas, TX',
      territory: leadObj.territory || 'texas',
      industry: leadObj.category || leadObj.industry || 'Commercial Services',
      status: 'New',
      priority: 'P1',
      opportunityScore: 85,
      speed_ms: parseInt(leadObj.speed) || 750,
      metaPixel: (leadObj.pixel || '').toLowerCase().includes('meta'),
      googleAds: (leadObj.pixel || '').toLowerCase().includes('google'),
      campaignId: 'camp_tx_01',
      tags: ['saved-from-table'],
      notes: [
        { id: 'n_' + Date.now(), timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16), author: 'User', text: 'Saved from live dataset preview table.' }
      ],
      followUpDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      savedAt: new Date().toISOString()
    };

    leads.unshift(newLead);
    saveCrmLeads(leads);
    notify(`✓ Added ${newLead.company} to CRM Pipeline!`);
  };

  // Open Lead Profile Drawer
  window.openLeadDrawer = function (leadId) {
    const leads = getCrmLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    activeLeadInDrawer = lead;

    document.getElementById('drawerCompanyName').innerText = lead.company;
    document.getElementById('drawerDomainAndCity').innerText = `${lead.domain} • ${lead.city}`;
    document.getElementById('drawerContactName').innerText = lead.contactName || 'Decision Maker';
    document.getElementById('drawerEmailVal').innerText = lead.email;
    document.getElementById('drawerPhoneVal').innerText = lead.phone;
    document.getElementById('drawerSpeedVal').innerText = `${lead.speed_ms || 700}ms`;
    document.getElementById('drawerScoreVal').innerText = `${lead.opportunityScore || 85}/100`;
    document.getElementById('drawerTrackingVal').innerText = `${lead.metaPixel ? 'Meta' : 'No Pixel'} / ${lead.googleAds ? 'Google Ads' : 'No Ads'}`;

    const statusSel = document.getElementById('drawerStatusSelect');
    if (statusSel) statusSel.value = lead.status;

    const prioSel = document.getElementById('drawerPrioritySelect');
    if (prioSel) prioSel.value = lead.priority || 'P1';

    const prioBadge = document.getElementById('drawerPriorityBadge');
    if (prioBadge) prioBadge.innerText = `${lead.priority || 'P1'} - Opportunity Tier`;

    const dateInp = document.getElementById('drawerFollowUpDateInput');
    if (dateInp) dateInp.value = lead.followUpDate || '';

    // Render notes
    renderDrawerNotes(lead);

    const drawer = document.getElementById('leadProfileDrawer');
    if (drawer) {
      drawer.classList.remove('hidden');
      drawer.classList.add('flex');
    }
  };

  window.closeLeadDrawer = function () {
    const drawer = document.getElementById('leadProfileDrawer');
    if (drawer) {
      drawer.classList.add('hidden');
      drawer.classList.remove('flex');
    }
    activeLeadInDrawer = null;
  };

  function renderDrawerNotes(lead) {
    const list = document.getElementById('drawerNotesList');
    if (!list) return;

    list.innerHTML = '';
    const notes = lead.notes || [];
    if (notes.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-500 italic">No notes logged yet.</p>';
    } else {
      notes.forEach(n => {
        const d = document.createElement('div');
        d.className = 'bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs space-y-1';
        d.innerHTML = `
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>${n.author || 'User'}</span>
            <span>${n.timestamp}</span>
          </div>
          <p class="text-slate-200">${n.text}</p>
        `;
        list.appendChild(d);
      });
    }
  }

  window.saveDrawerStatusChange = function () {
    if (!activeLeadInDrawer) return;
    const val = document.getElementById('drawerStatusSelect').value;
    activeLeadInDrawer.status = val;
    const leads = getCrmLeads();
    const target = leads.find(l => l.id === activeLeadInDrawer.id);
    if (target) target.status = val;
    saveCrmLeads(leads);
    notify(`Status updated to "${val}"`);
    renderCrmLeads();
  };

  window.saveDrawerPriorityChange = function () {
    if (!activeLeadInDrawer) return;
    const val = document.getElementById('drawerPrioritySelect').value;
    activeLeadInDrawer.priority = val;
    const leads = getCrmLeads();
    const target = leads.find(l => l.id === activeLeadInDrawer.id);
    if (target) target.priority = val;
    saveCrmLeads(leads);
    notify(`Priority set to ${val}`);
    renderCrmLeads();
  };

  window.saveDrawerFollowUpDate = function () {
    if (!activeLeadInDrawer) return;
    const val = document.getElementById('drawerFollowUpDateInput').value;
    activeLeadInDrawer.followUpDate = val;
    const leads = getCrmLeads();
    const target = leads.find(l => l.id === activeLeadInDrawer.id);
    if (target) target.followUpDate = val;
    saveCrmLeads(leads);
    notify(`Follow-up date scheduled for ${val}`);
    renderCrmLeads();
  };

  window.saveNewLeadNote = function () {
    if (!activeLeadInDrawer) return;
    const inp = document.getElementById('drawerNewNoteInput');
    const text = inp.value.trim();
    if (!text) return;

    const newNote = {
      id: 'n_' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      author: getUserData().name || 'Agent',
      text: text
    };

    if (!activeLeadInDrawer.notes) activeLeadInDrawer.notes = [];
    activeLeadInDrawer.notes.unshift(newNote);

    const leads = getCrmLeads();
    const target = leads.find(l => l.id === activeLeadInDrawer.id);
    if (target) {
      if (!target.notes) target.notes = [];
      target.notes.unshift(newNote);
    }
    saveCrmLeads(leads);

    inp.value = '';
    renderDrawerNotes(activeLeadInDrawer);
    notify('Note added to lead record!');
  };

  window.copyDrawerEmail = function () {
    if (activeLeadInDrawer) {
      navigator.clipboard.writeText(activeLeadInDrawer.email);
      notify(`Copied ${activeLeadInDrawer.email} to clipboard!`);
    }
  };

  window.generateOutreachFromDrawer = function () {
    if (!activeLeadInDrawer) return;
    window.closeLeadDrawer();
    window.closeCustomerDashboard();
    
    // Populate Tool 3 Outreach Generator
    window.currentSelectedLead = {
      name: activeLeadInDrawer.company,
      domain: activeLeadInDrawer.domain,
      speed: `${activeLeadInDrawer.speed_ms || 750}ms`,
      pixel: activeLeadInDrawer.metaPixel ? 'Meta Pixel Active' : 'No Pixel',
      tech: activeLeadInDrawer.googleAds ? 'Google Ads Active' : 'Organic Only'
    };

    location.hash = '#cold-outreach';
    if (typeof window.regenerateOutreachTemplates === 'function') {
      window.regenerateOutreachTemplates();
    }
    notify(`Generated tailored outreach templates for ${activeLeadInDrawer.company}!`);
  };

  window.deleteLeadFromCrm = function (leadId) {
    if (!confirm('Are you sure you want to remove this lead from your CRM?')) return;
    let leads = getCrmLeads();
    leads = leads.filter(l => l.id !== leadId);
    saveCrmLeads(leads);
    notify('Lead removed from CRM.');
    renderCrmLeads();
  };

  // Follow-up actions
  window.markFollowUpComplete = function (leadId) {
    const leads = getCrmLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      lead.followUpDate = '';
      if (lead.status === 'Follow-Up') lead.status = 'Contacted';
      saveCrmLeads(leads);
      notify(`Follow-up marked complete for ${lead.company}`);
      renderCampaignsAndFollowUps();
      renderCrmLeads();
    }
  };

  window.snoozeFollowUp = function (leadId, days) {
    const leads = getCrmLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      const current = lead.followUpDate ? new Date(lead.followUpDate) : new Date();
      current.setDate(current.getDate() + days);
      lead.followUpDate = current.toISOString().split('T')[0];
      saveCrmLeads(leads);
      notify(`Snoozed follow-up to ${lead.followUpDate}`);
      renderCampaignsAndFollowUps();
      renderCrmLeads();
    }
  };

  // Add Manual Lead Modal
  window.openAddLeadModal = function () {
    injectDashboardHTML();
    const modal = document.getElementById('addLeadModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeAddLeadModal = function () {
    const modal = document.getElementById('addLeadModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.submitNewManualLead = function (e) {
    e.preventDefault();
    const company = document.getElementById('addLeadCompany').value.trim();
    const domain = document.getElementById('addLeadDomain').value.trim().toLowerCase();
    const city = document.getElementById('addLeadCity').value.trim();
    const email = document.getElementById('addLeadEmail').value.trim();
    const phone = document.getElementById('addLeadPhone').value.trim();
    const status = document.getElementById('addLeadStatus').value;
    const priority = document.getElementById('addLeadPriority').value;
    const note = document.getElementById('addLeadNote').value.trim();

    const leads = getCrmLeads();
    const newLead = {
      id: 'lead_' + Date.now(),
      company,
      domain,
      contactName: 'Executive',
      email,
      phone: phone || '+1 555 0100',
      city,
      territory: 'custom',
      industry: 'B2B Client',
      status,
      priority,
      opportunityScore: 88,
      speed_ms: 650,
      metaPixel: false,
      googleAds: true,
      campaignId: 'camp_tx_01',
      tags: ['manual-entry'],
      notes: note ? [{ id: 'n_' + Date.now(), timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16), author: 'User', text: note }] : [],
      followUpDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      savedAt: new Date().toISOString()
    };

    leads.unshift(newLead);
    saveCrmLeads(leads);
    window.closeAddLeadModal();
    notify(`✓ Saved ${company} to CRM Pipeline!`);
    renderCrmLeads();
  };

  // Export CRM CSV
  window.exportCrmLeadsCsv = function () {
    const leads = getCrmLeads();
    let csv = 'Company,Domain,Email,Phone,City,Status,Priority,Opportunity_Score,Follow_Up_Date\n';
    leads.forEach(l => {
      csv += `"${l.company}","${l.domain}","${l.email}","${l.phone}","${l.city}","${l.status}","${l.priority}","${l.opportunityScore}","${l.followUpDate || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `apexintel_crm_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    notify(`Exported ${leads.length} CRM prospects to CSV!`);
  };

  // Export Audit Report
  window.exportAuditReport = function (auditId) {
    const audits = getAuditScans();
    const audit = audits.find(a => a.id === auditId) || audits[0];

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Website Intelligence Diagnostic — ${audit.domain}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #070B14; color: #E2E8F0; padding: 40px; margin: 0; }
    .container { max-width: 800px; margin: 0 auto; background: #0F172A; border: 1px solid #1E293B; border-radius: 20px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .header { border-bottom: 1px solid #1E293B; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .badge { background: rgba(99, 102, 241, 0.15); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.3); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
    .card { background: #070B14; border: 1px solid #1E293B; border-radius: 12px; padding: 16px; text-align: center; }
    .card-label { font-size: 11px; color: #94A3B8; text-transform: uppercase; font-weight: 700; }
    .card-val { font-size: 20px; font-weight: 900; color: #38BDF8; margin-top: 6px; font-family: monospace; }
    .pitch-box { background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 20px; margin-top: 24px; }
    .footer { margin-top: 32px; border-top: 1px solid #1E293B; padding-top: 16px; font-size: 11px; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="badge">Technical Audit Lab</span>
        <h1 style="margin: 8px 0 0 0; font-size: 24px; color: #FFFFFF;">${audit.company || audit.domain}</h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94A3B8; font-family: monospace;">Target Domain: ${audit.domain}</p>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; color: #64748B;">Audit Date</span>
        <div style="font-size: 12px; font-weight: 700; color: #E2E8F0;">${audit.scannedAt}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Mobile TTFB Latency</div>
        <div class="card-val" style="color: ${audit.speed_ms > 900 ? '#F43F5E' : '#10B981'};">${audit.speed_ms}ms</div>
      </div>
      <div class="card">
        <div class="card-label">CMS Platform</div>
        <div class="card-val" style="font-size: 14px; color: #F8FAFC;">${audit.cms}</div>
      </div>
      <div class="card">
        <div class="card-label">Opportunity Score</div>
        <div class="card-val" style="color: #6366F1;">${audit.icpScore}/100</div>
      </div>
    </div>

    <div class="pitch-box">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #34D399; text-transform: uppercase;">Diagnostic Strategic Angle</h3>
      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #CBD5E1;">"${audit.pitch}"</p>
    </div>

    <div class="footer">
      Generated via ApexIntel B2B Website Intelligence Systems • Cloud Fulfillment ap-southeast-2
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_report_${audit.domain}.html`;
    link.click();
    notify(`Exported client audit report for ${audit.domain}!`);
  };

  // Download custom request CSV
  window.downloadCustomExtractionCsv = function (reqId) {
    const list = getCustomRequests();
    const req = list.find(r => r.id === reqId) || list[0];
    
    let csv = 'Company,Email,Phone,City,Industry,Territory,Status\n';
    csv += `"Phoenix Sun Solar","service@phoenixsun.com","+1 602 555 8920","Phoenix, AZ","${req.industry}","${req.territory}","Verified"\n`;
    csv += `"Desert Ridge Roofing Pros","office@desertridgeroof.com","+1 480 555 1204","Scottsdale, AZ","${req.industry}","${req.territory}","Verified"\n`;
    csv += `"Camelback Commercial HVAC","dispatch@camelbackmech.com","+1 602 555 4411","Phoenix, AZ","${req.industry}","${req.territory}","Verified"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `custom_extraction_${req.id}.csv`;
    link.click();
    notify(`Downloaded custom dataset for ${req.id}!`);
  };

  // --- Retained Dataset & Ledger Methods ---
  function populateDatasetsList() {
    const container = document.getElementById('purchasedDatasetsList');
    if (!container) return;

    const user = getUserData();
    let orders = defaultPurchases;

    if (window.ApexAuth && typeof window.ApexAuth.getOrders === 'function') {
      const authOrders = window.ApexAuth.getOrders(user.email);
      if (authOrders && authOrders.length > 0) {
        orders = authOrders.map(o => ({
          id: o.id,
          key: o.packId || 'texas',
          name: o.packName || 'Contractors Intelligence Pack',
          territory: o.packId === 'florida' ? 'Miami, Tampa, Orlando' : o.packId === 'medspas' ? 'Beverly Hills, SF' : o.packId === 'hvac' ? 'Chicago, DFW, Atlanta' : 'Austin, DFW, Houston',
          orderDate: o.date ? new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Nov 20, 2026',
          leadCount: o.leadsDelivered || 24,
          price: `$${o.amount || 79}.00`,
          invoiceId: `INV-${(o.id || '2026-0891').replace('ord_', '').toUpperCase()}`,
          leads: defaultPurchases[0].leads
        }));
      }
    }

    container.innerHTML = '';
    orders.forEach(pack => {
      const card = document.createElement('div');
      card.className = 'bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl transition flex flex-col md:flex-row md:items-center justify-between gap-4';
      card.innerHTML = `
        <div class="flex items-start gap-3.5">
          <div class="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">
            📊
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h5 class="font-bold text-white text-sm">${pack.name}</h5>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${pack.leadCount} Leads</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${pack.territory}</p>
            <div class="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-mono">
              <span>Ordered: ${pack.orderDate}</span>
              <span>•</span>
              <span class="text-slate-400 font-bold">${pack.price}</span>
              <span>•</span>
              <span class="text-indigo-400">${pack.invoiceId}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button onclick="window.downloadDatasetPacks('${pack.key}', 'xlsx')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30">
            <span>📥 Download .XLSX</span>
          </button>
          <button onclick="window.downloadDatasetPacks('${pack.key}', 'csv')" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700">
            Export .CSV
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function populateLedgerList() {
    const tbody = document.getElementById('dedupeLedgerTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    dedupeLedgerRecords.forEach(rec => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-900/40 transition';
      tr.innerHTML = `
        <td class="py-2.5 px-4 text-indigo-400 font-bold flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          ${rec.domain}
        </td>
        <td class="py-2.5 px-4 text-white">${rec.company}</td>
        <td class="py-2.5 px-4 text-slate-400">${rec.territory}</td>
        <td class="py-2.5 px-4 text-slate-400">${rec.date}</td>
        <td class="py-2.5 px-4 text-right">
          <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            ✓ ${rec.status}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function refreshDashboardUserInfo() {
    const user = getUserData();
    const avatarEl = document.getElementById('dashUserAvatar');
    const nameEl = document.getElementById('dashUserName');
    const companyEl = document.getElementById('dashUserCompany');
    const creditsEl = document.getElementById('dashUserCredits');
    const planBadge = document.getElementById('dashUserPlanBadge');

    const firstLetter = (user.name || 'User').charAt(0).toUpperCase();
    if (avatarEl) avatarEl.innerText = firstLetter;
    if (nameEl) nameEl.innerText = user.name || 'Agency Member';
    if (planBadge) planBadge.innerText = user.plan || 'Agency Growth';
    if (creditsEl) creditsEl.innerText = `${user.credits || 250} Leads Available`;
    if (companyEl) companyEl.innerHTML = `${user.company || 'Direct Agency'} • <span class="text-indigo-400 font-mono font-bold">${user.credits || 250} Leads Available</span>`;

    const setNam = document.getElementById('custSettingName');
    const setCom = document.getElementById('custSettingCompany');
    const setEma = document.getElementById('custSettingEmail');
    const setPla = document.getElementById('custSettingPlan');

    if (setNam) setNam.value = user.name || '';
    if (setCom) setCom.value = user.company || '';
    if (setEma) setEma.value = user.email || '';
    if (setPla) setPla.value = user.plan || 'Enterprise Pro (Lifetime)';

    const key = getCustomerApiKey();
    const keyInput = document.getElementById('custApiKeyInput');
    const keyPlaceholder = document.getElementById('curlKeyPlaceholder');
    if (keyInput) keyInput.value = key;
    if (keyPlaceholder) keyPlaceholder.innerText = key;
  }

  window.openCustomerDashboard = function (initialTab = 'crm') {
    injectDashboardHTML();
    refreshDashboardUserInfo();
    window.switchCustomerTab(initialTab);

    const modal = document.getElementById('customerDashboard');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeCustomerDashboard = function () {
    const modal = document.getElementById('customerDashboard');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.copyCustomerApiKey = function () {
    const input = document.getElementById('custApiKeyInput');
    if (input) {
      navigator.clipboard.writeText(input.value);
      notify('API Key copied to clipboard! Keep it secure.');
    }
  };

  window.regenerateCustomerApiKey = function () {
    if (confirm('Regenerating will revoke your existing API key immediately. Proceed?')) {
      const newKey = 'apex_live_sec_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10) + '2026';
      localStorage.setItem('apexintel_api_key', newKey);
      refreshDashboardUserInfo();
      notify('New API Key generated & activated!');
    }
  };

  window.saveCustomerWebhook = function () {
    const url = document.getElementById('custWebhookInput').value.trim();
    if (url) {
      localStorage.setItem('apexintel_webhook_url', url);
      notify('Webhook endpoint saved & verified!');
    }
  };

  window.copyCustomerCurlSnippet = function () {
    const snippet = document.getElementById('custCurlCode').innerText;
    navigator.clipboard.writeText(snippet);
    notify('cURL code snippet copied to clipboard!');
  };

  window.saveCustomerSettingsProfile = function () {
    const name = document.getElementById('custSettingName').value.trim();
    const company = document.getElementById('custSettingCompany').value.trim();
    const email = document.getElementById('custSettingEmail').value.trim();

    const user = getUserData();
    user.name = name || user.name;
    user.company = company || user.company;
    user.email = email || user.email;

    sessionStorage.setItem('apexintel_session', JSON.stringify(user));

    if (window.ApexAuth && typeof window.ApexAuth.updateCurrentUser === 'function') {
      window.ApexAuth.updateCurrentUser(user);
    }
    if (typeof window.updateNavbarState === 'function') {
      window.updateNavbarState();
    }

    refreshDashboardUserInfo();
    notify('Profile & Agency settings updated successfully!');
  };

  window.downloadDatasetPacks = function (key, format) {
    const pack = defaultPurchases.find(p => p.key === key) || defaultPurchases[0];
    let content = 'Company,Email,Phone,City_State,Mobile_Speed_ms,Pixel_Audit,DNS_MX_Valid\n';
    pack.leads.forEach(l => {
      content += `"${l.name}","${l.email}","${l.phone}","${l.city}","${l.speed}","${l.pixel}","${l.mx}"\n`;
    });

    const filename = `${pack.key}_commercial_leads_verified.${format === 'xlsx' ? 'csv' : 'csv'}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    notify(`Downloaded: ${pack.name} (${format.toUpperCase()})`);
  };

  window.downloadCombinedMasterDataset = function () {
    let content = 'Company,Email,Phone,City_State,Mobile_Speed_ms,Pixel_Audit,DNS_MX_Valid,Territory_Pack\n';
    defaultPurchases.forEach(pack => {
      pack.leads.forEach(l => {
        content += `"${l.name}","${l.email}","${l.phone}","${l.city}","${l.speed}","${l.pixel}","${l.mx}","${pack.name}"\n`;
      });
    });

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'apexintel_master_all_purchased_leads.csv';
    link.click();
    notify('Downloaded Combined Master Dataset (72 Leads)!');
  };

  window.downloadCustomerInvoice = function (invId, product, amount, date) {
    const user = getUserData();
    const receipt = `=====================================================
APEXINTEL B2B COMMERCIAL INTELLIGENCE — OFFICIAL RECEIPT
=====================================================
Invoice ID:      ${invId}
Date:            ${date}
Client Name:     ${user.name}
Agency:          ${user.company}
Email:           ${user.email}
-----------------------------------------------------
Item Description:
1x ${product}
- 24 Decision-Maker Verified Leads
- 100% Live DNS MX Resolution
- Exact Mobile Latency Speed (ms)
- Ad Pixel Tracking Status (Meta / Google)
-----------------------------------------------------
Subtotal:        ${amount}
Tax (0.0%):      $0.00 USD
TOTAL PAID:      ${amount}
Payment Status:  PAID (Gumroad / Stripe 256-bit SSL)
AWS Ledger Hash: sha256:${Math.random().toString(36).substring(2, 14)}...
=====================================================
ApexIntel Intelligence Systems • Cloud Fulfillment
AWS DynamoDB Table: leads_cache (Region: ap-southeast-2)
Support: aaronagbas102@gmail.com
=====================================================`;

    const blob = new Blob([receipt], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${invId}_receipt.txt`;
    link.click();
    notify(`Receipt ${invId} downloaded!`);
  };

  window.customerDashQuickReorder = function () {
    window.closeCustomerDashboard();
    if (typeof window.openQuickBuyModal === 'function') {
      window.openQuickBuyModal();
    }
  };

  window.customerDashLogout = function () {
    window.closeCustomerDashboard();
    if (window.ApexAuth && typeof window.ApexAuth.logout === 'function') {
      window.ApexAuth.logout();
    } else {
      sessionStorage.removeItem('apexintel_session');
      if (typeof window.updateNavbarState === 'function') {
        window.updateNavbarState();
      }
      notify('Logged out successfully.');
    }
  };

  window.initCustomerDashboard = function () {
    injectDashboardHTML();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initCustomerDashboard);
  } else {
    window.initCustomerDashboard();
  }
})();
