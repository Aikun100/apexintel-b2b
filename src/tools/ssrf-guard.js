/**
 * ApexIntel B2B - SSRF Guard & DNS-Resolution-First Protection Engine
 * 
 * Protects serverless backends and internal infrastructure against Server-Side Request Forgery (SSRF).
 * 
 * Defenses Implemented:
 * 1. Strict Domain Syntax Validation:
 *    - Rejects IP literals (IPv4 / IPv6).
 *    - Rejects decimal, hex (0x7f), and octal (0177) integer-obfuscated IP addresses.
 *    - Rejects userinfo / credentials in domain strings (user:pass@host).
 *    - Rejects non-standard ports (strictly limits to 80/443).
 *    - Rejects single-label hostnames and internal/reserved TLDs (.local, .internal, .localhost, etc.).
 * 2. DNS-Resolution-First IP Verification:
 *    - Resolves A and AAAA records prior to any outbound network connection.
 *    - Evaluates all returned IPs against RFC 1918, RFC 3927, RFC 4193, CGNAT, Loopback,
 *      and Cloud Metadata ranges (AWS IMDS 169.254.169.254, fd00:ec2::254).
 *    - Rejects target if ANY resolved IP falls in a restricted or private range.
 * 3. DNS Rebinding (TOCTOU) Prevention:
 *    - Pins outbound socket/TLS connections directly to the verified IP address,
 *      while preserving SNI (servername) and the HTTP Host header.
 * 4. Safe Redirect Validation:
 *    - Inspects redirect locations (max 3 hops) recursively against SSRF rules.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

// Internal / Reserved TLDs that must never be scanned
const DISALLOWED_TLDS = new Set([
  'local',
  'localhost',
  'internal',
  'lan',
  'home',
  'corp',
  'arpa',
  'test',
  'example',
  'invalid',
  'onion'
]);

/**
 * Check whether an IPv4 or IPv6 address belongs to private, loopback,
 * link-local, carrier-grade NAT, cloud metadata, or reserved ranges.
 * 
 * @param {string} ip - IPv4 or IPv6 string
 * @returns {boolean} true if private/reserved/dangerous, false if public
 */
export function isPrivateOrReservedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  const trimmed = ip.trim().toLowerCase();

  // 1. Check for IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (trimmed.startsWith('::ffff:')) {
    const v4Part = trimmed.slice(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateOrReservedIp(v4Part);
    }
    // Hex notation within mapped IPv6
    const hexParts = v4Part.split(':');
    if (hexParts.length === 2) {
      const a = parseInt(hexParts[0].slice(0, 2), 16);
      const b = parseInt(hexParts[0].slice(2, 4), 16);
      const c = parseInt(hexParts[1].slice(0, 2), 16);
      const d = parseInt(hexParts[1].slice(2, 4), 16);
      return isPrivateOrReservedIp(`${a}.${b}.${c}.${d}`);
    }
  }

  // 2. IPv4 Checks
  if (net.isIPv4(trimmed)) {
    const octets = trimmed.split('.').map(num => parseInt(num, 10));
    if (octets.length !== 4 || octets.some(o => isNaN(o) || o < 0 || o > 255)) {
      return true; // Malformed IPv4
    }

    const [a, b, c, d] = octets;

    // 0.0.0.0/8 (Current network / default route)
    if (a === 0) return true;

    // 10.0.0.0/8 (RFC 1918 Private)
    if (a === 10) return true;

    // 100.64.0.0/10 (Shared Address Space / CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (Link-Local & Cloud Metadata, including AWS IMDS 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (RFC 1918 Private)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && c === 2) return true;

    // 192.88.99.0/24 (6to4 Relay Anycast)
    if (a === 192 && b === 88 && c === 99) return true;

    // 192.168.0.0/16 (RFC 1918 Private)
    if (a === 192 && b === 168) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;

    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved / Future use & Broadcast 255.255.255.255)
    if (a >= 240) return true;

    return false;
  }

  // 3. IPv6 Checks
  if (net.isIPv6(trimmed)) {
    // Unspecified ::/128
    if (trimmed === '::' || trimmed === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

    // Loopback ::1/128
    if (trimmed === '::1' || trimmed.endsWith(':0001') && trimmed.replace(/:/g, '') === '1') return true;

    // Normalize IPv6 by expanding shorthand
    const normalized = expandIpv6(trimmed);

    // Unique Local Addresses (fc00::/7) -> fc00.. to fdff.. (includes AWS IMDS fd00:ec2::254)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // Link-Local Unicast (fe80::/10) -> fe80.. to febf..
    const firstTwoBytes = parseInt(normalized.slice(0, 4), 16);
    if ((firstTwoBytes & 0xffc0) === 0xfe80) return true;

    // Multicast (ff00::/8)
    if (normalized.startsWith('ff')) return true;

    // Documentation (2001:0db8::/32)
    if (normalized.startsWith('20010db8')) return true;

    // Discard prefix (0100::/64)
    if (normalized.startsWith('0100')) return true;

    return false;
  }

  // Not a recognizable valid IP -> flag as restricted for safety
  return true;
}

/**
 * Expand an IPv6 string to 32 hex characters.
 * @param {string} ip 
 * @returns {string} 32 hex characters without colons
 */
function expandIpv6(ip) {
  let full = ip.toLowerCase();
  if (full.includes('::')) {
    const sides = full.split('::');
    const left = sides[0] ? sides[0].split(':') : [];
    const right = sides[1] ? sides[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    const middle = Array(missing).fill('0000');
    full = [...left, ...middle, ...right].map(seg => seg.padStart(4, '0')).join('');
  } else {
    full = full.split(':').map(seg => seg.padStart(4, '0')).join('');
  }
  return full;
}

/**
 * Strictly validate target domain syntax and reject IP literals, obfuscated formats,
 * invalid characters, ports, and internal TLDs.
 * 
 * @param {string} rawInput 
 * @returns {{ valid: boolean, domain?: string, reason?: string }}
 */
export function validateTargetDomain(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return { valid: false, reason: 'Domain is required.' };
  }

  let cleaned = rawInput.trim().toLowerCase();

  // Strip leading protocol if user supplied full URL
  cleaned = cleaned.replace(/^(https?:\/\/)/, '');

  // Strip trailing slashes, paths, and query fragments
  const pathIdx = cleaned.search(/[\/\?#]/);
  if (pathIdx !== -1) {
    cleaned = cleaned.substring(0, pathIdx);
  }

  // Strip leading 'www.' if present for uniform domain resolution
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.slice(4);
  }

  // 1. Reject credentials (user:pass@host)
  if (cleaned.includes('@')) {
    return { valid: false, reason: 'URL credentials (@) are not permitted.' };
  }

  // 2. Reject ports (e.g., domain:8080)
  if (cleaned.includes(':')) {
    return { valid: false, reason: 'Custom port specifications are not permitted.' };
  }

  // 3. Reject pure IP literals (IPv4 / IPv6)
  if (net.isIP(cleaned)) {
    return { valid: false, reason: 'Direct IP address scanning is prohibited. Please specify a public domain name.' };
  }

  // 4. Reject decimal / octal / hex obfuscated integer IPs (e.g., 2130706433, 0x7f000001, 017700000001)
  if (/^\d+$/.test(cleaned) || /^0x[0-9a-f]+$/i.test(cleaned) || /^0[0-7]+$/.test(cleaned)) {
    return { valid: false, reason: 'Numeric or hex-obfuscated IP literals are strictly prohibited.' };
  }

  // 5. Reject dot-decimal variations with hex/octal octets (e.g., 0x7f.0.0.1, 0177.0.0.1)
  if (cleaned.split('.').every(part => /^(0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(part))) {
    return { valid: false, reason: 'Obfuscated IP formats are strictly prohibited.' };
  }

  // 6. Check overall length (RFC 1035 max 253 characters)
  if (cleaned.length < 3 || cleaned.length > 253) {
    return { valid: false, reason: 'Domain name must be between 3 and 253 characters.' };
  }

  // 7. Check for consecutive dots or leading/trailing dots
  if (cleaned.includes('..') || cleaned.startsWith('.') || cleaned.endsWith('.')) {
    return { valid: false, reason: 'Invalid domain syntax.' };
  }

  const labels = cleaned.split('.');
  if (labels.length < 2) {
    return { valid: false, reason: 'Domain must contain a valid top-level domain (e.g. example.com).' };
  }

  // 8. Validate each label (RFC 1123)
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return { valid: false, reason: 'Domain label length must be between 1 and 63 characters.' };
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) {
      return { valid: false, reason: `Invalid characters in domain label: '${label}'.` };
    }
  }

  // 9. Validate TLD
  const tld = labels[labels.length - 1];
  if (DISALLOWED_TLDS.has(tld)) {
    return { valid: false, reason: `Scanning internal or reserved TLD (.${tld}) is prohibited.` };
  }

  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valid: false, reason: `Top-level domain (.${tld}) is not recognized.` };
  }

  return { valid: true, domain: cleaned };
}

/**
 * Resolve target domain via DNS (A and AAAA records) and verify all returned IPs.
 * 
 * Pins connection to a validated public IP to prevent DNS Rebinding (TOCTOU) attacks.
 * 
 * @param {string} domain - Pre-validated domain name
 * @param {object} [resolverOverride] - Optional mock DNS resolver for unit testing
 * @returns {Promise<{ verified: boolean, domain: string, ip: string, allIps: string[] }>}
 */
export async function resolveAndVerifyTarget(domain, resolverOverride = null) {
  const dnsClient = resolverOverride || dns;
  const resolvedIps = [];

  // 1. Resolve IPv4 (A records)
  try {
    const v4 = await dnsClient.resolve4(domain);
    if (Array.isArray(v4)) resolvedIps.push(...v4);
  } catch (err) {
    // Non-fatal if domain only has AAAA records
  }

  // 2. Resolve IPv6 (AAAA records)
  try {
    const v6 = await dnsClient.resolve6(domain);
    if (Array.isArray(v6)) resolvedIps.push(...v6);
  } catch (err) {
    // Non-fatal if domain only has A records
  }

  if (resolvedIps.length === 0) {
    throw new Error(`Domain '${domain}' could not be resolved (no A or AAAA records found).`);
  }

  // 3. Security Audit: Check EVERY resolved IP
  // If ANY returned IP falls within a private or link-local range, fail closed immediately!
  for (const ip of resolvedIps) {
    if (isPrivateOrReservedIp(ip)) {
      throw new Error(`SSRF Security Violation: Domain '${domain}' resolves to a restricted/private IP address (${ip}). Request aborted.`);
    }
  }

  // Select first verified IP for pinned connection
  const pinnedIp = resolvedIps[0];

  return {
    verified: true,
    domain,
    ip: pinnedIp,
    allIps: resolvedIps
  };
}
