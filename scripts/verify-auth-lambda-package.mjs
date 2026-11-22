#!/usr/bin/env node
/**
 * ApexIntel B2B - Auth Lambda Package Verifier & Smoke Tester
 * 
 * Verifies:
 * 1. ZIP existence, structure, and compression integrity
 * 2. Mandatory files present (aws/lambda-auth-handler.mjs, src/auth/**, package.json, node_modules)
 * 3. Strict exclusion of secrets, .env files, public frontend, docs, and non-auth dependencies
 * 4. ESM import resolution of extracted package
 * 5. Local smoke invocation using mock API Gateway v2 / Lambda Function URL events
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const zipPath = path.join(distDir, 'apexintel-auth-lambda.zip');
const verifyExtractDir = path.join(distDir, 'verify-staging');

console.log('🔍 Starting ApexIntel Auth Lambda Deployment Package Verification...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failCount++;
  }
}

async function runVerification() {
  // 1. Verify ZIP Archive Exists
  assert(fs.existsSync(zipPath), `ZIP archive exists at ${zipPath}`);
  if (!fs.existsSync(zipPath)) {
    console.error('Package ZIP not found. Please run `node scripts/package-auth-lambda.mjs` first.');
    process.exit(1);
  }

  const zipStats = fs.statSync(zipPath);
  assert(zipStats.size > 10000, `ZIP archive has reasonable non-zero size (${(zipStats.size / 1024).toFixed(2)} KB)`);

  // 2. Inspect ZIP Archive Table of Contents
  console.log('\n📋 Inspecting archive file entries...');
  let entries = [];
  if (process.platform === 'win32') {
    const psListCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}'); $zip.Entries | ForEach-Object { $_.FullName }; $zip.Dispose()`;
    const listRaw = execSync(`powershell -NoProfile -NonInteractive -Command "${psListCmd}"`, { encoding: 'utf-8' });
    entries = listRaw.split(/\r?\n/).map(s => s.trim().replace(/\\/g, '/')).filter(Boolean);
  } else {
    const listRaw = execSync(`unzip -Z1 "${zipPath}"`, { encoding: 'utf-8' });
    entries = listRaw.split(/\r?\n/).map(s => s.trim().replace(/\\/g, '/')).filter(Boolean);
  }

  console.log(`  Total file/directory entries in archive: ${entries.length}`);

  // 3. Verify Mandatory Entries Present
  const requiredFiles = [
    'aws/lambda-auth-handler.mjs',
    'index.mjs',
    'package.json',
    'src/auth/router.js',
    'src/auth/service.js',
    'src/auth/repository.js',
    'src/auth/session.js',
    'src/auth/password.js',
    'src/auth/csrf.js',
    'src/auth/rate-limiter.js',
    'src/auth/audit-logger.js'
  ];

  for (const reqFile of requiredFiles) {
    const present = entries.some(e => e === reqFile || e.endsWith('/' + reqFile));
    assert(present, `Archive contains required entry: ${reqFile}`);
  }

  // Verify node_modules presence
  const hasValidator = entries.some(e => e.includes('node_modules/validator'));
  const hasDynamoClient = entries.some(e => e.includes('node_modules/@aws-sdk/client-dynamodb'));
  const hasDynamoLib = entries.some(e => e.includes('node_modules/@aws-sdk/lib-dynamodb'));

  assert(hasValidator, 'Archive contains production dependency: validator');
  assert(hasDynamoClient, 'Archive contains production dependency: @aws-sdk/client-dynamodb');
  assert(hasDynamoLib, 'Archive contains production dependency: @aws-sdk/lib-dynamodb');

  // 4. Verify Absolute Exclusion of Prohibited Content
  console.log('\n🛡️  Auditing archive for excluded files and potential leaks...');

  const prohibitedPatterns = [
    { pattern: /\.env/i, name: '.env credential files' },
    { pattern: /\.git/i, name: 'git repository files' },
    { pattern: /^public\//i, name: 'public frontend assets' },
    { pattern: /^sales\//i, name: 'sales & marketing materials' },
    { pattern: /^output\//i, name: 'scraper output data' },
    { pattern: /^docs\//i, name: 'documentation' },
    { pattern: /^tests\//i, name: 'test suite files' },
    { pattern: /^audits\//i, name: 'audit reports' },
    { pattern: /^scripts\//i, name: 'build scripts' },
    { pattern: /\.pem$/i, name: 'PEM private keys' },
    { pattern: /\.key$/i, name: 'private key files' },
    { pattern: /node_modules\/wrangler/i, name: 'wrangler devDependency' },
    { pattern: /node_modules\/stripe/i, name: 'stripe SDK (non-auth)' },
    { pattern: /node_modules\/crawlee/i, name: 'crawlee crawler (non-auth)' },
    { pattern: /node_modules\/cheerio/i, name: 'cheerio parser (non-auth)' },
    { pattern: /node_modules\/exceljs/i, name: 'exceljs (non-auth)' },
    { pattern: /node_modules\/sharp/i, name: 'sharp image engine (non-auth)' }
  ];

  for (const { pattern, name } of prohibitedPatterns) {
    const found = entries.filter(e => pattern.test(e));
    assert(found.length === 0, `Archive is strictly clean of ${name} (matched: ${found.length})`);
    if (found.length > 0) {
      console.warn(`    ⚠️ Found unexpected files: ${found.slice(0, 3).join(', ')}...`);
    }
  }

  // 5. Extract Archive to Verification Staging Directory
  console.log('\n📂 Extracting archive for ESM resolution and live smoke execution...');
  if (fs.existsSync(verifyExtractDir)) {
    fs.rmSync(verifyExtractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(verifyExtractDir, { recursive: true });

  if (process.platform === 'win32') {
    const psExtractCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/'/g, "''")}', '${verifyExtractDir.replace(/'/g, "''")}')`;
    execSync(`powershell -NoProfile -NonInteractive -Command "${psExtractCmd}"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -q "${zipPath}" -d "${verifyExtractDir}"`, { stdio: 'inherit' });
  }

  // 6. Test Dynamic ESM Import Resolution
  console.log('\n⚡ Testing ESM handler import inside extracted package...');
  const extractedHandlerPath = path.join(verifyExtractDir, 'aws', 'lambda-auth-handler.mjs');
  const extractedIndexMjsPath = path.join(verifyExtractDir, 'index.mjs');

  assert(fs.existsSync(extractedHandlerPath), `Extracted handler file exists: ${extractedHandlerPath}`);
  assert(fs.existsSync(extractedIndexMjsPath), `Extracted root index.mjs exists: ${extractedIndexMjsPath}`);

  // Set test environment flags for smoke testing
  process.env.NODE_ENV = 'test';
  process.env.USE_MOCK_STORAGE = 'true';
  const testWorkerSecret = 'test-verification-secret-3344';
  process.env.WORKER_BACKEND_SECRET = testWorkerSecret;

  const handlerModule = await import(pathToFileURL(extractedHandlerPath).href);
  const rootModule = await import(pathToFileURL(extractedIndexMjsPath).href);

  assert(typeof handlerModule.handler === 'function', '`aws/lambda-auth-handler.mjs` exports `handler` function');
  assert(typeof rootModule.handler === 'function', '`index.mjs` exports `handler` function');

  // 7. Execute Local Smoke Invocations
  console.log('\n🧪 Executing local smoke invocations on packaged Lambda handler...');

  // Smoke Test 1: Worker Secret Enforcement (Unauthorized Direct Access Blocked)
  const unauthEvent = {
    version: '2.0',
    routeKey: 'GET /api/auth/me',
    rawPath: '/api/auth/me',
    headers: {
      'host': 'apexintel-auth.lambda-url.ap-southeast-2.on.aws',
      'user-agent': 'curl/8.4.0'
    },
    requestContext: {
      http: {
        method: 'GET',
        path: '/api/auth/me',
        protocol: 'HTTP/1.1',
        sourceIp: '203.0.113.195',
        userAgent: 'curl/8.4.0'
      }
    }
  };

  const unauthRes = await handlerModule.handler(unauthEvent, { callbackWaitsForEmptyEventLoop: true });
  assert(unauthRes.statusCode === 403, `Direct invocation without worker secret returns 403 Forbidden (got ${unauthRes.statusCode})`);
  const unauthBody = JSON.parse(unauthRes.body);
  assert(unauthBody.success === false, '403 response contains success: false');

  // Smoke Test 2: Authorized Worker Invocation (Without Session Cookie -> Returns 401 Authentication Required)
  const authNoCookieEvent = {
    version: '2.0',
    routeKey: 'GET /api/auth/me',
    rawPath: '/api/auth/me',
    headers: {
      'host': 'apexintel-auth.lambda-url.ap-southeast-2.on.aws',
      'x-apexintel-worker-secret': testWorkerSecret,
      'x-forwarded-for': '198.51.100.42',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    requestContext: {
      http: {
        method: 'GET',
        path: '/api/auth/me',
        protocol: 'HTTP/1.1',
        sourceIp: '172.68.1.1', // Cloudflare edge IP
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }
  };

  const authNoCookieRes = await handlerModule.handler(authNoCookieEvent, { callbackWaitsForEmptyEventLoop: true });
  assert(authNoCookieRes.statusCode === 401, `Authorized request to /api/auth/me without cookie returns 401 Unauthorized (got ${authNoCookieRes.statusCode})`);
  const authNoCookieBody = JSON.parse(authNoCookieRes.body);
  assert(authNoCookieBody.success === false && authNoCookieBody.error === 'Authentication required.', 'Unauthenticated query returns error: Authentication required.');

  // Smoke Test 3: Authorized Registration via POST /api/auth/register
  const regEmail = `smoke_${Date.now()}@apexintel.io`;
  const regEvent = {
    version: '2.0',
    routeKey: 'POST /api/auth/register',
    rawPath: '/api/auth/register',
    headers: {
      'content-type': 'application/json',
      'origin': 'https://apexintel-b2b.shop',
      'x-apexintel-worker-secret': testWorkerSecret,
      'x-forwarded-for': '203.0.113.88'
    },
    body: JSON.stringify({
      email: regEmail,
      password: 'SmokeTestPass2026!',
      passwordConfirmation: 'SmokeTestPass2026!',
      name: 'Smoke Test Agent',
      company: 'Apex Automation'
    }),
    requestContext: {
      http: {
        method: 'POST',
        path: '/api/auth/register',
        sourceIp: '172.68.1.2'
      }
    }
  };

  const regRes = await handlerModule.handler(regEvent, { callbackWaitsForEmptyEventLoop: true });
  assert(regRes.statusCode === 201, `Registration through Lambda handler returns 201 Created (got ${regRes.statusCode})`);
  assert(Array.isArray(regRes.cookies) && regRes.cookies.length > 0, 'Registration response includes Set-Cookie header in cookies array');
  const sessionCookie = regRes.cookies[0].split(';')[0]; // e.g. apexintel_session=rawToken

  // Smoke Test 4: Authenticated /api/auth/me using event.cookies array
  const authWithCookieEvent = {
    version: '2.0',
    routeKey: 'GET /api/auth/me',
    rawPath: '/api/auth/me',
    headers: {
      'x-apexintel-worker-secret': testWorkerSecret
    },
    cookies: [sessionCookie],
    requestContext: {
      http: {
        method: 'GET',
        sourceIp: '172.68.1.2'
      }
    }
  };

  const authWithCookieRes = await handlerModule.handler(authWithCookieEvent, { callbackWaitsForEmptyEventLoop: true });
  assert(authWithCookieRes.statusCode === 200, `Authenticated request to /api/auth/me with cookie returns 200 OK (got ${authWithCookieRes.statusCode})`);
  const authWithCookieBody = JSON.parse(authWithCookieRes.body);
  assert(authWithCookieBody.success === true && authWithCookieBody.user?.email === regEmail, `Profile returned matches registered email (${regEmail})`);

  // Smoke Test 5: Invalid/Tampered Session Token Rejection
  const invalidCookieEvent = {
    version: '2.0',
    routeKey: 'GET /api/auth/me',
    rawPath: '/api/auth/me',
    headers: {
      'x-apexintel-worker-secret': testWorkerSecret
    },
    cookies: ['apexintel_session=tampered-fake-token-000000'],
    requestContext: {
      http: {
        method: 'GET',
        sourceIp: '172.68.1.2'
      }
    }
  };

  const invalidCookieRes = await handlerModule.handler(invalidCookieEvent, { callbackWaitsForEmptyEventLoop: true });
  assert(invalidCookieRes.statusCode === 401, `Invalid session token in event.cookies returns 401 Unauthorized (got ${invalidCookieRes.statusCode})`);

  // 8. Clean up Staging Directory
  fs.rmSync(verifyExtractDir, { recursive: true, force: true });
  console.log('\n🧹 Verification staging folder cleaned up.');

  // 9. Summary
  console.log('\n======================================================');
  console.log(`VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================');

  if (failCount > 0) {
    console.error('❌ Package verification failed!');
    process.exit(1);
  } else {
    console.log('✨ Package is 100% verified, self-contained, and ready for deployment.\n');
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
