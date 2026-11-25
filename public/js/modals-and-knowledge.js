/**
 * ApexIntel B2B — Modals, Product Detail Views, Comparison & Knowledge Hub
 * Powers:
 * 1. Dedicated Product Detail Modals (Texas, Florida, MedSpas, HVAC)
 * 2. Dataset Comparison Matrix Modal
 * 3. 4 Full In-Depth Agency Prospecting Playbooks
 * 4. Trust & Legal Compliance Modals (Privacy, Terms, Refund, CAN-SPAM, Methodology)
 */

(function () {
  'use strict';

  const PRODUCT_SPECS = {
    texas: {
      title: 'Texas High-Ticket Contractors & Restoration',
      territory: 'Austin, Dallas-Fort Worth, Houston, San Antonio (Texas)',
      niche: 'Commercial Roofing, Storm Restoration & Solar',
      price: '$79.00',
      packKey: 'texas',
      records: 24,
      avgContract: 'Varies by project and market',
      coverage: { email: '13 / 24', phone: '17 / 24', tech: '17 / 24' },
      fields: ['Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone', 'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'],
      sampleRows: [
        { company: 'Sutton Roofing', city: 'Austin, TX', email: 's***@gmail.com', phone: '+1 512 *** 9801', tech: 'Google Analytics' },
        { company: 'T Rock Roofing', city: 'Dallas, TX', email: 'in**@d***.com', phone: '+1 469 *** 9867', tech: 'WordPress' },
        { company: 'Lon Smith Roofing', city: 'Dallas, TX', email: 'in**@l***.com', phone: '+1 800 *** 4791', tech: 'WordPress, Google Analytics, Meta Pixel' }
      ],
      limitations: 'Where businesses do not publish a direct email or phone, entries are marked Unavailable rather than guessed.',
      overview: 'Curated business records across selected Texas metros. Website performance and advertising-technology signals are included only where available; review each record's coverage and limitations before outreach.',
      icp: 'Digital marketing agencies, SEO consultants, and web developers serving construction and home-service businesses.',
      pitchAngle: 'Where a site diagnostic is available, discuss the observed response-time result and validate its business impact before proposing improvements.'
    },
    florida: {
      title: 'Florida Solar & Disaster Mitigation Specialists',
      territory: 'Miami-Dade, Tampa Bay, Orlando, Jacksonville (Florida)',
      niche: 'Commercial Solar, Hurricane-Grade Roofing & Mitigation',
      price: '$79.00',
      packKey: 'florida',
      records: 8,
      avgContract: 'Varies by project and market',
      coverage: { email: '5 / 8', phone: '7 / 8', tech: '7 / 8' },
      fields: ['Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone', 'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'],
      sampleRows: [
        { company: 'Tampa Bay Solar', city: 'Tampa, FL', email: 'in**@t***.com', phone: '+1 813 *** 6527', tech: 'WordPress, Google Analytics' },
        { company: 'SunVena Solar', city: 'Orlando, FL', email: 's***@s***.com', phone: '+1 407 *** 9584', tech: 'WordPress, Google Analytics' },
        { company: 'Goldin Solar', city: 'Miami, FL', email: 'Unavailable', phone: '+1 855 *** 2730', tech: 'WordPress' }
      ],
      limitations: 'Points-in-time telemetry; unlisted contact channels left Unavailable.',
      overview: 'Business records for commercial solar and disaster-mitigation providers across selected Florida metros. Contact coverage and website signals vary by record.',
      icp: 'Performance marketing agencies and outbound teams serving commercial solar, roofing, and restoration businesses.',
      pitchAngle: 'Where a Meta Pixel was not detected, check for server-side events or other tracking methods before suggesting a retargeting change.'
    },
    medspas: {
      title: 'California Luxury MedSpas & Aesthetic Clinics',
      territory: 'Los Angeles, Beverly Hills, Newport Beach, San Diego, SF',
      niche: 'Aesthetic Medicine, Plastic Surgery, Injectables & Laser',
      price: '$89.00',
      packKey: 'medspas',
      records: 9,
      avgContract: 'Varies by clinic and service',
      coverage: { email: '4 / 9', phone: '7 / 9', tech: '7 / 9' },
      fields: ['Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone', 'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'],
      sampleRows: [
        { company: 'SkinSpirit Beverly Hills', city: 'Beverly Hills, CA', email: 's***@5***.com', phone: '+1 855 *** 7546', tech: 'Google Analytics' },
        { company: 'Epi Center MedSpa', city: 'San Francisco, CA', email: 'r***@e***.com', phone: '+1 415 *** 4754', tech: 'WordPress, Meta Pixel' },
        { company: 'Nob Hill Aesthetics', city: 'San Francisco, CA', email: 's***@n***.com', tech: 'Shopify, Google Analytics, Meta Pixel', phone: '+1 415 *** 6800' }
      ],
      limitations: 'Clinic front-desk reception emails verified; private surgeon emails not fabricated.',
      overview: 'Curated records for aesthetic practices and clinics in selected California metros. Website, technology, and contact signals are included where available and should be verified before outreach.',
      icp: 'Healthcare marketing agencies, patient-acquisition specialists, and CRM providers working with aesthetic practices.',
      pitchAngle: 'Review the clinic's booking flow, follow-up process, and available tracking signals before proposing an improvement.'
    },
    hvac: {
      title: 'Commercial HVAC & Industrial Mechanical Contractors',
      territory: 'Chicago, Dallas-Fort Worth, Atlanta Metro Hubs',
      niche: 'Commercial Chiller, VRF Mechanical Piping & Controls',
      price: '$99.00',
      packKey: 'hvac',
      records: 12,
      avgContract: 'Varies by project and market',
      coverage: { email: '7 / 12', phone: '11 / 12', tech: '7 / 12' },
      fields: ['Company Name', 'Category / Niche', 'City', 'State / Region', 'Primary Phone', 'Verified Email', 'Website', 'Tech Stack', 'SEO / Site Issues', 'Growth Opportunities', 'LinkedIn'],
      sampleRows: [
        { company: 'Midwest Mechanical', city: 'Chicago, IL', email: 'a***@m***.com', phone: '+1 630 *** 2300', tech: 'Google Analytics' },
        { company: 'Way Mechanical', city: 'Dallas, TX', email: 's***@w***.com', phone: '+1 713 *** 7545', tech: 'Wix' },
        { company: 'Shumate Commercial HVAC', city: 'Atlanta, GA', email: 'c***@s***.com', phone: '+1 678 *** 0880', tech: 'Google Analytics' }
      ],
      limitations: 'Cleaned email address entries; malformed legacy spreadsheet cells sanitized.',
      overview: 'High-value dataset targeting commercial mechanical outfits handling commercial chillers, industrial refrigeration, and facility maintenance across the nation’s largest industrial distribution hubs.',
      icp: 'B2B enterprise lead gen agencies, recruitment headhunters, and industrial marketing consultants targeting seven-figure mechanical contractors.',
      pitchAngle: 'Pitch modern B2B LinkedIn outbound pipelines and speed-optimized commercial bidding pages to commercial facility estimators.'
    }
  };

  // Open Product Detail Modal
  window.openProductDetailModal = function (packKey) {
    const spec = PRODUCT_SPECS[packKey] || PRODUCT_SPECS.texas;
    const modal = document.getElementById('productDetailModal');
    if (!modal) return;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };
    setText('pdmTitle', spec.title);
    setText('pdmTerritory', spec.territory);
    setText('pdmNiche', spec.niche);
    setText('pdmPrice', spec.price);
    setText('pdmRecords', `${spec.records} Business Records`);
    setText('pdmAvgContract', spec.avgContract);
    setText('pdmOverview', spec.overview);
    setText('pdmIcp', spec.icp);
    setText('pdmPitchAngle', `"${spec.pitchAngle}"`);

    if (spec.coverage) {
      setText('pdmCovEmail', spec.coverage.email);
      setText('pdmCovPhone', spec.coverage.phone);
      setText('pdmCovTech', spec.coverage.tech);
    }
    if (spec.limitations) {
      setText('pdmLimitationsText', spec.limitations);
    }

    const fieldsContainer = document.getElementById('pdmFieldsList');
    if (fieldsContainer) {
      fieldsContainer.innerHTML = spec.fields.map(f => `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
          <span class="text-emerald-400">✓</span> ${f}
        </span>
      `).join('');
    }

    const sampleTableBody = document.getElementById('pdmSampleTableBody');
    if (sampleTableBody && Array.isArray(spec.sampleRows)) {
      sampleTableBody.innerHTML = spec.sampleRows.map(row => `
        <tr>
          <td class="p-2.5 font-bold text-white">${row.company}</td>
          <td class="p-2.5 text-slate-400">${row.city}</td>
          <td class="p-2.5 text-cyan-400">${row.email}</td>
          <td class="p-2.5 text-slate-300">${row.phone}</td>
          <td class="p-2.5 text-emerald-400">${row.tech}</td>
        </tr>
      `).join('');
    }

    const buyBtn = document.getElementById('pdmBuyBtn');
    if (buyBtn) {
      buyBtn.onclick = function () {
        window.closeProductDetailModal();
        if (typeof window.openCheckoutModal === 'function') {
          window.openCheckoutModal(spec.packKey);
        }
      };
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (window.location.hash !== `#dataset=${spec.packKey}`) {
      try {
        window.history.replaceState({}, '', `#dataset=${spec.packKey}`);
      } catch {}
    }
  };

  window.closeProductDetailModal = function () {
    const modal = document.getElementById('productDetailModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    if (/^#dataset=/i.test(window.location.hash)) {
      try {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      } catch {}
    }
  };

  // Hash route listener for #dataset=texas|florida|medspas|hvac
  function checkDatasetHash() {
    const hash = window.location.hash;
    const match = hash.match(/^#dataset=(texas|florida|medspas|hvac)$/i);
    if (match) {
      window.openProductDetailModal(match[1].toLowerCase());
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', checkDatasetHash);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkDatasetHash);
    } else {
      checkDatasetHash();
    }
  }

  // Open Dataset Comparison Matrix
  window.openComparisonModal = function () {
    const modal = document.getElementById('comparisonModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeComparisonModal = function () {
    const modal = document.getElementById('comparisonModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  // Knowledge Hub Playbooks
  const PLAYBOOKS = {
    playbook1: {
      title: 'The Agency Outbound Playbook: Pitching Speed & Pixel Gaps',
      category: 'Agency Cold Email Strategy',
      readTime: '6 min read',
      content: `
        <h4>Why Generic Cold Pitching Fails in 2026</h4>
        <p>Most agencies email contractors saying: <em>"Hey, I can get you 20 leads next month."</em> Every business owner deletes this instantly because they receive 15 identical templates weekly.</p>
        <p>The secret to 40%+ open rates and 8%+ meeting booking rates is <strong>Objective Technical Observation</strong>. When you lead with an exact factual flaw that is hurting their wallet, the dynamic completely shifts.</p>
        
        <h4>The 3-Part Technical Angle Framework:</h4>
        <ol>
          <li><strong>The Objective Observation:</strong> "I was testing mobile contractor sites in Dallas and noticed your page takes 940ms to respond on mobile."</li>
          <li><strong>The Commercial Consequence:</strong> "A slow mobile response can add friction to the inquiry process. Use the business's own analytics to quantify any conversion impact."</li>
          <li><strong>The Friction-Free Offer:</strong> "I put together a 2-minute Loom showing the two uncompressed scripts causing this. Mind if I send it over?"</li>
        </ol>

        <h4>Handling The Ad Pixel Angle</h4>
        <p>A missing Meta Pixel may limit one retargeting channel. Check whether server-side events or other tags are configured before drawing conclusions about campaign performance. Remind them: <em>"A homeowner who visited your commercial roofing estimate page won't see your brand on Instagram or Facebook unless your retargeting pixel is active."</em></p>
      `
    },
    playbook2: {
      title: 'B2B Data Verification 101: DNS MX Records & Deliverability Auditing',
      category: 'Data Engineering & Deliverability',
      readTime: '5 min read',
      content: `
        <h4>What Does a DNS MX Check Actually Confirm?</h4>
        <p>Email addresses can be outdated, role-based, or invalid. Verification claims should identify exactly which syntax, domain, or mailbox checks were performed.</p>
        
        <h4>The 3-Step ApexIntel Verification Protocol:</h4>
        <ol>
          <li><strong>Contact field review:</strong> Dataset listings disclose the available contact fields and any documented validation status.</li>
          <li><strong>DNS MX lookup:</strong> Where an email address is listed, the domain can be checked for published mail-exchange records. This does not prove the individual mailbox exists or guarantee inbox placement.</li>
          <li><strong>Overlap policy:</strong> Any duplicate or territory policy is disclosed on the individual dataset listing. There is no universal platform-wide exclusivity guarantee.</li>
        </ol>

        <h4>Deliverability Best Practices:</h4>
        <p>Follow your sending provider's rules, ramp sending gradually, configure SPF, DKIM, and DMARC, and honor opt-outs and applicable email-marketing laws.</p>
      `
    },
    playbook3: {
      title: 'High-Ticket Contractor Outreach: Commercial Roofing & Solar',
      category: 'Niche Playbook',
      readTime: '7 min read',
      content: `
        <h4>The Economics of Commercial Trades</h4>
        <p>A commercial roof replacement averages <strong>$45,000 to $120,000</strong>. A commercial solar array installation averages <strong>$80,000 to $250,000</strong>.</p>
        <p>Because their ticket size is enormous, these business owners do not care about "social media management" or "SEO rankings." They care about one metric: <strong>commercial quote opportunities</strong>.</p>

        <h4>How to Frame Your Agency Value:</h4>
        <p>Position your services as an infrastructure upgrade. When you explain that their 850ms mobile lag is costing them 1 to 2 commercial quotes per quarter ($100k+ in potential revenue), paying your agency a $3,500/month retainer is mathematically trivial.</p>
      `
    },
    playbook4: {
      title: 'Aesthetic Clinics & MedSpas: Selling High-ROAS Retargeting',
      category: 'Healthcare & Aesthetics Playbook',
      readTime: '5 min read',
      content: `
        <h4>Understanding Cash-Pay Aesthetic Medicine</h4>
        <p>Unlike traditional medical practices that bill health insurance, Many aesthetic services are cash-pay, but billing varies by clinic, procedure, and patient.</p>
        <p>Patient lifetime value varies widely by clinic, treatment mix, pricing, and retention. Use the clinic's own figures when building a business case.</p>

        <h4>The Number One Bottleneck in Aesthetic Sites</h4>
        <p>Prospective patients browse treatment galleries on their iPhones. If the booking engine is slow or requires creating a password, patients bounce. Potential opportunities include simpler booking flows, follow-up messaging, and appropriately configured retargeting.</p>
      `
    }
  };

  window.openPlaybookModal = function (playbookId) {
    const pb = PLAYBOOKS[playbookId] || PLAYBOOKS.playbook1;
    const modal = document.getElementById('knowledgeModal');
    if (!modal) return;

    document.getElementById('kmCategory').innerText = pb.category;
    document.getElementById('kmReadTime').innerText = pb.readTime;
    document.getElementById('kmTitle').innerText = pb.title;
    document.getElementById('kmContent').innerHTML = pb.content;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.closeKnowledgeModal = function () {
    const modal = document.getElementById('knowledgeModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  // Trust & Legal Policy Modals
  const POLICIES = {
    privacy: {
      title: 'Privacy Policy',
      updated: 'November 2026',
      body: `
        <h4>1. Information We Collect</h4>
        <p>ApexIntel collects business contact information that is publicly indexed on commercial websites, business directories, and corporate registries. For registered customers, we collect delivery email addresses and transaction IDs.</p>
        <h4>2. Use of Information</h4>
        <p>Customer emails are strictly used for order delivery, dataset invoice verification, and essential security notices. We never sell, rent, or lease customer payment information to third parties.</p>
        <h4>3. Data Security & Storage</h4>
        <p>All client communications and payments are processed via 256-bit SSL encryption. Payment transactions are executed directly via Stripe Checkout — zero raw card numbers are stored on our servers.</p>
      `
    },
    terms: {
      title: 'Terms of Service',
      updated: 'November 2026',
      body: `
        <h4>1. Permitted Use of Intelligence Data</h4>
        <p>Purchasers are granted a non-exclusive, non-transferable commercial license to use ApexIntel datasets for internal sales prospecting, B2B cold outreach, and client acquisition campaigns.</p>
        <h4>2. Resale & Distribution Prohibitions</h4>
        <p>Purchasers may NOT resell, publicize, repackage, or distribute raw ApexIntel datasets on public marketplaces, torrent networks, or data-broker forums.</p>
        <h4>3. Compliance with Applicable Laws</h4>
        <p>Customers agree to conduct all email, SMS, and telephone communications in strict compliance with the CAN-SPAM Act, TCPA, and relevant local data privacy regulations.</p>
      `
    },
    refund: {
      title: 'Refund & Verification Policy',
      updated: 'November 2026',
      body: `
        <h4>1. Digital Product Delivery</h4>
        <p>Due to the instant, irrevocable nature of digital intelligence datasets and downloadable spreadsheet files, all completed sales are final once downloaded.</p>
        <h4>2. Data Quality Review & Replacement Policy</h4>
        <p>If more than 5% of the email addresses in a purchased dataset produce hard bounces within 7 days, contact support with your order reference and bounce evidence. The team will review the issue and provide replacements or account credit under this policy. A DNS MX check alone does not prove that an individual mailbox exists or guarantee inbox placement.</p>
      `
    },
    methodology: {
      title: 'Data Collection & Verification Methodology',
      updated: 'November 2026',
      body: `
        <h4>1. Multi-Stage Pipeline</h4>
        <p>Dataset sources and collection methods vary by product. Each listing describes its available provenance and limitations. The current ingestion service accepts explicit candidate batches; it does not autonomously crawl public registries.</p>
        <h4>2. Real-Time Latency & Pixel Auditing</h4>
        <p>Website diagnostics are performed for reachable public sites when a scan is requested. Response-time, TLS, and advertising-tag observations are point-in-time results and can vary by network, location, and site configuration. DNS MX checks confirm domain mail-exchange records only.</p>
        <h4>3. Deduplication Ledger</h4>
        <p>Purchase and download records are stored server-side. Dataset overlap or territory exclusivity is not guaranteed platform-wide and must be stated on the individual dataset listing.</p>
      `
    }
  };

  window.openPolicyModal = function (policyKey) {
    const p = POLICIES[policyKey] || POLICIES.privacy;
    const modal = document.getElementById('policyModal');
    if (!modal) return;

    document.getElementById('policyModalTitle').innerText = p.title;
    document.getElementById('policyModalUpdated').innerText = `Last Updated: ${p.updated}`;
    document.getElementById('policyModalBody').innerHTML = p.body;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  window.closePolicyModal = function () {
    const modal = document.getElementById('policyModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

})();
