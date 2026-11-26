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

  // Orders are authoritative backend records. Never seed or persist orders in browser storage.

  // --- Production Auth Engine ---
  const ApexAuth = {
    _currentUser: null,
    _initialized: false,

    initStorage: function () {
      // Kept as a compatibility hook; order data must come from the authenticated API.
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

    getOrders: function () {
      // No local/demo order ledger. Fetch orders from the authenticated backend.
      return [];
    },

    addOrder: function () {
      // Orders can only be created by the server-side payment/fulfillment workflow.
      return false;
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
      const dash = document.getElementById('customerDashboard');
      if (dash) {
        dash.classList.add('hidden');
        dash.classList.remove('flex');
      }
      const adminDash = document.getElementById('adminDashboardModal');
      if (adminDash) {
        adminDash.classList.add('hidden');
        adminDash.classList.remove('flex');
      }
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

  window.getCsrfToken = function () {
    const match = document.cookie.match(/(?:^|;\s*)apexintel_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

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

          <div class="text-center mt-2">
            <button type="button" onclick="switchAuthTab('forgot')" class="text-[11px] text-slate-500 hover:text-cyan-400 transition font-mono">Forgot password?</button>
          </div>

          <p class="text-center text-[10px] text-slate-500 pt-3 border-t border-slate-800/80">Use your registered account credentials. Demo access is disabled.</p>
        </form>

        <!-- REGISTER FORM -->
        <form id="registerForm" onsubmit="handleRegisterSubmit(event)" class="space-y-3 hidden">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
            <input type="text" id="regName" required placeholder="Your full name"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Agency / Company</label>
            <input type="text" id="regCompany" required placeholder="Your company or agency"
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

        <!-- FORGOT PASSWORD FORM -->
        <form id="forgotPasswordForm" onsubmit="handleForgotPasswordSubmit(event)" class="space-y-3.5 hidden">
          <div class="text-center mb-4">
            <div class="text-2xl mb-2">🔑</div>
            <p class="text-xs text-slate-400">Enter your account email and we'll send a reset link.</p>
          </div>
          <div>
            <label for="forgotEmail" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account Email</label>
            <input type="email" id="forgotEmail" required placeholder="name@youragency.com" autocomplete="email"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition">
          </div>
          <div id="forgotError" class="text-xs text-rose-400 hidden pt-1"></div>
          <div id="forgotSuccess" class="text-xs text-emerald-400 hidden pt-1 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20"></div>
          <button id="forgotSubmitBtn" type="submit" class="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-600/30 active:scale-95">
            Send Reset Link
          </button>
          <div class="text-center">
            <button type="button" onclick="switchAuthTab('signin')" class="text-[11px] text-slate-500 hover:text-white transition font-mono">&larr; Back to Sign In</button>
          </div>
        </form>

        <!-- RESET PASSWORD FORM (token from URL) -->
        <form id="resetPasswordForm" onsubmit="handleResetPasswordSubmit(event)" class="space-y-3.5 hidden">
          <div class="text-center mb-4">
            <div class="text-2xl mb-2">🔒</div>
            <p class="text-xs text-slate-400">Enter your new password below.</p>
          </div>
          <div>
            <label for="resetNewPassword" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Password</label>
            <input type="password" id="resetNewPassword" required placeholder="New password (min 12 chars)" minlength="12"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition">
          </div>
          <div>
            <label for="resetConfirmPassword" class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Confirm Password</label>
            <input type="password" id="resetConfirmPassword" required placeholder="Re-enter new password" minlength="12"
                   class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition">
          </div>
          <div id="resetError" class="text-xs text-rose-400 hidden pt-1"></div>
          <div id="resetSuccess" class="text-xs text-emerald-400 hidden pt-1 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20"></div>
          <button id="resetSubmitBtn" type="submit" class="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-600/30 active:scale-95">
            Set New Password
          </button>
          <div class="text-center">
            <button type="button" onclick="switchAuthTab('signin')" class="text-[11px] text-slate-500 hover:text-white transition font-mono">&larr; Back to Sign In</button>
          </div>
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
            <span class="text-white font-bold">${user.credits !== null && user.credits !== undefined ? user.credits : '—'}</span>
            <span class="text-slate-500 text-[10px]">credits</span>
          </div>

          <!-- User Profile Dropdown Button -->
          <div class="relative" id="userMenuContainer">
            <button onclick="toggleUserDropdown()" class="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-tr ${isAdm ? 'from-rose-600 to-amber-500' : 'from-indigo-600 to-cyan-500'} flex items-center justify-center font-black text-white text-xs shadow-md">
                ${initial}
              </div>
              <div class="hidden md:block text-left">
                <div class="text-xs font-bold text-white leading-tight truncate max-w-[120px]">${user.name || 'Account'}</div>
                <div class="text-[10px] text-slate-400 truncate max-w-[120px]">${user.company || 'Company not set'}</div>
              </div>
              <span class="text-slate-400 text-xs">▾</span>
            </button>

            <!-- User Dropdown Menu -->
            <div id="userDropdownMenu" class="absolute right-0 top-full mt-2 w-64 bg-slate-950/95 border border-slate-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-50 hidden divide-y divide-slate-800/70">
              <div class="p-2.5">
                <div class="text-xs font-bold text-white">${user.name}</div>
                <div class="text-[11px] text-slate-400 truncate">${user.email}</div>
                <div class="mt-1.5 inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeColor}">
                  ${user.plan || 'No plan assigned'}
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
                  <span>🛡️</span> Delivery History
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
    const formForgot = document.getElementById('forgotPasswordForm');
    const formReset = document.getElementById('resetPasswordForm');
    const title = document.getElementById('authModalTitle');

    if (!btnIn || !btnReg || !formIn || !formReg || !title) return;

    // Hide all forms first
    [formIn, formReg, formForgot, formReset].forEach(f => { if (f) f.classList.add('hidden'); });
    // Reset tab button active states
    btnIn.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition text-center';
    btnReg.className = 'py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition text-center';

    if (tab === 'signin' || tab === 'login') {
      btnIn.className = 'py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition text-center shadow';
      formIn.classList.remove('hidden');
      title.innerText = 'Sign In to ApexIntel';
    } else if (tab === 'register') {
      btnReg.className = 'py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white transition text-center shadow';
      formReg.classList.remove('hidden');
      title.innerText = 'Create Client Account';
    } else if (tab === 'forgot') {
      formForgot.classList.remove('hidden');
      title.innerText = 'Reset Your Password';
      // Pre-fill email from sign-in form if present
      const signInEmail = document.getElementById('signInEmail');
      const forgotEmail = document.getElementById('forgotEmail');
      if (signInEmail && forgotEmail && signInEmail.value) forgotEmail.value = signInEmail.value;
    } else if (tab === 'reset') {
      formReset.classList.remove('hidden');
      title.innerText = 'Set New Password';
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

  // --- Forgot Password Submit Handler ---
  window.handleForgotPasswordSubmit = async function (e) {
    e.preventDefault();
    const email = (document.getElementById('forgotEmail').value || '').trim();
    const errEl = document.getElementById('forgotError');
    const successEl = document.getElementById('forgotSuccess');
    const btn = document.getElementById('forgotSubmitBtn');

    if (errEl) errEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');
    if (btn) { btn.disabled = true; btn.innerText = 'Sending…'; }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (successEl) {
          successEl.innerText = data.message || 'If that email is registered, a reset link has been sent.';
          successEl.classList.remove('hidden');
        }
      } else {
        if (errEl) {
          errEl.innerText = data.error || 'Could not send reset email. Please try again.';
          errEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (errEl) {
        errEl.innerText = 'Network error. Check your connection and try again.';
        errEl.classList.remove('hidden');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'Send Reset Link'; }
    }
  };

  // --- Reset Password Submit Handler (token from URL ?token=...) ---
  window.handleResetPasswordSubmit = async function (e) {
    e.preventDefault();
    const token = new URLSearchParams(window.location.search).get('token') || '';
    const newPassword = document.getElementById('resetNewPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;
    const errEl = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');
    const btn = document.getElementById('resetSubmitBtn');

    if (errEl) errEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    if (newPassword !== confirmPassword) {
      if (errEl) { errEl.innerText = 'Passwords do not match.'; errEl.classList.remove('hidden'); }
      return;
    }
    if (newPassword.length < 12) {
      if (errEl) { errEl.innerText = 'Password must be at least 12 characters.'; errEl.classList.remove('hidden'); }
      return;
    }
    if (!token) {
      if (errEl) { errEl.innerText = 'Invalid or missing reset token. Please request a new reset link.'; errEl.classList.remove('hidden'); }
      return;
    }

    if (btn) { btn.disabled = true; btn.innerText = 'Setting password…'; }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (successEl) {
          successEl.innerText = 'Password updated. You can now sign in with your new password.';
          successEl.classList.remove('hidden');
        }
        // Auto-switch to sign-in after 2s
        setTimeout(() => window.switchAuthTab('signin'), 2000);
      } else {
        if (errEl) {
          errEl.innerText = data.error || 'Password reset failed. The token may have expired.';
          errEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (errEl) {
        errEl.innerText = 'Network error. Check your connection and try again.';
        errEl.classList.remove('hidden');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'Set New Password'; }
    }
  };

  // Auto-open reset form if ?token= is present in URL
  (function checkResetToken() {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      window.addEventListener('DOMContentLoaded', () => {
        window.openAuthModal('reset');
      });
    }
  })();

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
