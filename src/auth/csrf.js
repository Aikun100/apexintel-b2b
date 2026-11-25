/**
 * ApexIntel B2B - Request Security, Origin Verification & CSRF Protection
 * 
 * Features:
 * - Allowed origin validation for state-changing HTTP requests
 * - Enforces application/json content-type on mutation routes
 * - Enforces payload size limit to prevent memory exhaustion
 * - SameSite=Lax cookie defense + Origin/Referer verification
 */

const baseAllowed = [
  'https://apexintel-b2b.shop',
  'https://www.apexintel-b2b.shop',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

if (process.env.ALLOWED_ORIGINS) {
  const extras = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  for (const extra of extras) {
    if (!baseAllowed.includes(extra)) baseAllowed.push(extra);
  }
}

if (process.env.PORT && process.env.PORT !== '3000') {
  baseAllowed.push(`http://localhost:${process.env.PORT}`);
  baseAllowed.push(`http://127.0.0.1:${process.env.PORT}`);
}

export const ALLOWED_ORIGINS = baseAllowed;

export const MAX_BODY_BYTES = 64 * 1024; // 64 KB max payload for auth

/**
 * Validate request Origin or Referer for state-changing operations.
 * @param {string} originHeader 
 * @param {string} refererHeader 
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateRequestOrigin(originHeader, refererHeader) {
  // If Origin header is present, check against allowlist
  if (originHeader) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => {
      return originHeader.toLowerCase() === allowed.toLowerCase();
    });
    if (!isAllowed) {
      return { valid: false, reason: `Origin '${originHeader}' is not permitted.` };
    }
    return { valid: true };
  }

  // If Origin is not present (some browsers omit on same-origin POST or older clients), check Referer
  if (refererHeader) {
    try {
      const url = new URL(refererHeader);
      const refOrigin = `${url.protocol}//${url.host}`.toLowerCase();
      const isAllowed = ALLOWED_ORIGINS.some(allowed => {
        return refOrigin === allowed.toLowerCase();
      });
      if (!isAllowed) {
        return { valid: false, reason: `Referer origin '${refOrigin}' is not permitted.` };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'Malformed Referer header.' };
    }
  }

  // In local test environments without Origin or Referer, permit if explicit flag set
  if (process.env.NODE_ENV === 'test') {
    return { valid: true };
  }

  return { valid: false, reason: 'Missing Origin and Referer security headers.' };
}

/**
 * Validate Content-Type header is application/json for JSON requests.
 * @param {string} contentTypeHeader 
 * @returns {boolean}
 */
export function validateJsonContentType(contentTypeHeader) {
  if (!contentTypeHeader || typeof contentTypeHeader !== 'string') {
    return false;
  }
  return contentTypeHeader.toLowerCase().includes('application/json');
}
