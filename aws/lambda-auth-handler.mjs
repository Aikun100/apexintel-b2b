/**
 * ApexIntel B2B - AWS Lambda Authentication Handler
 * 
 * Target: AWS Lambda Node.js 20+ (ARM64 or x86_64)
 * Triggers: Amazon API Gateway HTTP API v2.0 or Lambda Function URL
 * Database: Amazon DynamoDB (apexintel_users, apexintel_sessions)
 */

import { handleLambdaEvent } from '../src/auth/router.js';

export async function handler(event, context) {
  // Ensure Lambda does not wait for empty event loop if any background logging remains
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  try {
    return await handleLambdaEvent(event);
  } catch (err) {
    console.error('[Lambda Auth Handler Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'An internal authentication service error occurred.'
      })
    };
  }
}
