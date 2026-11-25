#!/usr/bin/env node
/**
 * ApexIntel B2B - End-to-End Customer Journey Test Runner
 * 
 * Usage:
 *   node scripts/run-e2e-tests.mjs
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Starting ApexIntel B2B End-to-End Customer Purchase Journey Test Suite...\n');

const child = spawn(process.execPath, ['--test', path.join(rootDir, 'tests/e2e/customer-journey.test.js')], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    USE_MOCK_STORAGE: 'true'
  }
});

child.on('close', code => {
  if (code === 0) {
    console.log('\n✨ All End-to-End Customer Journey tests passed successfully (0 failures).');
  } else {
    console.error(`\n❌ End-to-End Customer Journey test suite failed with exit code ${code}.`);
  }
  process.exit(code);
});
