#!/usr/bin/env node
/**
 * ApexIntel B2B - Discovery & Crawler Ingestion Test Runner
 * Executes the entire automated lead ingestion, filtering, and admin recrawl test suite.
 */

import { spawn } from 'node:child_process';

console.log('🧪 Starting ApexIntel B2B Discovery & Ingestion Test Suite...\n');

const testFiles = [
  'tests/discovery/discovery.test.js'
];

const child = spawn('node', ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test', USE_MOCK_STORAGE: 'true' }
});

child.on('close', code => {
  if (code === 0) {
    console.log('\n✨ All Discovery and Crawler Ingestion tests passed successfully (0 failures).');
  } else {
    console.error(`\n❌ Discovery test suite failed with exit code ${code}.`);
  }
  process.exit(code);
});
