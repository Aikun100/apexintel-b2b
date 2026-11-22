/**
 * ApexIntel B2B - Custom Extraction Requests AWS Lambda Entry Point
 * 
 * Invoked by AWS HTTP API (v2) Gateway:
 * - /api/requests/*
 */

import { handleLambdaRequestsEvent } from '../src/requests/router.js';

export const handler = async (event) => {
  return handleLambdaRequestsEvent(event);
};
