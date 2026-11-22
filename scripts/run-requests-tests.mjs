#!/usr/bin/env node
/**
 * ApexIntel B2B - Custom Extraction Requests Test Runner
 * 
 * Usage:
 *   node scripts/run-requests-tests.mjs
 */

import { runRequestsTests } from '../tests/requests/custom-requests.test.js';

runRequestsTests().catch(err => {
  console.error('❌ Custom requests test suite execution failed:', err.message);
  process.exit(1);
});
