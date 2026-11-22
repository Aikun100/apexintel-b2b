#!/usr/bin/env node
/**
 * ApexIntel B2B - Auth Test Runner
 * Executes the entire automated authentication test suite.
 */

import { spawn } from 'node:child_process';

console.log('🧪 Starting ApexIntel B2B Authentication Test Suite...\n');

const testFiles = [
  'tests/auth/auth.test.js',
  'tests/auth/password-reset-and-admin.test.js',
  'tests/auth/lambda-and-worker.test.js'
];

const child = spawn('node', ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test', USE_MOCK_STORAGE: 'true' }
});

child.on('close', code => {
  if (code === 0) {
    console.log('\n✨ All authentication tests passed successfully (0 failures).');
  } else {
    console.error(`\n❌ Authentication test suite failed with exit code ${code}.`);
  }
  process.exit(code);
});
