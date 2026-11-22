/**
 * ApexIntel B2B - Authentication & Dynamic Navigation System
 * Handles client-side auth, demo accounts seeding, session management,
 * auth modal rendering, and dynamic navbar state updates.
 */

(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_ACCOUNTS = 'apexintel_accounts';
  const STORAGE_SESSION = 'apexintel_session';
  const STORAGE_ORDERS = 'apexintel_orders';

  // --- Seed Data ---
  const SEED_ACCOUNTS = [
    {
      email: 'alex@velocitygrowth.io',
      name: 'Alex Rivera',
      company: 'Velocity Growth Agency',
      plan: 'Enterprise Pro',
      credits: 250,
      role: 'customer',
      password: 'demo123',
      apiKey: 'apex_live_sec_7f9a2b8e4d1c603a'
    },
    {
      email: 'sarah@outboundsprint.com',
      name: 'Sarah Chen',
      company: 'OutboundSprint',
      plan: 'Agency Growth',
      credits: 50,
      role: 'customer',
      password: 'demo123',
      apiKey: 'apex_live_sec_1a3b5c7d9e0f2468'
    },
    {
      email: 'admin@apexintel.io',
      name: 'Admin',
      company: 'ApexIntel HQ',
      plan: 'Admin',
      credits: 9999,
      role: 'admin',
      password: 'apex2026',
      apiKey: 'apex_live_sec_root_999988887777'
    }
  ];

  const SEED_ORDERS = [
    {
      id: 'ord_tx_9011',
      date: '2026-11-20T14:22:00Z',
      customerEmail: 'alex@velocitygrowth.io',
      customerName: 'Alex Rivera',
      company: 'Velocity Growth Agency',
      packId: 'texas',
      packName: 'Texas High-Ticket Contractors',
      leadsDelivered: 24,
      amount: 79,
      processor: 'Gumroad',
      status: 'Delivered',
      downloadUrl: '/covers/cover_texas.png',
      leads: [
        { domain: 'dallasroofer.com', company: 'T Rock Roofing & Restoration', email: 'info@dallasroofer.com' },
        { domain: 'suttonroofinginc.com', company: 'Sutton Roofing & Solar', email: 'office@suttonroofinginc.com' },
        { domain: 'precisionroof.com', company: 'Precision Roof Crafters', email: 'leads@precisionroof.com' },
        { domain: 'freedomsolar.com', company: 'Freedom Solar Power', email: 'contact@freedomsolar.com' }
      ]
    },
    {
      id: 'ord_fl_8944',
      date: '2026-11-19T09:11:00Z',
      customerEmail: 'alex@velocitygrowth.io',
      customerName: 'Alex Rivera',
      company: 'Velocity Growth Agency',
      packId: 'florida',
      packName: 'Florida Solar & Storm Restoration',
      leadsDelivered: 24,
      amount: 79,
      processor: 'Gumroad',
      status: 'Delivered',
      downloadUrl: '/covers/cover_florida.png',
      leads: [
        { domain: 'tampabaysolar.com', company: 'Tampa Bay Solar', email: 'info@tampabaysolar.com' },
        { domain: 'sunvena.com', company: 'SunVena Solar', email: 'service@sunvena.com' },
        { domain: 'goldinsolar.com', company: 'Goldin Solar', email: 'contact@goldinsolar.com' }
      ]
    },
    {
      id: 'ord_ca_7812',
      date: '2026-11-21T11:45:00Z',
      customerEmail: 'sarah@outboundsprint.com',
      customerName: 'Sarah Chen',
      company: 'OutboundSprint',
      packId: 'medspas',
      packName: 'California Luxury MedSpas',
      leadsDelivered: 24,
      amount: 89,
      processor: 'Gumroad',
      status: 'Delivered',
      downloadUrl: '/covers/cover_medspas.png',
      leads: [
        { domain: 'nassifmd.com', company: 'NassifMD Medical Spa', email: 'concierge@nassifmd.com' },
        { domain: 'skinspirit.com', company: 'SkinSpirit Beverly Hills', email: 'info@skinspirit.com' },
        { domain: 'ljcmedspa.com', company: 'La Jolla Cosmetic MedSpa', email: 'appointments@ljcmedspa.com' }
      ]
    },
    {
      id: 'ord_hv_6501',
      date: '2026-11-18T16:04:00Z',
      customerEmail: 'mike@industrialgrowth.io',
      customerName: 'Mike Sullivan',
      company: 'Industrial Growth Partners',
      packId: 'hvac',
      packName: 'Commercial HVAC & Mechanical',
      leadsDelivered: 24,
      amount: 99,
      processor: 'Stripe',
      status: 'Delivered',
      downloadUrl: '/covers/cover_hvac.png',
      leads: [
        { domain: 'ambermech.com', company: 'Amber Mechanical Contractors', email: 'service@ambermech.com' },
        { domain: 'dallasmech.com', company: 'Dallas Mechanical Group', email: 'estimating@dallasmech.com' }
      ]
    },
    {
      id: 'ord_cst_3019',
      date: '2026-11-21T08:30:00Z',
      customerEmail: 'david@zenithb2b.com',
      customerName: 'David Vance',
      company: 'Zenith B2B Media',
      packId: 'custom_250',
      packName: 'Custom Extraction (Phoenix Roofing & Solar)',
      leadsDelivered: 250,
      amount: 299,
      processor: 'Stripe Invoice',
      status: 'Delivered',
      downloadUrl: '#',
      leads: []
    }
  ];

  // --- Auth Engine ---
  const ApexAuth = {
    _getAccounts: function () {
      try {
        const stored = localStorage.getItem(STORAGE_ACCOUNTS);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    },

    _saveAccounts: function (accounts) {
      localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(accounts));
    },

    initStorage: function () {
      if (!localStorage.getItem(STORAGE_ACCOUNTS)) {
        localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(SEED_ACCOUNTS));
      }
      if (!localStorage.getItem(STORAGE_ORDERS)) {
        localStorage.setItem(STORAGE_ORDERS, JSON.stringify(SEED_ORDERS));
      }
    },

    getAccounts: function () {
      return this._getAccounts();
    },

    getOrders: function (customerEmail) {
      try {
        const raw = localStorage.getItem(STORAGE_ORDERS);
        const all = raw ? JSON.parse(raw) : [];
        if (!customerEmail) return all;
        return all.filter(o => o.customerEmail.toLowerCase() === customerEmail.toLowerCase());
      } catch (e) {
        return [];
      }
    },

    addOrder: function (order) {
      try {
        const all = this.getOrders();
        all.unshift(order);
        localStorage.setItem(STORAGE_ORDERS, JSON.stringify(all));
        return true;
      } catch (e) {
        return false;
      }
    },

    login: function (email, password) {
      const accounts = this._getAccounts();
      const user = accounts.find(
        a => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
      );
      if (!user) {
        return { success: false, message: 'Invalid email or password.' };
      }
      // Set session (excluding raw password)
      const sessionUser = { ...user };
      delete sessionUser.password;
      sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(sessionUser));
      updateNavbarState();
      return { success: true, user: sessionUser };
    },

    register: function (data) {
      const accounts = this._getAccounts();
      const exists = accounts.some(a => a.email.toLowerCase() === data.email.trim().toLowerCase());
      if (exists) {
        return { success: false, message: 'An account with this email already exists.' };
      }
      const newAccount = {
        email: data.email.trim().toLowerCase(),
        name: data.name.trim(),
        company: data.company.trim() || 'Independent Agency',
        plan: 'Agency Growth',
        credits: 50,
        role: 'customer',
        password: data.password,
        targetNiche: data.targetNiche || 'Contractors',
        apiKey: 'apex_live_sec_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
      };
      accounts.push(newAccount);
      this._saveAccounts(accounts);

      const sessionUser = { ...newAccount };
      delete sessionUser.password;
      sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(sessionUser));
      updateNavbarState();
      return { success: true, user: sessionUser };
    },

    logout: function () {
      sessionStorage.removeItem(STORAGE_SESSION);
      updateNavbarState();
      if (typeof window.showToast === 'function') {
        window.showToast('Signed out successfully.');
      }
      // If customer dashboard is open, close it
      const dash = document.getElementById('customerDashboardModal');
      if (dash) dash.classList.add('hidden');
      const adminDash = document.getElementById('adminDashboardModal');
      if (adminDash) adminDash.classList.add('hidden');
    },

    getCurrentUser: function () {
      try {
        const raw = sessionStorage.getItem(STORAGE_SESSION);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    isLoggedIn: function () {
      return this.getCurrentUser() !== null;
    },

    isAdmin: function () {
      const u = this.getCurrentUser();
      return u && u.role === 'admin';
    }
  };

  window.ApexAuth = ApexAuth;

  // --- HTML Injections: Auth Modal Template ---
  function injectAuthModal() {
    if (document.getElementById('authModal')) return;

    const modalHtml = `
    <!-- AUTHENTICATION MODAL -->
    <div id="authModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 hidden items-center justify-center p-4">
      <div class="bg-slate-950 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
        <button onclick="closeAuthModal()" class="absolute top-5 right-5 text-slate-400 hover:text-white text-xl font-bold transition">&times;</button>

        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs font-black uppercase tracking-wider text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">Client Portal</span>
          <span class="text-xs text-slate-500 font-mono">Secure Access</span>
        </div>

        <h3 id="authModalTitle" class="text-2xl font-black text-white">Sign In to ApexIntel</h3>
        <p class="text-xs text-slate-400 mt-1 mb-5">Access your purchased datasets, deduplication ledger, and CRM API keys.</p>

        <!-- Auth Tabs -->
        <div class="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl mb-5 border border-slate-800">
          <button id="authTabSignIn" onclick="switchAuthTab('signin')" class="py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition text-center shadow">
            Sign In
          </button>
          <button id="authTabRegister" onclick="switchAuthTab('register')" class="py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition text-center">
            Create Account
          </button>
        </div>

        <!-- SIGN IN FORM -->
        <form id="signInForm" onsubmit="handleSignInSubmit(event)" class="space-y-3.5">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Email</label>
            <input type="email" id="signInEmail" required placeholder="name@youragency.com" autocomplete="email"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <span class="text-[10px] text-slate-500 font-mono">demo: demo123</span>
            </div>
            <input type="password" id="signInPassword" required placeholder="••••••••" autocomplete="current-password"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>

          <div id="signInError" class="text-xs text-rose-400 hidden pt-1"></div>

          <button type="submit" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/30 active:scale-95">
            Sign In to Dashboard &rarr;
          </button>

          <!-- 1-Click Demo Login Shortcuts -->
          <div class="pt-3 border-t border-slate-800/80">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 text-center">⚡ 1-Click Demo Test Accounts</span>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" onclick="fillDemoAccount('alex@velocitygrowth.io', 'demo123')" class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-left transition group">
                <div class="text-[11px] font-bold text-white group-hover:text-indigo-400 transition">Alex (Agency Pro)</div>
                <div class="text-[10px] text-slate-500 font-mono">250 credits • 2 packs</div>
              </button>
              <button type="button" onclick="fillDemoAccount('sarah@outboundsprint.com', 'demo123')" class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-left transition group">
                <div class="text-[11px] font-bold text-white group-hover:text-indigo-400 transition">Sarah (Growth SDR)</div>
                <div class="text-[10px] text-slate-500 font-mono">50 credits • 1 pack</div>
              </button>
            </div>
            <div class="mt-2 text-center">
              <button type="button" onclick="fillDemoAccount('admin@apexintel.io', 'apex2026')" class="text-[10px] text-slate-500 hover:text-emerald-400 font-mono transition">
                🔒 Sign in as Platform Admin (admin@apexintel.io)
              </button>
            </div>
          </div>
        </form>

        <!-- REGISTER FORM -->
        <form id="registerForm" onsubmit="handleRegisterSubmit(event)" class="space-y-3 hidden">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
            <input type="text" id="regName" required placeholder="Alex Rivera"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agency / Company</label>
            <input type="text" id="regCompany" required placeholder="Velocity Growth Agency"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Work Email</label>
            <input type="email" id="regEmail" required placeholder="founder@youragency.com"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
            <input type="password" id="regPassword" required placeholder="Create secure password" minlength="6"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Target Niche</label>
            <select id="regNiche" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 transition">
              <option value="Commercial Roofing">Commercial Roofing & Storm</option>
              <option value="Commercial Solar">Commercial Solar & Storage</option>
              <option value="Luxury MedSpas">Luxury MedSpas & Aesthetics</option>
              <option value="Commercial HVAC">Commercial HVAC & Mechanical</option>
              <option value="Other">Other High-Ticket Services</option>
            </select>
          </div>

          <div id="registerError" class="text-xs text-rose-400 hidden pt-1"></div>

          <button type="submit" class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/30 active:scale-95">
            Create Free Account (+50 Credits) &rarr;
          </button>
        </form>

      </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // --- Dynamic Navbar Updater ---
  window.updateNavbarState = function () {
    const navActions = document.getElementById('navActions');
    if (!navActions) return;

    const user = ApexAuth.getCurrentUser();

    if (!user) {
      // Logged Out State
      navActions.innerHTML = `
        <button onclick="openAuthModal('signin')" class="text-xs font-bold text-slate-300 hover:text-white transition px-3 py-2 rounded-xl hover:bg-slate-900">
          Sign In
        </button>
        <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Store Live
        </span>
        <button onclick="openQuickBuyModal()" class="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center gap-1.5">
          <span>⚡</span> <span class="hidden sm:inline">Get Instant Access</span><span class="sm:hidden">Buy Pack</span>
        </button>
      `;
    } else {
      // Logged In State
      const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
      const isAdm = user.role === 'admin';
      const badgeColor = isAdm
        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        : user.plan.includes('Pro')
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';

      navActions.innerHTML = `
        <!-- Credits Counter Badge -->
        <div class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
          <span class="text-indigo-400">🎯</span>
          <span class="text-white font-bold">${user.credits}</span>
          <span class="text-slate-500 text-[10px]">credits</span>
        </div>

        <!-- User Profile Dropdown Button -->
        <div class="relative" id="userMenuContainer">
          <button onclick="toggleUserDropdown()" class="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr ${isAdm ? 'from-rose-600 to-amber-500' : 'from-indigo-600 to-cyan-500'} flex items-center justify-center font-black text-white text-xs shadow-md">
              ${initial}
            </div>
            <div class="hidden md:block text-left">
              <div class="text-xs font-bold text-white leading-tight truncate max-w-[120px]">${user.name}</div>
              <div class="text-[10px] text-slate-400 truncate max-w-[120px]">${user.company}</div>
            </div>
            <span class="text-slate-400 text-xs">▾</span>
          </button>

          <!-- User Dropdown Menu -->
          <div id="userDropdownMenu" class="absolute right-0 top-full mt-2 w-64 bg-slate-950/95 border border-slate-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 hidden divide-y divide-slate-800/70">
            <div class="p-2.5">
              <div class="text-xs font-bold text-white">${user.name}</div>
              <div class="text-[11px] text-slate-400 truncate">${user.email}</div>
              <div class="mt-1.5 inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeColor}">
                ${user.plan}
              </div>
            </div>

            <div class="py-1 space-y-0.5 text-xs">
              <button onclick="openCustomerDashboard('crm'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 flex items-center gap-2 transition font-bold">
                <span>🎯</span> Prospect CRM & Pipeline
              </button>
              <button onclick="openCustomerDashboard('campaigns'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition">
                <span>🚀</span> Campaigns & Follow-Ups
              </button>
              <button onclick="openCustomerDashboard('auditlab'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition">
                <span>🔬</span> Website Audit Lab
              </button>
              <button onclick="openCustomerDashboard('customreq'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition">
                <span>📋</span> Custom Extraction Requests
              </button>
              <button onclick="openCustomerDashboard('datasets'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition">
                <span>📦</span> My Datasets & Downloads
              </button>
              <button onclick="openCustomerDashboard('ledger'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition">
                <span>🛡️</span> Zero-Duplicate Ledger
              </button>
              <button onclick="openCustomerDashboard('api'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition">
                <span>🔑</span> CRM & API Credentials
              </button>
              <button onclick="openCustomerDashboard('settings'); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition">
                <span>⚙️</span> Account & Plan Settings
              </button>
              ${
                isAdm
                  ? `
                <button onclick="openAdminDashboard(); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 font-bold flex items-center gap-2 transition mt-1 border border-rose-500/20">
                  <span>🔒</span> Owner Revenue & AWS Admin
                </button>
              `
                  : ''
              }
            </div>

            <div class="pt-1">
              <button onclick="ApexAuth.logout(); toggleUserDropdown(false);" class="w-full text-left px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-2 transition">
                <span>🚪</span> Sign Out
              </button>
            </div>
          </div>
        </div>
      `;
    }
  };

  // --- Modal Helpers & Event Handlers ---
  window.openAuthModal = function (tab = 'signin') {
    injectAuthModal();
    const modal = document.getElementById('authModal');
    if (!modal) return;
    switchAuthTab(tab);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.closeAuthModal = function () {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    const errIn = document.getElementById('signInError');
    if (errIn) errIn.classList.add('hidden');
    const errReg = document.getElementById('registerError');
    if (errReg) errReg.classList.add('hidden');
  };

  window.switchAuthTab = function (tab) {
    const btnIn = document.getElementById('authTabSignIn');
    const btnReg = document.getElementById('authTabRegister');
    const formIn = document.getElementById('signInForm');
    const formReg = document.getElementById('registerForm');
    const title = document.getElementById('authModalTitle');

    if (tab === 'signin') {
      btnIn.className = 'py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition text-center shadow';
      btnReg.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition text-center';
      formIn.classList.remove('hidden');
      formReg.classList.add('hidden');
      title.innerText = 'Sign In to ApexIntel';
    } else {
      btnReg.className = 'py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition text-center shadow';
      btnIn.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition text-center';
      formReg.classList.remove('hidden');
      formIn.classList.add('hidden');
      title.innerText = 'Create Client Account';
    }
  };

  window.fillDemoAccount = function (email, password) {
    document.getElementById('signInEmail').value = email;
    document.getElementById('signInPassword').value = password;
    const form = document.getElementById('signInForm');
    if (form) form.requestSubmit();
  };

  window.handleSignInSubmit = function (e) {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value;
    const password = document.getElementById('signInPassword').value;
    const err = document.getElementById('signInError');

    const res = ApexAuth.login(email, password);
    if (!res.success) {
      err.innerText = res.message;
      err.classList.remove('hidden');
    } else {
      err.classList.add('hidden');
      closeAuthModal();
      if (typeof window.showToast === 'function') {
        window.showToast(`Welcome back, ${res.user.name}!`);
      }
      // If admin, open admin dash or customer dash
      if (res.user.role === 'admin') {
        if (typeof window.openAdminDashboard === 'function') {
          window.openAdminDashboard();
        }
      } else {
        if (typeof window.openCustomerDashboard === 'function') {
          window.openCustomerDashboard('crm');
        }
      }
    }
  };

  window.handleRegisterSubmit = function (e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const company = document.getElementById('regCompany').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const niche = document.getElementById('regNiche').value;
    const err = document.getElementById('registerError');

    const res = ApexAuth.register({ name, company, email, password, targetNiche: niche });
    if (!res.success) {
      err.innerText = res.message;
      err.classList.remove('hidden');
    } else {
      err.classList.add('hidden');
      closeAuthModal();
      if (typeof window.showToast === 'function') {
        window.showToast(`Account created! Welcome, ${res.user.name}.`);
      }
      if (typeof window.openCustomerDashboard === 'function') {
        window.openCustomerDashboard('crm');
      }
    }
  };

  window.toggleUserDropdown = function (forceState = null) {
    const menu = document.getElementById('userDropdownMenu');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    const shouldOpen = forceState !== null ? forceState : isHidden;
    if (shouldOpen) {
      menu.classList.remove('hidden');
    } else {
      menu.classList.add('hidden');
    }
  };

  // Close dropdown on outside click
  document.addEventListener('click', function (e) {
    const container = document.getElementById('userMenuContainer');
    if (container && !container.contains(e.target)) {
      toggleUserDropdown(false);
    }
  });

  // --- Bootstrap on Page Load ---
  window.initAuth = function () {
    ApexAuth.initStorage();
    injectAuthModal();
    updateNavbarState();
  };

  // Auto-run if DOM already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initAuth);
  } else {
    window.initAuth();
  }
})();
