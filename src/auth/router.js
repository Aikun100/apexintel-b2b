/**
 * ApexIntel B2B - Unified Authentication HTTP Router
 * 
 * Routes:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - POST /api/auth/logout
 * - GET  /api/auth/me
 * - POST /api/auth/change-password
 * - POST /api/auth/forgot-password
 * - POST /api/auth/reset-password
 * 
 * Compatible with:
 * - Node.js http (serve.js & local dev)
 * - Cloudflare Workers (fetch event)
 * - AWS Lambda Function URL / API Gateway v2.0
 */

import crypto from 'node:crypto';
import { authService } from './service.js';
import { 
  SESSION_CONFIG, 
  parseCookies, 
  serializeSessionCookie, 
  serializeClearSessionCookie 
} from './session.js';
import { 
  validateRequestOrigin, 
  validateJsonContentType, 
  MAX_BODY_BYTES 
} from './csrf.js';

/**
 * Validate Worker-to-Lambda shared secret for backend origin protection.
 * Prevents unauthorized direct internet requests to the Lambda Function URL.
 * @param {object} headers 
 * @returns {{ valid: boolean, reason?: string, isWorkerVerified: boolean }}
 */
export function validateWorkerSecret(headers = {}) {
  const configuredSecret = process.env.WORKER_BACKEND_SECRET;

  // In development and test environments, if WORKER_BACKEND_SECRET is not configured,
  // allow local requests but mark as unverified by Worker (cannot trust arbitrary X-Forwarded-For).
  if (!configuredSecret) {
    if (process.env.NODE_ENV === 'production') {
      return { 
        valid: false, 
        reason: 'Worker-to-Lambda authentication is mandatory in production but unconfigured.',
        isWorkerVerified: false 
      };
    }
    return { valid: true, isWorkerVerified: false };
  }

  const incomingSecret = headers['x-apexintel-worker-secret'] || 
                         headers['X-ApexIntel-Worker-Secret'] || 
                         headers['x-worker-secret'] || 
                         headers['X-Worker-Secret'];

  if (!incomingSecret || typeof incomingSecret !== 'string') {
    return { valid: false, reason: 'Missing worker authentication secret.', isWorkerVerified: false };
  }

  // Constant-time comparison
  const bufA = Buffer.from(incomingSecret);
  const bufB = Buffer.from(configuredSecret);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, reason: 'Invalid worker authentication secret.', isWorkerVerified: false };
  }

  return { valid: true, isWorkerVerified: true };
}

/**
 * Core Request Dispatcher for any environment.
 * @param {object} reqObj - Normalized request { method, path, headers, body, ip, userAgent }
 * @returns {Promise<{ statusCode: number, headers: object, body: object }>}
 */
export async function dispatchAuthRoute(reqObj, service = authService) {
  const method = (reqObj.method || 'GET').toUpperCase();
  const path = reqObj.path || '/api/auth/me';
  const headers = reqObj.headers || {};
  const ip = reqObj.ip || '127.0.0.1';
  const userAgent = reqObj.userAgent || '';
  const isProduction = process.env.NODE_ENV === 'production';

  const cookies = parseCookies(headers.cookie || headers.Cookie || '');
  const sessionToken = cookies[SESSION_CONFIG.COOKIE_NAME] || null;

  // CSRF & Header checks on mutation operations
  if (method === 'POST') {
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
  }

  try {
    // 1. POST /api/auth/register
    if (method === 'POST' && path === '/api/auth/register') {
      const result = await service.register(reqObj.body, ip);
      const cookieHeader = serializeSessionCookie(result.rawToken, { isProduction });
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader
        },
        body: {
          success: true,
          message: 'Account created successfully.',
          user: result.user
        }
      };
    }

    // 2. POST /api/auth/login
    if (method === 'POST' && path === '/api/auth/login') {
      const result = await service.login(reqObj.body, ip, userAgent);
      const cookieHeader = serializeSessionCookie(result.rawToken, { isProduction });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader
        },
        body: {
          success: true,
          message: 'Authentication successful.',
          user: result.user
        }
      };
    }

    // 3. POST /api/auth/logout
    if (method === 'POST' && path === '/api/auth/logout') {
      await service.logout(sessionToken, ip);
      const cookieHeader = serializeClearSessionCookie({ isProduction });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader
        },
        body: {
          success: true,
          message: 'Signed out successfully.'
        }
      };
    }

    // 4. GET /api/auth/me
    if (method === 'GET' && path === '/api/auth/me') {
      const user = await service.getMe(sessionToken);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          user
        }
      };
    }

    // 5. POST /api/auth/change-password
    if (method === 'POST' && path === '/api/auth/change-password') {
      const result = await service.changePassword(sessionToken, reqObj.body, ip);
      const cookieHeader = serializeSessionCookie(result.newRawToken, { isProduction });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader
        },
        body: {
          success: true,
          message: 'Password changed successfully.'
        }
      };
    }

    // 6. POST /api/auth/forgot-password
    if (method === 'POST' && path === '/api/auth/forgot-password') {
      const result = await service.forgotPassword(reqObj.body?.email, ip);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    }

    // 7. POST /api/auth/reset-password
    if (method === 'POST' && path === '/api/auth/reset-password') {
      const result = await service.resetPassword(reqObj.body, ip);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: result
      };
    }

    // Unknown Auth Subroute
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: `Authentication route ${method} ${path} not found.` }
    };

  } catch (err) {
    const statusCode = err.statusCode || (err.status ? err.status : 500);
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: false,
        error: statusCode === 500 ? 'An unexpected authentication error occurred.' : err.message
      }
    };
  }
}

/**
 * Handle Node.js http.IncomingMessage (used by serve.js and local server).
 * @param {import('node:http').IncomingMessage} req 
 * @param {import('node:http').ServerResponse} res 
 */
export async function handleNodeHttpRequest(req, res, service = authService) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = urlObj.pathname;

  let body = {};
  if (req.method === 'POST') {
    try {
      const rawBody = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
          data += chunk;
          if (data.length > MAX_BODY_BYTES) {
            reject(new Error('Payload Too Large'));
          }
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });

      if (rawBody.trim()) {
        body = JSON.parse(rawBody);
      }
    } catch (parseErr) {
      res.writeHead(parseErr.message === 'Payload Too Large' ? 413 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: parseErr.message }));
      return;
    }
  }

  const clientIp = req.headers['x-forwarded-for'] 
    ? req.headers['x-forwarded-for'].split(',')[0].trim() 
    : req.socket.remoteAddress || '127.0.0.1';

  const reqObj = {
    method: req.method,
    path: pathname,
    headers: req.headers,
    body,
    ip: clientIp,
    userAgent: req.headers['user-agent'] || ''
  };

  const response = await dispatchAuthRoute(reqObj, service);

  res.writeHead(response.statusCode, response.headers);
  res.end(JSON.stringify(response.body));
}

/**
 * AWS Lambda Handler for API Gateway v2.0 or Lambda Function URL.
 * @param {object} event 
 * @returns {Promise<object>}
 */
export async function handleLambdaEvent(event, service = authService) {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/api/auth/me';
  const headers = { ...(event.headers || {}) };

  // 1. Worker-to-Lambda Trust Boundary Verification
  const workerAuth = validateWorkerSecret(headers);
  if (!workerAuth.valid) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: workerAuth.reason })
    };
  }

  // 2. Client IP Resolution (Defense-in-depth trust boundary)
  // Only trust X-Forwarded-For if request is verified to originate through authorized Cloudflare Worker.
  // Otherwise, use TCP sourceIp directly from AWS network socket.
  let clientIp;
  if (workerAuth.isWorkerVerified && headers['x-forwarded-for']) {
    clientIp = headers['x-forwarded-for'].split(',')[0].trim();
  } else {
    clientIp = event.requestContext?.http?.sourceIp || '127.0.0.1';
  }

  const userAgent = event.requestContext?.http?.userAgent || headers['user-agent'] || '';

  // 3. Multi-Format Cookie Extraction (supports headers.cookie, headers.Cookie, and event.cookies array)
  const cookieHeader =
    headers.cookie ||
    headers.Cookie ||
    (Array.isArray(event.cookies)
      ? event.cookies.join('; ')
      : '');
  headers.cookie = cookieHeader;

  let body = {};
  if (event.body) {
    try {
      const payloadStr = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64').toString('utf8') 
        : event.body;
      body = JSON.parse(payloadStr);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Malformed JSON payload.' })
      };
    }
  }

  const reqObj = {
    method: httpMethod,
    path,
    headers,
    body,
    ip: clientIp,
    userAgent
  };

  const response = await dispatchAuthRoute(reqObj, service);

  const lambdaResult = {
    statusCode: response.statusCode,
    headers: { ...response.headers },
    body: JSON.stringify(response.body)
  };

  if (response.headers['Set-Cookie']) {
    lambdaResult.cookies = [response.headers['Set-Cookie']];
  }

  return lambdaResult;
}
