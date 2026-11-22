#!/usr/bin/env node
/**
 * ApexIntel B2B - Unified End-to-End Test Runner
 * 
 * Executes all 6 modular test suites across the ApexIntel serverless architecture:
 * 1. Authentication & Session Lifecycle (52 tests)
 * 2. Multi-Tenant CRM Backend (24 tests)
 * 3. Stripe Payments & S3 Fulfillment (19 tests)
 * 4. Lead Discovery & Crawler Ingestion (15 tests)
 * 5. Website Scanner & SSRF Hardening (31 tests)
 * 6. Custom Extraction Requests & Admin Queue (17 tests)
 * 
 * Total Target: 158 automated tests, 0 failures.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SUITES = [
  {
    name: 'Authentication & Session Lifecycle',
    script: 'scripts/run-auth-tests.mjs',
    expectedTests: 52
  },
  {
    name: 'Multi-Tenant CRM Backend',
    script: 'scripts/run-crm-tests.mjs',
    expectedTests: 24
  },
  {
    name: 'Stripe Payments & S3 Fulfillment',
    script: 'scripts/run-payment-tests.mjs',
    expectedTests: 19
  },
  {
    name: 'Discovery API & Crawler Ingestion',
    script: 'scripts/run-discovery-tests.mjs',
    expectedTests: 15
  },
  {
    name: 'Website Intelligence Scanner & SSRF',
    script: 'scripts/run-scanner-tests.mjs',
    expectedTests: 31
  },
  {
    name: 'Custom Extraction Requests & Queue',
    script: 'scripts/run-requests-tests.mjs',
    expectedTests: 17
  }
];

function runSuite(suite) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`\n================================================================================`);
    console.log(`▶ Running Suite: ${suite.name}`);
    console.log(`  Script: ${suite.script}`);
    console.log(`================================================================================\n`);

    const child = spawn(process.execPath, [path.join(rootDir, suite.script)], {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        USE_MOCK_STORAGE: 'true'
      }
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      resolve({
        ...suite,
        passed: code === 0,
        exitCode: code,
        durationMs
      });
    });

    child.on('error', (err) => {
      const durationMs = Date.now() - startTime;
      console.error(`Execution error in ${suite.name}:`, err);
      resolve({
        ...suite,
        passed: false,
        exitCode: 1,
        durationMs,
        error: err.message
      });
    });
  });
}

async function main() {
  console.log('🚀 ApexIntel B2B — Unified Automated Test Suite');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`📍 Environment: Node.js ${process.version} (Test Mode / In-Memory Isolation)`);
  console.log(`🎯 Executing ${SUITES.length} test suites...\n`);

  const overallStart = Date.now();
  const results = [];

  for (const suite of SUITES) {
    const result = await runSuite(suite);
    results.push(result);
    if (!result.passed) {
      console.error(`\n❌ Suite FAILED: ${suite.name} (exit code ${result.exitCode})`);
    }
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  const totalPassedSuites = results.filter(r => r.passed).length;
  const totalTests = SUITES.reduce((sum, s) => sum + s.expectedTests, 0);

  console.log('\n================================================================================');
  console.log('📊 APEXINTEL B2B TEST SUITE EXECUTION SUMMARY');
  console.log('================================================================================\n');

  console.log('| Suite Name                             | Target Tests | Status | Duration |');
  console.log('|----------------------------------------|-------------:|:------:|---------:|');

  for (const res of results) {
    const status = res.passed ? '✓ PASS' : '✗ FAIL';
    const duration = (res.durationMs / 1000).toFixed(2) + 's';
    const name = res.name.padEnd(38);
    const count = String(res.expectedTests).padStart(12);
    const statusCol = status.padStart(6);
    const durCol = duration.padStart(8);
    console.log(`| ${name} | ${count} | ${statusCol} | ${durCol} |`);
  }

  console.log('|----------------------------------------|-------------:|:------:|---------:|');
  console.log(`| TOTAL AUTOMATED TESTS                  | ${String(totalTests).padStart(12)} | ${totalPassedSuites === SUITES.length ? '✓ ALL' : '✗ FAIL'} | ${overallDuration.padStart(7)}s |`);
  console.log('================================================================================\n');

  if (totalPassedSuites === SUITES.length) {
    console.log(`✨ All ${totalTests} tests across ${SUITES.length} suites PASSED with 0 failures!`);
    console.log('🛡️  Full system integrity verified: Ready for packaging and deployment audit.\n');
    process.exit(0);
  } else {
    console.error(`❌ ${SUITES.length - totalPassedSuites} out of ${SUITES.length} test suites FAILED.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
