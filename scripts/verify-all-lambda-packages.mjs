#!/usr/bin/env node
/**
 * ApexIntel B2B - Unified Lambda Package Verifier & Smoke Tester
 * 
 * Verifies all 6 Lambda deployment packages in dist/:
 * 1. apexintel-auth-lambda.zip
 * 2. apexintel-crm-lambda.zip
 * 3. apexintel-payments-lambda.zip
 * 4. apexintel-crawler-lambda.zip
 * 5. apexintel-tools-lambda.zip
 * 6. apexintel-requests-lambda.zip
 * 
 * Validates:
 * - Integrity and non-zero size
 * - Archive table of contents
 * - Mandatory handlers, modules, and production dependencies
 * - Strict exclusion of .env, git, tests, docs, frontend, and dev tools
 * - Dynamic ESM import resolution & smoke invocation of extracted handlers
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const PACKAGES = [
  {
    name: 'apexintel-auth-lambda',
    zipName: 'apexintel-auth-lambda.zip',
    handlerFile: 'aws/lambda-auth-handler.mjs',
    requiredFiles: [
      'aws/lambda-auth-handler.mjs',
      'index.mjs',
      'package.json',
      'src/auth/router.js',
      'src/auth/service.js',
      'src/auth/repository.js',
      'src/auth/session.js'
    ],
    requiredModules: ['validator', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb']
  },
  {
    name: 'apexintel-crm-lambda',
    zipName: 'apexintel-crm-lambda.zip',
    handlerFile: 'aws/lambda-crm-handler.mjs',
    requiredFiles: [
      'aws/lambda-crm-handler.mjs',
      'index.mjs',
      'package.json',
      'src/crm/router.js',
      'src/crm/service.js',
      'src/crm/repository.js',
      'src/auth/session.js'
    ],
    requiredModules: ['validator', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb']
  },
  {
    name: 'apexintel-payments-lambda',
    zipName: 'apexintel-payments-lambda.zip',
    handlerFile: 'aws/lambda-payments-handler.mjs',
    requiredFiles: [
      'aws/lambda-payments-handler.mjs',
      'index.mjs',
      'package.json',
      'src/payments/router.js',
      'src/payments/service.js',
      'src/payments/catalog.js',
      'src/payments/repository.js'
    ],
    requiredModules: [
      'validator',
      '@aws-sdk/client-dynamodb',
      '@aws-sdk/lib-dynamodb',
      '@aws-sdk/client-s3',
      '@aws-sdk/s3-request-presigner',
      'stripe'
    ]
  },
  {
    name: 'apexintel-crawler-lambda',
    zipName: 'apexintel-crawler-lambda.zip',
    handlerFile: 'aws/lambda-crawler-handler.mjs',
    requiredFiles: [
      'aws/lambda-crawler-handler.mjs',
      'aws/deduplication-engine.mjs',
      'index.mjs',
      'package.json',
      'src/discovery/repository.js',
      'src/discovery/service.js',
      'src/discovery/router.js',
      'src/auth/repository.js',
      'src/payments/repository.js',
      'src/payments/catalog.js',
      'src/requests/repository.js'
    ],
    requiredModules: ['validator', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb']
  },
  {
    name: 'apexintel-tools-lambda',
    zipName: 'apexintel-tools-lambda.zip',
    handlerFile: 'aws/lambda-tools-handler.mjs',
    requiredFiles: [
      'aws/lambda-tools-handler.mjs',
      'index.mjs',
      'package.json',
      'src/tools/router.js',
      'src/tools/scanner-service.js',
      'src/tools/ssrf-guard.js',
      'src/tools/repository.js'
    ],
    requiredModules: ['validator', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb']
  },
  {
    name: 'apexintel-requests-lambda',
    zipName: 'apexintel-requests-lambda.zip',
    handlerFile: 'aws/lambda-requests-handler.mjs',
    requiredFiles: [
      'aws/lambda-requests-handler.mjs',
      'index.mjs',
      'package.json',
      'src/requests/router.js',
      'src/requests/service.js',
      'src/requests/repository.js'
    ],
    requiredModules: ['validator', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb']
  }
];

const PROHIBITED_PATTERNS = [
  { pattern: /\.env/i, name: '.env credential files' },
  { pattern: /\.git/i, name: 'git repository files' },
  { pattern: /^tests[\\\/]/i, name: 'tests directory' },
  { pattern: /^public[\\\/]/i, name: 'public frontend assets' },
  { pattern: /^docs[\\\/]/i, name: 'documentation' },
  { pattern: /^audits[\\\/]/i, name: 'audit reports' },
  { pattern: /node_modules[\\\/]wrangler/i, name: 'wrangler dev dependency' },
  { pattern: /node_modules[\\\/]crawlee/i, name: 'crawlee dev dependency' },
  { pattern: /node_modules[\\\/]cheerio/i, name: 'cheerio dev dependency' },
  { pattern: /node_modules[\\\/]exceljs/i, name: 'exceljs dev dependency' }
];

function listZipEntries(zipPath) {
  if (process.platform === 'win32') {
    const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}'); $zip.Entries | ForEach-Object { $_.FullName }; $zip.Dispose()`;
    const raw = execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, { encoding: 'utf-8' });
    return raw.split(/\r?\n/).map(s => s.trim().replace(/\\/g, '/')).filter(Boolean);
  } else {
    const raw = execSync(`unzip -Z1 "${zipPath}"`, { encoding: 'utf-8' });
    return raw.split(/\r?\n/).map(s => s.trim().replace(/\\/g, '/')).filter(Boolean);
  }
}

function extractZip(zipPath, targetDir) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  if (process.platform === 'win32') {
    const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/'/g, "''")}', '${targetDir.replace(/'/g, "''")}')`;
    execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, { stdio: 'pipe' });
  } else {
    execSync(`unzip -q "${zipPath}" -d "${targetDir}"`, { stdio: 'pipe' });
  }
}

async function verifyPackage(pkg) {
  const zipPath = path.join(distDir, pkg.zipName);
  const verifyStaging = path.join(distDir, `verify-${pkg.name}`);
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`     ✓ [PASS] ${message}`);
      passCount++;
    } else {
      console.error(`     ✗ [FAIL] ${message}`);
      failCount++;
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🔍 Verifying Package: ${pkg.name}`);
  console.log(`   ZIP: dist/${pkg.zipName}`);
  console.log(`================================================================================`);

  // 1. Check existence and size
  assert(fs.existsSync(zipPath), `ZIP exists at ${zipPath}`);
  if (!fs.existsSync(zipPath)) {
    return { name: pkg.name, passed: false, passCount, failCount: failCount + 1 };
  }

  const stats = fs.statSync(zipPath);
  assert(stats.size > 10000, `Reasonable archive size: ${(stats.size / 1024).toFixed(2)} KB`);

  // 2. Inspect entries
  const entries = listZipEntries(zipPath);
  assert(entries.length > 10, `Archive contains populated file entries (count: ${entries.length})`);

  // 3. Verify required files
  for (const req of pkg.requiredFiles) {
    const found = entries.some(e => e === req || e.endsWith('/' + req));
    assert(found, `Contains required entry: ${req}`);
  }

  // 4. Verify required modules in node_modules
  for (const mod of pkg.requiredModules) {
    const found = entries.some(e => e.includes(`node_modules/${mod}/`) || e.includes(`node_modules/${mod.replace('/', '\\')}`));
    assert(found, `Contains production dependency: ${mod}`);
  }

  // 5. Audit exclusions
  for (const prohibited of PROHIBITED_PATTERNS) {
    const leaked = entries.filter(e => prohibited.pattern.test(e));
    assert(leaked.length === 0, `Strict exclusion of ${prohibited.name} (leaked: ${leaked.length})`);
  }

  // 6. Extraction & ESM Runtime Import Smoke Test
  console.log(`   Executing ESM runtime resolution & smoke check...`);
  try {
    extractZip(zipPath, verifyStaging);

    const indexFileUrl = pathToFileURL(path.join(verifyStaging, 'index.mjs')).href;
    const importedModule = await import(indexFileUrl);

    assert(typeof importedModule.handler === 'function', `index.mjs exports valid async handler function`);

    // Perform safe local smoke invocation with empty event
    process.env.NODE_ENV = 'test';
    process.env.USE_MOCK_STORAGE = 'true';
    const smokeRes = await importedModule.handler({}, { callbackWaitsForEmptyEventLoop: false });
    assert(smokeRes !== undefined, `Smoke invocation executed cleanly (status: ${smokeRes?.statusCode || 'handled'})`);
  } catch (err) {
    assert(false, `ESM import/invocation error: ${err.message}`);
  } finally {
    if (fs.existsSync(verifyStaging)) {
      fs.rmSync(verifyStaging, { recursive: true, force: true });
    }
  }

  return {
    name: pkg.name,
    passed: failCount === 0,
    passCount,
    failCount,
    sizeKb: (stats.size / 1024).toFixed(2)
  };
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 ApexIntel B2B — Multi-Package Deployment Verifier');
  console.log(`📁 Scanning Directory: ${distDir}\n`);

  const results = [];
  for (const pkg of PACKAGES) {
    const res = await verifyPackage(pkg);
    results.push(res);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const allPassed = results.every(r => r.passed);

  console.log('\n================================================================================');
  console.log('🛡️  LAMBDA PACKAGES AUDIT & VERIFICATION REPORT');
  console.log('================================================================================\n');
  console.log('| Package Name                      | Size (KB) | Checks Passed | Failed | Status |');
  console.log('|-----------------------------------|----------:|--------------:|-------:|:------:|');
  for (const r of results) {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`| ${r.name.padEnd(33)} | ${(r.sizeKb + ' KB').padStart(9)} | ${String(r.passCount).padStart(13)} | ${String(r.failCount).padStart(6)} | ${status.padStart(6)} |`);
  }
  console.log('|-----------------------------------|----------:|--------------:|-------:|:------:|');
  console.log(`Total verification time: ${totalTime}s\n`);

  if (allPassed) {
    console.log('✨ All 6 AWS Lambda deployment packages VERIFIED and READY for deployment!');
    process.exit(0);
  } else {
    console.error('❌ One or more Lambda deployment packages failed verification.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
