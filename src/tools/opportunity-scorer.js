/**
 * ApexIntel B2B - Deterministic Explainable Opportunity Scoring & 5-Tier Provenance Engine
 *
 * Pure Node.js ESM module with zero AWS SDK or DOM dependencies.
 * Shared across Tools Scanner, Discovery Search, Crawler Ingestion, and CRM.
 *
 * Zero-Fabrication Contract:
 * - Missing/null fields remain null with provenance 'Unavailable' and contribute 0 points.
 * - Never synthesizes info@, +1 555, 750ms, 850ms, or placeholder tech stacks.
 */

import validator from 'validator';

export const PROVENANCE_TIERS = Object.freeze({
  VERIFIED: 'Verified',
  PUBLICLY_LISTED: 'Publicly Listed',
  INFERRED: 'Inferred',
  ESTIMATED: 'Estimated',
  UNAVAILABLE: 'Unavailable'
});

const EMAIL_PLACEHOLDERS = new Set([
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'unavailable',
  'unknown',
  'not available',
  'no email',
  '-',
  '--'
]);

const PHONE_PLACEHOLDERS = new Set([
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'unavailable',
  'unknown',
  'not available',
  'no phone',
  '-',
  '--'
]);

const PROVENANCE_RANK = Object.freeze({
  [PROVENANCE_TIERS.VERIFIED]: 4,
  [PROVENANCE_TIERS.PUBLICLY_LISTED]: 3,
  [PROVENANCE_TIERS.INFERRED]: 2,
  [PROVENANCE_TIERS.ESTIMATED]: 1,
  [PROVENANCE_TIERS.UNAVAILABLE]: 0
});

/**
 * Strip ASCII control characters and normalize whitespace.
 * @param {unknown} raw
 * @returns {string}
 */
function cleanRawString(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Defensively normalize and validate an email address.
 * Handles mailto: prefixes, concatenated leading phone digits (e.g. "708-345-1900devitom@aircomfort.com"),
 * and rejects placeholders and masked preview strings.
 *
 * @param {unknown} rawEmail
 * @returns {string|null}
 */
export function normalizeEmail(rawEmail) {
  let cleaned = cleanRawString(rawEmail);
  if (!cleaned) return null;

  cleaned = cleaned.replace(/^mailto:/i, '').trim();
  const lower = cleaned.toLowerCase();

  if (
    !lower ||
    EMAIL_PLACEHOLDERS.has(lower) ||
    lower.startsWith('contact form') ||
    lower.includes('form on site') ||
    lower.includes('**')
  ) {
    return null;
  }

  let candidate = lower;

  // Extract trailing email when prefixed by a concatenated NANP phone number BEFORE validator.isEmail
  // (since validator.isEmail treats leading digits+hyphens like "708-345-1900devitom@..." as a valid local-part).
  const formattedPhonePrefixMatch = candidate.match(
    /^(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}(?:[\s:;-]+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|([a-z][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}))$/i
  );
  if (formattedPhonePrefixMatch && (formattedPhonePrefixMatch[1] || formattedPhonePrefixMatch[2])) {
    candidate = (formattedPhonePrefixMatch[1] || formattedPhonePrefixMatch[2]).toLowerCase();
  } else {
    const compactPhonePrefixMatch = candidate.match(
      /^(?:1?\d{10})[\s:;-]*([a-z][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,})$/i
    );
    if (compactPhonePrefixMatch && compactPhonePrefixMatch[1]) {
      candidate = compactPhonePrefixMatch[1].toLowerCase();
    } else if (!validator.isEmail(candidate)) {
      // Fallback: strip leading digit/punctuation prefix immediately preceding a valid email
      const genericPrefixMatch = candidate.match(
        /^[\d()+\-.\s]{7,}([a-z][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,})$/i
      );
      if (genericPrefixMatch && genericPrefixMatch[1]) {
        candidate = genericPrefixMatch[1].toLowerCase();
      }
    }
  }

  if (!validator.isEmail(candidate)) {
    return null;
  }

  return candidate;
}

export const normalizeLeadEmail = normalizeEmail;

/**
 * Defensively normalize a phone number.
 * Rejects placeholders, dummy zeroed 555/000 numbers, masked numbers, email leaks, and <7 digit strings.
 * Formats 10-digit or 11-digit North American numbers as "+1 XXX XXX XXXX".
 *
 * @param {unknown} rawPhone
 * @returns {string|null}
 */
export function normalizePhone(rawPhone) {
  const cleaned = cleanRawString(rawPhone);
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  if (PHONE_PLACEHOLDERS.has(lower)) return null;
  if (cleaned.includes('@') || cleaned.includes('*')) return null;

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 7) return null;

  // Reject exact synthetic/zeroed placeholder phone patterns
  const us10 = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (
    /^0+$/.test(digits) ||
    us10 === '5550000000' ||
    us10 === '0000000000' ||
    /^(\+?1[\s.-]?)?(555|000)[\s.-]?000[\s.-]?0000$/.test(cleaned)
  ) {
    return null;
  }

  // Format standard US/NANP 10-digit or 11-digit (leading 1) numbers cleanly
  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return cleaned;
}

export const normalizeLeadPhone = normalizePhone;

/**
 * Compute deterministic, explainable opportunity score (0..100), grade, factors,
 * and 5-tier provenance breakdown from Scanner, Discovery, or CRM lead telemetry.
 *
 * @param {object} [input]
 * @returns {{
 *   score: number,
 *   grade: 'A'|'B'|'C'|'D',
 *   factors: Array<{ key: string, label: string, points: number, maxPoints: number, reason: string, provenance: string }>,
 *   provenance: { overall: string, email: string, phone: string, speed_ms: string, techStack: string }
 * }}
 */
export function scoreOpportunity(input = {}) {
  const data = input && typeof input === 'object' ? input : {};

  // 1. Speed / Latency (max 25)
  const rawSpeed = data.speed_ms ?? data.ttfbMs ?? data.speed;
  const speedMs = typeof rawSpeed === 'number' && Number.isFinite(rawSpeed) && rawSpeed >= 0
    ? rawSpeed
    : null;

  let speedFactor;
  let speedProvenance = PROVENANCE_TIERS.UNAVAILABLE;
  if (speedMs === null) {
    speedFactor = {
      key: 'speed',
      label: 'Mobile Speed & Latency',
      points: 0,
      maxPoints: 25,
      reason: 'Website latency telemetry unavailable.',
      provenance: PROVENANCE_TIERS.UNAVAILABLE
    };
  } else {
    speedProvenance = data.speedEstimated ? PROVENANCE_TIERS.ESTIMATED : PROVENANCE_TIERS.VERIFIED;
    let points = 4;
    let reason = `Fast baseline server response (${speedMs}ms TTFB).`;
    if (speedMs >= 1200) {
      points = 25;
      reason = `Critical mobile latency (${speedMs}ms TTFB) may justify a performance review; validate business impact with analytics.`;
    } else if (speedMs >= 800) {
      points = 20;
      reason = `Sub-optimal server latency (${speedMs}ms TTFB) slows mobile landing pages.`;
    } else if (speedMs >= 500) {
      points = 10;
      reason = `Moderate server latency (${speedMs}ms TTFB) has room for caching optimization.`;
    }
    speedFactor = {
      key: 'speed',
      label: 'Mobile Speed & Latency',
      points,
      maxPoints: 25,
      reason,
      provenance: speedProvenance
    };
  }

  // 2. TLS & Security Posture (max 15)
  const sslDetails = data.sslDetails && typeof data.sslDetails === 'object' ? data.sslDetails : null;
  const secHeaders = data.securityHeaders && typeof data.securityHeaders === 'object' ? data.securityHeaders : null;
  const isTotalNetworkFailure = Boolean(
    data.scanStatus === 'failed' &&
    sslDetails &&
    sslDetails.status === 'failed' &&
    data.httpStatus !== 'completed'
  );
  const hasTlsTelemetry = !isTotalNetworkFailure && Boolean(sslDetails || secHeaders || typeof data.tlsValid === 'boolean');

  let tlsFactor;
  if (!hasTlsTelemetry) {
    tlsFactor = {
      key: 'tls',
      label: 'TLS & Security Posture',
      points: 0,
      maxPoints: 15,
      reason: 'TLS and security header telemetry unavailable.',
      provenance: PROVENANCE_TIERS.UNAVAILABLE
    };
  } else {
    const tlsValid = typeof data.tlsValid === 'boolean'
      ? data.tlsValid
      : (sslDetails ? Boolean(sslDetails.valid) : true);
    const expiringSoon = sslDetails && typeof sslDetails.daysRemaining === 'number' && sslDetails.daysRemaining < 30;
    const missingHsts = secHeaders ? !secHeaders.hsts : false;

    let points = 2;
    let reason = 'Valid TLS certificate with baseline HSTS security posture.';
    if (!tlsValid) {
      points = 15;
      reason = 'Invalid, expired, or misconfigured TLS certificate hurts buyer trust.';
    } else if (expiringSoon || missingHsts) {
      points = 8;
      reason = expiringSoon
        ? `TLS certificate expires in ${sslDetails.daysRemaining} days.`
        : 'Valid TLS certificate but missing HTTP Strict Transport Security (HSTS).';
    }
    tlsFactor = {
      key: 'tls',
      label: 'TLS & Security Posture',
      points,
      maxPoints: 15,
      reason,
      provenance: PROVENANCE_TIERS.VERIFIED
    };
  }

  // 3. Ad Tracking & Analytics Gap (max 25)
  const pixels = data.pixels && typeof data.pixels === 'object' ? data.pixels : null;
  const hasMetaFlag = typeof data.meta_pixel === 'boolean' || typeof data.metaPixel === 'boolean';
  const hasGoogleAdsFlag = typeof data.google_ads === 'boolean' || typeof data.googleAds === 'boolean';
  const hasAnalyticsTelemetry = Boolean(pixels || hasMetaFlag || hasGoogleAdsFlag);

  let analyticsFactor;
  if (!hasAnalyticsTelemetry) {
    analyticsFactor = {
      key: 'analytics',
      label: 'Ad Tracking & Analytics Gap',
      points: 0,
      maxPoints: 25,
      reason: 'Tracking pixel and analytics telemetry unavailable.',
      provenance: PROVENANCE_TIERS.UNAVAILABLE
    };
  } else {
    const hasMeta = pixels ? Boolean(pixels.meta) : Boolean(data.meta_pixel ?? data.metaPixel);
    const hasGoogleAds = pixels ? Boolean(pixels.googleAds) : Boolean(data.google_ads ?? data.googleAds);
    const hasGaOrGtm = pixels ? Boolean(pixels.ga4 || pixels.gtm) : null;

    let points = 5;
    let reason = 'Baseline retargeting and analytics tags are active.';
    if (hasGoogleAds && !hasMeta) {
      points = 25;
      reason = 'A Google Ads tag was detected without a Meta Pixel in the scanned page; other tracking methods may be in use.';
    } else if (hasGaOrGtm === false && !hasMeta) {
      points = 22;
      reason = 'Missing Meta retargeting pixel and Google Analytics/GTM attribution.';
    } else if (!hasMeta) {
      points = 18;
      reason = 'No Meta Pixel was detected in the scanned page; this does not rule out server-side or alternative tracking.';
    } else if (hasGaOrGtm === false) {
      points = 12;
      reason = 'Meta Pixel detected; GA4/GTM tags were not detected in the scanned page.';
    }

    analyticsFactor = {
      key: 'analytics',
      label: 'Ad Tracking & Analytics Gap',
      points,
      maxPoints: 25,
      reason,
      provenance: PROVENANCE_TIERS.VERIFIED
    };
  }

  // 4. Contact & Deliverability Readiness (max 15)
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);
  const hasDnsMx = Boolean(data.dns && Array.isArray(data.dns.mx) && data.dns.mx.length > 0);
  const hasMxFlag = typeof data.mx_verified === 'boolean';
  const mxVerified = data.mx_verified === true || hasDnsMx;

  const emailProvenance = email
    ? (data.emailVerified === true ? PROVENANCE_TIERS.VERIFIED : PROVENANCE_TIERS.PUBLICLY_LISTED)
    : PROVENANCE_TIERS.UNAVAILABLE;
  const phoneProvenance = phone
    ? (data.phoneVerified === true ? PROVENANCE_TIERS.VERIFIED : PROVENANCE_TIERS.PUBLICLY_LISTED)
    : PROVENANCE_TIERS.UNAVAILABLE;

  let contactFactor;
  if (!email && !phone && !hasDnsMx && !hasMxFlag) {
    contactFactor = {
      key: 'contact',
      label: 'Contact & Deliverability Readiness',
      points: 0,
      maxPoints: 15,
      reason: 'Contact and MX deliverability telemetry unavailable.',
      provenance: PROVENANCE_TIERS.UNAVAILABLE
    };
  } else {
    let points = 4;
    let reason = 'Domain MX status is available; mailbox existence and phone ownership are not confirmed.';
    let contactProv = PROVENANCE_TIERS.INFERRED;

    if (email && mxVerified && phone) {
      points = 15;
      reason = 'Email domain publishes MX records and a phone is listed; mailbox delivery and phone ownership are not confirmed.';
      contactProv = data.emailVerified === true && data.phoneVerified === true
        ? PROVENANCE_TIERS.VERIFIED
        : PROVENANCE_TIERS.PUBLICLY_LISTED;
    } else if ((email && mxVerified) || (email && phone)) {
      points = 12;
      reason = email && mxVerified
        ? 'Email domain publishes MX records; mailbox existence and inbox placement are not confirmed.'
        : 'Publicly listed email and phone channels are available.';
      contactProv = data.emailVerified === true || data.phoneVerified === true
        ? PROVENANCE_TIERS.VERIFIED
        : PROVENANCE_TIERS.PUBLICLY_LISTED;
    } else if (email || phone || mxVerified) {
      points = 8;
      reason = phone
        ? 'Direct phone line available for outreach.'
        : (email ? 'Publicly listed email available; domain MX status is not confirmed.' : 'Domain publishes MX records; inbox delivery is not guaranteed.');
      contactProv = mxVerified ? PROVENANCE_TIERS.VERIFIED : PROVENANCE_TIERS.PUBLICLY_LISTED;
    }

    contactFactor = {
      key: 'contact',
      label: 'Contact & Deliverability Readiness',
      points,
      maxPoints: 15,
      reason,
      provenance: contactProv
    };
  }

  // 5. SEO & Tech Stack Opportunity (max 10)
  const rawTech = data.cms ?? data.tech;
  const techStack = typeof rawTech === 'string' && rawTech.trim() ? rawTech.trim() : null;
  const techProvenance = techStack ? PROVENANCE_TIERS.VERIFIED : PROVENANCE_TIERS.UNAVAILABLE;
  const hasTitle = typeof data.title === 'string' && data.title.trim().length > 0;
  const hasMetaDesc = typeof data.metaDesc === 'string' && data.metaDesc.trim().length > 0;
  const hasHttpScanContext = data.scanStatus === 'completed' || data.title !== undefined || data.metaDesc !== undefined;
  const hasSeoTelemetry = Boolean(techStack || hasHttpScanContext || data.seoIssues);

  let seoFactor;
  if (!hasSeoTelemetry) {
    seoFactor = {
      key: 'seo',
      label: 'SEO & Tech Stack Opportunity',
      points: 0,
      maxPoints: 10,
      reason: 'SEO metadata and tech stack telemetry unavailable.',
      provenance: PROVENANCE_TIERS.UNAVAILABLE
    };
  } else {
    let points = 3;
    let reason = 'Baseline metadata and modern web stack detected.';
    if ((hasHttpScanContext && !hasTitle && !hasMetaDesc) || data.seoIssues) {
      points = 10;
      reason = 'Missing title/meta description or flagged on-page SEO issues.';
    } else if ((hasHttpScanContext && !hasMetaDesc) || /wordpress|wix|squarespace|weebly/i.test(techStack || '')) {
      points = 7;
      reason = hasHttpScanContext && !hasMetaDesc
        ? 'Missing meta description reduces search click-through rate.'
        : `CMS (${techStack}) commonly benefits from performance and funnel optimization.`;
    }
    seoFactor = {
      key: 'seo',
      label: 'SEO & Tech Stack Opportunity',
      points,
      maxPoints: 10,
      reason,
      provenance: (techStack || hasHttpScanContext) ? PROVENANCE_TIERS.VERIFIED : PROVENANCE_TIERS.INFERRED
    };
  }

  // 6. Commercial Vertical & Ticket Potential (max 10)
  const tradeText = String(data.trade || data.category || data.industry || data.marginTier || '').trim();
  let marginFactor;
  if (!tradeText) {
    marginFactor = {
      key: 'margin',
      label: 'Commercial Vertical & Ticket Potential',
      points: 0,
      maxPoints: 10,
      reason: 'Commercial vertical/trade data unavailable.',
      provenance: PROVENANCE_TIERS.UNAVAILABLE
    };
  } else {
    let points = 3;
    let reason = `Standard commercial vertical (${tradeText}).`;
    if (/roof|solar|hvac|mechanical|chiller|medspa|aesthetic|cosmetic|dermatolog|restoration|contractor|plumbing|electrical|high/i.test(tradeText)) {
      points = 10;
      reason = `Commercial vertical (${tradeText}) is often associated with higher project values; confirm the typical contract size for this business.`;
    } else if (/medium|service|agency|medical|dental|legal/i.test(tradeText)) {
      points = 6;
      reason = `Mid-ticket B2B/service vertical (${tradeText}).`;
    }
    marginFactor = {
      key: 'margin',
      label: 'Commercial Vertical & Ticket Potential',
      points,
      maxPoints: 10,
      reason,
      provenance: PROVENANCE_TIERS.ESTIMATED
    };
  }

  const factors = [speedFactor, tlsFactor, analyticsFactor, contactFactor, seoFactor, marginFactor];
  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let grade = 'D';
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 50) grade = 'C';

  const coreProvenances = [emailProvenance, phoneProvenance, speedProvenance, techProvenance];
  const presentCore = coreProvenances.filter(p => p !== PROVENANCE_TIERS.UNAVAILABLE);

  let overall = PROVENANCE_TIERS.UNAVAILABLE;
  if (presentCore.length > 0) {
    overall = presentCore.reduce((lowest, current) => {
      return PROVENANCE_RANK[current] < PROVENANCE_RANK[lowest] ? current : lowest;
    }, presentCore[0]);
  }

  return {
    score,
    grade,
    factors,
    provenance: {
      overall,
      email: emailProvenance,
      phone: phoneProvenance,
      speed_ms: speedProvenance,
      techStack: techProvenance
    }
  };
}

export const scoreLead = scoreOpportunity;
