/**
 * ApexIntel B2B - Production-Grade Authentication & Dynamic Navigation System
 * 
 * Architecture:
 * - Server-authoritative session management via HttpOnly, Secure cookies
 * - Real API integration (/api/auth/login, /api/auth/register, /api/auth/logout, /api/auth/me)
 * - Zero plaintext passwords or session tokens stored in browser storage
 * - In-memory user identity state with automatic session restoration on page load
 * - Dynamic navbar state updates & role-based UI presentation
 */

(function () {
  'use strict';

  const STORAGE_ORDERS = 'apexintel_orders';

  // --- Seed Orders (Local UI Showcase Data) ---
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
      processor: 'Stripe',
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
      processor: 'Stripe',
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
      processor: 'Stripe',
      status: 'Delivered',
      downloadUrl: '/covers/cover_medspas.png',
      leads: [
        { domain: 'nassifmd.com', company: 'NassifMD Medical Spa', email: 'concierge@nassifmd.com' },
        { domain: 'skinspirit.com', company: 'SkinSpirit Beverly Hills', email: 'info@skinspirit.com' },
        { domain: 'ljcmedspa.com', company: 'La Jolla Cosmetic MedSpa', email: 'appointments@ljcmedspa.com' }
      ]
    }
  ];

  // --- Production Auth Engine ---
  const ApexAuth = {
    _currentUser: null,
    _initialized: false,

    initStorage: function () {
      if (!localStorage.getItem(STORAGE_ORDERS)) {
        localStorage.setItem(STORAGE_ORDERS, JSON.stringify(SEED_ORDERS));
      }
    },

    /**
     * Restore authenticated session from backend via GET /api/auth/me
     */
    checkSession: async function () {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.user) {
            this._currentUser = data.user;
          } else {
            this._currentUser = null;
          }
        } else {
          this._currentUser = null;
        }
      } catch (err) {
        // Network or offline fallback
        this._currentUser = null;
      } finally {
        this._initialized = true;
        if (typeof window.updateNavbarState === 'function') {
          window.updateNavbarState();
        }
      }
      return this._currentUser;
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

    /**
     * Authenticate via POST /api/auth/login
     */
    login: async function (email, password) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            success: false,
            message: data.error || data.message || 'Invalid email or password.'
          };
        }

        this._currentUser = data.user;
        if (typeof window.updateNavbarState === 'function') {
          window.updateNavbarState();
        }
        return { success: true, user: data.user };
      } catch (err) {
        return {
          success: false,
          message: 'Unable to reach the authentication service. Please check your connection.'
        };
      }
    },

    /**
     * Register customer account via POST /api/auth/register
     */
    register: async function (data) {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: data.name,
            company: data.company,
            email: data.email,
            password: data.password,
            passwordConfirmation: data.passwordConfirmation || data.password,
            targetNiche: data.targetNiche
          })
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          return {
            success: false,
            message: resData.error || resData.message || 'Registration failed.'
          };
        }

        this._currentUser = resData.user;
        if (typeof window.updateNavbarState === 'function') {
          window.updateNavbarState();
        }
        return { success: true, user: resData.user };
      } catch (err) {
        return {
          success: false,
          message: 'Unable to reach registration service. Please retry shortly.'
        };
      }
    },

    /**
     * Terminate session via POST /api/auth/logout
     */
    logout: async function () {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
      } catch (err) {
        // Logout should proceed even if network fails
      }

      this._currentUser = null;
      if (typeof window.updateNavbarState === 'function') {
        window.updateNavbarState();
      }

      if (typeof window.showToast === 'function') {
        window.showToast('Signed out successfully.');
      }

      // Close open dashboards & purge cached CRM tenant state
      if (typeof window.clearCustomerDashboardCache === 'function') {
        window.clearCustomerDashboardCache();
      }
      const dash = document.getElementById('customerDashboardModal');
      if (dash) dash.classList.add('hidden');
      const adminDash = document.getElementById('adminDashboardModal');
      if (adminDash) adminDash.classList.add('hidden');
    },

    getCurrentUser: function () {
      return this._currentUser;
    },

    updateCurrentUser: function (updates) {
      if (this._currentUser) {
        this._currentUser = { ...this._currentUser, ...updates };
        if (typeof window.updateNavbarState === 'function') {
          window.updateNavbarState();
        }
      }
    },

    isLoggedIn: function () {
      return this._currentUser !== null;
    },

    isAdmin: function () {
      return this._currentUser !== null && this._currentUser.role === 'admin';
    },

    openAuthModal: function (tab = 'signin') {
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal(tab);
      }
    },

    closeAuthModal: function () {
      if (typeof window.closeAuthModal === 'function') {
        window.closeAuthModal();
      }
    },

    openAdminModal: function () {
      if (typeof window.openAdminDashboard === 'function') {
        window.openAdminDashboard();
      } else if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('signin');
      }
    }
  };

  window.ApexAuth = ApexAuth;

  // --- HTML Injections: Auth Modal Template ---
  function injectAuthModal() {
    if (document.getElementById('authModal')) return;

    const modalHtml = `
    <!-- AUTHENTICATION MODAL -->
    <div id="authModal" onclick="if(event.target === this) closeAuthModal()" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 hidden items-center justify-center p-4">
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
              <span class="text-[10px] text-slate-500 font-mono">min 12 chars</span>
            </div>
            <input type="password" id="signInPassword" required placeholder="••••••••••••" autocomplete="current-password"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>

          <div id="signInError" class="text-xs text-rose-400 hidden pt-1"></div>

          <button id="signInSubmitBtn" type="submit" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-2">
            <span>Sign In to Dashboard &rarr;</span>
          </button>

          <!-- 1-Click Demo Login Shortcuts -->
          <div class="pt-3 border-t border-slate-800/80">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 text-center">⚡ 1-Click Test Accounts</span>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" onclick="fillDemoAccount('alex@velocitygrowth.io', 'ApexDemo2026!')" class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-left transition group">
                <div class="text-[11px] font-bold text-white group-hover:text-indigo-400 transition">Alex (Agency Pro)</div>
                <div class="text-[10px] text-slate-500 font-mono">250 credits • 2 packs</div>
              </button>
              <button type="button" onclick="fillDemoAccount('sarah@outboundsprint.com', 'ApexDemo2026!')" class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-left transition group">
                <div class="text-[11px] font-bold text-white group-hover:text-indigo-400 transition">Sarah (Growth SDR)</div>
                <div class="text-[10px] text-slate-500 font-mono">50 credits • 1 pack</div>
              </button>
            </div>
            <div class="mt-2 text-center">
              <button type="button" onclick="fillDemoAccount('admin@apexintel.io', 'AdminMaster2026!')" class="text-[10px] text-slate-500 hover:text-emerald-400 font-mono transition">
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
            <div class="flex items-center justify-between mb-1">
              <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <span class="text-[10px] text-slate-500 font-mono">min 12 chars</span>
            </div>
            <input type="password" id="regPassword" required placeholder="Create secure password" minlength="12"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confirm Password</label>
            <input type="password" id="regPasswordConfirm" required placeholder="Re-enter password" minlength="12"
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

          <button id="registerSubmitBtn" type="submit" class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/30 active:scale-95 flex items-center justify-center gap-2">
            <span>Create Free Account (+50 Credits) &rarr;</span>
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
    const mobileActions = document.getElementById('mobileNavActions');
    if (!navActions && !mobileActions) return;

    const user = ApexAuth.getCurrentUser();

    if (!user) {
      // Logged Out State
      if (navActions) {
        navActions.innerHTML = `
          <button onclick="openAuthModal('signin')" class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center gap-1.5">
            <span>👤</span> Sign In
          </button>
          <a href="#pricing" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-500/20 active:scale-[0.98]">
            Get Started &rarr;
          </a>
        `;
      }
      if (mobileActions) {
        mobileActions.innerHTML = `
          <button onclick="document.getElementById('mobileMenu').classList.add('hidden'); openAuthModal('signin')" class="w-full py-3 rounded-xl text-xs font-bold text-slate-200 bg-slate-900 border border-slate-800 text-center">
            Sign In
          </button>
          <a href="#pricing" onclick="document.getElementById('mobileMenu').classList.add('hidden')" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold text-xs uppercase tracking-wider text-center">
            Get Started
          </a>
        `;
      }
    } else {
      // Logged In State
      const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
      const isAdm = user.role === 'admin';
      const badgeColor = isAdm
        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        : (user.plan && user.plan.includes('Pro'))
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';

      if (navActions) {
        navActions.innerHTML = `
          <!-- Credits Counter Badge -->
          <div class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <span class="text-indigo-400">🎯</span>
            <span class="text-white font-bold">${user.credits !== undefined ? user.credits : 50}</span>
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
                  ${user.plan || 'Agency Growth'}
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
      if (mobileActions) {
        mobileActions.innerHTML = `
          <button onclick="document.getElementById('mobileMenu').classList.add('hidden'); openCustomerDashboard('crm')" class="w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 text-center flex items-center justify-center gap-2">
            <span>🎯</span> Open Workspace (${user.name})
          </button>
          <button onclick="document.getElementById('mobileMenu').classList.add('hidden'); ApexAuth.logout()" class="w-full py-2.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 text-center">
            Sign Out
          </button>
        `;
      }
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

    if (!btnIn || !btnReg || !formIn || !formReg || !title) return;

    if (tab === 'signin' || tab === 'login') {
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

  // Bind modal functions to ApexAuth object for dual compatibility
  ApexAuth.openAuthModal = window.openAuthModal;
  ApexAuth.closeAuthModal = window.closeAuthModal;
  ApexAuth.switchAuthTab = window.switchAuthTab;
  ApexAuth.openAdminModal = function () {
    if (typeof window.openAdminDashboard === 'function') {
      window.openAdminDashboard();
    } else {
      window.openAuthModal('signin');
    }
  };

  window.fillDemoAccount = function (email, password) {
    document.getElementById('signInEmail').value = email;
    document.getElementById('signInPassword').value = password;
    const form = document.getElementById('signInForm');
    if (form) form.requestSubmit();
  };

  window.handleSignInSubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value;
    const password = document.getElementById('signInPassword').value;
    const err = document.getElementById('signInError');
    const submitBtn = document.getElementById('signInSubmitBtn');

    err.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳ Authenticating...</span>`;
    }

    try {
      const res = await ApexAuth.login(email, password);
      if (!res.success) {
        err.innerText = res.message;
        err.classList.remove('hidden');
      } else {
        err.classList.add('hidden');
        closeAuthModal();
        if (typeof window.showToast === 'function') {
          window.showToast(`Welcome back, ${res.user.name}!`);
        }
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
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to Dashboard &rarr;</span>`;
      }
    }
  };

  window.handleRegisterSubmit = async function (e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const company = document.getElementById('regCompany').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const passwordConfirmation = document.getElementById('regPasswordConfirm')?.value || password;
    const niche = document.getElementById('regNiche').value;
    const err = document.getElementById('registerError');
    const submitBtn = document.getElementById('registerSubmitBtn');

    err.classList.add('hidden');

    if (password !== passwordConfirmation) {
      err.innerText = 'Password confirmation does not match.';
      err.classList.remove('hidden');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳ Creating Account...</span>`;
    }

    try {
      const res = await ApexAuth.register({ 
        name, 
        company, 
        email, 
        password, 
        passwordConfirmation, 
        targetNiche: niche 
      });

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
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Create Free Account (+50 Credits) &rarr;</span>`;
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
  window.initAuth = async function () {
    ApexAuth.initStorage();
    injectAuthModal();
    if (window._pendingAuthTab) {
      window.openAuthModal(window._pendingAuthTab);
      window._pendingAuthTab = null;
    }
    // Validate session with authoritative backend
    await ApexAuth.checkSession();
  };

  // Auto-run if DOM already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initAuth);
  } else {
    window.initAuth();
  }
})();
