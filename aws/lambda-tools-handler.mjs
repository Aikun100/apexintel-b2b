/**
 * ApexIntel B2B - Website Scanner & Intelligence Tools AWS Lambda Entry Point
 * 
 * Invoked by AWS HTTP API (v2) Gateway:
 * - POST /api/tools/scan-website
 */

import { handleLambdaToolsEvent } from '../src/tools/router.js';

export const handler = async (event) => {
  return handleLambdaToolsEvent(event);
};
