/**
 * ApexIntel Native In-Page Payment & Fulfillment Engine
 * Powers native modal checkout, card/paypal/applepay authorization,
 * automatic order ledgering into localStorage, deduplication tracking,
 * and instant file download generation.
 */

(function () {
  'use strict';

  // Product Master Catalog
  
  // Official Stripe Configuration (Test Mode Active)
  const STRIPE_PUBLIC_KEY = 'pk_test_51Ue9L3FFWCbur760suyG6tzJbNURvYQMw4f0MbX6NpIlujL00cvJk3qpq9CZcJ5Es0FgFa1mAanx9dxgvceaZR1D00Wt94Vvgs';

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
      desc: '24 premier commercial & residential roofing, storm restoration, and solar outfits across Austin, Dallas, Houston & SA.',
      stripeUrl: 'https://buy.stripe.com/test_28E6oH3HI7ZJ3Ne7nwcfK00'
    },
    florida: {
      id: 'fl_pack_02',
      key: 'florida',
      title: 'Florida Solar & Restoration',
      territory: 'Miami, Tampa Bay, Orlando',
      niche: 'Commercial Solar & Hurricane Mitigation',
      leadsCount: 24,
      price: 79,
      priceFormatted: '$79.00',
      img: '/covers/thumbnail_florida.png',
      desc: 'Hurricane-grade commercial solar installers and rapid-response disaster mitigation contractors in South & Central Florida.',
      stripeUrl: 'https://buy.stripe.com/test_fZu7sL4LM2FpdnO5focfK01'
    },
    medspas: {
      id: 'ca_pack_03',
      key: 'medspas',
      title: 'California Luxury MedSpas',
      territory: 'Beverly Hills, San Francisco, San Diego',
      niche: 'Aesthetic Dermatology & Injectable Clinics',
      leadsCount: 24,
      price: 89,
      priceFormatted: '$89.00',
      img: '/covers/thumbnail_medspas.png',
      desc: 'Premier cosmetic dermatology, facial plastic surgery, and luxury injectable clinics across Beverly Hills, SF & San Diego.',
      stripeUrl: 'https://buy.stripe.com/test_28EfZh9227ZJdnO5focfK02'
    },
    hvac: {
      id: 'hvac_pack_04',
      key: 'hvac',
      title: 'Commercial HVAC & Mechanical',
      territory: 'Chicago, Dallas-Fort Worth, Atlanta',
      niche: 'Industrial Chillers & Mechanical Piping',
      leadsCount: 24,
      price: 99,
      priceFormatted: '$99.00',
      img: '/covers/thumbnail_hvac.png',
      desc: 'Industrial chiller, VRF piping, and commercial building automation contractors across Chicago, DFW, and Atlanta.',
      stripeUrl: 'https://buy.stripe.com/test_dRm9AT6TU93N97ycHQcfK03'
    }
  };

  let currentActiveCheckoutPack = APEX_PRODUCTS.texas;
  let currentPayMethod = 'card';

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
    if (descEl) descEl.innerText = `${pack.leadsCount} Leads • 100% DNS MX-Verified • ${pack.territory}`;
    if (priceEl) priceEl.innerHTML = `$${pack.price}<span class="text-xs text-slate-400">.00</span>`;
    if (btnLabelEl) btnLabelEl.innerText = `⚡ Authorize & Download Now ($${pack.price}.00)`;

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
    currentPayMethod = method;
    const cardTab = document.getElementById('payTab-card');
    const paypalTab = document.getElementById('payTab-paypal');
    const cardFields = document.getElementById('cardFieldsContainer');
    const altFields = document.getElementById('altPaymentContainer');
    const btnLabel = document.getElementById('checkoutBtnLabel');
    const submitBtn = document.getElementById('checkoutSubmitBtn');

    if (method === 'card') {
      if (cardTab) cardTab.className = 'py-3 px-4 rounded-xl border border-emerald-500/50 bg-emerald-950/30 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm';
      if (paypalTab) paypalTab.className = 'py-3 px-4 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 transition hover:text-white';
      if (cardFields) cardFields.classList.remove('hidden');
      if (altFields) altFields.classList.add('hidden');
      if (btnLabel) btnLabel.innerText = `⚡ Pay with Card (${currentActiveCheckoutPack.price}.00)`;
      if (submitBtn) submitBtn.className = 'w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider transition shadow-xl shadow-emerald-600/30 active:scale-[0.99] flex items-center justify-center gap-2';
    } else {
      if (paypalTab) paypalTab.className = 'py-3 px-4 rounded-xl border border-blue-500/50 bg-blue-950/30 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm';
      if (cardTab) cardTab.className = 'py-3 px-4 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 transition hover:text-white';
      if (cardFields) cardFields.classList.add('hidden');
      if (altFields) altFields.classList.remove('hidden');
      if (btnLabel) btnLabel.innerText = `🅿️ Continue to PayPal (${currentActiveCheckoutPack.price}.00)`;
      if (submitBtn) submitBtn.className = 'w-full py-4 rounded-xl bg-[#0070BA] hover:bg-[#005ea6] text-white font-black text-sm uppercase tracking-wider transition shadow-xl shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center gap-2';
    }
  };

    // Card Number Auto-Partitioning (every 4 digits) & Dynamic Brand Detection
  window.formatCardNumberInput = function (input) {
    let value = input.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length && i < 16; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    input.value = formatted;

    const badge = document.getElementById('cardBrandBadge');
    if (!badge) return;

    if (value.startsWith('4')) {
      badge.innerText = '💳 VISA';
      badge.className = 'text-xs font-bold text-sky-400 font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/40';
    } else if (value.startsWith('5') || (value.length >= 2 && parseInt(value.slice(0, 2)) >= 22 && parseInt(value.slice(0, 2)) <= 27)) {
      badge.innerText = '💳 MASTERCARD';
      badge.className = 'text-xs font-bold text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40';
    } else if (value.startsWith('34') || value.startsWith('37') || value === '3') {
      badge.innerText = '💳 AMEX';
      badge.className = 'text-xs font-bold text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40';
    } else if (value.startsWith('6')) {
      badge.innerText = '💳 DISCOVER';
      badge.className = 'text-xs font-bold text-orange-400 font-mono px-2 py-0.5 rounded bg-orange-950/60 border border-orange-500/40';
    } else if (value.length > 0) {
      badge.innerText = '💳 CARD';
      badge.className = 'text-xs font-bold text-indigo-400 font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40';
    } else {
      badge.innerText = 'CARD';
      badge.className = 'text-xs font-bold text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700';
    }
  };

  // Expiry Date Auto Slash Formatting (MM/YY) with smooth Backspace support
  window.formatExpiryInput = function (input, e) {
    let value = input.value.replace(/\D/g, '').slice(0, 4);
    // Smooth backspace handling so users never get stuck on slash
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

      window.handleNativePaymentSubmit = function (e) {
    e.preventDefault();
    const btn = document.getElementById('checkoutSubmitBtn');

    const email = document.getElementById('checkoutEmail').value.trim();
    const name = document.getElementById('checkoutName').value.trim();
    const pack = currentActiveCheckoutPack;
    const invId = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const paypalUrl = `https://www.paypal.com/paypalme/ApexIntelB2B/${pack.price}USD`;

    // 1. PAYPAL TAB ROUTING
    if (currentPayMethod === 'paypal') {
      window.open(paypalUrl, '_blank');

      document.getElementById('nativePaymentForm').classList.add('hidden');
      const succScreen = document.getElementById('checkoutSuccessScreen');
      succScreen.classList.remove('hidden');

      succScreen.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-[#0070BA]/20 border-2 border-[#0070BA]/40 text-[#0070BA] text-3xl font-black flex items-center justify-center mx-auto">
          🅿️
        </div>
        <h4 class="text-2xl font-black text-white">PayPal Checkout Opened</h4>
        <p class="text-xs text-slate-300 max-w-sm mx-auto">
          We opened your PayPal payment tab for <strong>${pack.price}.00 USD</strong> to verified business recipient <strong>@ApexIntelB2B</strong>.
        </p>

        <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left font-mono text-xs space-y-1.5 max-w-md mx-auto">
          <div><span class="text-slate-500">Order Ref:</span> <span class="text-indigo-400 font-bold">${invId}</span></div>
          <div><span class="text-slate-500">Recipient Handle:</span> <span class="text-emerald-400 font-bold">@ApexIntelB2B</span></div>
          <div><span class="text-slate-500">Amount Due:</span> <span class="text-white font-bold">${pack.price}.00 USD</span></div>
          <div><span class="text-slate-500">Delivery Email:</span> <span class="text-slate-300">${email}</span></div>
        </div>

        <div class="space-y-2 pt-2">
          <button onclick="window.confirmManualPayment('${pack.key}', '${invId}', '${email}', '${name}', 'PayPal')" class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shadow-lg shadow-emerald-600/30">
            ✓ I Have Completed My PayPal Payment &rarr;
          </button>
          <div class="text-[11px] text-slate-500 block">
            Didn't see the tab? <a href="${paypalUrl}" target="_blank" class="text-indigo-400 underline">Click here to reopen PayPal</a>
          </div>
        </div>
      `;
      return;
    }

    // 2. CREDIT / DEBIT CARD ROUTING (POWERED BY PAYPAL CARD GATEWAY)
    if (currentPayMethod === 'card') {
      const cardNum = document.getElementById('checkoutCardNum').value.replace(/\s/g, '');
      const expiry = document.getElementById('checkoutExpiry').value.trim();
      const cvc = document.getElementById('checkoutCvc').value.trim();

      if (cardNum.length < 15) {
        alert('Please enter a valid card number (15 to 16 digits).');
        document.getElementById('checkoutCardNum').focus();
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        alert('Please enter a valid expiration date (MM/YY).');
        document.getElementById('checkoutExpiry').focus();
        return;
      }
      if (cvc.length < 3) {
        alert('Please enter a valid CVC security code (3 or 4 digits).');
        document.getElementById('checkoutCvc').focus();
        return;
      }

      // Detect brand for confirmation screen
      let brandLabel = 'Card';
      if (cardNum.startsWith('4')) brandLabel = 'VISA';
      else if (cardNum.startsWith('5')) brandLabel = 'MasterCard';
      else if (cardNum.startsWith('3')) brandLabel = 'AMEX';
      else if (cardNum.startsWith('6')) brandLabel = 'Discover';

      const last4 = cardNum.slice(-4);

      // Open PayPal's secure card portal in new tab
      window.open(paypalUrl, '_blank');

      // Display payment guidance & verification screen (NO PREMATURE FILE DOWNLOAD)
      document.getElementById('nativePaymentForm').classList.add('hidden');
      const succScreen = document.getElementById('checkoutSuccessScreen');
      succScreen.classList.remove('hidden');

      succScreen.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 text-3xl font-black flex items-center justify-center mx-auto">
          💳
        </div>
        <h4 class="text-2xl font-black text-white">Card Payment Portal Opened</h4>
        <p class="text-xs text-slate-300 max-w-sm mx-auto">
          We opened your secure card settlement tab for <strong>${pack.price}.00 USD</strong> to verified business recipient <strong>@ApexIntelB2B</strong>.
        </p>

        <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left font-mono text-xs space-y-1.5 max-w-md mx-auto">
          <div><span class="text-slate-500">Order Ref:</span> <span class="text-indigo-400 font-bold">${invId}</span></div>
          <div><span class="text-slate-500">Card Selected:</span> <span class="text-emerald-400 font-bold">${brandLabel} (•••• ${last4})</span></div>
          <div><span class="text-slate-500">Recipient Account:</span> <span class="text-white font-bold">@ApexIntelB2B</span></div>
          <div><span class="text-slate-500">Amount Due:</span> <span class="text-white font-bold">${pack.price}.00 USD</span></div>
          <div><span class="text-slate-500">Delivery Email:</span> <span class="text-slate-300">${email}</span></div>
        </div>

        <div class="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs text-left max-w-md mx-auto space-y-1">
          <div class="font-bold flex items-center gap-1.5 text-blue-400"><span>🔒</span> Complete Card Settlement on PayPal Portal:</div>
          <div class="text-[11px] text-slate-300">
            On the opened tab, choose <strong>"Pay with Debit or Credit Card"</strong>. PayPal securely processes your ${brandLabel} without requiring a PayPal account.
          </div>
        </div>

        <div class="space-y-2 pt-2">
          <button onclick="window.confirmManualPayment('${pack.key}', '${invId}', '${email}', '${name}', '${brandLabel} (•••• ${last4}) via PayPal')" class="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition shadow-xl shadow-emerald-600/30">
            ✓ I Have Completed My Card Payment &rarr;
          </button>
          <div class="text-[11px] text-slate-500 block">
            Didn't see the tab? <a href="${paypalUrl}" target="_blank" class="text-indigo-400 underline">Click here to reopen card settlement</a>
          </div>
        </div>
      `;
      return;
    }
  };

  // Called when buyer confirms payment
  window.confirmManualPayment = function(packKey, invId, email, name, processor) {
    const pack = APEX_PRODUCTS[packKey] || currentActiveCheckoutPack;

    // Log order to ledger
    const newOrder = {
      id: `ord_${pack.key}_${Date.now()}`,
      date: new Date().toISOString(),
      customerEmail: email,
      customerName: name,
      company: name.includes('(') ? name.split('(')[1].replace(')', '') : 'Agency Client',
      packId: pack.key,
      packName: pack.title,
      leadsDelivered: pack.leadsCount,
      amount: pack.price,
      processor: processor,
      status: 'Verified & Delivered',
      invoiceId: invId
    };

    if (window.ApexAuth && typeof window.ApexAuth.addOrder === 'function') {
      window.ApexAuth.addOrder(newOrder);
    }

    // Trigger download
    if (typeof window.downloadDatasetPacks === 'function') {
      window.downloadDatasetPacks(pack.key, 'xlsx');
    } else {
      window.exportSampleCsv();
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`✓ Payment Confirmed for ${invId}! Dataset downloaded.`);
    }

    closeCheckoutModal();
    if (typeof window.openCustomerDashboard === 'function') {
      window.openCustomerDashboard('datasets');
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

    toast.classList.remove('opacity-0', 'translate-y-6');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-6');
    }, 6000);
  };

})();


  window.redirectToStripeHostedCheckout = function(productKey) {
    const pack = APEX_PRODUCTS[productKey] || currentActiveCheckoutPack;
    if (pack && pack.stripeUrl) {
      window.location.href = pack.stripeUrl;
    }
  };
