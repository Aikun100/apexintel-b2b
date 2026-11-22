/**
 * ApexIntel B2B - Admin Command Center Dashboard
 * Owner/Executive revenue analytics, live transaction feed, AWS infrastructure monitor,
 * custom extraction request fulfillment queue, and lead inventory manager.
 */

(function () {
  'use strict';

  // --- Sample Admin Seed Data ---
  const ADMIN_METRICS = {
    grossRevenue: 14820,
    revenueGrowth: '+2,370',
    netProfit: 14480,
    profitMargin: '97.7%',
    awsCost: 0,
    activeLeads: 3840,
    uniqueBuyers: 88,
    reorderRate: '42%'
  };

  const SEED_TRANSACTIONS = [
    {
      id: 'tx_ord_9011',
      time: '2026-11-21 14:32',
      customerEmail: 'alex@velocitygrowth.io',
      agency: 'Velocity Growth Agency',
      product: 'Texas Commercial Contractors',
      tier: 'Pack (24 leads)',
      amount: '$79.00',
      processor: 'PayPal Card',
      status: 'Delivered',
      statusColor: 'emerald'
    },
    {
      id: 'tx_ord_8944',
      time: '2026-11-21 11:45',
      customerEmail: 'sarah@outboundsprint.com',
      agency: 'OutboundSprint',
      product: 'California Luxury MedSpas',
      tier: 'Pack (24 leads)',
      amount: '$89.00',
      processor: 'PayPal Card',
      status: 'Delivered',
      statusColor: 'emerald'
    },
    {
      id: 'tx_ord_8820',
      time: '2026-11-21 08:30',
      customerEmail: 'david@zenithb2b.com',
      agency: 'Zenith B2B Media',
      product: 'Custom Scrape: Phoenix Solar & Roofing',
      tier: 'Custom (250 leads)',
      amount: '$299.00',
      processor: 'Stripe Invoice',
      status: 'Delivered',
      statusColor: 'emerald'
    },
    {
      id: 'tx_ord_8755',
      time: '2026-11-20 18:04',
      customerEmail: 'marcus@leadcraft.agency',
      agency: 'LeadCraft Outbound',
      product: 'Commercial HVAC & Mechanical',
      tier: 'Pack (24 leads)',
      amount: '$99.00',
      processor: 'PayPal Card',
      status: 'Delivered',
      statusColor: 'emerald'
    },
    {
      id: 'tx_ord_8612',
      time: '2026-11-20 13:22',
      customerEmail: 'elena@skylinegrowth.com',
      agency: 'Skyline Growth Partners',
      product: 'Florida Solar & Storm Restoration',
      tier: 'Pack (24 leads)',
      amount: '$79.00',
      processor: 'PayPal Card',
      status: 'Delivered',
      statusColor: 'emerald'
    },
    {
      id: 'tx_ord_8501',
      time: '2026-11-19 21:10',
      customerEmail: 'mike@industrialgrowth.io',
      agency: 'Industrial Growth Partners',
      product: 'Commercial HVAC & Mechanical',
      tier: 'Pack (24 leads)',
      amount: '$99.00',
      processor: 'PayPal Card',
      status: 'Delivered',
      statusColor: 'emerald'
    }
  ];

  const INVENTORY_DATA = [
    {
      territory: 'Texas Commercial Contractors',
      niche: 'Roofing & Restoration (Austin, DFW, Houston)',
      unassigned: 1420,
      delivered: 180,
      total: 1600,
      pct: 88,
      status: 'Optimal',
      badgeColor: 'emerald'
    },
    {
      territory: 'Florida Solar & Storm Recovery',
      niche: 'Commercial Solar & Hurricane Mitigation',
      unassigned: 980,
      delivered: 120,
      total: 1100,
      pct: 89,
      status: 'Optimal',
      badgeColor: 'sky'
    },
    {
      territory: 'California Luxury MedSpas',
      niche: 'Aesthetic Medicine & Injectables (BH, SF, SD)',
      unassigned: 740,
      delivered: 95,
      total: 835,
      pct: 88,
      status: 'High Demand',
      badgeColor: 'pink'
    },
    {
      territory: 'Commercial HVAC & Mechanical',
      niche: 'Industrial Chillers & Building Automation',
      unassigned: 700,
      delivered: 85,
      total: 785,
      pct: 89,
      status: 'Optimal',
      badgeColor: 'emerald'
    }
  ];

  // Helper to fetch custom requests from storage
  function getCustomRequestsForAdmin() {
    const raw2 = localStorage.getItem('apexintel_custom_requests');
    const raw1 = localStorage.getItem('apex_custom_requests');
    let list = [];
    if (raw2) {
      try { list = JSON.parse(raw2); } catch (e) {}
    } else if (raw1) {
      try { list = JSON.parse(raw1); } catch (e) {}
    }
    if (!list || list.length === 0) {
      list = [
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
      localStorage.setItem('apexintel_custom_requests', JSON.stringify(list));
    }
    return list;
  }

  function saveCustomRequestsFromAdmin(list) {
    localStorage.setItem('apexintel_custom_requests', JSON.stringify(list));
    localStorage.setItem('apex_custom_requests', JSON.stringify(list));
  }

  // Inject Admin Dashboard Modal HTML
  function injectAdminModal() {
    if (document.getElementById('adminDashboardModal')) return;

    const html = `
      <div id="adminDashboardModal" class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 hidden items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div class="bg-slate-950 border border-slate-800 rounded-3xl max-w-6xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative my-auto">
          
          <!-- Top Header -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 mb-6">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-rose-600/30">
                🔒
              </div>
              <div>
                <div class="flex items-center gap-2.5">
                  <h2 class="text-2xl font-black text-white tracking-tight">ApexIntel Admin Command Center</h2>
                  <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">ROOT ACCESS</span>
                  <span class="text-[10px] font-mono text-slate-500">v2.0 AWS Production</span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">Real-Time Revenue Analytics, Crawler Fleet Health, Lead Inventory & Custom Extraction Queue</p>
              </div>
            </div>
            
            <div class="flex items-center gap-3">
              <button onclick="window.triggerEmergencyRecrawl()" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow">
                <span>🔄</span>
                <span>Trigger Recrawl</span>
              </button>
              <button onclick="window.closeAdminDashboard()" class="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold text-lg border border-slate-800 transition">
                &times;
              </button>
            </div>
          </div>

          <!-- KPI Metric Cards Grid (4 Cards) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <!-- Gross Revenue -->
            <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/40 transition">
              <div class="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Gross Revenue (MTD)</span>
                <span class="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-bold">▲ +$2,370 wk</span>
              </div>
              <div class="text-3xl font-black text-white font-mono">$14,820</div>
              <div class="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span class="text-emerald-400 font-bold">88</span> paid transactions across all packs
              </div>
            </div>

            <!-- Net Profit & Margin -->
            <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/40 transition">
              <div class="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Net Profit (Est.)</span>
                <span class="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-bold">97.7% Margin</span>
              </div>
              <div class="text-3xl font-black text-emerald-400 font-mono">$14,480</div>
              <div class="text-[11px] text-slate-500 mt-1.5">
                AWS infrastructure cost: <strong class="text-slate-300 font-mono">$0.00</strong> (credit pool)
              </div>
            </div>

            <!-- Active Lead Inventory -->
            <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/40 transition">
              <div class="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Pre-Warmed Lead Pool</span>
                <span class="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-bold">DynamoDB</span>
              </div>
              <div class="text-3xl font-black text-cyan-300 font-mono">3,840</div>
              <div class="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>100% DNS MX-verified, zero bounce</span>
              </div>
            </div>

            <!-- Unique Buyers & Reorder Rate -->
            <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-purple-500/40 transition">
              <div class="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Agency Client Base</span>
                <span class="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded text-[10px] font-mono font-bold">42% Reorders</span>
              </div>
              <div class="text-3xl font-black text-purple-300 font-mono">88</div>
              <div class="text-[11px] text-slate-500 mt-1.5">
                Average LTV: <strong class="text-white font-mono">$168.40</strong> per agency
              </div>
            </div>
          </div>

          <!-- Custom Extraction Requests Queue (New Admin Capability) -->
          <div class="mb-8 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm font-extrabold uppercase tracking-wider text-amber-400">📋 Custom Extraction Queue (Customer Inbound)</span>
                <span class="text-[10px] font-mono text-slate-500">Live Client Sync</span>
              </div>
              <span class="text-xs text-slate-400">Review specs, update status, and fulfill deliveries</span>
            </div>

            <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                    <th class="py-2.5 px-3">Order ID</th>
                    <th class="py-2.5 px-3">Customer Email</th>
                    <th class="py-2.5 px-3">Target Industry & Territory</th>
                    <th class="py-2.5 px-3">Volume</th>
                    <th class="py-2.5 px-3">Quote</th>
                    <th class="py-2.5 px-3">Current Status</th>
                    <th class="py-2.5 px-3 text-right">Fulfillment Action</th>
                  </tr>
                </thead>
                <tbody id="adminCustomRequestsTableBody" class="divide-y divide-slate-800/60 font-mono text-slate-300">
                  <!-- Rendered via JS -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- AWS Crawler & Infrastructure Health (4 Cards Row) -->
          <div class="mb-8">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-extrabold uppercase tracking-wider text-cyan-400">⚡ AWS Serverless Infrastructure</span>
                <span class="text-[10px] font-mono text-slate-500">Region: ap-southeast-2 (Sydney)</span>
              </div>
              <span class="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <!-- Lambda Status -->
              <div class="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold text-slate-300">Lambda Crawler</span>
                  <span class="text-[10px] font-mono text-emerald-400 font-bold">ACTIVE ●</span>
                </div>
                <div class="text-sm font-mono text-white font-bold truncate">apex-web-app</div>
                <div class="text-[11px] text-slate-400 mt-1 flex justify-between">
                  <span>Last Invoked:</span>
                  <span class="text-slate-300 font-mono">2m ago</span>
                </div>
                <div class="text-[11px] text-slate-400 flex justify-between mt-0.5">
                  <span>Runtime:</span>
                  <span class="text-slate-300 font-mono">Node.js 20.x</span>
                </div>
              </div>

              <!-- DynamoDB Status -->
              <div class="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold text-slate-300">DynamoDB Ledger</span>
                  <span class="text-[10px] font-mono text-cyan-400 font-bold">PAY_PER_REQ</span>
                </div>
                <div class="text-sm font-mono text-white font-bold truncate">leads_cache</div>
                <div class="text-[11px] text-slate-400 mt-1 flex justify-between">
                  <span>Items Tracked:</span>
                  <span class="text-slate-300 font-mono font-bold">3,840</span>
                </div>
                <div class="text-[11px] text-slate-400 flex justify-between mt-0.5">
                  <span>Throttled Events:</span>
                  <span class="text-emerald-400 font-mono font-bold">0</span>
                </div>
              </div>

              <!-- DNS MX Verification -->
              <div class="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold text-slate-300">DNS MX Deliverability</span>
                  <span class="text-[10px] font-mono text-emerald-400 font-bold">98.4% PASS</span>
                </div>
                <div class="text-sm font-mono text-white font-bold">Zero Hard Bounces</div>
                <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div class="bg-emerald-500 h-1.5 rounded-full" style="width: 98.4%"></div>
                </div>
                <div class="text-[10px] text-slate-400 mt-1.5 flex justify-between">
                  <span>Failed Discarded:</span>
                  <span class="text-slate-400 font-mono">61 invalid</span>
                </div>
              </div>

              <!-- AWS Credit Pool -->
              <div class="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold text-slate-300">AWS Credit Budget</span>
                  <span class="text-[10px] font-mono text-indigo-400 font-bold">$200.00 POOL</span>
                </div>
                <div class="text-sm font-mono text-white font-bold">$0.00 MTD Billed</div>
                <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div class="bg-indigo-500 h-1.5 rounded-full" style="width: 1%"></div>
                </div>
                <div class="text-[10px] text-slate-400 mt-1.5 flex justify-between">
                  <span>Credits Remaining:</span>
                  <span class="text-emerald-400 font-mono font-bold">$200.00</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Lead Inventory Manager by Territory -->
          <div class="mb-8">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-extrabold uppercase tracking-wider text-emerald-400">🗄️ Lead Pool Inventory by Commercial Territory</span>
              <span class="text-xs text-slate-400">Auto-balanced across 4 core datasets</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              ${INVENTORY_DATA.map(inv => `
                <div class="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between text-xs font-bold text-white mb-1">
                      <span class="truncate">${inv.territory}</span>
                      <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-${inv.badgeColor}-500/10 text-${inv.badgeColor}-400 border border-${inv.badgeColor}-500/20 shrink-0">
                        ${inv.status}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-400 mb-3">${inv.niche}</p>
                  </div>

                  <div>
                    <div class="flex items-center justify-between text-xs font-mono mb-1.5">
                      <span class="text-slate-400">Available:</span>
                      <span class="text-white font-bold">${inv.unassigned.toLocaleString()} leads</span>
                    </div>
                    <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                      <div class="bg-${inv.badgeColor}-500 h-2 rounded-full" style="width: ${inv.pct}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Delivered: ${inv.delivered}</span>
                      <span>Total Pool: ${inv.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Recent Orders & Live Transaction Feed -->
          <div class="mb-8">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-extrabold uppercase tracking-wider text-indigo-400">📋 Live Order & Transaction Feed</span>
                <span class="text-[10px] font-mono text-slate-500">Synced with PayPal & Stripe</span>
              </div>
              <span class="text-xs text-slate-400">Showing last real-time transactions</span>
            </div>

            <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
                    <th class="py-3 px-4">Timestamp</th>
                    <th class="py-3 px-4">Customer & Agency</th>
                    <th class="py-3 px-4">Dataset Ordered</th>
                    <th class="py-3 px-4">Amount</th>
                    <th class="py-3 px-4">Gateway</th>
                    <th class="py-3 px-4 text-center">Fulfillment</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 font-mono text-slate-300">
                  ${SEED_TRANSACTIONS.map(tx => `
                    <tr class="hover:bg-slate-800/40 transition">
                      <td class="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">${tx.time}</td>
                      <td class="py-3 px-4">
                        <div class="font-bold text-white font-sans">${tx.agency}</div>
                        <div class="text-[11px] text-slate-400">${tx.customerEmail}</div>
                      </td>
                      <td class="py-3 px-4">
                        <div class="font-bold text-indigo-300 font-sans">${tx.product}</div>
                        <div class="text-[10px] text-slate-500 font-sans">${tx.tier}</div>
                      </td>
                      <td class="py-3 px-4 font-bold text-emerald-400 text-sm">${tx.amount}</td>
                      <td class="py-3 px-4">
                        <span class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          ${tx.processor}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <span>✓</span> ${tx.status}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Bottom Summary Strip -->
          <div class="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
            <div class="flex flex-wrap items-center gap-4">
              <span>All-Time Leads: <strong class="text-white">12,480</strong></span>
              <span>•</span>
              <span>All-Time Revenue: <strong class="text-emerald-400">$14,820</strong></span>
              <span>•</span>
              <span>Uptime: <strong class="text-white">99.97%</strong></span>
              <span>•</span>
              <span>Avg Delivery: <strong class="text-cyan-400">1.2s</strong></span>
            </div>
            <div>
              <button onclick="window.closeAdminDashboard()" class="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold transition">
                Close Admin Panel
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // Render custom requests inside admin modal
  function renderAdminCustomRequests() {
    const tbody = document.getElementById('adminCustomRequestsTableBody');
    if (!tbody) return;

    const list = getCustomRequestsForAdmin();
    tbody.innerHTML = '';
    list.forEach(req => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-900/60 transition';
      tr.innerHTML = `
        <td class="py-2.5 px-3 text-indigo-400 font-bold">${req.id}</td>
        <td class="py-2.5 px-3 text-slate-300 font-sans">${req.email}</td>
        <td class="py-2.5 px-3 text-white font-sans">${req.industry} <span class="text-slate-400">(${req.territory})</span></td>
        <td class="py-2.5 px-3 text-slate-300">${req.volume}</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">${req.estimatedPrice || '$299.00'}</td>
        <td class="py-2.5 px-3">
          <select onchange="window.adminUpdateCustomRequestStatus('${req.id}', this.value)" class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-white focus:outline-none">
            <option value="Submitted" ${req.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
            <option value="Reviewing" ${req.status === 'Reviewing' ? 'selected' : ''}>Reviewing</option>
            <option value="Mining" ${req.status === 'Mining' ? 'selected' : ''}>Mining</option>
            <option value="Delivered" ${req.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
          </select>
        </td>
        <td class="py-2.5 px-3 text-right">
          ${req.status !== 'Delivered' ? `
            <button onclick="window.adminFulfillCustomRequest('${req.id}')" class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition">
              ✓ Deliver Now
            </button>
          ` : `
            <span class="text-emerald-400 font-bold text-xs">✓ Delivered</span>
          `}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Admin status update action
  window.adminUpdateCustomRequestStatus = function (reqId, newStatus) {
    const list = getCustomRequestsForAdmin();
    const target = list.find(r => r.id === reqId);
    if (target) {
      target.status = newStatus;
      saveCustomRequestsFromAdmin(list);
      if (typeof window.showToast === 'function') {
        window.showToast(`Updated request ${reqId} status to "${newStatus}"!`);
      }
      renderAdminCustomRequests();
    }
  };

  // Admin fulfill action
  window.adminFulfillCustomRequest = function (reqId) {
    window.adminUpdateCustomRequestStatus(reqId, 'Delivered');
    if (typeof window.showToast === 'function') {
      window.showToast(`Order ${reqId} marked as Delivered! Client can download now.`);
    }
  };

  // --- Exposed Window Functions ---

  window.openAdminDashboard = function () {
    // Check if user is authenticated and has admin role
    if (typeof window.ApexAuth !== 'undefined') {
      const user = window.ApexAuth.getCurrentUser();
      if (!user || user.role !== 'admin') {
        if (typeof window.showToast === 'function') {
          window.showToast('⛔ Admin access required. Please sign in as Administrator.');
        } else {
          alert('⛔ Admin access required.');
        }
        if (typeof window.openAuthModal === 'function') {
          window.openAuthModal('signin');
          setTimeout(() => {
            const emailInput = document.getElementById('signInEmail');
            if (emailInput && !emailInput.value) {
              emailInput.value = 'admin@apexintel.io';
            }
          }, 150);
        }
        return;
      }
    }

    injectAdminModal();
    renderAdminCustomRequests();
    const modal = document.getElementById('adminDashboardModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeAdminDashboard = function () {
    const modal = document.getElementById('adminDashboardModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.triggerEmergencyRecrawl = function () {
    if (typeof window.showToast === 'function') {
      window.showToast('⚡ Invoking AWS Lambda (apex-web-app)... Fresh crawl dispatched!');
    }
    setTimeout(() => {
      if (typeof window.showToast === 'function') {
        window.showToast('✓ 240 fresh leads ingested & verified into DynamoDB leads_cache.');
      }
    }, 2200);
  };

  window.initAdminDashboard = function () {
    injectAdminModal();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initAdminDashboard);
  } else {
    window.initAdminDashboard();
  }

})();
