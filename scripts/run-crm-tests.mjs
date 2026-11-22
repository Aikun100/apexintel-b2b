#!/usr/bin/env node
/**
 * ApexIntel B2B - CRM Test Runner
 * Executes the entire automated Multi-Tenant CRM test suite.
 */

import { spawn } from 'node:child_process';

console.log('🧪 Starting ApexIntel B2B CRM Test Suite (In-Memory Isolation Mocks)...\n');

const testFiles = [
  'tests/crm/crm.test.js'
];

const child = spawn('node', ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test', USE_MOCK_STORAGE: 'true' }
});

child.on('close', code => {
  if (code === 0) {
    console.log('\n✨ All CRM multi-tenant tests passed successfully (0 failures).');
  } else {
    console.error(`\n❌ CRM test suite failed with exit code ${code}.`);
  }
  process.exit(code);
});
