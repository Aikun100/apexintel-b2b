// ============================================================================
// ApexIntel B2B — Customer Intelligence & Prospect CRM Workspace
// Master Directive Implementation: 11-Stage Pipeline, Dual Views (Table & Kanban),
// Lead Profile Drawer, Campaigns, Follow-Up Queue, Audit Lab & Custom Extraction
// ============================================================================

(function () {
  'use strict';

  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  // CRM starts empty for each account; records are loaded from the authenticated backend.
  const DEFAULT_CRM_LEADS = [];
  // Campaigns and audits start empty; never inject showcase records into customer workspaces.
  const DEFAULT_CAMPAIGNS = [];
  const DEFAULT_AUDITS = [];

  // --- Custom Extraction Requests State ---
  window.userCustomRequests = [];

  // --- Server-Authoritative User Purchased Orders ---
  let userPurchasedOrders = [];

  // Ledger rows must come from verified purchase/deduplication records; no demo entries.

  // --- Notification Helper ---
  function notify(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      console.log('[ApexIntel Workspace]', msg);
    }
  }

  // --- In-Memory Multi-Tenant CRM Cache & Server-Authoritative Sync ---
  let crmLeadsCache = null;
  let crmFetchPromise = null;
  let crmCampaignsCache = null;
  let crmCampaignsFetchPromise = null;

  async function syncLeadToBackend(leadId, updates) {
    if (!window.ApexAuth || !window.ApexAuth.isLoggedIn()) return;
    try {
      await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.warn('[CRM Sync] Failed to update lead on server:', err);
    }
  }
  async function createLeadOnBackend(lead) {
    if (!window.ApexAuth || !window.ApexAuth.isLoggedIn()) {
      throw new Error('Sign in before adding a CRM record.');
    }
    const response = await fetch('/api/crm/leads', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(lead)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.lead) {
      throw new Error(data.error || 'The server could not save this CRM record.');
    }
    return data.lead;
  }

  async function deleteLeadFromBackend(leadId) {
    if (!window.ApexAuth || !window.ApexAuth.isLoggedIn()) return;
    try {
      await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
    } catch (err) {
      console.warn('[CRM Sync] Failed to delete lead from server:', err);
    }
  }

  window.loadCrmLeadsFromBackend = async function () {
    if (crmFetchPromise) return crmFetchPromise;

    if (!window.ApexAuth || !window.ApexAuth.isLoggedIn()) {
      crmLeadsCache = [];
      renderCrmLeads();
      renderCampaignsAndFollowUps();
      return crmLeadsCache;
    }

    crmFetchPromise = (async () => {
      try {
        const res = await fetch('/api/crm/leads?limit=100', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.leads)) {
            // An empty server response is a genuinely empty CRM, not a request to seed demo records.
            crmLeadsCache = data.leads;
          } else {
            crmLeadsCache = DEFAULT_CRM_LEADS;
          }
        } else {
          crmLeadsCache = DEFAULT_CRM_LEADS;
        }
      } catch (err) {
        console.warn('[CRM] Failed to fetch leads from server:', err);
        crmLeadsCache = DEFAULT_CRM_LEADS;
      } finally {
        crmFetchPromise = null;
        renderCrmLeads();
        renderCampaignsAndFollowUps();
      }
      return crmLeadsCache;
    })();

    return crmFetchPromise;
  };

  function getCrmLeads() {
    if (crmLeadsCache === null) {
      crmLeadsCache = DEFAULT_CRM_LEADS;
      window.loadCrmLeadsFromBackend();
    }
    return crmLeadsCache;
  }

  function saveCrmLeads(leads) {
    crmLeadsCache = leads;
  }

  window.clearCustomerDashboardCache = function () {
    crmLeadsCache = null;
    crmFetchPromise = null;
    crmCampaignsCache = null;
    crmCampaignsFetchPromise = null;
    activeLeadInDrawer = null;
    userPurchasedOrders = [];
  };

  function getTenantStorageKey(key) {
    const user = window.ApexAuth && typeof window.ApexAuth.getCurrentUser === 'function'
      ? window.ApexAuth.getCurrentUser()
      : null;
    const tenant = user && (user.userId || user.id || user.email);
    return tenant ? `${key}:${String(tenant).toLowerCase()}` : null;
  }

  function getCrmCampaigns() {
    if (crmCampaignsCache === null) {
      crmCampaignsCache = [];
      window.loadCrmCampaignsFromBackend();
    }
    return crmCampaignsCache;
  }

  function saveCrmCampaigns(campaigns) {
    crmCampaignsCache = Array.isArray(campaigns) ? campaigns : [];
    renderCampaignsAndFollowUps();
  }

  window.loadCrmCampaignsFromBackend = async function () {
    if (crmCampaignsFetchPromise) return crmCampaignsFetchPromise;

    if (!window.ApexAuth || !window.ApexAuth.isLoggedIn()) {
      crmCampaignsCache = [];
      renderCampaignsAndFollowUps();
      return crmCampaignsCache;
    }

    crmCampaignsFetchPromise = (async () => {
      try {
        const response = await fetch('/api/crm/campaigns', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        const data = await response.json().catch(() => ({}));
        crmCampaignsCache = response.ok && data.success && Array.isArray(data.campaigns)
          ? data.campaigns
          : [];
      } catch (error) {
        console.warn('[CRM] Failed to fetch campaigns from server:', error);
        crmCampaignsCache = [];
      } finally {
        crmCampaignsFetchPromise = null;
        renderCampaignsAndFollowUps();
      }
      return crmCampaignsCache;
    })();

    return crmCampaignsFetchPromise;
  };

  function getAuditScans() {
    const key = getTenantStorageKey('apexintel_audit_scans');
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveAuditScans(audits) {
    const key = getTenantStorageKey('apexintel_audit_scans');
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify((Array.isArray(audits) ? audits : []).slice(0, 50)));
    } catch (error) {
      console.warn('[Audit History] Could not save browser history:', error.message);
    }
  }

  window.recordCustomerAuditScan = function (scan) {
    if (!scan || !scan.domain || !window.ApexAuth || !window.ApexAuth.isLoggedIn()) return;
    const scannedAt = scan.scannedAt || new Date().toISOString();
    const entry = {
      id: `${scan.domain}:${scannedAt}`,
      domain: String(scan.domain),
      company: scan.company || scan.domain,
      scannedAt,
      speed_ms: typeof scan.speed === 'number' && Number.isFinite(scan.speed) ? scan.speed : null,
      cms: scan.cms || null,
      metaPixel: typeof scan.pixels?.meta === 'boolean' ? scan.pixels.meta : null,
      googleAds: typeof scan.pixels?.googleAds === 'boolean' ? scan.pixels.googleAds : null,
      icpScore: Number.isFinite(Number(scan.opportunityScore)) ? Number(scan.opportunityScore) : null,
      pitch: scan.suggestedPitch || null,
      scanStatus: scan.scanStatus || 'unknown',
      failedChecks: Array.isArray(scan.failedChecks) ? scan.failedChecks : [],
      fromCache: Boolean(scan.fromCache)
    };
    const current = getAuditScans();
    const next = [entry, ...current.filter(item => item.id !== entry.id)].slice(0, 50);
    saveAuditScans(next);
    renderAuditLab();
  };

  function getCustomRequests() {
    return window.userCustomRequests || [];
  }

  window.loadCustomRequestsFromBackend = async function () {
    try {
      const resp = await fetch('/api/requests/custom', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success && Array.isArray(data.requests)) {
        window.userCustomRequests = data.requests;
        renderCustomRequests();
      }
    } catch (e) {
      console.warn('Failed to load custom requests from backend:', e);
    }
  };

  function getUserData() {
    if (window.ApexAuth && typeof window.ApexAuth.getCurrentUser === 'function') {
      const u = window.ApexAuth.getCurrentUser();
      if (u) return u;
    }
    return {
      name: null,
      email: '',
      company: null,
      plan: null,
      credits: null,
      role: 'customer'
    };
  }

  // --- HTML Injection ---
  function injectDashboardHTML() {
    if (document.getElementById('customerDashboard')) return;

    const modalHTML = `
    <!-- ==================== CUSTOMER WORKSPACE & CRM MODAL ==================== -->
    <div id="customerDashboard" onclick="if(event.target === this) window.closeCustomerDashboard()" class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 hidden items-center justify-center p-2 sm:p-4">
      <div class="bg-slate-950 border border-slate-800 rounded-3xl max-w-7xl w-full max-h-[96vh] overflow-hidden flex flex-col shadow-2xl relative">
        
        <!-- Header Bar -->
        <div class="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/70 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3.5">
            <div id="dashUserAvatar" class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-600/30">
              A
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 id="dashUserName" class="text-base font-black text-white leading-tight">Your Account</h3>
                <span id="dashUserPlanBadge" class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Enterprise Pro
                </span>
                <span class="hidden md:inline-flex text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700">
                  CRM v2.0
                </span>
              </div>
              <p id="dashUserCompany" class="text-xs text-slate-400 mt-0.5 font-medium" >Company not set • <span id="dashUserCredits" class="text-indigo-400 font-mono font-bold">Credits unavailable</span></p>
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

        <!-- Navigation Tabs Bar (Blueprint v1.0 Standard) -->
        <div class="px-4 sm:px-6 pt-2.5 border-b border-slate-800/80 bg-slate-950 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          <button id="custTabBtn-overview" onclick="window.switchCustomerTab('overview')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-cyan-500 bg-cyan-500/10 text-cyan-300 flex items-center gap-1.5 shrink-0">
            <span>📊</span> Overview
          </button>
          <button id="custTabBtn-discover" onclick="window.switchCustomerTab('discover')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🔍</span> Discover
          </button>
          <button id="custTabBtn-myleads" onclick="window.switchCustomerTab('myleads')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>⭐</span> My Leads
          </button>
          <button id="custTabBtn-intelligence" onclick="window.switchCustomerTab('intelligence')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🔬</span> Intelligence
          </button>
          <button id="custTabBtn-datasets" onclick="window.switchCustomerTab('datasets')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>📦</span> Datasets
          </button>
          <button id="custTabBtn-campaigns" onclick="window.switchCustomerTab('campaigns')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🚀</span> Campaigns
          </button>
          <button id="custTabBtn-crm" onclick="window.switchCustomerTab('crm')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>🎯</span> CRM
          </button>
          <button id="custTabBtn-customreq" onclick="window.switchCustomerTab('customreq')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>📋</span> Custom Research
          </button>
          <button id="custTabBtn-billing" onclick="window.switchCustomerTab('billing')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>💳</span> Billing
          </button>
          <button id="custTabBtn-settings" onclick="window.switchCustomerTab('settings')" class="px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0">
            <span>⚙️</span> Settings
          </button>
        </div>

        <!-- Scrollable Tab Content Area -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          <!-- ==================== TAB: OVERVIEW (#custTab-overview) ==================== -->
          <div id="custTab-overview" class="space-y-6">
            <!-- 4 Metric Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span class="text-xs font-mono text-slate-400 uppercase">Saved Prospects</span>
                <div class="flex items-baseline gap-2">
                  <span id="overviewSavedCount" class="text-3xl font-black text-white font-display">0</span>
                  <span class="text-xs text-emerald-400 font-mono">in CRM</span>
                </div>
                <p class="text-[11px] text-slate-500">Active pipeline contacts</p>
              </div>

              <div class="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span class="text-xs font-mono text-slate-400 uppercase">Available Discoveries</span>
                <div class="flex items-baseline gap-2">
                  <span id="overviewDiscoverCount" class="text-3xl font-black text-cyan-400 font-display">96</span>
                  <span class="text-xs text-cyan-500 font-mono">Server data</span>
                </div>
                <p class="text-[11px] text-slate-500">Across TX, FL, CA & HVAC</p>
              </div>

              <div class="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span class="text-xs font-mono text-slate-400 uppercase">High Opportunity Signals</span>
                <div class="flex items-baseline gap-2">
                  <span id="overviewHighOppCount" class="text-3xl font-black text-indigo-400 font-display">68</span>
                  <span class="text-xs text-indigo-400 font-mono">Score &gt;= 85</span>
                </div>
                <p class="text-[11px] text-slate-500">Slow mobile & missing pixels</p>
              </div>

              <div class="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span class="text-xs font-mono text-slate-400 uppercase">Active Custom Requests</span>
                <div class="flex items-baseline gap-2">
                  <span id="overviewActiveRequestsCount" class="text-3xl font-black text-amber-400 font-display">0</span>
                  <span class="text-xs text-amber-400 font-mono">Mining</span>
                </div>
                <p class="text-[11px] text-slate-500">Bespoke research queue</p>
              </div>
            </div>

            <!-- Quick Action Launcher Bar -->
            <div class="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span class="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>⚡</span> Quick Intelligence Actions:
              </span>
              <div class="flex flex-wrap items-center gap-2">
                <button onclick="window.switchCustomerTab('intelligence')" class="px-3.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition flex items-center gap-1.5">
                  <span>🔬</span> Audit a Website
                </button>
                <button onclick="window.switchCustomerTab('discover')" class="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition flex items-center gap-1.5">
                  <span>🔍</span> Search Discovery Database
                </button>
                <button onclick="window.switchCustomerTab('crm')" class="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5">
                  <span>🎯</span> Manage Sales Pipeline
                </button>
                <button onclick="window.switchCustomerTab('customreq')" class="px-3.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5">
                  <span>📋</span> Request Custom Research
                </button>
              </div>
            </div>

            <!-- Pipeline Snapshot & Recent Activity Split Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- Left: Sales Pipeline Progress -->
              <div class="lg:col-span-7 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-black text-white flex items-center gap-2">
                    <span>📊</span> Sales Pipeline Breakdown
                  </h4>
                  <button onclick="window.switchCustomerTab('crm')" class="text-xs text-cyan-400 hover:text-cyan-300 font-bold transition">Open Kanban Board &rarr;</button>
                </div>
                <div id="overviewPipelineBars" class="space-y-2.5">
                  <!-- Populated dynamically -->
                </div>
              </div>

              <!-- Right: Recent Activity Feed -->
              <div class="lg:col-span-5 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-black text-white flex items-center gap-2">
                    <span>⏱️</span> Recent Activity
                  </h4>
                  <span class="text-[10px] font-mono text-slate-500">Server data</span>
                </div>
                <div id="overviewActivityList" class="space-y-3 text-xs text-slate-300">
                  <!-- Populated dynamically -->
                </div>
              </div>
            </div>
          </div>

          <!-- ==================== TAB: DISCOVER (#custTab-discover) ==================== -->
          <div id="custTab-discover" class="space-y-4 hidden">
            <!-- Filter Bar -->
            <div class="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="relative flex-1 min-w-[220px]">
                  <input type="text" id="discoverSearchInput" oninput="window.filterDiscoverLeads()" placeholder="Search discovery database by company, domain, city..." class="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500">
                  <span class="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <select id="discoverTerritorySelect" onchange="window.filterDiscoverLeads()" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none">
                    <option value="ALL">All Territories (TX, FL, CA, HVAC)</option>
                    <option value="texas">Texas (Dallas, Austin, Houston)</option>
                    <option value="florida">Florida (Miami, Tampa, Orlando)</option>
                    <option value="medspas">California (Beverly Hills, SF)</option>
                    <option value="hvac">Industrial HVAC (Chicago, DFW)</option>
                  </select>
                  <select id="discoverSignalSelect" onchange="window.filterDiscoverLeads()" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none">
                    <option value="ALL">All Opportunity Signals</option>
                    <option value="high_score">Opportunity Score &gt;= 85</option>
                    <option value="missing_pixel">Missing Meta Pixel (Gap)</option>
                    <option value="slow_speed">Slow Latency (&gt; 1,000ms)</option>
                  </select>
                  <button onclick="window.customerDashQuickReorder()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow flex items-center gap-1.5 shrink-0">
                    <span>⚡</span> Acquire Territory Pack
                  </button>
                </div>
              </div>
            </div>

            <!-- Discover Results Table -->
            <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-3 px-4">Company & Domain</th>
                    <th class="py-3 px-4">Location</th>
                    <th class="py-3 px-4">Industry Niche</th>
                    <th class="py-3 px-4">Mobile Speed</th>
                    <th class="py-3 px-4">Retargeting</th>
                    <th class="py-3 px-4 text-center">Score</th>
                    <th class="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="discoverTableBody" class="divide-y divide-slate-800/60 text-slate-300">
                  <!-- Populated dynamically from catalog seed data -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- ==================== TAB: MY LEADS (#custTab-myleads) ==================== -->
          <div id="custTab-myleads" class="space-y-4 hidden">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
              <div class="flex items-center gap-2 flex-1">
                <div class="relative flex-1 min-w-[200px]">
                  <input type="text" id="myLeadsSearchInput" oninput="window.filterMyLeads()" placeholder="Search my saved leads..." class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500">
                  <span class="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
                </div>
                <select id="myLeadsStatusFilter" onchange="window.filterMyLeads()" class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 focus:outline-none">
                  <option value="ALL">All Statuses (11)</option>
                  ${PIPELINE_STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
                </select>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button onclick="window.openAddLeadModal()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow flex items-center gap-1.5">
                  <span>+</span> Add Custom Lead
                </button>
                <button onclick="window.switchCustomerTab('crm')" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700">
                  Kanban View &rarr;
                </button>
              </div>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                    <th class="py-3 px-4">Company</th>
                    <th class="py-3 px-4">Decision Maker</th>
                    <th class="py-3 px-4">Location</th>
                    <th class="py-3 px-4">Status</th>
                    <th class="py-3 px-4 text-center">Score</th>
                    <th class="py-3 px-4">Follow-Up</th>
                    <th class="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="myLeadsTableBody" class="divide-y divide-slate-800/60 text-slate-300">
                  <!-- Populated dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- ==================== TAB: PROSPECT CRM & PIPELINE ==================== -->
          <div id="custTab-crm" class="space-y-4 hidden">
            
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

          <!-- ==================== TAB: WEBSITE AUDIT LAB / INTELLIGENCE ==================== -->
          <div id="custTab-intelligence" class="space-y-6 hidden">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-black text-white flex items-center gap-2">
                  <span>🔬</span> Website Intelligence Audit Lab
                </h4>
                <p class="text-xs text-slate-400 mt-0.5">Recent website scans. History is saved in this browser for the signed-in account and does not sync across devices.</p>
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
                <div class="text-2xl font-black text-white mt-1"><span id="datasetsOwnedCount">0</span> <span class="text-xs text-slate-500 font-normal">Active</span></div>
              </div>
              <div class="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Business Records</span>
                <div class="text-2xl font-black text-emerald-400 mt-1"><span id="datasetsTotalLeadsCount">0</span> <span class="text-xs text-slate-500 font-normal">Contacts</span></div>
              </div>
              <div class="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email Coverage</span>
                <div class="text-sm font-black text-indigo-300 mt-2">Varies <span class="text-xs text-slate-500 font-normal">by dataset</span></div>
              </div>
              <div class="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Export Formats</span>
                <div class="text-xs font-bold text-slate-200 mt-2 flex items-center gap-1.5 font-mono">
                  <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">.XLSX</span>
                  
                </div>
              </div>
            </div>

            <!-- Datasets Table Section -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span>📁</span> Purchased Intelligence Packs
                </h4>

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
                    <h4 class="text-base font-black text-white">Order & Download History</h4>
                    <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Backend tracked</span>
                  </div>
                  <p class="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                    This panel lists orders returned by the authenticated orders API. Purchase and download access are recorded server-side; dataset overlap or territory exclusivity is defined per listing, not guaranteed platform-wide.
                  </p>
                </div>
              </div>
              <div class="bg-slate-950/90 border border-slate-800 p-3 rounded-xl text-center shrink-0 w-full sm:w-auto">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Orders on Account</span>
                <span id="customerOrderHistoryCount" class="text-2xl font-black text-emerald-400 font-mono">—</span>
                <span class="text-[10px] text-slate-500 block">Server records</span>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Recent Orders
                </h4>
                <span class="text-xs font-mono text-slate-500">Server order records</span>
              </div>

              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-3 px-4">Order ID</th>
                      <th class="py-3 px-4">Dataset</th>
                      <th class="py-3 px-4">Records</th>
                      <th class="py-3 px-4">Order Date</th>
                      <th class="py-3 px-4 text-right">Status</th>
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
            <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <h4 class="text-sm font-black text-white">External Integrations</h4>
                <span class="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">Not enabled</span>
              </div>
              <p class="text-sm text-slate-300 leading-relaxed">
                External API-key authentication and automated webhook delivery are not enabled yet. The current workspace supports authenticated browser sessions; third-party services cannot use an account key to access the API or receive automatic lead dispatches.
              </p>
              <p class="text-xs text-slate-500">This section will be updated when API-key authentication, documented endpoints, and webhook delivery are available end to end.</p>
            </div>
          </div>

          <!-- ==================== TAB: BILLING (#custTab-billing) ==================== -->
          <div id="custTab-billing" class="space-y-6 hidden">
            <div class="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">Account Plan</span>
                  <span id="billingPlanStatus" class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">Status unavailable</span>
                </div>
                <h3 id="billingPlanName" class="text-2xl font-black text-white font-display">No plan assigned</h3>
                <p id="billingPlanDescription" class="text-xs text-slate-400 leading-relaxed max-w-xl">
                  Plan details and account allowances will appear here when provided by the account service.
                </p>
              </div>
              <div class="flex flex-col items-start sm:items-end gap-2 shrink-0">
                <span id="billingCreditBalance" class="text-2xl font-black text-white font-display">Credits unavailable</span>
                <span class="text-[10px] text-slate-500 font-mono">Server account balance</span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span class="text-xs text-slate-400 font-bold">CRM Records</span>
                <div id="billingLeadQuotaText" class="text-2xl font-black text-cyan-400 font-mono">—</div>
                <p class="text-[11px] text-slate-500">Server-backed records for this account</p>
              </div>
              <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span class="text-xs text-slate-400 font-bold">Saved Website Scans</span>
                <div id="billingScanCountText" class="text-2xl font-black text-indigo-400 font-mono">—</div>
                <p class="text-[11px] text-slate-500">Saved in this browser; not synced across devices</p>
              </div>
              <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span class="text-xs text-slate-400 font-bold">Custom Research Requests</span>
                <div id="billingRequestCountText" class="text-2xl font-black text-emerald-400 font-mono">—</div>
                <p class="text-[11px] text-slate-500">Requests returned by the account service</p>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-bold uppercase tracking-wider text-slate-300">Order &amp; Payment History</h4>
                <span class="text-xs font-mono text-slate-500">Server order records</span>
              </div>
              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th class="py-3 px-4">Order ID</th>
                      <th class="py-3 px-4">Dataset</th>
                      <th class="py-3 px-4">Date</th>
                      <th class="py-3 px-4">Amount</th>
                      <th class="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody id="billingInvoicesBody" class="divide-y divide-slate-800/60 font-mono text-slate-300">
                    <tr><td colspan="5" class="py-6 px-4 text-center text-slate-500">No payment records have been returned for this account yet.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- ==================== TAB: SETTINGS ==================== -->
          <div id="custTab-settings" class="space-y-6 hidden">
            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
              <h4 class="text-sm font-black text-white flex items-center gap-2"><span>👤</span> Account Profile</h4>
              <p class="text-xs text-slate-500">These details are read from your authenticated account. Profile editing is not available in this workspace yet.</p>
              <div class="grid sm:grid-cols-2 gap-4">
                <div><label class="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label><div id="custSettingNameDisplay" class="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">Account name unavailable</div></div>
                <div><label class="block text-xs font-bold text-slate-400 uppercase mb-1">Company</label><div id="custSettingCompanyDisplay" class="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">Company not set</div></div>
                <div><label class="block text-xs font-bold text-slate-400 uppercase mb-1">Account Email</label><div id="custSettingEmailDisplay" class="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">Email unavailable</div></div>
                <div><label class="block text-xs font-bold text-slate-400 uppercase mb-1">Account Plan</label><div id="custSettingPlanDisplay" class="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">No plan assigned</div></div>
              </div>
            </div>

            <div class="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 class="text-sm font-black text-white">Order &amp; Payment History</h4>
                <p class="text-xs text-slate-400 mt-1">Your server-backed purchases and payment status are listed in the Billing tab.</p>
              </div>
              <button onclick="window.switchCustomerTab('billing')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold">Open Billing</button>
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
              Server sync active
            </span>
            <span>•</span>
            <span>Authenticated workspace</span>
          </div>
          <div>
            Need additional data? <a href="#custom-request" onclick="window.closeCustomerDashboard()" class="text-emerald-400 font-semibold underline">Request custom research</a>
          </div>
        </div>

      </div>
    </div>

    <!-- ==================== LEAD PROFILE DRAWER MODAL ==================== -->
    <div id="leadProfileDrawer" onclick="if(event.target === this) window.closeLeadDrawer()" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] hidden items-center justify-end">
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
              <span class="text-slate-400">Email contact:</span>
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
    <div id="addLeadModal" onclick="if(event.target === this) window.closeAddLeadModal()" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] hidden items-center justify-center p-4">
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
              <label class="block text-slate-400 uppercase font-bold mb-1">Contact Email (optional)</label>
              <input type="email" id="addLeadEmail" placeholder="owner@company.com" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500">
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
                <option value="P2" selected>P2 - Moderate</option>
                <option value="P1">P1 - High Priority</option>
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

          const comp = escapeHTML(l.company || '');
          const dom = escapeHTML(l.domain || '');
          const em = escapeHTML(l.email || '');
          const cty = escapeHTML(l.city || '');
          const prio = escapeHTML(l.priority || 'P2');
          const fuDate = escapeHTML(l.followUpDate || '');
          const score = typeof l.opportunityScore === 'number' ? l.opportunityScore : null;

          tr.innerHTML = `
            <td class="py-3 px-4" onclick="window.openLeadDrawer('${escapeHTML(l.id)}')">
              <div class="font-bold text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${l.priority === 'P1' ? 'bg-emerald-400' : 'bg-indigo-400'}"></span>
                ${comp}
              </div>
              <div class="text-[11px] text-slate-400 font-mono mt-0.5">${dom} • ${em}</div>
            </td>
            <td class="py-3 px-3" onclick="window.openLeadDrawer('${escapeHTML(l.id)}')">
              <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${l.priority === 'P1' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : l.priority === 'P2' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}">
                ${prio}
              </span>
            </td>
            <td class="py-3 px-3">
              <select onchange="window.updateLeadStatus('${escapeHTML(l.id)}', this.value)" onclick="event.stopPropagation()" class="px-2 py-1 rounded-lg bg-slate-950 border ${statusObj.border} text-[11px] font-bold ${statusObj.text} focus:outline-none">
                ${PIPELINE_STATUSES.map(s => `<option value="${s.id}" ${s.id === l.status ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </td>
            <td class="py-3 px-3 font-mono font-bold text-slate-200" onclick="window.openLeadDrawer('${escapeHTML(l.id)}')">
              <span class="${score >= 85 ? 'text-emerald-400' : 'text-indigo-300'}">${score}/100</span>
            </td>
            <td class="py-3 px-3 text-slate-400 text-xs" onclick="window.openLeadDrawer('${escapeHTML(l.id)}')">
              ${cty}
            </td>
            <td class="py-3 px-3 text-xs" onclick="window.openLeadDrawer('${escapeHTML(l.id)}')">
              ${fuDate ? `
                <span class="font-mono text-[11px] ${isOverdue ? 'text-rose-400 font-bold flex items-center gap-1' : 'text-slate-300'}">
                  ${isOverdue ? '⚠️ ' : ''}${fuDate}
                </span>
              ` : '<span class="text-slate-600 font-mono text-[11px]">None set</span>'}
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center gap-1">
                <button onclick="window.openLeadDrawer('${escapeHTML(l.id)}')" title="Open Drawer" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
                  📝
                </button>
                <button onclick="window.generateOutreachForLead('${escapeHTML(l.id)}')" title="Generate Pitch" class="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 transition border border-indigo-500/30">
                  ✉️
                </button>
                <button onclick="window.deleteLeadFromCrm('${escapeHTML(l.id)}')" title="Delete" class="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition">
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
              <div onclick="window.openLeadDrawer('${escapeHTML(lead.id)}')" class="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 p-3 rounded-xl cursor-pointer transition shadow-sm space-y-2 group">
                <div class="flex items-start justify-between gap-1">
                  <h6 class="text-xs font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">${escapeHTML(lead.company)}</h6>
                  <span class="text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${lead.priority === 'P1' ? 'bg-rose-500/20 text-rose-300' : 'bg-indigo-500/20 text-indigo-300'} shrink-0">${escapeHTML(lead.priority)}</span>
                </div>
                <div class="text-[10px] text-slate-400 font-mono truncate">${escapeHTML(lead.domain)}</div>
                <div class="flex items-center justify-between text-[10px] pt-1 border-t border-slate-900">
                  <span class="text-emerald-400 font-mono font-bold">${lead.opportunityScore == null ? 'Not scored' : `${escapeHTML(lead.opportunityScore)}/100`}</span>
                  <div class="flex items-center gap-1">
                    <button onclick="event.stopPropagation(); window.advanceLeadStage('${escapeHTML(lead.id)}')" title="Advance Stage" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition font-mono">
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
        const campaignId = c.campaignId || c.id;
        const campaignName = c.name || c.title || 'Untitled campaign';
        const assigned = leads.filter(l => l.campaignId === campaignId || (Array.isArray(c.leadIds) && c.leadIds.includes(l.id)));
        const assignedCount = Math.max(assigned.length, Array.isArray(c.leadIds) ? c.leadIds.length : 0);
        const contacted = assigned.filter(l => ['Contacted', 'Follow-Up', 'Responded', 'Meeting Scheduled', 'Proposal', 'Won'].includes(l.status)).length;
        const meetings = assigned.filter(l => ['Meeting Scheduled', 'Proposal', 'Won'].includes(l.status)).length;
        const won = assigned.filter(l => l.status === 'Won').length;

        const card = document.createElement('div');
        card.className = 'bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-3';
        card.innerHTML = `
          <div class="flex items-start justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">${c.status}</span>
              <h5 class="text-xs font-black text-white mt-1.5 leading-snug">${escapeHTML(campaignName)}</h5>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">${c.territory}</p>
            </div>
          </div>

          <div class="grid grid-cols-4 gap-1.5 text-center bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
            <div>
              <span class="text-[9px] text-slate-500 block uppercase">Leads</span>
              <span class="text-xs font-mono font-bold text-white">${assignedCount}</span>
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
                  <h6 class="text-xs font-bold text-white">${escapeHTML(l.company)}</h6>
                  <span class="text-[10px] font-mono px-2 py-0.2 rounded ${isOverdue ? 'bg-rose-500/20 text-rose-400 font-bold' : isToday ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'bg-slate-800 text-slate-400'}">
                    ${escapeHTML(isOverdue ? 'OVERDUE' : isToday ? 'TODAY' : l.followUpDate)}
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5">${escapeHTML(l.notes?.[0]?.text || 'Scheduled follow-up touchpoint')}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button onclick="window.markFollowUpComplete('${escapeHTML(l.id)}')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition">
                ✓ Mark Done
              </button>
              <button onclick="window.snoozeFollowUp('${escapeHTML(l.id)}', 2)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">
                +2 Days
              </button>
              <button onclick="window.openLeadDrawer('${escapeHTML(l.id)}')" class="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 text-xs font-bold transition">
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
    if (audits.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-8 px-4 text-center text-slate-500">No scans have been saved in this browser for this account yet. Run a website scan to add one.</td></tr>';
      return;
    }
    audits.forEach(a => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-900/50 transition border-b border-slate-800/60';
      tr.innerHTML = `
        <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          ${escapeHTML(a.domain)}
        </td>
        <td class="py-3 px-3 text-slate-400 font-mono text-[11px]">${escapeHTML(a.scannedAt)}</td>
        <td class="py-3 px-3">
          <span class="px-2 py-0.5 rounded font-mono text-[11px] font-bold ${a.speed_ms == null ? 'bg-slate-800 text-slate-400' : (a.speed_ms > 900 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400')}">
            ${a.speed_ms == null ? 'Not measured' : `${escapeHTML(a.speed_ms)}ms`}
          </span>
        </td>
        <td class="py-3 px-3 text-slate-300 font-mono text-xs">${escapeHTML(a.cms || 'Not detected')}</td>
        <td class="py-3 px-3 text-xs">
          <span class="${a.googleAds === null ? 'text-slate-500' : (a.googleAds ? 'text-emerald-400 font-bold' : 'text-amber-400')}">Ads: ${a.googleAds === null ? 'Unknown' : (a.googleAds ? 'Detected' : 'Not detected')}</span> • 
          <span class="${a.metaPixel === null ? 'text-slate-500' : (a.metaPixel ? 'text-indigo-400 font-bold' : 'text-amber-400')}">Pixel: ${a.metaPixel === null ? 'Unknown' : (a.metaPixel ? 'Detected' : 'Not detected')}</span>
        </td>
        <td class="py-3 px-3 font-mono font-bold text-white">${a.icpScore == null ? 'Not scored' : `${escapeHTML(a.icpScore)}/100`}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="window.exportAuditReport('${escapeHTML(a.id)}')" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow flex items-center gap-1.5 ml-auto">
            <span>📄</span> Export Report (.html)
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 4. Render Custom Extraction Requests
  function renderCustomRequests() {
    if (!window.userCustomRequestsLoaded) {
      window.userCustomRequestsLoaded = true;
      window.loadCustomRequestsFromBackend();
    }

    const list = getCustomRequests();
    const container = document.getElementById('customRequestsList');
    if (!container) return;

    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400">
          <p class="text-sm font-bold text-white mb-1">No Custom Extraction Requests Yet</p>
          <p class="text-xs">Use Tool 6 in the Intelligence Suite to request bespoke B2B contractor datasets.</p>
        </div>
      `;
      return;
    }

    list.forEach(req => {
      const card = document.createElement('div');
      card.className = 'bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4';

      const reqId = escapeHTML(req.requestId || req.id);
      const status = escapeHTML(req.status || 'Submitted');
      const isDelivered = req.status === 'Delivered';
      const date = escapeHTML((req.createdAt || req.date || 'Nov 2026').slice(0, 16).replace('T', ' '));
      const industry = escapeHTML(req.industry || '');
      const territory = escapeHTML(req.territory || '');
      const volume = escapeHTML(String(req.volume || ''));
      const price = escapeHTML(req.estimatedPrice || 'Quote pending');
      const notes = escapeHTML(req.notes || ('Requested volume: ' + volume + ' records'));
      const hasDeliveredRecords = (Array.isArray(req.deliveredRecords) && req.deliveredRecords.length > 0) || (Array.isArray(req.results) && req.results.length > 0);

      card.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold text-indigo-400">${reqId}</span>
            <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${isDelivered ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">
              ${status}
            </span>
            <span class="text-xs text-slate-500">• ${date}</span>
          </div>
          <h5 class="text-sm font-bold text-white">${industry} — ${territory}</h5>
          <p class="text-xs text-slate-400">${notes}</p>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span class="text-sm font-mono font-bold text-white">${price}</span>
          ${isDelivered && hasDeliveredRecords ? `
            <button onclick="window.downloadCustomExtractionCsv('${reqId}')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow">
              <span>📥</span> Download Dataset (.CSV)
            </button>
          ` : `
            <span class="text-xs font-mono text-slate-500 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
              ${isDelivered ? 'Delivery file not attached yet' : 'Awaiting fulfillment update'}
            </span>
          `}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Discovery records are sourced exclusively from the authenticated discovery API.
  // Tab Aliases for backwards compatibility with legacy UI triggers
  const TAB_ALIASES = {
    auditlab: 'intelligence'
  };

  let liveDiscoveryLeadsCache = [];
  let liveDiscoveryPromise = null;

  window.loadLiveDiscoveryLeads = async function () {
    if (liveDiscoveryPromise) return liveDiscoveryPromise;
    liveDiscoveryPromise = (async () => {
      try {
        const res = await fetch('/api/discovery/search?limit=50', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.leads)) {
            liveDiscoveryLeadsCache = data.leads.map(l => ({
              id: l.id || l.domain,
              company: l.company_name || l.name || l.domain,
              domain: l.domain || l.id,
              contactName: l.contact_name || l.contactName || '',
              email: l.email || '',
              phone: l.phone || '',
              city: l.city || l.location || '',
              territory: /TX\b/i.test(l.city || '') ? 'texas'
                : /FL\b/i.test(l.city || '') ? 'florida'
                : /medspa|aesthetic/i.test(l.trade || '') ? 'medspas'
                : /hvac|mechanical/i.test(l.trade || '') ? 'hvac'
                : 'other',
              industry: l.trade || l.category || 'Not specified',
              speed_ms: Number.isFinite(Number(l.speed_ms)) && Number(l.speed_ms) > 0 ? Number(l.speed_ms) : null,
              metaPixel: typeof l.meta_pixel === 'boolean' ? l.meta_pixel : null,
              googleAds: typeof l.google_ads === 'boolean' ? l.google_ads : null,
              opportunityScore: typeof l.opportunityScore === 'number' ? l.opportunityScore : null,
              tags: [l.meta_pixel === null || l.meta_pixel === undefined ? 'tracking-unknown' : (l.meta_pixel ? 'meta-active' : 'missing-pixel')],
              isLiveApi: true
            }));
            renderDiscoverTab();
          } else {
            liveDiscoveryLeadsCache = [];
            renderDiscoverTab();
          }
        } else {
          liveDiscoveryLeadsCache = [];
          renderDiscoverTab();
        }
      } catch (err) {
        liveDiscoveryLeadsCache = [];
        console.warn('[Discover] Live API request failed:', err.message);
        renderDiscoverTab();
      } finally {
        liveDiscoveryPromise = null;
      }
      return liveDiscoveryLeadsCache;
    })();
    return liveDiscoveryPromise;
  };

  function getDiscoveryPool() {
    return Array.isArray(liveDiscoveryLeadsCache) ? liveDiscoveryLeadsCache : [];
  }

  // --- Window Interactive Actions ---

  // Switch workspace tab (Blueprint v1.0 10-Tab Standard)
  window.switchCustomerTab = function (tabName) {
    const canonicalTab = TAB_ALIASES[tabName] || tabName;
    const allTabIds = ['overview', 'discover', 'myleads', 'intelligence', 'datasets', 'campaigns', 'crm', 'customreq', 'billing', 'settings', 'auditlab', 'ledger', 'api'];

    allTabIds.forEach(t => {
      const panel = document.getElementById(`custTab-${t}`);
      const btn = document.getElementById(`custTabBtn-${t}`);
      const isTarget = (t === canonicalTab);

      if (isTarget) {
        if (panel) panel.classList.remove('hidden');
        if (btn) {
          btn.className = 'px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-cyan-500 bg-cyan-500/10 text-cyan-300 flex items-center gap-1.5 shrink-0';
        }
      } else {
        if (panel) {
          panel.classList.add('hidden');
        }
        if (btn) {
          btn.className = 'px-3.5 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition border-b-2 border-transparent text-slate-400 hover:text-white hover:bg-slate-900/50 flex items-center gap-1.5 shrink-0';
        }
      }
    });

    if (canonicalTab === 'overview') renderOverviewTab();
    if (canonicalTab === 'discover') {
      renderDiscoverTab();
      if (!liveDiscoveryLeadsCache) window.loadLiveDiscoveryLeads();
    }
    if (canonicalTab === 'myleads') renderMyLeadsTab();
    if (canonicalTab === 'intelligence') renderAuditLab();
    if (canonicalTab === 'crm') renderCrmLeads();
    if (canonicalTab === 'campaigns') renderCampaignsAndFollowUps();
    if (canonicalTab === 'customreq') renderCustomRequests();
    if (canonicalTab === 'datasets') populateDatasetsList();
    if (canonicalTab === 'billing') renderBillingTab();
  };

  // Render Overview Cockpit Tab
  function renderOverviewTab() {
    const leads = getCrmLeads() || [];
    const requests = getCustomRequests() || [];
    const discoveryPool = getDiscoveryPool();

    const savedEl = document.getElementById('overviewSavedCount');
    const discoverEl = document.getElementById('overviewDiscoverCount');
    const highOppEl = document.getElementById('overviewHighOppCount');
    const activeReqEl = document.getElementById('overviewActiveRequestsCount');

    if (savedEl) savedEl.innerText = leads.length;
    if (discoverEl) discoverEl.innerText = String(discoveryPool.length);
    if (highOppEl) highOppEl.innerText = String(leads.filter(l => typeof l.opportunityScore === 'number' && l.opportunityScore >= 85).length);
    if (activeReqEl) activeReqEl.innerText = requests.filter(r => r.status !== 'Delivered' && r.status !== 'Cancelled').length;

    // Render pipeline status progress bars
    const pipelineContainer = document.getElementById('overviewPipelineBars');
    if (pipelineContainer) {
      pipelineContainer.innerHTML = '';
      PIPELINE_STATUSES.slice(0, 7).forEach(st => {
        const count = leads.filter(l => l.status === st.id).length;
        const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'space-y-1';
        row.innerHTML = `
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-slate-300 font-bold">${st.label}</span>
            <span class="text-slate-400">${count} (${pct}%)</span>
          </div>
          <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div class="${st.bg.replace('/10', '/80')} h-1.5 rounded-full" style="width: ${Math.max(pct, 4)}%"></div>
          </div>
        `;
        pipelineContainer.appendChild(row);
      });
    }

    // Render Recent Activity feed
    const activityContainer = document.getElementById('overviewActivityList');
    if (activityContainer) {
      activityContainer.innerHTML = `
        <div class="flex items-start gap-2.5 pb-2 border-b border-slate-800/60">
          <span class="text-cyan-400 font-bold text-sm">🎯</span>
          <div>
            <p class="text-slate-200 font-bold leading-tight">Pipeline Loaded</p>
            <span class="text-[10px] text-slate-500 font-mono">${leads.length} business records in your CRM</span>
          </div>
        </div>
        <div class="flex items-start gap-2.5 pb-2 border-b border-slate-800/60">
          <span class="text-emerald-400 font-bold text-sm">⚡</span>
          <div>
            <p class="text-slate-200 font-bold leading-tight">Territory Catalog Ingested</p>
            <span class="text-[10px] text-slate-500 font-mono">Catalog datasets available for Texas, Florida, California, and HVAC; contact coverage varies</span>
          </div>
        </div>
        <div class="flex items-start gap-2.5">
          <span class="text-indigo-400 font-bold text-sm">🔬</span>
          <div>
            <p class="text-slate-200 font-bold leading-tight">Audit Scanner Ready</p>
            <span class="text-[10px] text-slate-500 font-mono">Website diagnostics available for reachable sites; scan coverage varies</span>
          </div>
        </div>
      `;
    }
  }

  // Render Discover Database Tab
  function renderDiscoverTab() {
    const tableBody = document.getElementById('discoverTableBody');
    if (!tableBody) return;

    const territoryFilter = document.getElementById('discoverTerritorySelect')?.value || 'ALL';
    const signalFilter = document.getElementById('discoverSignalSelect')?.value || 'ALL';
    const searchQ = (document.getElementById('discoverSearchInput')?.value || '').toLowerCase().trim();

    let filtered = [...getDiscoveryPool()];
    const currentLeads = getCrmLeads();

    if (territoryFilter !== 'ALL') {
      filtered = filtered.filter(l => l.territory === territoryFilter);
    }

    if (signalFilter === 'high_score') {
      filtered = filtered.filter(l => l.opportunityScore >= 85);
    } else if (signalFilter === 'missing_pixel') {
      filtered = filtered.filter(l => !l.metaPixel);
    } else if (signalFilter === 'slow_speed') {
      filtered = filtered.filter(l => l.speed_ms > 1000);
    }

    if (searchQ) {
      filtered = filtered.filter(l => 
        l.company.toLowerCase().includes(searchQ) ||
        l.domain.toLowerCase().includes(searchQ) ||
        l.city.toLowerCase().includes(searchQ) ||
        l.industry.toLowerCase().includes(searchQ)
      );
    }

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-500">
            <img src="/assets/visuals/empty-state-leads.svg" alt="No records" class="w-48 h-auto mx-auto mb-3 opacity-75">
            <div class="text-sm font-bold text-slate-300">No discovery records match the selected filters.</div>
            <div class="text-xs text-slate-500 mt-1">Try switching territories or expanding signal filters.</div>
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(item => {
      const isAlreadySaved = currentLeads.some(l => l.domain === item.domain || l.id === item.id);
      const speedColor = item.speed_ms == null ? 'text-slate-500' : (item.speed_ms > 1000 ? 'text-rose-400' : (item.speed_ms > 700 ? 'text-amber-400' : 'text-emerald-400'));
      const pixelBadge = item.metaPixel === null
        ? '<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">Not assessed</span>'
        : (item.metaPixel
          ? '<span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">Meta detected</span>'
          : '<span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">Meta not detected</span>');
      const scoreLabel = item.opportunityScore == null ? 'Not scored' : `${scoreLabel}`;

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition';
      tr.innerHTML = `
        <td class="py-3 px-4">
          <div class="font-bold text-white">${escapeHTML(item.company)}</div>
          <a href="https://${item.domain}" target="_blank" rel="noopener noreferrer" class="text-[11px] font-mono text-cyan-400 hover:underline flex items-center gap-1">
            ${escapeHTML(item.domain)} ↗
          </a>
        </td>
        <td class="py-3 px-4 font-mono text-slate-300 text-[11px]">${escapeHTML(item.city)}</td>
        <td class="py-3 px-4 text-slate-300">${escapeHTML(item.industry)}</td>
        <td class="py-3 px-4 font-mono font-bold ${speedColor}">${item.speed_ms == null ? 'Not measured' : `${item.speed_ms}ms`}</td>
        <td class="py-3 px-4">
          ${pixelBadge}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-mono font-black text-xs">${item.opportunityScore}/100</span>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="window.auditDiscoveredDomain('${escapeHTML(item.domain)}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition">
              Audit
            </button>
            ${isAlreadySaved 
              ? '<span class="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-500 text-[11px] font-mono border border-slate-800">In CRM</span>'
              : `<button onclick="window.addDiscoveredLeadToCrm('${item.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-500/30 transition">
                  + Add to CRM
                 </button>`
            }
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  window.filterDiscoverLeads = function () {
    renderDiscoverTab();
  };

  // Add discovered lead to CRM
  window.addDiscoveredLeadToCrm = async function (leadObj) {
    if (!leadObj || !(leadObj.name || leadObj.company)) {
      notify('This discovery result does not contain a business name.');
      return;
    }
    const leads = getCrmLeads();
    const companyName = String(leadObj.name || leadObj.company);
    const domain = String(leadObj.domain || '').toLowerCase();
    const existing = leads.find(item =>
      (domain && item.domain === domain) ||
      ((item.company || '').toLowerCase() === companyName.toLowerCase())
    );
    if (existing) {
      notify('This business is already in your CRM.');
      window.openCustomerDashboard('crm');
      window.openLeadDrawer(existing.id);
      return;
    }

    const newLead = {
      company: companyName,
      domain: domain || null,
      contactName: leadObj.contactName || null,
      email: leadObj.email || null,
      phone: leadObj.phone || null,
      city: leadObj.city || null,
      territory: leadObj.territory || null,
      industry: leadObj.category || leadObj.industry || null,
      status: 'New',
      priority: 'P2',
      opportunityScore: typeof leadObj.opportunityScore === 'number' ? leadObj.opportunityScore : null,
      speed_ms: typeof leadObj.speed_ms === 'number' ? leadObj.speed_ms : null,
      metaPixel: typeof leadObj.metaPixel === 'boolean' ? leadObj.metaPixel : null,
      googleAds: typeof leadObj.googleAds === 'boolean' ? leadObj.googleAds : null,
      campaignId: null,
      tags: ['saved-from-discovery'],
      notes: [],
      followUpDate: null
    };

    try {
      const savedLead = await createLeadOnBackend(newLead);
      saveCrmLeads([savedLead, ...getCrmLeads()]);
      notify('Business record added to your CRM.');
      renderCrmLeads();
    } catch (error) {
      console.warn('[CRM] Could not save discovery record:', error);
      notify(error.message || 'Unable to save this record. Please retry.');
    }
  }

  // Quick audit launcher from discovery row
  window.auditDiscoveredDomain = function (domain) {
    window.switchCustomerTab('intelligence');
    const input = document.getElementById('scanDomainInput');
    if (input) {
      input.value = domain;
      if (typeof window.runDomainScan === 'function') {
        window.runDomainScan();
      }
    }
  };

  // Render My Leads Tab
  function renderMyLeadsTab() {
    const tableBody = document.getElementById('myLeadsTableBody');
    if (!tableBody) return;

    const searchQ = (document.getElementById('myLeadsSearchInput')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('myLeadsStatusFilter')?.value || 'ALL';

    let list = [...getCrmLeads()];

    if (statusFilter !== 'ALL') {
      list = list.filter(l => l.status === statusFilter);
    }

    if (searchQ) {
      list = list.filter(l => 
        (l.company || '').toLowerCase().includes(searchQ) ||
        (l.domain || '').toLowerCase().includes(searchQ) ||
        (l.email || '').toLowerCase().includes(searchQ) ||
        (l.city || '').toLowerCase().includes(searchQ)
      );
    }

    tableBody.innerHTML = '';

    if (list.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-500">
            <img src="/assets/visuals/empty-state-leads.svg" alt="No records" class="w-48 h-auto mx-auto mb-3 opacity-75">
            <div class="text-sm font-bold text-slate-300">No saved leads match your search criteria.</div>
            <div class="text-xs text-slate-500 mt-1">Add leads from the Discover tab or click "+ Add Lead" above.</div>
          </td>
        </tr>
      `;
      return;
    }

    list.forEach(lead => {
      const statusObj = PIPELINE_STATUSES.find(s => s.id === lead.status) || PIPELINE_STATUSES[0];
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition cursor-pointer';
      tr.onclick = (e) => {
        if (!e.target.closest('button')) {
          window.openLeadProfileDrawer(lead.id);
        }
      };

      tr.innerHTML = `
        <td class="py-3 px-4">
          <div class="font-bold text-white">${escapeHTML(lead.company)}</div>
          <span class="text-[11px] font-mono text-cyan-400">${escapeHTML(lead.domain)}</span>
        </td>
        <td class="py-3 px-4">
          <div class="text-slate-200 font-medium">${escapeHTML(lead.contactName || 'Decision Maker')}</div>
          <div class="text-[11px] font-mono text-slate-400">${escapeHTML(lead.email)}</div>
        </td>
        <td class="py-3 px-4 text-slate-300 font-mono text-[11px]">${escapeHTML(lead.city)}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusObj.bg} ${statusObj.text} border ${statusObj.border}">
            ${statusObj.label}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-indigo-300 font-mono font-bold text-xs">${lead.opportunityScore == null ? 'Not scored' : lead.opportunityScore}</span>
        </td>
        <td class="py-3 px-4 font-mono text-[11px] text-slate-400">
          ${lead.followUpDate ? `📅 ${lead.followUpDate}` : '<span class="text-slate-600">—</span>'}
        </td>
        <td class="py-3 px-4 text-right">
          <button onclick="window.openLeadProfileDrawer('${lead.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-bold border border-indigo-500/30 transition">
            Details &rarr;
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  window.filterMyLeads = function () {
    renderMyLeadsTab();
  };

  // Render billing from account and order data returned by the server.
  function renderBillingTab() {
    const user = getUserData();
    const planName = document.getElementById('billingPlanName');
    const planStatus = document.getElementById('billingPlanStatus');
    const planDescription = document.getElementById('billingPlanDescription');
    const creditBalance = document.getElementById('billingCreditBalance');
    const leadCount = document.getElementById('billingLeadQuotaText');
    const scanCount = document.getElementById('billingScanCountText');
    const requestCount = document.getElementById('billingRequestCountText');

    const credits = user && user.credits !== null && user.credits !== undefined && Number.isFinite(Number(user.credits))
      ? Number(user.credits)
      : null;
    if (planName) planName.innerText = user && user.plan ? user.plan : 'No plan assigned';
    if (planStatus) planStatus.innerText = user && user.accountStatus ? user.accountStatus : 'Status unavailable';
    if (creditBalance) creditBalance.innerText = credits === null ? 'Credits unavailable' : `${credits} credits`;
    if (planDescription) {
      planDescription.innerText = credits === null
        ? 'Plan limits, subscription status, and renewal dates are not currently available from the account service.'
        : 'Your account balance is shown above. Any additional plan limits or renewal terms should be confirmed in your account agreement.';
    }
    if (leadCount) leadCount.innerText = `${getCrmLeads().length} records`;
    if (scanCount) scanCount.innerText = String(getAuditScans().length);
    if (requestCount) requestCount.innerText = Array.isArray(window.userCustomRequests)
      ? String(window.userCustomRequests.length)
      : '—';

    populateBillingInvoices();
  }

  function populateBillingInvoices() {
    const tbody = document.getElementById('billingInvoicesBody');
    if (!tbody) return;
    const orders = Array.isArray(userPurchasedOrders) ? userPurchasedOrders : [];
    tbody.innerHTML = '';
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-center text-slate-500">No payment records have been returned for this account yet.</td></tr>';
      return;
    }

    orders.forEach(order => {
      const cents = order.amountInCents !== null && order.amountInCents !== undefined
        ? Number(order.amountInCents)
        : null;
      const amount = cents !== null && Number.isFinite(cents)
        ? cents / 100
        : (Number.isFinite(Number(order.amount)) ? Number(order.amount) : null);
      const currency = String(order.currency || 'USD').toUpperCase();
      let amountLabel = '—';
      if (amount !== null) {
        try {
          amountLabel = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
        } catch {
          amountLabel = `${amount.toFixed(2)} ${currency}`;
        }
      }
      const dateLabel = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Date unavailable';
      const status = String(order.status || 'unknown');
      const paid = status.toLowerCase() === 'paid';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="py-3 px-4 text-cyan-300">${escapeHTML(order.orderId || 'Order ID unavailable')}</td>
        <td class="py-3 px-4 font-sans text-white">${escapeHTML(order.productName || order.productKey || 'Dataset')}</td>
        <td class="py-3 px-4 text-slate-400">${escapeHTML(dateLabel)}</td>
        <td class="py-3 px-4 font-bold text-white">${escapeHTML(amountLabel)}</td>
        <td class="py-3 px-4 text-right"><span class="px-2 py-0.5 rounded ${paid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'} text-[10px]">${escapeHTML(status.toUpperCase())}</span></td>
      `;
      tbody.appendChild(row);
    });
  }

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
      syncLeadToBackend(leadId, { status: newStatus });
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
      syncLeadToBackend(leadId, { status: nextStatus });
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
    createLeadOnBackend(newLead);
    notify(`✓ Added ${newLead.company} to CRM Pipeline!`);
  };

  // Open Lead Profile Drawer
  window.openLeadDrawer = function (leadId) {
    const leads = getCrmLeads();
    const lead = leads.find(item => item.id === leadId || item.leadId === leadId);
    if (!lead) return;

    activeLeadInDrawer = lead;
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.innerText = value == null || value === '' ? 'Not provided' : String(value);
    };
    setText('drawerCompanyName', lead.company || 'Business record');
    setText('drawerDomainAndCity', [lead.domain, lead.city].filter(Boolean).join(' • ') || 'Location and domain unavailable');
    setText('drawerContactName', lead.contactName || 'Not provided');
    setText('drawerEmailVal', lead.email || 'Not provided');
    setText('drawerPhoneVal', lead.phone || 'Not provided');
    setText('drawerSpeedVal', lead.speed_ms == null ? 'Not measured' : String(lead.speed_ms) + 'ms');
    setText('drawerScoreVal', lead.opportunityScore == null ? 'Not scored' : String(lead.opportunityScore) + '/100');
    const tracking = lead.metaPixel === null || lead.metaPixel === undefined
      ? 'Meta: Not assessed'
      : (lead.metaPixel ? 'Meta: Detected' : 'Meta: Not detected');
    const ads = lead.googleAds === null || lead.googleAds === undefined
      ? 'Google Ads: Not assessed'
      : (lead.googleAds ? 'Google Ads: Detected' : 'Google Ads: Not detected');
    setText('drawerTrackingVal', tracking + ' / ' + ads);

    const statusSel = document.getElementById('drawerStatusSelect');
    if (statusSel) statusSel.value = lead.status || 'New';
    const prioritySel = document.getElementById('drawerPrioritySelect');
    if (prioritySel) prioritySel.value = lead.priority || 'P2';
    const priorityBadge = document.getElementById('drawerPriorityBadge');
    if (priorityBadge) priorityBadge.innerText = (lead.priority || 'P2') + ' - Priority';
    const followUp = document.getElementById('drawerFollowUpDateInput');
    if (followUp) followUp.value = lead.followUpDate || '';
    renderDrawerNotes(lead);

    const drawer = document.getElementById('leadProfileDrawer');
    if (drawer) {
      drawer.classList.remove('hidden');
      drawer.classList.add('flex');
    }
  }

  window.closeLeadDrawer = function () {
    const drawer = document.getElementById('leadProfileDrawer');
    if (drawer) {
      drawer.classList.add('hidden');
      drawer.classList.remove('flex');
    }
    activeLeadInDrawer = null;
  };

  // Aliases for lead profile drawer
  window.openLeadProfileDrawer = function (leadId) {
    window.openLeadDrawer(leadId);
  };

  // Generate outreach pitch from CRM lead
  window.generateOutreachForLead = function (leadId) {
    const leads = getCrmLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    if (typeof window.showToast === 'function') {
      window.showToast(`🎯 Generating customized pitch for ${lead.company}...`);
    }
    const input = document.getElementById('outreachDomainInput');
    if (input && lead.domain) input.value = lead.domain;
    if (typeof window.generateOutreachCampaign === 'function') {
      window.generateOutreachCampaign();
    }
    const target = document.getElementById('outreach-gen');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Open Create Campaign Modal
  window.openCreateCampaignModal = function () {
    const name = prompt('Enter a name for your campaign plan (e.g. Q1 Texas Commercial Outbound):');
    if (!name || !name.trim()) return;
    const leads = getCrmLeads();
    const leadIds = leads.slice(0, 10).map(l => l.id);
    const campaign = {
      name: name.trim(),
      niche: 'Commercial Services',
      territory: 'Regional',
      channel: 'Email & LinkedIn Outbound',
      leadIds,
      status: 'planned'
    };

    const csrfToken = typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : '';
    fetch('/api/crm/campaigns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-csrf-token': csrfToken
      },
      credentials: 'include',
      body: JSON.stringify(campaign)
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.campaign) {
        throw new Error(data.error || 'The server could not save this campaign.');
      }
      crmCampaignsCache = [data.campaign, ...(crmCampaignsCache || [])];
      renderCampaignsAndFollowUps();
      if (typeof window.showToast === 'function') {
        window.showToast(`Campaign "${name}" saved to your account with ${leadIds.length} target records.`);
      }
    }).catch(err => {
      console.warn('Campaign save error:', err);
      if (typeof window.showToast === 'function') {
        window.showToast(err.message || 'Campaign could not be saved. Please retry.');
      }
    });
  };

  // Open Stripe Customer Portal
  window.customerDashQuickReorder = function () {
    window.closeCustomerDashboard();
    if (typeof window.openQuickBuyModal === 'function') {
      window.openQuickBuyModal();
    }
  };

  window.customerDashLogout = function () {
    window.closeCustomerDashboard();
    window.clearCustomerDashboardCache();
    if (window.ApexAuth && typeof window.ApexAuth.logout === 'function') {
      window.ApexAuth.logout();
    } else {
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


  // Restored workspace actions from the original dashboard implementation.

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
            <span>${escapeHTML(n.author || 'User')}</span>
            <span>${escapeHTML(n.timestamp)}</span>
          </div>
          <p class="text-slate-200">${escapeHTML(n.text)}</p>
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
    syncLeadToBackend(activeLeadInDrawer.id, { status: val });
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
    syncLeadToBackend(activeLeadInDrawer.id, { priority: val });
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
    syncLeadToBackend(activeLeadInDrawer.id, { followUpDate: val });
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
    syncLeadToBackend(activeLeadInDrawer.id, { notes: target ? target.notes : activeLeadInDrawer.notes });

    inp.value = '';
    renderDrawerNotes(activeLeadInDrawer);
    notify('Note added to lead record!');
  };
  window.copyDrawerEmail = function () {
    if (!activeLeadInDrawer || !activeLeadInDrawer.email) {
      notify('No email address is listed for this record.');
      return;
    }
    navigator.clipboard.writeText(activeLeadInDrawer.email);
    notify('Email address copied.');
  }
  window.generateOutreachFromDrawer = function () {
    if (!activeLeadInDrawer) return;
    window.closeLeadDrawer();
    window.closeCustomerDashboard();

    window.currentSelectedLead = {
      name: activeLeadInDrawer.company || 'Business record',
      domain: activeLeadInDrawer.domain || '',
      speed: activeLeadInDrawer.speed_ms == null ? 'Not measured' : String(activeLeadInDrawer.speed_ms) + 'ms',
      pixel: activeLeadInDrawer.metaPixel === null || activeLeadInDrawer.metaPixel === undefined
        ? 'Not assessed'
        : (activeLeadInDrawer.metaPixel ? 'Meta Pixel detected' : 'Meta Pixel not detected'),
      tech: activeLeadInDrawer.googleAds === null || activeLeadInDrawer.googleAds === undefined
        ? 'Not assessed'
        : (activeLeadInDrawer.googleAds ? 'Google Ads tag detected' : 'Google Ads tag not detected')
    };

    location.hash = '#cold-outreach';
    if (typeof window.regenerateOutreachTemplates === 'function') {
      window.regenerateOutreachTemplates();
    }
    notify('Outreach draft context prepared. Verify all details before sending.');
  }


  window.deleteLeadFromCrm = function (leadId) {
    if (!confirm('Are you sure you want to remove this lead from your CRM?')) return;
    let leads = getCrmLeads();
    leads = leads.filter(l => l.id !== leadId);
    saveCrmLeads(leads);
    deleteLeadFromBackend(leadId);
    notify('Lead removed from CRM.');
    renderCrmLeads();
  };

  window.markFollowUpComplete = function (leadId) {
    const leads = getCrmLeads();
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      lead.followUpDate = '';
      if (lead.status === 'Follow-Up') lead.status = 'Contacted';
      saveCrmLeads(leads);
      syncLeadToBackend(leadId, { followUpDate: '', status: lead.status });
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
      syncLeadToBackend(leadId, { followUpDate: lead.followUpDate });
      notify(`Snoozed follow-up to ${lead.followUpDate}`);
      renderCampaignsAndFollowUps();
      renderCrmLeads();
    }
  };

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
  window.submitNewManualLead = async function (event) {
    event.preventDefault();
    const company = document.getElementById('addLeadCompany').value.trim();
    const domain = document.getElementById('addLeadDomain').value.trim().toLowerCase();
    const city = document.getElementById('addLeadCity').value.trim();
    const email = document.getElementById('addLeadEmail').value.trim();
    const phone = document.getElementById('addLeadPhone').value.trim();
    const status = document.getElementById('addLeadStatus').value;
    const priority = document.getElementById('addLeadPriority').value;
    const note = document.getElementById('addLeadNote').value.trim();

    const newLead = {
      company,
      domain: domain || null,
      contactName: null,
      email: email || null,
      phone: phone || null,
      city: city || null,
      territory: null,
      industry: null,
      status,
      priority,
      opportunityScore: null,
      speed_ms: null,
      metaPixel: null,
      googleAds: null,
      campaignId: null,
      tags: ['manual-entry'],
      notes: note ? [{
        id: 'n_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        author: getUserData().name || 'User',
        text: note
      }] : [],
      followUpDate: null
    };

    try {
      const savedLead = await createLeadOnBackend(newLead);
      saveCrmLeads([savedLead, ...getCrmLeads()]);
      window.closeAddLeadModal();
      notify('Business record saved to your CRM.');
      renderCrmLeads();
    } catch (error) {
      console.warn('[CRM] Manual lead creation failed:', error);
      notify(error.message || 'Unable to save this record. Please retry.');
    }
  }
  window.exportCrmLeadsCsv = function () {
    const leads = getCrmLeads();
    if (!leads.length) {
      notify('There are no CRM records to export yet.');
      return;
    }
    const headers = ['Company', 'Domain', 'Email', 'Phone', 'City', 'Status', 'Priority', 'Opportunity Score', 'Follow-up Date'];
    const escapeCsv = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    const csv = [headers.map(escapeCsv).join(',')]
      .concat(leads.map(lead => [
        lead.company, lead.domain, lead.email, lead.phone, lead.city,
        lead.status, lead.priority, lead.opportunityScore, lead.followUpDate
      ].map(escapeCsv).join(',')))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'apexintel_crm_export_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify('Exported ' + leads.length + ' CRM records.');
  }
  window.exportAuditReport = function (auditId) {
    const audits = getAuditScans();
    const audit = audits.find(item => item.id === auditId) || audits[0];
    if (!audit) {
      notify('No saved audit is available to export yet.');
      return;
    }

    const safe = {
      domain: escapeHTML(audit.domain || ''),
      company: escapeHTML(audit.company || audit.domain || 'Website audit'),
      scannedAt: escapeHTML(audit.scannedAt ? new Date(audit.scannedAt).toLocaleString() : 'Date unavailable'),
      speed: audit.speed_ms == null ? 'Not measured' : escapeHTML(audit.speed_ms) + 'ms',
      cms: escapeHTML(audit.cms || 'Not detected'),
      meta: audit.metaPixel === null || audit.metaPixel === undefined ? 'Unknown' : (audit.metaPixel ? 'Detected' : 'Not detected'),
      ads: audit.googleAds === null || audit.googleAds === undefined ? 'Unknown' : (audit.googleAds ? 'Detected' : 'Not detected'),
      score: audit.icpScore == null ? 'Not scored' : escapeHTML(audit.icpScore) + '/100',
      pitch: escapeHTML(audit.pitch || 'No outreach suggestion was generated.'),
      failed: escapeHTML(Array.isArray(audit.failedChecks) ? audit.failedChecks.join(', ') : 'Not available')
    };
    const report = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Website Diagnostic — ' + safe.domain + '</title>' +
      '<style>body{font:15px/1.6 Arial,sans-serif;background:#070b14;color:#e2e8f0;padding:32px}.card{max-width:760px;margin:auto;background:#0f172a;border:1px solid #334155;border-radius:18px;padding:28px}h1{font-size:24px}small{color:#94a3b8}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.metric{background:#070b14;border:1px solid #334155;border-radius:12px;padding:14px}.label{font-size:11px;color:#94a3b8;text-transform:uppercase}.value{font-size:20px;font-weight:800;color:#38bdf8}.note{margin-top:22px;padding:16px;border:1px solid #334155;border-radius:12px}</style></head><body><main class="card"><small>APEXINTEL • WEBSITE DIAGNOSTIC</small><h1>' + safe.company + '</h1><p>Target domain: ' + safe.domain + '</p><p><small>Scanned: ' + safe.scannedAt + '</small></p><section class="grid"><div class="metric"><div class="label">Response time</div><div class="value">' + safe.speed + '</div></div><div class="metric"><div class="label">Technology</div><div class="value">' + safe.cms + '</div></div><div class="metric"><div class="label">Meta Pixel</div><div class="value">' + safe.meta + '</div></div><div class="metric"><div class="label">Google Ads tag</div><div class="value">' + safe.ads + '</div></div><div class="metric"><div class="label">Research score</div><div class="value">' + safe.score + '</div></div><div class="metric"><div class="label">Failed checks</div><div class="value">' + safe.failed + '</div></div></section><section class="note"><h2>Suggested research angle</h2><p>' + safe.pitch + '</p><small>Point-in-time website diagnostics are not a guarantee of performance, tracking coverage, or conversion outcomes.</small></section></main></body></html>';
    const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit_report_' + String(audit.domain || 'website').replace(/[^a-z0-9.-]/gi, '_') + '.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify('Audit report exported.');
  }
  window.downloadCustomExtractionCsv = function (requestId) {
    const requests = Array.isArray(window.userCustomRequests) ? window.userCustomRequests : [];
    const request = requests.find(item => item.requestId === requestId || item.id === requestId);
    if (!request) {
      notify('Custom research request was not found for this account.');
      return;
    }

    const records = Array.isArray(request.deliveredRecords)
      ? request.deliveredRecords
      : (Array.isArray(request.results) ? request.results : []);
    if (!records.length) {
      notify('No delivered records are attached to this request yet.');
      return;
    }

    const headers = Array.from(new Set(records.flatMap(record => Object.keys(record || {}))));
    const escapeCsv = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    const csv = [headers.map(escapeCsv).join(',')]
      .concat(records.map(record => headers.map(key => escapeCsv(record[key])).join(',')))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'custom_research_' + String(request.requestId || request.id).replace(/[^a-z0-9_-]/gi, '_') + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify('Delivered records exported.');
  }
  window.loadUserOrdersFromBackend = async function () {
    const user = getUserData();
    if (!user || !user.email) {
      userPurchasedOrders = [];
      populateDatasetsList();
      populateLedgerList();
      populateBillingInvoices();
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.orders)) {
        if (response.status === 401) userPurchasedOrders = [];
        else throw new Error(data.error || 'Unable to load account orders.');
      } else {
        userPurchasedOrders = data.orders;
      }
    } catch (error) {
      console.warn('[Orders Load Error]:', error.message);
      userPurchasedOrders = [];
    }

    populateDatasetsList();
    populateLedgerList();
    populateBillingInvoices();
    renderBillingTab();
  }


  function populateDatasetsList() {
    const container = document.getElementById('purchasedDatasetsList');
    const ownedEl = document.getElementById('datasetsOwnedCount');
    const totalEl = document.getElementById('datasetsTotalLeadsCount');
    const orders = Array.isArray(userPurchasedOrders) ? userPurchasedOrders : [];
    const paidOrders = orders.filter(order => String(order.status || '').toLowerCase() === 'paid');
    const packRecordCounts = { texas: 24, florida: 8, medspas: 9, hvac: 12 };
    if (ownedEl) ownedEl.innerText = String(paidOrders.length);
    if (totalEl) {
      const total = paidOrders.reduce((sum, order) => sum + (Number(order.leadsCount) || packRecordCounts[order.productKey] || 0), 0);
      totalEl.innerText = String(total);
    }
    if (!container) return;
    container.innerHTML = '';

    if (!orders.length) {
      container.innerHTML = `
        <div class="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
          <div class="text-3xl">📦</div>
          <h5 class="text-white font-bold text-sm">No Purchased Datasets Yet</h5>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">Paid dataset orders will appear here after payment is confirmed by the server.</p>
          <button onclick="window.customerDashQuickReorder()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/30">Browse Dataset Catalog &rarr;</button>
        </div>`;
      return;
    }

    orders.forEach(order => {
      const isPaid = String(order.status || '').toLowerCase() === 'paid';
      const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
      const amountValue = Number(order.amount);
      const amountLabel = Number.isFinite(amountValue) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: String(order.currency || 'USD').toUpperCase() }).format(amountValue) : 'Amount unavailable';
      const productName = escapeHTML(order.productName || order.productKey || 'Dataset');
      const filename = escapeHTML(order.filename || 'Dataset file');
      const orderId = escapeHTML(order.orderId || '');
      const productKey = escapeHTML(order.productKey || '');
      const status = escapeHTML(isPaid ? 'Paid' : (order.status || 'Pending'));
      const recordCount = Number(order.leadsCount) || packRecordCounts[order.productKey] || null;
      const card = document.createElement('div');
      card.className = 'bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl transition flex flex-col md:flex-row md:items-center justify-between gap-4';
      card.innerHTML = `
        <div class="flex items-start gap-3.5">
          <div class="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">📊</div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h5 class="font-bold text-white text-sm">${productName}</h5>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded ${isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">${status}</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${recordCount === null ? 'Record count unavailable' : recordCount + ' business records'} • ${filename}</p>
            <div class="flex items-center gap-2 mt-2 text-[11px] text-slate-500 font-mono flex-wrap">
              <span>Ordered: ${escapeHTML(orderDate)}</span><span>•</span><span class="text-slate-400 font-bold">${escapeHTML(amountLabel)}</span><span>•</span><span class="text-indigo-400">${orderId || 'Order ID unavailable'}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${isPaid
            ? `<button onclick="window.downloadDatasetOrder('${orderId}')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"><span>📥 Download XLSX</span></button>`
            : `<button onclick="window.redirectToStripeHostedCheckout('${productKey}')" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md">Complete Payment</button>`}
        </div>`;
      container.appendChild(card);
    });
  }

  function populateLedgerList() {
    const tbody = document.getElementById('dedupeLedgerTableBody');
    const countEl = document.getElementById('customerOrderHistoryCount');
    if (!tbody) return;
    const orders = Array.isArray(userPurchasedOrders) ? userPurchasedOrders : [];
    if (countEl) countEl.innerText = String(orders.length);
    tbody.innerHTML = '';
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 px-4 text-center text-slate-500">No orders have been recorded for this account yet.</td></tr>';
      return;
    }
    const packLeadCounts = { texas: 24, florida: 8, medspas: 9, hvac: 12 };
    orders.forEach(order => {
      const status = String(order.status || 'unknown');
      const recordCount = Number(order.leadsCount) || packLeadCounts[order.productKey] || null;
      const date = order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date unavailable';
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-900/40 transition';
      row.innerHTML = '<td class="py-2.5 px-4 text-indigo-300 font-bold">' + escapeHTML(order.orderId || 'Order ID unavailable') + '</td>' +
        '<td class="py-2.5 px-4 text-white">' + escapeHTML(order.productName || order.productKey || 'Dataset') + '</td>' +
        '<td class="py-2.5 px-4 text-slate-300">' + (recordCount === null ? 'Not specified' : recordCount) + '</td>' +
        '<td class="py-2.5 px-4 text-slate-400">' + escapeHTML(date) + '</td>' +
        '<td class="py-2.5 px-4 text-right"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">' + escapeHTML(status) + '</span></td>';
      tbody.appendChild(row);
    });
  }

  function refreshDashboardUserInfo() {
    const user = getUserData() || {};
    const avatarEl = document.getElementById('dashUserAvatar');
    const nameEl = document.getElementById('dashUserName');
    const companyEl = document.getElementById('dashUserCompany');
    const creditsEl = document.getElementById('dashUserCredits');
    const planBadge = document.getElementById('dashUserPlanBadge');
    const displayName = user.name || 'Account';
    const credits = user.credits !== null && user.credits !== undefined && Number.isFinite(Number(user.credits))
      ? Number(user.credits)
      : null;
    const creditsLabel = credits === null ? 'Credits unavailable' : credits + ' Account Credits';

    if (avatarEl) avatarEl.innerText = displayName.charAt(0).toUpperCase();
    if (nameEl) nameEl.innerText = displayName;
    if (planBadge) planBadge.innerText = user.plan || 'No plan assigned';
    if (creditsEl) creditsEl.innerText = creditsLabel;
    if (companyEl) companyEl.innerHTML = escapeHTML(user.company || 'Company not set') +
      ' • <span class="text-indigo-400 font-mono font-bold">' + escapeHTML(creditsLabel) + '</span>';

    const fields = {
      custSettingNameDisplay: displayName,
      custSettingCompanyDisplay: user.company || 'Company not set',
      custSettingEmailDisplay: user.email || 'Email unavailable',
      custSettingPlanDisplay: user.plan || 'No plan assigned'
    };
    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.innerText = value;
    });
  }
  window.openCustomerDashboard = function (initialTab = 'overview') {
    injectDashboardHTML();
    refreshDashboardUserInfo();
    window.loadCrmLeadsFromBackend();
    window.loadUserOrdersFromBackend();
    if (typeof window.loadCrmCampaignsFromBackend === 'function') window.loadCrmCampaignsFromBackend();
    window.switchCustomerTab(initialTab);

    const modal = document.getElementById('customerDashboard');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }


  window.closeCustomerDashboard = function () {
    const modal = document.getElementById('customerDashboard');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };


  window.downloadDatasetOrder = async function (orderId) {
    if (!orderId) {
      notify('Invalid order reference.');
      return;
    }

    notify('⏳ Requesting secure presigned download from AWS S3...');

    try {
      const resp = await fetch(`/api/downloads/signed-url?orderId=${encodeURIComponent(orderId)}`, {
        method: 'GET',
        credentials: 'include'
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        if (resp.status === 401) {
          notify('Authentication required. Please sign in again.');
          return;
        }
        if (resp.status === 403) {
          notify(data.error || 'Access denied: Payment verification required.');
          return;
        }
        throw new Error(data.error || 'Failed to generate download URL.');
      }

      if (data.downloadUrl) {
        notify('✓ Presigned URL authorized. Starting download...');
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.setAttribute('download', data.filename || 'apexintel_dataset.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('[Download Error]:', err);
      notify(`Download error: ${err.message}`);
    }
  };
  window.downloadDatasetPacks = function (keyOrOrderId) {
    const order = (userPurchasedOrders || []).find(item =>
      item.status === 'paid' && (item.orderId === keyOrOrderId || item.productKey === keyOrOrderId)
    );
    if (order) {
      window.downloadDatasetOrder(order.orderId);
    } else {
      notify('No paid order found for this dataset. Complete checkout to unlock the download.');
    }
  }
  window.downloadCombinedMasterDataset = function () {
    notify('Datasets are delivered per paid order. Use the download action on each purchased dataset.');
  }

})();
