/**
 * ApexIntel Native In-Page Payment & Fulfillment Engine
 * 
 * Powered by Server-Authoritative Stripe Checkout & S3 Presigned Delivery:
 * - Server creates Stripe Checkout Sessions with authoritative pricing (/api/orders/checkout)
 * - Cryptographically signed Stripe webhooks fulfill orders (/api/webhooks/payment)
 * - Time-limited AWS S3 presigned URLs provide secure direct downloads (/api/downloads/signed-url)
 * - Client-side payment confirmation bypasses and unauthenticated downloads have been removed
 */

(function () {
  'use strict';

  // Product Master Catalog
  const APEX_PRODUCTS = {
    texas: {
      id: 'tx_pack_01',
      key: 'texas',
      title: 'Texas High-Ticket Contractors',
      territory: 'Austin, Dallas-Fort Worth, Houston, San Antonio',
      niche: 'Commercial Roofing & Storm Restoration',
      leadsCount: 24,
      price: 79,
      priceFormatted: '$79.00',
      img: '/covers/thumbnail_texas.png',
      desc: '24 premier commercial & residential roofing, storm restoration, and solar outfits across Austin, Dallas, Houston & SA.'
    },
    florida: {
      id: 'fl_pack_02',
      key: 'florida',
      title: 'Florida Solar & Restoration',
      territory: 'Miami, Tampa Bay, Orlando',
      niche: 'Commercial Solar & Hurricane Mitigation',
      leadsCount: 8,
      price: 79,
      priceFormatted: '$79.00',
      img: '/covers/thumbnail_florida.png',
      desc: 'Hurricane-grade commercial solar installers and rapid-response disaster mitigation contractors in South & Central Florida.'
    },
    medspas: {
      id: 'ca_pack_03',
      key: 'medspas',
      title: 'California Luxury MedSpas',
      territory: 'Beverly Hills, San Francisco, San Diego',
      niche: 'Aesthetic Dermatology & Injectable Clinics',
      leadsCount: 9,
      price: 89,
      priceFormatted: '$89.00',
      img: '/covers/thumbnail_medspas.png',
      desc: 'Premier cosmetic dermatology, facial plastic surgery, and luxury injectable clinics across Beverly Hills, SF & San Diego.'
    },
    hvac: {
      id: 'hvac_pack_04',
      key: 'hvac',
      title: 'Commercial HVAC & Mechanical',
      territory: 'Chicago, Dallas-Fort Worth, Atlanta',
      niche: 'Industrial Chillers & Mechanical Piping',
      leadsCount: 12,
      price: 99,
      priceFormatted: '$99.00',
      img: '/covers/thumbnail_hvac.png',
      desc: 'Industrial chiller, VRF piping, and commercial building automation contractors across Chicago, DFW, and Atlanta.'
    }
  };

  let currentActiveCheckoutPack = APEX_PRODUCTS.texas;

  // Open native checkout modal for selected product
  window.openCheckoutModal = function (productKey) {
    const pack = APEX_PRODUCTS[productKey] || APEX_PRODUCTS.texas;
    currentActiveCheckoutPack = pack;

    // Pre-populate modal fields
    const imgEl = document.getElementById('checkoutPackImg');
    const titleEl = document.getElementById('checkoutPackTitle');
    const descEl = document.getElementById('checkoutPackDesc');
    const priceEl = document.getElementById('checkoutPackPrice');
    const btnLabelEl = document.getElementById('checkoutBtnLabel');

    if (imgEl) imgEl.src = pack.img;
    if (titleEl) titleEl.innerText = pack.title;
    if (descEl) descEl.innerText = `${pack.leadsCount} Leads • Verification coverage shown • ${pack.territory}`;
    if (priceEl) priceEl.innerHTML = `$${pack.price}<span class="text-xs text-slate-400">.00</span>`;
    if (btnLabelEl) btnLabelEl.innerText = `⚡ Continue to Secure Stripe Checkout ($${pack.price}.00)`;

    // Pre-fill email if logged in
    const user = (window.ApexAuth && typeof window.ApexAuth.getCurrentUser === 'function') ? window.ApexAuth.getCurrentUser() : null;
    const emailInput = document.getElementById('checkoutEmail');
    const nameInput = document.getElementById('checkoutName');
    if (emailInput && user && user.email) emailInput.value = user.email;
    if (nameInput && user && user.name) nameInput.value = `${user.name} (${user.company || 'Agency'})`;

    // Reset screens
    const form = document.getElementById('nativePaymentForm');
    const successScreen = document.getElementById('checkoutSuccessScreen');
    if (form) form.classList.remove('hidden');
    if (successScreen) successScreen.classList.add('hidden');

    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeCheckoutModal = function () {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.selectPayMethod = function (method) {
    // Both tabs route securely through server-authoritative Stripe Checkout (Cards, Apple Pay, Google Pay)
    const cardTab = document.getElementById('payTab-card');
    const paypalTab = document.getElementById('payTab-paypal');
    const btnLabel = document.getElementById('checkoutBtnLabel');

    if (cardTab) cardTab.className = 'py-3 px-4 rounded-xl border border-emerald-500/50 bg-emerald-950/30 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm';
    if (paypalTab) paypalTab.className = 'py-3 px-4 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 transition hover:text-white';
    if (btnLabel) btnLabel.innerText = `⚡ Continue to Secure Stripe Checkout ($${currentActiveCheckoutPack.price}.00)`;
  };

  // Card formatting helpers retained for non-invasive input styling
  window.formatCardNumberInput = function (input) {
    let value = input.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    input.value = formatted;
  };

  window.formatExpiryInput = function (input, e) {
    let value = input.value.replace(/\D/g, '').slice(0, 4);
    if (e && e.inputType === 'deleteContentBackward') {
      if (value.length === 2) {
        input.value = value.slice(0, 1);
        return;
      }
    }
    if (value.length > 2) {
      input.value = value.substring(0, 2) + '/' + value.substring(2, 4);
    } else if (value.length === 2 && (!e || e.inputType !== 'deleteContentBackward')) {
      input.value = value + '/';
    } else {
      input.value = value;
    }
  };

  /**
   * Handle checkout submit: Initiates server-authoritative Stripe Checkout Session
   */
  window.handleNativePaymentSubmit = async function (e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('checkoutSubmitBtn');
    const label = document.getElementById('checkoutBtnLabel');

    // 1. Authentication check
    const user = (window.ApexAuth && typeof window.ApexAuth.getCurrentUser === 'function') 
      ? window.ApexAuth.getCurrentUser() 
      : null;

    if (!user) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please sign in or create an account to purchase verified datasets.');
      }
      window.closeCheckoutModal();
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
      }
      return;
    }

    const pack = currentActiveCheckoutPack || APEX_PRODUCTS.texas;

    if (btn) btn.disabled = true;
    if (label) label.innerText = '⚡ Connecting to Secure Stripe Checkout...';

    try {
      const csrfToken = typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : '';
      const resp = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          productKey: pack.key
        })
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        if (resp.status === 401) {
          if (typeof window.showToast === 'function') {
            window.showToast('Session expired. Please sign in again.');
          }
          window.closeCheckoutModal();
          if (typeof window.openAuthModal === 'function') {
            window.openAuthModal('login');
          }
          return;
        }
        throw new Error(data.error || 'Failed to initiate checkout session.');
      }

      if (data.checkoutUrl) {
        if (typeof window.showToast === 'function') {
          window.showToast('Redirecting to secure Stripe Checkout...');
        }
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned from payment server.');
      }
    } catch (err) {
      console.error('[Checkout Error]:', err);
      if (typeof window.showToast === 'function') {
        window.showToast(`Checkout error: ${err.message}`);
      }
    } finally {
      if (btn) btn.disabled = false;
      if (label) label.innerText = `⚡ Continue to Secure Stripe Checkout ($${pack.price}.00)`;
    }
  };

  /**
   * Hosted Stripe Checkout trigger from landing page pricing cards
   */
  window.redirectToStripeHostedCheckout = function (productKey) {
    const pack = APEX_PRODUCTS[productKey] || currentActiveCheckoutPack;
    currentActiveCheckoutPack = pack;

    const user = (window.ApexAuth && typeof window.ApexAuth.getCurrentUser === 'function') 
      ? window.ApexAuth.getCurrentUser() 
      : null;

    if (!user) {
      window.openCheckoutModal(productKey);
    } else {
      window.handleNativePaymentSubmit();
    }
  };

  // Real purchase notification trigger
  window.triggerRealPurchaseToast = function (buyerName, productTitle, price, img) {
    const toast = document.getElementById('socialToast');
    if (!toast) return;

    const titleEl = document.getElementById('socialToastTitle');
    const descEl = document.getElementById('socialToastDesc');
    const timeEl = document.getElementById('socialToastTime');
    const priceEl = document.getElementById('socialToastPrice');
    const imgEl = document.getElementById('socialToastImg');

    if (titleEl) titleEl.innerText = buyerName;
    if (descEl) descEl.innerText = productTitle;
    if (timeEl) timeEl.innerText = 'Just now';
    if (priceEl) priceEl.innerText = price;
    if (imgEl && img) imgEl.src = img;

    toast.classList.remove('opacity-0', 'translate-y-6', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-6', 'pointer-events-none');
    }, 6000);
  };

  // Check URL on page load for post-checkout returns
  document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true') {
      const orderId = params.get('order_id') || '';
      if (typeof window.showToast === 'function') {
        window.showToast(`✓ Payment Successful! Order ${orderId} unlocked in your Dashboard.`);
      }
      setTimeout(() => {
        if (typeof window.openCustomerDashboard === 'function') {
          window.openCustomerDashboard('datasets');
        }
      }, 500);

      // Clean query string
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (params.get('payment_cancelled') === 'true') {
      if (typeof window.showToast === 'function') {
        window.showToast('Checkout cancelled. You can complete your order anytime.');
      }
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  });

})();
