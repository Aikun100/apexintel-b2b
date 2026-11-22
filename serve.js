import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleNodeHttpRequest } from './src/auth/router.js';
import { getAuthRepository } from './src/auth/repository.js';
import { hashPassword } from './src/auth/password.js';

const PORT = 3000;
const PUBLIC_DIR = path.resolve('./public');
const COVERS_DIR = path.resolve('./output/covers');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

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
  // Handle API Authentication routes (/api/auth/*)
  if (req.url.startsWith('/api/auth/')) {
    return handleNodeHttpRequest(req, res);
  }

  // Handle POST to save rendered cover images
  if (req.method === 'POST' && req.url.startsWith('/save-cover')) {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const filename = urlObj.searchParams.get('name') || 'cover.png';
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const base64Data = body.replace(/^data:image\/png;base64,/, '');
      const filePath = path.join(COVERS_DIR, filename);
      fs.writeFileSync(filePath, base64Data, 'base64');
      console.log(`📸 Saved cover image: ${filePath}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: filePath }));
    });
    return;
  }

  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath);
  let contentType = 'text/html';
  if (ext === '.css') contentType = 'text/css';
  if (ext === '.js') contentType = 'text/javascript';
  if (ext === '.json') contentType = 'application/json';
  if (ext === '.png') contentType = 'image/png';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`🚀 Sales Showcase live at http://localhost:${PORT}`);
  console.log(`🔐 Authentication API live at http://localhost:${PORT}/api/auth/*`);
});
