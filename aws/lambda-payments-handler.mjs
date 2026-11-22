/**
 * ApexIntel B2B - AWS Lambda Payments & Fulfillment Handler
 * 
 * Target: AWS Lambda Node.js 20+ (ARM64 or x86_64)
 * Triggers: Amazon API Gateway HTTP API v2.0 or Lambda Function URL
 * Database: Amazon DynamoDB (apexintel_orders, apexintel_sessions)
 * Storage: Amazon S3 (apexintel-datasets-production)
 */

import { handleLambdaPaymentsEvent } from '../src/payments/router.js';

export async function handler(event, context) {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  try {
    return await handleLambdaPaymentsEvent(event);
  } catch (err) {
    console.error('[Lambda Payments Handler Error]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'An internal payments fulfillment service error occurred.'
      })
    };
  }
}
