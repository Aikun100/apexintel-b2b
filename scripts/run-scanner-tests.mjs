#!/usr/bin/env node
/**
 * ApexIntel B2B - Website Intelligence Scanner Test Runner
 * 
 * Usage:
 *   node scripts/run-scanner-tests.mjs
 */

import { runScannerTests } from '../tests/tools/scanner.test.js';

runScannerTests().catch(err => {
  console.error('❌ Scanner test suite execution failed:', err.message);
  process.exit(1);
});
