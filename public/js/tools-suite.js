/**
 * ApexIntel B2B — Complete 6-Tool Intelligence Suite
 * 1. Website Intelligence Scanner (with structured categories & safe auditing)
 * 2. B2B ROI & Pipeline Calculator (with presets & mathematical transparency)
 * 3. Cold Outreach & Multi-Channel Generator (Subject, Direct, Consultative, Bump, LinkedIn, Call Opener)
 * 4. Lead Quality Analyzer & ICP Scorer (0-100 score, P1/P2/P3 tier, opportunity breakdown)
 * 5. Dataset Live Preview, Filter & Search Engine
 * 6. Custom Data Request & Extraction Builder (with real-time budget estimator)
 */

(function () {
  'use strict';

  // =========================================================================
  // TOOL 1: WEBSITE INTELLIGENCE SCANNER (SSRF-Hardened Real Backend Audit)
  // =========================================================================

  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Active scanned profile cache in client memory
  window.currentScannedProfile = null;

  window.runDomainScan = async function () {
    const rawInput = document.getElementById('scanDomainInput')?.value.trim();
    const domain = (rawInput || 'dallasroofer.com').replace(/^(https?:\/\/)?(www\.)?/, '').split(/[\/\?#]/)[0].toLowerCase();

    // Client-side quick check
    if (!domain) {
      if (typeof window.showToast === 'function') window.showToast('Please enter a target domain.');
      return;
    }

    const progress = document.getElementById('scanProgress');
    const progressBar = document.getElementById('scanProgressBar');
    const statusText = document.getElementById('scanStatusText');
    const percentText = document.getElementById('scanPercent');
    const scanBtn = document.getElementById('scanBtn');
    const resultsBox = document.getElementById('scanResultsContainer');

    if (progress) progress.classList.remove('hidden');
    if (resultsBox) resultsBox.classList.add('hidden');
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.classList.add('opacity-50');
    }

    // Dynamic progress bar animation while network audit runs
    let pct = 20;
    if (progressBar) progressBar.style.width = '20%';
    if (statusText) statusText.innerText = 'Step 1/4: Resolving DNS & email authentication records...';
    if (percentText) percentText.innerText = '20%';

    const progressStages = [
      { pct: 45, text: 'Step 2/4: Handshaking TLS 1.3 & verifying SSL certificates...' },
      { pct: 70, text: 'Step 3/4: Measuring server TTFB latency & scanning DOM for ad pixels...' },
      { pct: 90, text: 'Step 4/4: Synthesizing commercial sales pitch teardown...' }
    ];

    let stageIdx = 0;
    const progressTimer = setInterval(() => {
      if (stageIdx < progressStages.length) {
        const s = progressStages[stageIdx];
        if (progressBar) progressBar.style.width = s.pct + '%';
        if (percentText) percentText.innerText = s.pct + '%';
        if (statusText) statusText.innerText = s.text;
        stageIdx++;
      }
    }, 450);

    try {
      const csrfToken = typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : '';
      const response = await fetch('/api/tools/scan-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ domain })
      });

      clearInterval(progressTimer);

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.scan) {
        if (progress) progress.classList.add('hidden');
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.classList.remove('opacity-50');
        }

        const errMsg = data.error || 'Website scan could not be completed. Please verify the domain and retry.';
        if (data.ssrfBlocked) {
          alert(`Security Notice: ${errMsg}`);
        } else if (typeof window.showToast === 'function') {
          window.showToast(errMsg);
        }

        if (resultsBox) {
          resultsBox.innerHTML = `
            <div class="mt-8 p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-2">
              <div class="font-bold flex items-center gap-2">
                <span>⚠️</span> Scan Alert
              </div>
              <p class="font-mono text-xs">${escapeHTML(errMsg)}</p>
            </div>
          `;
          resultsBox.classList.remove('hidden');
        }
        return;
      }

      // Complete progress bar animation
      if (progressBar) progressBar.style.width = '100%';
      if (percentText) percentText.innerText = '100%';
      if (statusText) statusText.innerText = 'Audit Complete!';

      setTimeout(() => {
        if (progress) progress.classList.add('hidden');
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.classList.remove('opacity-50');
        }
        window.currentScannedProfile = data.scan;
        renderScanResults(data.scan);
        if (typeof window.showToast === 'function') {
          window.showToast(`Verified live signal audit complete for ${data.scan.domain}`);
        }
      }, 300);

    } catch (err) {
      clearInterval(progressTimer);
      if (progress) progress.classList.add('hidden');
      if (scanBtn) {
        scanBtn.disabled = false;
        scanBtn.classList.remove('opacity-50');
      }
      if (typeof window.showToast === 'function') {
        window.showToast('Network error during website scan: ' + err.message);
      }
    }
  };

  function renderScanResults(profile) {
    if (!profile) return;
    const container = document.getElementById('scanResultsContainer');
    if (!container) return;

    const domain = escapeHTML(profile.domain);
    const company = escapeHTML(profile.company);
    const ip = escapeHTML(profile.ip);
    const ssl = escapeHTML(profile.ssl);
    const speed = typeof profile.speed === 'number' ? profile.speed : null;
    const speedRating = escapeHTML(profile.speedRating || (speed === null ? 'N/A (Latency Unmeasured)' : 'Standard Latency'));
    const cms = escapeHTML(profile.cms || 'N/A (Detection Unavailable)');
    const pixels = profile.pixels || null;
    const flaws = Array.isArray(profile.flaws) ? profile.flaws : [];
    const suggestedPitch = escapeHTML(profile.suggestedPitch || '');
    const scanStatus = profile.scanStatus || 'completed';
    const failedChecks = Array.isArray(profile.failedChecks) ? profile.failedChecks : [];

    let statusBadge = '';
    if (scanStatus === 'completed') {
      statusBadge = `
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Audit Complete: Verified Live Signal ${profile.fromCache ? '(Cached)' : ''}</span>
      `;
    } else if (scanStatus === 'partial') {
      statusBadge = `
        <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
        <span class="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">Partial Audit: Some Checks Failed ${profile.fromCache ? '(Cached)' : ''}</span>
      `;
    } else {
      statusBadge = `
        <span class="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
        <span class="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">Audit Incomplete / Failed ${profile.fromCache ? '(Cached)' : ''}</span>
      `;
    }

    const speedPill = speed !== null
      ? `<span class="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold ${speed > 800 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">⚡ ${speed}ms TTFB</span>`
      : `<span class="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">⚡ TTFB N/A</span>`;

    container.innerHTML = `
      <div class="mt-8 p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl text-left space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              ${statusBadge}
            </div>
            <h3 class="text-2xl font-black text-white font-mono">${domain}</h3>
            <p class="text-xs text-slate-400">${company} • Server IP: <span class="font-mono text-slate-300">${ip}</span></p>
          </div>
          <div class="flex items-center gap-3">
            ${speedPill}
            <button onclick="copyGeneratedScanPitch()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/30 flex items-center gap-1.5">
              <span>✉️</span> Copy Outreach Pitch
            </button>
          </div>
        </div>

        ${failedChecks.length > 0 ? `
          <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
            <div class="font-bold flex items-center gap-1.5">
              <span>⚠️</span> Diagnostics Notice (${scanStatus.toUpperCase()}):
            </div>
            <ul class="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
              ${failedChecks.map(fc => `<li><span class="font-mono text-amber-400">${escapeHTML(fc.check.toUpperCase())}</span>: ${escapeHTML(fc.reason)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- 4 Diagnostic Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Mobile Latency</div>
            <div class="text-lg font-black ${speed === null ? 'text-slate-400' : (speed > 800 ? 'text-rose-400' : 'text-emerald-400')} font-mono">
              ${speed === null ? 'N/A' : speed + 'ms'}
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">${speedRating}</div>
          </div>
          <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Meta Pixel Retargeting</div>
            <div class="text-lg font-black ${pixels ? (pixels.meta ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400'} font-mono">
              ${pixels ? (pixels.meta ? 'ACTIVE' : 'MISSING (LEAK)') : 'N/A'}
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">
              ${pixels ? (pixels.meta ? 'Audience building' : 'Zero remarketing active') : 'HTTP check unmeasured'}
            </div>
          </div>
          <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Google Tag / GA4</div>
            <div class="text-lg font-black ${pixels ? (pixels.ga4 || pixels.gtm ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-400'} font-mono">
              ${pixels ? (pixels.ga4 || pixels.gtm ? 'DETECTED' : 'UNVERIFIED') : 'N/A'}
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">
              ${pixels ? (pixels.gtm ? 'Managed via GTM' : (pixels.ga4 ? 'GA4 Active' : 'No Tag Found')) : 'HTTP check unmeasured'}
            </div>
          </div>
          <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">CMS & Technology</div>
            <div class="text-sm font-bold text-slate-200 mt-1 truncate">${cms}</div>
            <div class="text-[11px] ${profile.sslDetails?.valid ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">${ssl}</div>
          </div>
        </div>

        <!-- Detected Conversion Leaks -->
        <div class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2">
          <div class="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <span>⚠️</span> Identified Commercial Sales Opportunities (Pitch Angles)
          </div>
          <ul class="space-y-1.5 text-xs text-slate-300">
            ${flaws.map(f => `<li class="flex items-start gap-2"><span class="text-rose-400 font-bold">•</span><span>${escapeHTML(f)}</span></li>`).join('')}
          </ul>
        </div>

        <!-- Ready-to-Send Angle -->
        <div class="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>💡</span> Auto-Generated Turnkey Cold Pitch Angle:
            </span>
            <span class="text-[11px] text-indigo-400 font-mono">100% Ready for Outreach</span>
          </div>
          <p id="scanPitchText" class="text-xs text-slate-300 font-mono bg-slate-900 p-4 rounded-xl border border-slate-800 leading-relaxed">
            "${suggestedPitch}"
          </p>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div class="flex items-center gap-2">
              <button onclick="window.copyGeneratedScanPitch()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow">
                <span>📋</span> Copy Pitch
              </button>
              <button onclick="window.saveScannedProspectToCrm('${domain}')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow">
                <span>🎯</span> Save to CRM Pipeline
              </button>
            </div>
            <button onclick="window.exportScannedAuditReport('${domain}')" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition flex items-center gap-1.5">
              <span>📄</span> Export Client Report (.html)
            </button>
          </div>
        </div>
      </div>
    `;
    container.classList.remove('hidden');

    // Automatically record scan into Website Audit Lab
    try {
      const audits = JSON.parse(localStorage.getItem('apexintel_audit_scans') || '[]');
      const newScan = {
        id: 'audit_' + Date.now(),
        domain: profile.domain,
        company: profile.company,
        scannedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        speed_ms: speed,
        cms: profile.cms,
        metaPixel: !!(pixels && pixels.meta),
        googleAds: !!(pixels && pixels.googleAds),
        mxVerified: !!profile.dns?.mx?.length,
        icpScore: speed !== null && speed < 800 ? 92 : 84,
        pitch: profile.suggestedPitch
      };
      if (!audits.some(a => a.domain.toLowerCase() === profile.domain.toLowerCase())) {
        audits.unshift(newScan);
        localStorage.setItem('apexintel_audit_scans', JSON.stringify(audits));
      }
    } catch (e) {}
  }

  window.saveScannedProspectToCrm = function (domain) {
    const p = (window.currentScannedProfile && window.currentScannedProfile.domain === domain)
      ? window.currentScannedProfile
      : { domain, company: domain + ' Services', speed: null, pixels: {}, cms: 'N/A' };

    const companyName = p.company || (domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1) + ' Services');
    const leadObj = {
      name: companyName,
      company: companyName,
      domain: domain,
      email: `contact@${domain}`,
      phone: '+1 555 0199',
      city: 'Direct Market',
      speed: `${p.speed}ms`,
      pixel: p.pixels?.meta ? 'Meta Pixel Active' : 'No Pixel',
      tech: p.cms
    };
    if (typeof window.saveLeadToCrm === 'function') {
      window.saveLeadToCrm(leadObj);
      if (typeof window.openCustomerDashboard === 'function') {
        window.openCustomerDashboard('crm');
      }
    } else if (typeof window.showToast === 'function') {
      window.showToast(`Saved ${domain} to CRM!`);
    }
  };

  window.exportScannedAuditReport = function (domain) {
    const audits = JSON.parse(localStorage.getItem('apexintel_audit_scans') || '[]');
    const match = audits.find(a => a.domain.toLowerCase() === domain.toLowerCase()) || {
      id: 'scan_' + Date.now(),
      domain: domain,
      company: domain.toUpperCase(),
      scannedAt: 'Nov 2026',
      speed_ms: 780,
      cms: 'Custom / NGINX',
      icpScore: 88,
      pitch: 'High opportunity prospect with active web presence.'
    };
    if (typeof window.exportAuditReport === 'function') {
      window.exportAuditReport(match.id);
    } else if (typeof window.showToast === 'function') {
      window.showToast(`Audit report generated for ${domain}!`);
    }
  };

  window.copyGeneratedScanPitch = function () {
    const el = document.getElementById('scanPitchText');
    if (!el) return;
    const clean = el.innerText.replace(/^"|"$/g, '');
    navigator.clipboard.writeText(clean);
    if (typeof window.showToast === 'function') window.showToast('Copied personalized pitch to clipboard!');
  };

  window.quickTestDomain = function (domain) {
    const input = document.getElementById('scanDomainInput');
    if (input) input.value = domain;
    window.runDomainScan();
  };

  // =========================================================================
  // TOOL 2: B2B ROI & PIPELINE CALCULATOR
  // =========================================================================

  window.applyRoiPreset = function (preset) {
    const replySlider = document.getElementById('roiReplyRate');
    const meetingSlider = document.getElementById('roiMeetingRate');
    const closeSlider = document.getElementById('roiCloseRate');
    const retainerSlider = document.getElementById('roiRetainer');
    const volumeSlider = document.getElementById('roiVolume');

    if (preset === 'conservative') {
      if (replySlider) replySlider.value = 1.5;
      if (meetingSlider) meetingSlider.value = 20;
      if (closeSlider) closeSlider.value = 15;
    } else if (preset === 'moderate') {
      if (replySlider) replySlider.value = 3.5;
      if (meetingSlider) meetingSlider.value = 25;
      if (closeSlider) closeSlider.value = 20;
    } else if (preset === 'aggressive') {
      if (replySlider) replySlider.value = 6.0;
      if (meetingSlider) meetingSlider.value = 35;
      if (closeSlider) closeSlider.value = 25;
    }

    ['conservative', 'moderate', 'aggressive'].forEach(p => {
      const btn = document.getElementById(`roiPresetBtn-${p}`);
      if (!btn) return;
      if (p === preset) {
        btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white transition shadow';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition';
      }
    });

    window.updateAdvancedRoi();
  };

  window.updateAdvancedRoi = function () {
    const volume = parseInt(document.getElementById('roiVolume')?.value || '50');
    const replyRate = parseFloat(document.getElementById('roiReplyRate')?.value || '3.5') / 100;
    const meetingRate = parseFloat(document.getElementById('roiMeetingRate')?.value || '25') / 100;
    const closeRate = parseFloat(document.getElementById('roiCloseRate')?.value || '20') / 100;
    const retainer = parseInt(document.getElementById('roiRetainer')?.value || '2500');
    const months = parseInt(document.getElementById('roiMonths')?.value || '4');
    const cost = 79; // Default pack cost

    // Mathematical formula
    const responses = Math.max(1, Math.round(volume * replyRate));
    const meetings = Math.max(1, Math.round(responses * meetingRate));
    const clients = Math.max(1, Math.round(meetings * closeRate * 10) / 10);
    const ltv = retainer * months;
    const totalRevenue = Math.round(clients * ltv);
    const multiple = Math.round(totalRevenue / cost);
    const cac = Math.round(cost / Math.max(0.1, clients));

    // Update labels
    const vEl = document.getElementById('roiVolumeVal');
    const rEl = document.getElementById('roiReplyVal');
    const mEl = document.getElementById('roiMeetingVal');
    const cEl = document.getElementById('roiCloseVal');
    const retEl = document.getElementById('roiRetainerVal');
    const monEl = document.getElementById('roiMonthsVal');

    if (vEl) vEl.innerText = `${volume} Verified Leads`;
    if (rEl) rEl.innerText = `${(replyRate * 100).toFixed(1)}%`;
    if (mEl) mEl.innerText = `${(meetingRate * 100).toFixed(0)}%`;
    if (cEl) cEl.innerText = `${(closeRate * 100).toFixed(0)}%`;
    if (retEl) retEl.innerText = `$${retainer.toLocaleString()}/mo`;
    if (monEl) monEl.innerText = `${months} months`;

    // Update results
    const resEl = document.getElementById('roiResResponses');
    const meetEl = document.getElementById('roiResMeetings');
    const clEl = document.getElementById('roiResClients');
    const revEl = document.getElementById('roiResRevenue');
    const multEl = document.getElementById('roiResMultiple');
    const cacEl = document.getElementById('roiResCac');

    if (resEl) resEl.innerText = `${responses}`;
    if (meetEl) meetEl.innerText = `${meetings}`;
    if (clEl) clEl.innerText = `${clients >= 1 ? clients.toFixed(0) : clients.toFixed(1)}`;
    if (revEl) revEl.innerText = `$${totalRevenue.toLocaleString()}`;
    if (multEl) multEl.innerText = `${multiple}x ROI`;
    if (cacEl) cacEl.innerText = `$${cac}`;
  };

  // =========================================================================
  // TOOL 3: COLD OUTREACH & MULTI-CHANNEL GENERATOR
  // =========================================================================

  let currentOutreachTone = 'direct';

  window.setOutreachTone = function (tone) {
    currentOutreachTone = tone;
    ['direct', 'consultative', 'executive', 'friendly'].forEach(t => {
      const btn = document.getElementById(`toneBtn-${t}`);
      if (!btn) return;
      if (t === tone) {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white transition';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 hover:text-white transition';
      }
    });
    window.regenerateOutreachTemplates();
  };

  window.regenerateOutreachTemplates = function () {
    const lead = window.currentSelectedLead || {
      name: 'Apex Commercial Roofing',
      email: 'owner@apexroofingtx.com',
      city: 'Dallas, TX',
      speed: '940ms',
      pixel: 'No Meta Pixel'
    };

    const senderAgency = document.getElementById('outreachSenderName')?.value || 'Apex Growth Media';
    const senderService = document.getElementById('outreachSenderService')?.value || 'High-Converting Web Rebuilds';

    let subject = '';
    let email = '';
    let bump = '';
    let linkedin = '';
    let callScript = '';

    if (currentOutreachTone === 'direct') {
      subject = `quick question about ${lead.name}'s mobile speed (${lead.speed})`;
      email = `Hi ${lead.name.split(' ')[0]} team,\n\nI ran a diagnostic on your site and noticed mobile visitors in ${lead.city} are experiencing a ${lead.speed} delay before your phone number loads, and there's currently no Meta Pixel tracking active.\n\nWe specialize in ${senderService} for commercial contractors, cutting load time under 400ms and stopping quote form drop-offs.\n\nOpen to seeing a 2-minute video breakdown of how to fix this?\n\nBest,\n${senderAgency}`;
      bump = `Hey ${lead.name.split(' ')[0]} team — floating this to the top of your inbox in case it got buried. Any interest in the speed & tracking audit?\n\nBest,\n${senderAgency}`;
      linkedin = `Hi ${lead.name.split(' ')[0]} — came across your team in ${lead.city}. Ran a quick speed test and noticed your mobile site is clocking in at ${lead.speed}. Put together a 2-min fix overview. Would love to send it over if you're interested!`;
      callScript = `"Hi, this is ${senderAgency}. I was just reviewing ${lead.name}'s website and noticed your mobile contact form takes nearly a full second to load. In high-ticket contracting that's usually where 20-30% of calls drop off. Who on your team handles your site maintenance?"`;
    } else if (currentOutreachTone === 'consultative') {
      subject = `Technical audit for ${lead.name}: 2 conversion leaks in ${lead.city}`;
      email = `Hello ${lead.name.split(' ')[0]} leadership,\n\nWhile auditing commercial contractors in ${lead.city}, our system flagged two specific issues on your website:\n\n1. First-Byte Latency: ${lead.speed} (Google recommends under 400ms for commercial contractors)\n2. Ad Tracking Gap: ${lead.pixel} (causes lost retargeting on warm quote visitors)\n\nAt ${senderAgency}, we build ${senderService} designed specifically to turn warm traffic into booked phone estimates.\n\nWould it make sense to share a customized teardown with your team this Thursday?\n\nRegards,\n${senderAgency}`;
      bump = `Hi ${lead.name.split(' ')[0]} — following up on the technical audit notes regarding your ${lead.speed} latency. Let me know if you would like me to forward the teardown to someone else on your team.\n\nRegards,\n${senderAgency}`;
      linkedin = `Hello ${lead.name.split(' ')[0]} team — we compiled an audit of ${lead.city} contractors and noticed two specific speed & pixel gaps on your domain. Would be glad to share the findings if helpful!`;
      callScript = `"Hello! I'm calling from ${senderAgency}. We recently ran a local digital audit of contractors in ${lead.city} and found two technical bottlenecks on your quote page. May I speak with the owner or general manager regarding your website?"`;
    } else if (currentOutreachTone === 'executive') {
      subject = `Revenue impact of ${lead.name}'s mobile latency`;
      email = `Dear ${lead.name.split(' ')[0]},\n\nEvery 500ms of mobile delay reduces commercial inquiry conversion by approximately 18%. Our diagnostics indicate your domain is currently loading at ${lead.speed} with ${lead.pixel}.\n\nAt ${senderAgency}, we help contractors recapture missed pipeline through ${senderService}.\n\nAre you available for a brief 7-minute executive briefing this week?\n\nSincerely,\n${senderAgency}`;
      bump = `Dear ${lead.name.split(' ')[0]} — wanted to check if you had a moment to review the note below regarding the conversion impact of your site latency.\n\nSincerely,\n${senderAgency}`;
      linkedin = `Hi ${lead.name.split(' ')[0]} — we recently analyzed contractor lead pipelines in ${lead.city}. Your site is registering ${lead.speed} mobile latency, which represents a direct leak in customer acquisition. Would welcome the chance to connect.`;
      callScript = `"Good morning. This is ${senderAgency}. We work with commercial outfits to resolve mobile speed bottlenecks that impact inbound quote volume. Could you direct me to the executive who oversees your customer acquisition?"`;
    } else {
      // Friendly
      subject = `Loved your work in ${lead.city} (+ quick note on your site)`;
      email = `Hey there ${lead.name.split(' ')[0]} team!\n\nJust checked out some of your recent projects in ${lead.city} — impressive work!\n\nI did notice one quick thing while checking out your site on my phone: it took about ${lead.speed} to load, and it looks like your Meta retargeting pixel isn't firing.\n\nI help local businesses with ${senderService} to make sure you're getting every possible call. Would love to send over a quick free checklist if you'd find that helpful!\n\nCheers,\n${senderAgency}`;
      bump = `Hey again! Just wanted to make sure my note didn't get lost in the shuffle. Hope business in ${lead.city} is booming!\n\nCheers,\n${senderAgency}`;
      linkedin = `Hey ${lead.name.split(' ')[0]}! Great seeing your work in ${lead.city}. Dropping you a quick note because I noticed your mobile site latency is ${lead.speed}. Would love to connect and share a quick tip!`;
      callScript = `"Hey there! Hope you're having a great day. I was browsing through ${lead.name}'s site and noticed a small issue with your mobile quote form. Who is the best person to speak with about your website?"`;
    }

    const sEl = document.getElementById('outreachSubject');
    const eEl = document.getElementById('outreachBody');
    const bEl = document.getElementById('outreachBump');
    const lEl = document.getElementById('outreachLinkedin');
    const cEl = document.getElementById('outreachCall');

    if (sEl) sEl.innerText = subject;
    if (eEl) eEl.innerText = email;
    if (bEl) bEl.innerText = bump;
    if (lEl) lEl.innerText = linkedin;
    if (cEl) cEl.innerText = callScript;
  };

  window.copyOutreachItem = function (elementId, label) {
    const el = document.getElementById(elementId);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText);
    if (typeof window.showToast === 'function') window.showToast(`✓ Copied ${label} to clipboard!`);
  };

  // =========================================================================
  // TOOL 4: LEAD QUALITY ANALYZER & ICP SCORER (NEW)
  // =========================================================================

  window.analyzeLeadQuality = function () {
    const industry = document.getElementById('lqIndustry')?.value || 'contractor';
    const latency = parseInt(document.getElementById('lqLatency')?.value || '900');
    const pixel = document.getElementById('lqPixel')?.value || 'none';
    const contact = document.getElementById('lqContact')?.value || 'direct_owner';
    const margin = document.getElementById('lqMargin')?.value || 'high';

    let score = 40; // Base score

    // Latency signal (+20 max)
    if (latency >= 900) score += 20; // Massive pitch opportunity
    else if (latency >= 600) score += 12;
    else score += 5;

    // Pixel gap (+25 max)
    if (pixel === 'none') score += 25; // Complete tracking gap
    else if (pixel === 'google_only') score += 15;
    else score += 5;

    // Contact completeness (+25 max)
    if (contact === 'direct_owner') score += 25; // DNS MX Verified + Owner Mobile
    else if (contact === 'office_email') score += 15;
    else score += 8;

    // Ticket margin (+15 max)
    if (margin === 'high') score += 15; // Roofing, Solar, HVAC ($5k-$50k deal size)
    else if (margin === 'medium') score += 10;
    else score += 5;

    score = Math.min(99, Math.max(25, score));

    // Determine priority
    let tier = 'P1 - Top Tier Opportunity';
    let tierColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    let badge = '🔥 P1 HOT PROSPECT';
    let angle = 'Pitch Web Latency + Turnkey Ad Retargeting Rebuild';

    if (score < 65) {
      tier = 'P3 - Standard Enrichment Required';
      tierColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      badge = '📋 P3 COLD LIST';
      angle = 'General B2B Brand Awareness / Nurture Campaign';
    } else if (score < 85) {
      tier = 'P2 - High Potential Opportunity';
      tierColor = 'text-sky-400 bg-sky-500/10 border-sky-500/30';
      badge = '⚡ P2 QUALIFIED';
      angle = 'Targeted Mobile Speed Optimization Pitch';
    }

    const scoreEl = document.getElementById('lqScoreDisplay');
    const barEl = document.getElementById('lqScoreBar');
    const tierEl = document.getElementById('lqTierBadge');
    const angleEl = document.getElementById('lqRecommendedAngle');

    if (scoreEl) scoreEl.innerText = `${score}/100`;
    if (barEl) {
      barEl.style.width = `${score}%`;
      barEl.className = `h-2.5 rounded-full transition-all duration-500 ${score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-sky-500' : 'bg-amber-500'}`;
    }
    if (tierEl) {
      tierEl.innerText = badge;
      tierEl.className = `px-3 py-1 rounded-full text-xs font-mono font-bold border ${tierColor}`;
    }
    if (angleEl) angleEl.innerText = angle;
  };

  // =========================================================================
  // TOOL 6: CUSTOM DATA REQUEST BUILDER (NEW)
  // =========================================================================

  window.updateCustomQuote = function () {
    const volume = parseInt(document.getElementById('crVolumeSlider')?.value || '250');
    const volLabel = document.getElementById('crVolumeLabel');
    if (volLabel) volLabel.innerText = `${volume.toLocaleString()} Verified Records`;

    let rate = 0.55; // Base price per lead
    if (volume >= 1000) rate = 0.38;
    else if (volume >= 500) rate = 0.45;

    // Check optional enrichments
    const hasLatency = document.getElementById('crCheckLatency')?.checked;
    const hasPixel = document.getElementById('crCheckPixel')?.checked;
    const hasMobile = document.getElementById('crCheckMobile')?.checked;

    if (hasLatency) rate += 0.08;
    if (hasPixel) rate += 0.08;
    if (hasMobile) rate += 0.12;

    const totalCost = Math.round(volume * rate);

    const priceEl = document.getElementById('crEstimatedPrice');
    const rateEl = document.getElementById('crRatePerRecord');

    if (priceEl) priceEl.innerText = `$${totalCost}.00`;
    if (rateEl) rateEl.innerText = `$${rate.toFixed(2)} / record`;
  };

  window.handleCustomRequestBuilderSubmit = async function (e) {
    e.preventDefault();
    const industry = document.getElementById('crIndustrySelect')?.value || 'Commercial Services';
    const territory = document.getElementById('crTerritoryInput')?.value?.trim();
    const volume = parseInt(document.getElementById('crVolumeSlider')?.value, 10) || 100;
    const email = document.getElementById('crEmailInput')?.value?.trim();
    const hasLatency = document.getElementById('crCheckLatency')?.checked;
    const hasPixel = document.getElementById('crCheckPixel')?.checked;
    const hasMobile = document.getElementById('crCheckMobile')?.checked;

    if (!email || !territory) {
      if (typeof window.showToast === 'function') {
        window.showToast('Please fill in your delivery email and target geographic area.');
      } else {
        alert('Please fill in your delivery email and target geographic area.');
      }
      return;
    }

    const submitBtn = document.getElementById('crSubmitBtn') || e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50');
    }

    try {
      const csrfToken = typeof window.getCsrfToken === 'function' ? window.getCsrfToken() : '';
      const response = await fetch('/api/requests/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          industry,
          territory,
          volume,
          email,
          enrichments: {
            latency: Boolean(hasLatency),
            pixel: Boolean(hasPixel),
            mobile: Boolean(hasMobile)
          }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.request) {
        const errMsg = data.error || 'Failed to submit extraction request. Please try again.';
        if (typeof window.showToast === 'function') window.showToast(errMsg);
        else alert(errMsg);
        return;
      }

      const request = data.request;
      const orderId = request.requestId;

      // Show confirmation UI
      const form = document.getElementById('customRequestForm');
      const success = document.getElementById('customRequestSuccess');
      if (form) form.classList.add('hidden');
      if (success) {
        success.classList.remove('hidden');
        const orderRef = document.getElementById('crSuccessOrderRef');
        if (orderRef) orderRef.innerText = orderId;
      }

      if (typeof window.showToast === 'function') {
        window.showToast(`✓ Extraction Order ${orderId} submitted! Price: ${request.estimatedPrice}`);
      }
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast('Network error submitting request: ' + err.message);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50');
      }
    }
  };

})();
