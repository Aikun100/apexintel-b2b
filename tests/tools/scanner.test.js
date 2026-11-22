/**
 * ApexIntel B2B - Website Intelligence Scanner & SSRF Hardening Test Suite
 * 
 * Verifies:
 * 1. SSRF Guard syntax validation (IP literals, hex/octal/decimal obfuscation, ports, userinfo, internal TLDs)
 * 2. IPv4 / IPv6 private, loopback, link-local, AWS IMDS, and CGNAT IP detection
 * 3. DNS-Resolution-First verification & DNS rebinding fail-closed protection
 * 4. 7-Day TTL Scans Repository caching and expiration
 * 5. Scanner service HTML diagnostics, CMS detection, pixel detection, and pitch generation
 * 6. Rate Limiting enforcement (10 req/min limit)
 * 7. Origin / CSRF and Worker-to-Lambda secret validation
 */

import assert from 'node:assert';
import { 
  validateTargetDomain, 
  isPrivateOrReservedIp, 
  resolveAndVerifyTarget 
} from '../../src/tools/ssrf-guard.js';
import { InMemoryScansRepository } from '../../src/tools/repository.js';
import { ScannerService } from '../../src/tools/scanner-service.js';
import { dispatchToolsRoute } from '../../src/tools/router.js';
import { RateLimiter } from '../../src/auth/rate-limiter.js';

export async function runScannerTests() {
  console.log('🧪 Starting Website Intelligence Scanner & SSRF Hardening Test Suite...\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  }

  // =========================================================================
  // 1. SSRF GUARD: DOMAIN SYNTAX VALIDATION
  // =========================================================================
  console.log('--- 1. SSRF Guard: Domain Syntax Validation ---');

  await test('Rejects empty or non-string domain inputs', () => {
    assert.strictEqual(validateTargetDomain('').valid, false);
    assert.strictEqual(validateTargetDomain(null).valid, false);
    assert.strictEqual(validateTargetDomain(undefined).valid, false);
  });

  await test('Rejects pure IPv4 literals (127.0.0.1, 10.0.0.1, 192.168.1.1)', () => {
    assert.strictEqual(validateTargetDomain('127.0.0.1').valid, false);
    assert.strictEqual(validateTargetDomain('10.0.0.1').valid, false);
    assert.strictEqual(validateTargetDomain('192.168.1.1').valid, false);
    assert.strictEqual(validateTargetDomain('169.254.169.254').valid, false);
  });

  await test('Rejects IPv6 literals and bracketed IPv6 ([::1])', () => {
    assert.strictEqual(validateTargetDomain('::1').valid, false);
    assert.strictEqual(validateTargetDomain('[::1]').valid, false);
    assert.strictEqual(validateTargetDomain('fe80::1').valid, false);
  });

  await test('Rejects integer-obfuscated decimal IPs (2130706433 = 127.0.0.1)', () => {
    const res = validateTargetDomain('2130706433');
    assert.strictEqual(res.valid, false);
    assert.match(res.reason, /prohibited/i);
  });

  await test('Rejects hexadecimal and octal obfuscated IPs (0x7f000001, 017700000001)', () => {
    assert.strictEqual(validateTargetDomain('0x7f000001').valid, false);
    assert.strictEqual(validateTargetDomain('0x7f.0.0.1').valid, false);
    assert.strictEqual(validateTargetDomain('0177.0.0.1').valid, false);
  });

  await test('Rejects URL credentials / userinfo (admin:pass@domain.com)', () => {
    const res = validateTargetDomain('admin:secret@domain.com');
    assert.strictEqual(res.valid, false);
    assert.match(res.reason, /credentials/i);
  });

  await test('Rejects custom ports (domain.com:8080, domain.com:22)', () => {
    const res = validateTargetDomain('example.com:8080');
    assert.strictEqual(res.valid, false);
    assert.match(res.reason, /port/i);
  });

  await test('Rejects single-label hostnames without TLD (localhost, intranet, metadata)', () => {
    assert.strictEqual(validateTargetDomain('localhost').valid, false);
    assert.strictEqual(validateTargetDomain('intranet').valid, false);
    assert.strictEqual(validateTargetDomain('metadata').valid, false);
  });

  await test('Rejects internal and reserved TLDs (.local, .internal, .localhost, .lan)', () => {
    assert.strictEqual(validateTargetDomain('service.local').valid, false);
    assert.strictEqual(validateTargetDomain('kube.internal').valid, false);
    assert.strictEqual(validateTargetDomain('api.localhost').valid, false);
    assert.strictEqual(validateTargetDomain('nas.lan').valid, false);
    assert.strictEqual(validateTargetDomain('company.corp').valid, false);
  });

  await test('Accepts valid public domains and normalizes protocol and path', () => {
    const r1 = validateTargetDomain('https://dallasroofer.com/services');
    assert.strictEqual(r1.valid, true);
    assert.strictEqual(r1.domain, 'dallasroofer.com');

    const r2 = validateTargetDomain('http://www.austincontractor.com?ref=ads');
    assert.strictEqual(r2.valid, true);
    assert.strictEqual(r2.domain, 'austincontractor.com');

    const r3 = validateTargetDomain('subdomain.solarcompany.co.uk');
    assert.strictEqual(r3.valid, true);
    assert.strictEqual(r3.domain, 'subdomain.solarcompany.co.uk');
  });

  // =========================================================================
  // 2. SSRF GUARD: IP RANGE & CLOUD METADATA DETECTION
  // =========================================================================
  console.log('\n--- 2. SSRF Guard: IP Range & Cloud Metadata Detection ---');

  await test('Flags IPv4 loopback (127.0.0.0/8) as restricted', () => {
    assert.strictEqual(isPrivateOrReservedIp('127.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('127.255.255.254'), true);
    assert.strictEqual(isPrivateOrReservedIp('127.1.2.3'), true);
  });

  await test('Flags RFC 1918 Private IPv4 ranges as restricted', () => {
    assert.strictEqual(isPrivateOrReservedIp('10.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('10.254.254.254'), true);
    assert.strictEqual(isPrivateOrReservedIp('172.16.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('172.31.255.255'), true);
    assert.strictEqual(isPrivateOrReservedIp('192.168.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('192.168.100.254'), true);
  });

  await test('Flags Link-Local and AWS IMDS (169.254.169.254) as restricted', () => {
    assert.strictEqual(isPrivateOrReservedIp('169.254.169.254'), true);
    assert.strictEqual(isPrivateOrReservedIp('169.254.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('169.254.255.255'), true);
  });

  await test('Flags Carrier-Grade NAT (100.64.0.0/10) as restricted', () => {
    assert.strictEqual(isPrivateOrReservedIp('100.64.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('100.127.255.255'), true);
    // 100.128.0.1 is outside CGNAT
    assert.strictEqual(isPrivateOrReservedIp('100.128.0.1'), false);
  });

  await test('Flags Multicast, Broadcast, and Reserved (224.0.0.0/4, 240.0.0.0/4)', () => {
    assert.strictEqual(isPrivateOrReservedIp('224.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('239.255.255.255'), true);
    assert.strictEqual(isPrivateOrReservedIp('240.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('255.255.255.255'), true);
  });

  await test('Flags IPv6 Loopback, Link-Local, and Unique Local (ULA including AWS IMDS fd00:ec2::254)', () => {
    assert.strictEqual(isPrivateOrReservedIp('::1'), true);
    assert.strictEqual(isPrivateOrReservedIp('fe80::1'), true);
    assert.strictEqual(isPrivateOrReservedIp('fd00:ec2::254'), true); // AWS IMDS IPv6
    assert.strictEqual(isPrivateOrReservedIp('fc00::1'), true);
    assert.strictEqual(isPrivateOrReservedIp('ff02::1'), true); // Multicast
  });

  await test('Flags IPv4-mapped IPv6 pointing to private addresses (::ffff:127.0.0.1)', () => {
    assert.strictEqual(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('::ffff:169.254.169.254'), true);
    assert.strictEqual(isPrivateOrReservedIp('::ffff:10.0.0.1'), true);
  });

  await test('Identifies legitimate public IPv4 and IPv6 addresses as safe', () => {
    assert.strictEqual(isPrivateOrReservedIp('93.184.216.34'), false); // example.com
    assert.strictEqual(isPrivateOrReservedIp('104.21.55.19'), false); // Cloudflare
    assert.strictEqual(isPrivateOrReservedIp('8.8.8.8'), false); // Google DNS
    assert.strictEqual(isPrivateOrReservedIp('1.1.1.1'), false); // Cloudflare DNS
    assert.strictEqual(isPrivateOrReservedIp('2606:4700:4700::1111'), false); // Public IPv6
  });

  // =========================================================================
  // 3. DNS-RESOLUTION-FIRST & DNS REBINDING PROTECTION
  // =========================================================================
  console.log('\n--- 3. DNS Resolution & Rebinding Protection ---');

  await test('Throws SSRF violation when domain resolves to 127.0.0.1', async () => {
    const mockDns = {
      resolve4: async () => ['127.0.0.1'],
      resolve6: async () => []
    };
    await assert.rejects(
      async () => await resolveAndVerifyTarget('evil-rebind.com', mockDns),
      /SSRF Security Violation.*restricted\/private/
    );
  });

  await test('Throws SSRF violation when domain resolves to AWS IMDS 169.254.169.254', async () => {
    const mockDns = {
      resolve4: async () => ['169.254.169.254'],
      resolve6: async () => []
    };
    await assert.rejects(
      async () => await resolveAndVerifyTarget('imds-stealer.com', mockDns),
      /SSRF Security Violation.*169\.254\.169\.254/
    );
  });

  await test('Fails closed if ANY IP in a multi-homed / split DNS response is private', async () => {
    const mockDns = {
      resolve4: async () => ['93.184.216.34', '10.0.0.5'], // Split DNS attack
      resolve6: async () => []
    };
    await assert.rejects(
      async () => await resolveAndVerifyTarget('split-dns-attack.com', mockDns),
      /SSRF Security Violation/
    );
  });

  await test('Pins connection to verified public IP when DNS is valid', async () => {
    const mockDns = {
      resolve4: async () => ['93.184.216.34'],
      resolve6: async () => ['2606:2800:220:1:248:1893:25c8:1946']
    };
    const target = await resolveAndVerifyTarget('example.com', mockDns);
    assert.strictEqual(target.verified, true);
    assert.strictEqual(target.ip, '93.184.216.34');
    assert.strictEqual(target.allIps.length, 2);
  });

  // =========================================================================
  // 4. SCANS REPOSITORY & 7-DAY TTL CACHING
  // =========================================================================
  console.log('\n--- 4. Scans Repository & 7-Day TTL Caching ---');

  const repo = new InMemoryScansRepository();

  await test('Saves and retrieves cached scan record with 7-day TTL', async () => {
    const sampleScan = {
      domain: 'dallasroofer.com',
      company: 'Dallas Commercial Roofing',
      speed: 680,
      cms: 'WordPress',
      pixels: { meta: false, gtm: true, ga4: true, tiktok: false, googleAds: false },
      flaws: ['Missing Meta Pixel'],
      suggestedPitch: 'We noticed Dallas Commercial Roofing is missing retargeting.'
    };

    const saved = await repo.saveScan(sampleScan);
    assert.ok(saved.ttl > Math.floor(Date.now() / 1000) + 600000); // ~7 days in future

    const cached = await repo.getCachedScan('dallasroofer.com');
    assert.ok(cached);
    assert.strictEqual(cached.domain, 'dallasroofer.com');
    assert.strictEqual(cached.company, 'Dallas Commercial Roofing');
    assert.strictEqual(cached.speed, 680);
  });

  await test('Returns null and purges record when TTL has expired', async () => {
    const expiredScan = {
      domain: 'expired-contractor.com',
      company: 'Expired Inc',
      speed: 900,
      ttl: Math.floor(Date.now() / 1000) - 100 // Expired 100 seconds ago
    };

    await repo.saveScan(expiredScan);
    const result = await repo.getCachedScan('expired-contractor.com');
    assert.strictEqual(result, null);
  });

  // =========================================================================
  // 5. SCANNER SERVICE: HTML ANALYSIS, CMS & PIXEL DETECTION
  // =========================================================================
  console.log('\n--- 5. Scanner Service Diagnostics & Pitch Synthesis ---');

  const scannerSvc = new ScannerService({ repo });

  await test('Detects WordPress CMS and Elementor page builder signature', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Austin Commercial Roofing | DFW Roofers</title>
          <meta name="description" content="Top Austin commercial roof repair.">
          <link rel="stylesheet" href="/wp-content/plugins/elementor/assets/css/frontend.min.css">
        </head>
        <body>
          <script src="/wp-includes/js/wp-embed.min.js"></script>
        </body>
      </html>
    `;
    const parsed = scannerSvc._parseHtml(html);
    assert.strictEqual(parsed.title, 'Austin Commercial Roofing | DFW Roofers');
    assert.strictEqual(parsed.metaDesc, 'Top Austin commercial roof repair.');
    assert.strictEqual(parsed.cms, 'WordPress (Elementor)');
    assert.strictEqual(parsed.pixels.meta, false);
  });

  await test('Detects Meta Pixel and Google Tag Manager', () => {
    const html = `
      <html>
        <head>
          <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"></script>
          <script>
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1234567890');
          </script>
        </head>
      </html>
    `;
    const parsed = scannerSvc._parseHtml(html);
    assert.strictEqual(parsed.pixels.meta, true);
    assert.strictEqual(parsed.pixels.gtm, true);
    assert.strictEqual(parsed.pixels.tiktok, false);
  });

  await test('Returns cached scan with fromCache: true without network request', async () => {
    const cachedResult = await scannerSvc.scanDomain('dallasroofer.com', { forceRefresh: false });
    assert.strictEqual(cachedResult.fromCache, true);
    assert.strictEqual(cachedResult.domain, 'dallasroofer.com');
  });

  // =========================================================================
  // 6. ROUTER SECURITY: RATE LIMITING & ORIGIN ENFORCEMENT
  // =========================================================================
  console.log('\n--- 6. Router Security: Rate Limiting & Origin Enforcement ---');

  const testLimiter = new RateLimiter();

  await test('Enforces rate limiting: 10 allowed, 11th request receives 429 Too Many Requests', async () => {
    const reqObj = {
      method: 'POST',
      path: '/api/tools/scan-website',
      headers: {
        'origin': 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { domain: 'dallasroofer.com' },
      ip: '203.0.113.42'
    };

    // First 10 requests must succeed (or return cached scan)
    for (let i = 0; i < 10; i++) {
      const res = await dispatchToolsRoute(reqObj, scannerSvc, testLimiter);
      assert.strictEqual(res.statusCode, 200, `Request ${i + 1} should be 200`);
    }

    // 11th request must be rate limited with 429
    const blockedRes = await dispatchToolsRoute(reqObj, scannerSvc, testLimiter);
    assert.strictEqual(blockedRes.statusCode, 429);
    assert.match(blockedRes.body.error, /rate limit exceeded/i);
    assert.ok(blockedRes.headers['Retry-After']);
  });

  await test('Rejects state-mutating requests from untrusted origins with 403', async () => {
    const untrustedReq = {
      method: 'POST',
      path: '/api/tools/scan-website',
      headers: {
        'origin': 'https://attacker.evil.com',
        'content-type': 'application/json'
      },
      body: { domain: 'dallasroofer.com' },
      ip: '198.51.100.99'
    };

    const res = await dispatchToolsRoute(untrustedReq, scannerSvc, new RateLimiter());
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.body.error, /not permitted/i);
  });

  await test('Blocks SSRF attempts to 127.0.0.1 with 400 and ssrfBlocked flag', async () => {
    const ssrfReq = {
      method: 'POST',
      path: '/api/tools/scan-website',
      headers: {
        'origin': 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: { domain: '127.0.0.1' },
      ip: '198.51.100.99'
    };

    const res = await dispatchToolsRoute(ssrfReq, scannerSvc, new RateLimiter());
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.ssrfBlocked, true);
    assert.match(res.body.error, /prohibited|restricted/i);
  });

  await test('Enforces Worker shared secret in production Lambda environment', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.WORKER_BACKEND_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_BACKEND_SECRET = 'super-secret-worker-token-xyz';

      // Request without worker secret
      const resWithoutSecret = await dispatchToolsRoute({
        method: 'POST',
        path: '/api/tools/scan-website',
        headers: {
          'origin': 'https://apexintel-b2b.shop',
          'content-type': 'application/json'
        },
        body: { domain: 'dallasroofer.com' },
        ip: '127.0.0.1'
      }, scannerSvc, new RateLimiter());

      assert.strictEqual(resWithoutSecret.statusCode, 403);
      assert.match(resWithoutSecret.body.error, /secret|worker|prohibited/i);

      // Request with valid worker secret
      const resWithSecret = await dispatchToolsRoute({
        method: 'POST',
        path: '/api/tools/scan-website',
        headers: {
          'origin': 'https://apexintel-b2b.shop',
          'content-type': 'application/json',
          'x-apexintel-worker-secret': 'super-secret-worker-token-xyz'
        },
        body: { domain: 'dallasroofer.com' },
        ip: '127.0.0.1'
      }, scannerSvc, new RateLimiter());

      assert.strictEqual(resWithSecret.statusCode, 200);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.WORKER_BACKEND_SECRET = prevSecret;
    }
  });

  console.log(`\n======================================================`);
  console.log(`Scanner Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    throw new Error(`Website Scanner Test Suite failed with ${failed} failure(s).`);
  }
}
