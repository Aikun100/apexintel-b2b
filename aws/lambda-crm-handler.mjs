/**
 * ApexIntel B2B - AWS Lambda CRM Handler
 * 
 * Target: AWS Lambda Node.js 20+ (ARM64 or x86_64)
 * Triggers: Amazon API Gateway HTTP API v2.0 or Lambda Function URL
 * Database: Amazon DynamoDB (apexintel_user_crm, apexintel_sessions, apexintel_users)
 */

import { handleLambdaCrmEvent } from '../src/crm/router.js';

export async function handler(event, context) {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  try {
    return await handleLambdaCrmEvent(event);
  } catch (err) {
    console.error('[Lambda CRM Handler Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'An internal CRM service error occurred.'
      })
    };
  }
}
