#!/usr/bin/env node
/**
 * ApexIntel B2B - Payments & Fulfillment Test Runner
 * Executes the entire automated Stripe Checkout, Webhook, and S3 Presigned URL test suite.
 */

import { spawn } from 'node:child_process';

console.log('🧪 Starting ApexIntel B2B Payments & S3 Fulfillment Test Suite...\n');

const testFiles = [
  'tests/payments/payments.test.js'
];

const child = spawn('node', ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test', USE_MOCK_STORAGE: 'true' }
});

child.on('close', code => {
  if (code === 0) {
    console.log('\n✨ All Payment, Webhook, and S3 Presigned URL tests passed successfully (0 failures).');
  } else {
    console.error(`\n❌ Payments test suite failed with exit code ${code}.`);
  }
  process.exit(code);
});
