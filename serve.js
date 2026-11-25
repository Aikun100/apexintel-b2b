import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleNodeHttpRequest } from './src/auth/router.js';
import { handleNodeCrmHttpRequest } from './src/crm/router.js';
import { handleNodePaymentsHttpRequest } from './src/payments/router.js';
import { handleNodeDiscoveryHttpRequest } from './src/discovery/router.js';
import { handleNodeToolsHttpRequest } from './src/tools/router.js';
import { handleNodeRequestsHttpRequest } from './src/requests/router.js';
import { getAuthRepository } from './src/auth/repository.js';
import { hashPassword } from './src/auth/password.js';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = path.resolve('./public');

function applyServerSecurityHeaders(res, isHtml = false) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isHtml) {
    res.setHeader('Content-Security-Policy', "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none'; object-src 'none';");
  }
}

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

// Seed local development repository if using in-memory store
async function seedLocalDevAccounts() {
  const repo = getAuthRepository();
  const testEmail = 'alex@velocitygrowth.io';
  const existing = await repo.findUserByNormalizedEmail(testEmail);
  if (!existing) {
    console.log('🌱 Seeding local development test accounts with hashed passwords...');
    const now = new Date().toISOString();

    // 1. Customer: Alex
    const alexHash = await hashPassword('ApexDemo2026!');
    await repo.createUser({
      userId: 'usr_dev_alex_9011',
      email: 'alex@velocitygrowth.io',
      normalizedEmail: 'alex@velocitygrowth.io',
      passwordHash: alexHash.hash,
      passwordSalt: alexHash.salt,
      role: 'customer',
      accountStatus: 'active',
      emailVerified: true,
      name: 'Alex Rivera',
      company: 'Velocity Growth Agency',
      plan: 'Enterprise Pro',
      credits: 250,
      targetNiche: 'Commercial Roofing',
      apiKey: 'apex_live_sec_7f9a2b8e4d1c603a',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      passwordChangedAt: now
    });

    // 2. Customer: Sarah
    const sarahHash = await hashPassword('ApexDemo2026!');
    await repo.createUser({
      userId: 'usr_dev_sarah_7812',
      email: 'sarah@outboundsprint.com',
      normalizedEmail: 'sarah@outboundsprint.com',
      passwordHash: sarahHash.hash,
      passwordSalt: sarahHash.salt,
      role: 'customer',
      accountStatus: 'active',
      emailVerified: true,
      name: 'Sarah Chen',
      company: 'OutboundSprint',
      plan: 'Agency Growth',
      credits: 50,
      targetNiche: 'Luxury MedSpas',
      apiKey: 'apex_live_sec_1a3b5c7d9e0f2468',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      passwordChangedAt: now
    });

    // 3. Administrator: Admin
    const adminHash = await hashPassword('AdminMaster2026!');
    await repo.createUser({
      userId: 'usr_dev_admin_0001',
      email: 'admin@apexintel.io',
      normalizedEmail: 'admin@apexintel.io',
      passwordHash: adminHash.hash,
      passwordSalt: adminHash.salt,
      role: 'admin',
      accountStatus: 'active',
      emailVerified: true,
      name: 'Platform Admin',
      company: 'ApexIntel HQ',
      plan: 'Admin Master',
      credits: 999999,
      targetNiche: 'All Niches',
      apiKey: 'apex_live_sec_root_999988887777',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      passwordChangedAt: now
    });

    console.log('✅ Local test accounts seeded (Passwords securely hashed with scrypt).');
  }
}

seedLocalDevAccounts().catch(err => {
  console.warn('Local dev account seeding warning:', err.message);
});

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = urlObj.pathname;

  // Handle API Authentication routes (/api/auth/*)
  if (pathname.startsWith('/api/auth/')) {
    applyServerSecurityHeaders(res, false);
    return handleNodeHttpRequest(req, res);
  }

  // Handle API Multi-Tenant CRM routes (/api/crm/*)
  if (pathname.startsWith('/api/crm/')) {
    applyServerSecurityHeaders(res, false);
    return handleNodeCrmHttpRequest(req, res);
  }

  // Handle API Payments, Webhooks, & Downloads (/api/orders*, /api/webhooks/*, /api/downloads/*)
  if (pathname === '/api/orders' || pathname.startsWith('/api/orders/') || pathname.startsWith('/api/webhooks/') || pathname.startsWith('/api/downloads/')) {
    applyServerSecurityHeaders(res, false);
    return handleNodePaymentsHttpRequest(req, res);
  }

  // Handle API Discovery, Crawler Recrawl, & Admin Overview (/api/discovery/*, /api/admin/*)
  if (pathname.startsWith('/api/discovery/') || pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    applyServerSecurityHeaders(res, false);
    return handleNodeDiscoveryHttpRequest(req, res);
  }

  // Handle API Tools & Website Scanner (/api/tools/*)
  if (pathname.startsWith('/api/tools/')) {
    applyServerSecurityHeaders(res, false);
    return handleNodeToolsHttpRequest(req, res);
  }

  // Handle API Custom Extraction Requests (/api/requests/*)
  if (pathname.startsWith('/api/requests/')) {
    applyServerSecurityHeaders(res, false);
    return handleNodeRequestsHttpRequest(req, res);
  }

  // Fallback for unhandled /api/* routes (parity with Cloudflare Worker 404 JSON)
  if (pathname.startsWith('/api/')) {
    applyServerSecurityHeaders(res, false);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: `API endpoint '${pathname}' not found.` }));
    return;
  }

  // Static file serving with strict directory traversal prevention & isFile() check
  let safePathname;
  try {
    safePathname = decodeURIComponent(pathname);
  } catch {
    safePathname = pathname;
  }

  if (safePathname.includes('\0')) {
    applyServerSecurityHeaders(res, false);
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }

  const relPath = safePathname === '/' ? 'index.html' : safePathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(PUBLIC_DIR, relPath);

  // Guard against path traversal outside PUBLIC_DIR
  if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== PUBLIC_DIR) {
    applyServerSecurityHeaders(res, false);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  let stat;
  try {
    stat = fs.statSync(resolvedPath);
  } catch {
    stat = null;
  }

  if (!stat || !stat.isFile()) {
    applyServerSecurityHeaders(res, false);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const isHtml = ext === '.html';

  applyServerSecurityHeaders(res, isHtml);
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(resolvedPath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`🚀 Sales Showcase live at http://localhost:${PORT}`);
  console.log(`🔐 Authentication API live at http://localhost:${PORT}/api/auth/*`);
});
