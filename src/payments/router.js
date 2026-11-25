/**
 * ApexIntel B2B - Payments & Fulfillment HTTP Router & Gateway Adapter
 * 
 * Endpoints:
 * - POST /api/orders/checkout       (Creates order & Stripe checkout session; requires session auth + CSRF)
 * - POST /api/webhooks/payment      (Stripe webhook fulfillment; verified via cryptographic signature)
 * - GET  /api/orders               (Lists user purchase history; requires session auth)
 * - GET  /api/downloads/signed-url (Generates 15-min S3 presigned URL for paid datasets; requires session auth)
 * 
 * Security:
 * - Worker-to-Lambda secret check on client-facing routes
 * - HttpOnly session cookie authentication via authService
 * - Strict tenant isolation & payment status gating on downloads
 * - Raw body preservation for cryptographic Stripe signature validation
 */

import { paymentsService } from './service.js';
import { authenticateSession } from '../auth/middleware.js';
import { validateWorkerSecret } from '../auth/router.js';
import { 
  validateRequestOrigin, 
  validateJsonContentType, 
  MAX_BODY_BYTES 
} from '../auth/csrf.js';

/**
 * Core Request Dispatcher for Payments & Fulfillment Routes.
 * @param {object} reqObj - Normalized request { method, path, headers, body, rawBody, query, ip }
 * @param {import('./service.js').PaymentsService} [service]
 * @param {import('../auth/service.js').AuthService} [authSvc]
 * @returns {Promise<{ statusCode: number, headers: object, body: object }>}
 */
export async function dispatchPaymentsRoute(reqObj, service = paymentsService, authSvc = undefined) {
  const method = (reqObj.method || 'GET').toUpperCase();
  const rawPath = reqObj.path || '/api/orders';
  const headers = reqObj.headers || {};
  const query = reqObj.query || {};

  // Strip trailing slashes and normalize path
  const path = rawPath.replace(/\/+$/, '') || '/api/orders';

  // -----------------------------------------------------------------
  // Route 1: POST /api/webhooks/payment (Public Stripe Webhook Ingestion)
  // MUST NOT require session cookie or CSRF Origin check
  // -----------------------------------------------------------------
  if (method === 'POST' && path === '/api/webhooks/payment') {
    const signature = headers['stripe-signature'] || headers['Stripe-Signature'] || '';
    if (!signature) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Missing stripe-signature header.' }
      };
    }

    const rawPayload = reqObj.rawBody !== undefined 
      ? reqObj.rawBody 
      : (typeof reqObj.body === 'string' ? reqObj.body : JSON.stringify(reqObj.body || {}));

    try {
      const webhookResult = await service.handleStripeWebhook(rawPayload, signature);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: webhookResult
      };
    } catch (err) {
      return {
        statusCode: err.statusCode || 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: err.message }
      };
    }
  }

  // -----------------------------------------------------------------
  // For all other routes: Enforce Worker-to-Lambda Secret & Session Auth
  // -----------------------------------------------------------------

  // 1. Worker Secret Validation (Edge origin protection)
  const workerAuth = validateWorkerSecret(headers);
  if (!workerAuth.valid) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: workerAuth.reason }
    };
  }

  // 2. Authentication Check (Server-authoritative session cookie)
  const auth = await authenticateSession(reqObj, authSvc);
  if (!auth.authenticated || !auth.user) {
    return {
      statusCode: auth.statusCode || 401,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: auth.error || 'Authentication required.' }
    };
  }

  const authenticatedUser = auth.user;
  const userId = authenticatedUser.userId;
  const userEmail = authenticatedUser.email;

  // -----------------------------------------------------------------
  // Route 2: POST /api/orders/checkout
  // -----------------------------------------------------------------
  if (method === 'POST' && path === '/api/orders/checkout') {
    const origin = headers.origin || headers.Origin || null;
    const referer = headers.referer || headers.Referer || null;
    const originCheck = validateRequestOrigin(origin, referer);
    if (!originCheck.valid) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: originCheck.reason }
      };
    }

    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    if (!validateJsonContentType(contentType)) {
      return {
        statusCode: 415,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Content-Type must be application/json.' }
      };
    }

    const body = typeof reqObj.body === 'string' ? JSON.parse(reqObj.body || '{}') : (reqObj.body || {});
    const productKey = body.productKey || body.key;

    if (!productKey) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'productKey is required to initiate checkout.' }
      };
    }

    try {
      const checkoutSession = await service.createCheckoutSession({
        userId,
        userEmail,
        productKey,
        origin: origin || undefined
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          orderId: checkoutSession.orderId,
          checkoutUrl: checkoutSession.checkoutUrl,
          stripeSessionId: checkoutSession.stripeSessionId
        }
      };
    } catch (err) {
      return {
        statusCode: err.statusCode || 500,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: err.message }
      };
    }
  }

  // -----------------------------------------------------------------
  // Route 3: GET /api/orders (Purchase History)
  // -----------------------------------------------------------------
  if (method === 'GET' && (path === '/api/orders' || path === '/api/orders/list')) {
    try {
      const orders = await service.listUserOrders(userId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          orders
        }
      };
    } catch (err) {
      return {
        statusCode: err.statusCode || 500,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: err.message }
      };
    }
  }

  // -----------------------------------------------------------------
  // Route 4: GET /api/downloads/signed-url (Presigned S3 Fulfillment)
  // -----------------------------------------------------------------
  if (method === 'GET' && path === '/api/downloads/signed-url') {
    const orderId = query.orderId || query.id;
    if (!orderId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Query parameter orderId is required.' }
      };
    }

    try {
      const result = await service.generateSignedDownloadUrl(userId, orderId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          orderId: result.orderId,
          downloadUrl: result.downloadUrl,
          filename: result.filename,
          expiresIn: result.expiresIn
        }
      };
    } catch (err) {
      return {
        statusCode: err.statusCode || 500,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: err.message }
      };
    }
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: { success: false, error: `Payments route not found: ${method} ${path}` }
  };
}

/**
 * Node.js HTTP Request Adapter for local development server (serve.js)
 */
export async function handleNodePaymentsHttpRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const query = Object.fromEntries(urlObj.searchParams.entries());

  let body = '';
  let rawChunks = [];
  let bytesRead = 0;

  req.on('data', chunk => {
    bytesRead += chunk.length;
    if (bytesRead > MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Request body exceeds maximum allowed size (1MB).' }));
      req.destroy();
      return;
    }
    rawChunks.push(chunk);
    body += chunk;
  });

  req.on('end', async () => {
    const rawBuffer = Buffer.concat(rawChunks);
    let parsedBody = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body;
      }
    }

    const reqObj = {
      method: req.method,
      path: urlObj.pathname,
      headers: req.headers,
      query,
      body: parsedBody,
      rawBody: rawBuffer,
      ip: req.socket.remoteAddress
    };

    try {
      const result = await dispatchPaymentsRoute(reqObj);
      res.writeHead(result.statusCode, result.headers);
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Internal payments error.' }));
    }
  });
}

/**
 * AWS Lambda Handler for API Gateway v2.0 or Lambda Function URL.
 * @param {object} event 
 * @param {import('./service.js').PaymentsService} [service]
 * @returns {Promise<object>}
 */
export async function handleLambdaPaymentsEvent(event, service = paymentsService) {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/api/orders';
  const headers = { ...(event.headers || {}) };

  const normalizedPath = path.replace(/\/+$/, '') || '/api/orders';

  // For non-webhook routes: check worker secret
  if (normalizedPath !== '/api/webhooks/payment') {
    const workerAuth = validateWorkerSecret(headers);
    if (!workerAuth.valid) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: workerAuth.reason })
      };
    }
  }

  let clientIp = '127.0.0.1';
  if (headers['x-forwarded-for']) {
    clientIp = headers['x-forwarded-for'].split(',')[0].trim();
  } else if (event.requestContext?.http?.sourceIp) {
    clientIp = event.requestContext.http.sourceIp;
  }

  const cookieHeader =
    headers.cookie ||
    headers.Cookie ||
    (Array.isArray(event.cookies) ? event.cookies.join('; ') : '');
  headers.cookie = cookieHeader;

  let rawPayload = '';
  let body = {};

  if (event.body) {
    rawPayload = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64').toString('utf8') 
      : event.body;

    if (normalizedPath === '/api/webhooks/payment') {
      body = rawPayload;
    } else {
      try {
        body = JSON.parse(rawPayload);
      } catch {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Malformed JSON payload.' })
        };
      }
    }
  }

  const reqObj = {
    method: httpMethod,
    path,
    headers,
    body,
    rawBody: rawPayload,
    query: event.queryStringParameters || {},
    ip: clientIp,
    userAgent: event.requestContext?.http?.userAgent || headers['user-agent'] || ''
  };

  const response = await dispatchPaymentsRoute(reqObj, service);

  return {
    statusCode: response.statusCode,
    headers: { ...response.headers },
    body: JSON.stringify(response.body)
  };
}
