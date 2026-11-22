/**
 * ApexIntel B2B - Website Intelligence Tools HTTP Router & Gateway Adapter
 * 
 * Endpoints:
 * - POST /api/tools/scan-website    (SSRF-hardened live website intelligence audit)
 * - OPTIONS /api/tools/*            (CORS preflight)
 * 
 * Security Controls:
 * - Origin & CSRF verification
 * - Worker-to-Lambda shared secret verification
 * - Rate limiting (10 scans per 60 seconds per client IP)
 * - Strict SSRF error reporting (400 Bad Request / 422 Unprocessable)
 */

import { getScannerService } from './scanner-service.js';
import { RateLimiter } from '../auth/rate-limiter.js';
import { validateWorkerSecret } from '../auth/router.js';
import { 
  validateRequestOrigin, 
  validateJsonContentType, 
  MAX_BODY_BYTES 
} from '../auth/csrf.js';

const toolsRateLimiter = new RateLimiter();

/**
 * Dispatch Tools and Scanner Routes.
 * 
 * @param {object} reqObj - Normalized request { method, path, headers, body, query, ip }
 * @param {import('./scanner-service.js').ScannerService} [service]
 * @param {RateLimiter} [rateLimiter]
 * @returns {Promise<{ statusCode: number, headers: object, body: object }>}
 */
export async function dispatchToolsRoute(
  reqObj, 
  service = getScannerService(), 
  rateLimiter = toolsRateLimiter
) {
  const method = (reqObj.method || 'GET').toUpperCase();
  const rawPath = reqObj.path || '/api/tools/scan-website';
  const headers = reqObj.headers || {};
  const path = rawPath.replace(/\/+$/, '') || '/api/tools/scan-website';

  // -----------------------------------------------------------------
  // CORS Preflight OPTIONS
  // -----------------------------------------------------------------
  if (method === 'OPTIONS') {
    const origin = headers.origin || headers.Origin;
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || 'https://apexintel-b2b.shop',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-csrf-token, x-apexintel-worker-secret',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  // -----------------------------------------------------------------
  // Route: POST /api/tools/scan-website
  // -----------------------------------------------------------------
  if (method === 'POST' && (path === '/api/tools/scan-website' || path === '/api/tools/scan')) {
    // 1. Worker Secret Validation (Origin Defense in Production)
    const workerAuth = validateWorkerSecret(headers);
    if (!workerAuth.valid) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: workerAuth.reason || 'Direct backend invocation prohibited. Requests must route through Cloudflare edge.' }
      };
    }

    // 2. Origin / Referer Validation (Anti-CSRF)
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

    // 3. Content-Type Validation
    const contentType = headers['content-type'] || headers['Content-Type'] || null;
    if (!validateJsonContentType(contentType)) {
      return {
        statusCode: 415,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Content-Type must be application/json.' }
      };
    }

    // 4. Rate Limiting Check (Max 10 scans/min per client IP)
    const clientIp = reqObj.ip || headers['x-forwarded-for'] || '127.0.0.1';
    const rateCheck = rateLimiter.checkAndIncrement('SCAN', clientIp);
    if (!rateCheck.allowed) {
      return {
        statusCode: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfterSeconds)
        },
        body: {
          success: false,
          error: 'Rate limit exceeded. Please wait a moment before running another scan.',
          retryAfterSeconds: rateCheck.retryAfterSeconds
        }
      };
    }

    // 5. Parse and Validate Request Payload
    const body = reqObj.body || {};
    const domain = body.domain;

    if (!domain || typeof domain !== 'string' || !domain.trim()) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'A target domain string is required for scanning.' }
      };
    }

    try {
      const scanResult = await service.scanDomain(domain, {
        forceRefresh: !!body.forceRefresh
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(rateCheck.remainingAttempts)
        },
        body: {
          success: true,
          scan: scanResult
        }
      };
    } catch (err) {
      const isSsrf = err.message.includes('SSRF') || 
                     err.message.includes('prohibited') || 
                     err.message.includes('restricted');
      const statusCode = isSsrf ? 400 : (err.statusCode || 500);

      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: err.message,
          ssrfBlocked: isSsrf
        }
      };
    }
  }

  // Not Found
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: { success: false, error: `Endpoint not found: ${method} ${path}` }
  };
}

/**
 * Node.js HTTP Server Adapter (for serve.js and local dev)
 * 
 * @param {import('node:http').IncomingMessage} req 
 * @param {import('node:http').ServerResponse} res 
 * @returns {Promise<boolean>} true if route was handled
 */
export async function handleNodeToolsHttpRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname.replace(/\/+$/, '');

  if (!pathname.startsWith('/api/tools')) {
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

  const response = await dispatchToolsRoute(reqObj);

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
export async function handleLambdaToolsEvent(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.requestContext?.http?.path || event.rawPath || event.path || '/api/tools/scan-website';
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

  const response = await dispatchToolsRoute(reqObj);

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
  };
}
