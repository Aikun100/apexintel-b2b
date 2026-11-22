/**
 * ApexIntel B2B - Custom Extraction Requests Router & Gateway Adapter
 * 
 * Endpoints:
 * - POST  /api/requests/custom       (Submit new request; rate-limited, CSRF-protected, optional auth)
 * - GET   /api/requests/custom       (List requests; customer sees own, admin sees queue)
 * - GET   /api/requests/custom/:id   (Get request details; customer sees own, admin sees any)
 * - PATCH /api/requests/custom/:id   (Admin lifecycle transition; Submitted -> Reviewing -> Mining -> Delivered)
 * - OPTIONS /api/requests/*          (CORS preflight)
 * 
 * Security:
 * - Worker-to-Lambda shared secret verification
 * - Strict CSRF / Origin verification on state mutations (POST, PATCH)
 * - Multi-tenant isolation (customer cannot access or alter other users' requests)
 * - Rate limiting on public request submission
 */

import { requestsService } from './service.js';
import { authenticateSession } from '../auth/middleware.js';
import { validateWorkerSecret } from '../auth/router.js';
import { RateLimiter } from '../auth/rate-limiter.js';
import { 
  validateRequestOrigin, 
  validateJsonContentType, 
  MAX_BODY_BYTES 
} from '../auth/csrf.js';

const requestsRateLimiter = new RateLimiter();

/**
 * Dispatch Custom Extraction Request routes.
 * 
 * @param {object} reqObj - Normalized request { method, path, headers, body, query, ip }
 * @param {import('./service.js').RequestsService} [service]
 * @param {import('../auth/service.js').AuthService} [authSvc]
 * @param {RateLimiter} [rateLimiter]
 * @returns {Promise<{ statusCode: number, headers: object, body: object }>}
 */
export async function dispatchRequestsRoute(
  reqObj,
  service = requestsService,
  authSvc = undefined,
  rateLimiter = requestsRateLimiter
) {
  const method = (reqObj.method || 'GET').toUpperCase();
  const rawPath = reqObj.path || '/api/requests/custom';
  const headers = reqObj.headers || {};
  const query = reqObj.query || {};
  const path = rawPath.replace(/\/+$/, '') || '/api/requests/custom';

  // -----------------------------------------------------------------
  // CORS Preflight OPTIONS
  // -----------------------------------------------------------------
  if (method === 'OPTIONS') {
    const origin = headers.origin || headers.Origin;
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || 'https://apexintel-b2b.shop',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-csrf-token, x-apexintel-worker-secret',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  // -----------------------------------------------------------------
  // Route 1: POST /api/requests/custom (Submit Custom Extraction Request)
  // -----------------------------------------------------------------
  if (method === 'POST' && path === '/api/requests/custom') {
    // 1. Worker Secret Verification
    const workerAuth = validateWorkerSecret(headers);
    if (!workerAuth.valid) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: workerAuth.reason || 'Missing worker authentication secret.' }
      };
    }

    // 2. CSRF / Origin Verification
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

    // 3. Content-Type Check
    const contentType = headers['content-type'] || headers['Content-Type'] || null;
    if (!validateJsonContentType(contentType)) {
      return {
        statusCode: 415,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Content-Type must be application/json.' }
      };
    }

    // 4. Rate Limiting Check (Max 5 submissions per 15 minutes per IP)
    const clientIp = reqObj.ip || headers['x-forwarded-for'] || '127.0.0.1';
    const rateCheck = rateLimiter.checkAndIncrement('CUSTOM_REQUEST', clientIp);
    if (!rateCheck.allowed) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfterSeconds)
        },
        body: {
          success: false,
          error: 'Rate limit exceeded. Please wait a moment before submitting another request.',
          retryAfterSeconds: rateCheck.retryAfterSeconds
        }
      };
    }

    // 5. Optional User Session Attachment
    let userContext = null;
    try {
      const auth = await authenticateSession(reqObj, authSvc);
      if (auth.authenticated && auth.user) {
        userContext = auth.user;
      }
    } catch {
      userContext = null;
    }

    try {
      const result = await service.createCustomRequest(reqObj.body || {}, userContext);
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          request: result
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
  // Protected Routes: Require Authenticated Session
  // -----------------------------------------------------------------
  const auth = await authenticateSession(reqObj, authSvc);
  if (!auth.authenticated || !auth.user) {
    return {
      statusCode: auth.statusCode || 401,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: auth.error || 'Authentication required to access custom extraction requests.' }
    };
  }

  const sessionUser = auth.user;

  // -----------------------------------------------------------------
  // Route 2: GET /api/requests/custom (List Requests)
  // -----------------------------------------------------------------
  if (method === 'GET' && path === '/api/requests/custom') {
    try {
      const requests = await service.listCustomRequests(sessionUser, {
        status: query.status,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
        userId: query.userId
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          requests
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
  // Route 3: GET /api/requests/custom/:id (Get Single Request)
  // -----------------------------------------------------------------
  const singleMatch = path.match(/^\/api\/requests\/custom\/([A-Za-z0-9_-]+)$/);
  if (method === 'GET' && singleMatch) {
    const requestId = singleMatch[1];
    try {
      const request = await service.getCustomRequest(requestId, sessionUser);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          request
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
  // Route 4: PATCH /api/requests/custom/:id (Admin Status Update)
  // -----------------------------------------------------------------
  if (method === 'PATCH' && singleMatch) {
    const requestId = singleMatch[1];

    // CSRF / Origin Verification
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

    try {
      const updated = await service.updateRequestStatus(
        requestId,
        reqObj.body || {},
        sessionUser
      );

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          request: updated
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
    body: { success: false, error: `Endpoint not found: ${method} ${path}` }
  };
}

/**
 * Node.js HTTP Server Adapter (for serve.js)
 * 
 * @param {import('node:http').IncomingMessage} req 
 * @param {import('node:http').ServerResponse} res 
 * @returns {Promise<boolean>}
 */
export async function handleNodeRequestsHttpRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname.replace(/\/+$/, '');

  if (!pathname.startsWith('/api/requests')) {
    return false;
  }

  const chunks = [];
  let bytesReceived = 0;

  for await (const chunk of req) {
    bytesReceived += chunk.length;
    if (bytesReceived > MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Payload too large.' }));
      return true;
    }
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  let parsedBody = {};
  if (rawBody.trim()) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload.' }));
      return true;
    }
  }

  const query = Object.fromEntries(urlObj.searchParams.entries());
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

  const reqObj = {
    method: req.method,
    path: pathname,
    headers: req.headers,
    query,
    body: parsedBody,
    ip: clientIp
  };

  const response = await dispatchRequestsRoute(reqObj);

  res.writeHead(response.statusCode, response.headers);
  res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body));
  return true;
}

/**
 * AWS Lambda HTTP API (v2) Handler Adapter
 * 
 * @param {object} event 
 * @returns {Promise<object>}
 */
export async function handleLambdaRequestsEvent(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.requestContext?.http?.path || event.rawPath || event.path || '/api/requests/custom';
  const headers = event.headers || {};
  const query = event.queryStringParameters || {};
  const clientIp = event.requestContext?.http?.sourceIp || headers['x-forwarded-for'] || '127.0.0.1';

  let body = {};
  if (event.body) {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    try {
      body = JSON.parse(raw);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Malformed JSON payload.' })
      };
    }
  }

  const reqObj = {
    method,
    path,
    headers,
    query,
    body,
    ip: clientIp
  };

  const response = await dispatchRequestsRoute(reqObj);

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
  };
}
