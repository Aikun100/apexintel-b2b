/**
 * ApexIntel B2B - Discovery & Crawler HTTP Router & Gateway Adapter
 * 
 * Endpoints:
 * - GET  /api/discovery/search    (Live lead discovery with server-side contact masking; public with optional auth)
 * - POST /api/discovery/recrawl   (Admin-only recrawl trigger; requires admin session + CSRF + Worker secret)
 * - POST /api/admin/recrawl       (Alias for admin recrawl)
 * 
 * Security:
 * - Unauthenticated visitors receive masked email/phone contacts
 * - Admin recrawl strictly verifies server-authoritative role === 'admin'
 * - CSRF/Origin enforcement on state-mutating recrawl endpoint
 * - Worker-to-Lambda shared secret protection
 */

import { discoveryService } from './service.js';
import { authService } from '../auth/service.js';
import { paymentsService } from '../payments/service.js';
import { requestsService } from '../requests/service.js';
import { listProducts, getProductByKey } from '../payments/catalog.js';
import { authenticateSession } from '../auth/middleware.js';
import { validateWorkerSecret } from '../auth/router.js';
import { 
  validateRequestOrigin, 
  validateJsonContentType, 
  MAX_BODY_BYTES 
} from '../auth/csrf.js';

/**
 * Dispatch Discovery and Crawler Ingestion Routes.
 * @param {object} reqObj - Normalized request { method, path, headers, body, query, ip }
 * @param {import('./service.js').DiscoveryService} [service]
 * @param {import('../auth/service.js').AuthService} [authSvc]
 * @returns {Promise<{ statusCode: number, headers: object, body: object }>}
 */
export async function dispatchDiscoveryRoute(reqObj, service = discoveryService, authSvc = undefined) {
  const method = (reqObj.method || 'GET').toUpperCase();
  const rawPath = reqObj.path || '/api/discovery/search';
  const headers = reqObj.headers || {};
  const query = reqObj.query || {};

  // Strip trailing slashes and normalize path
  const path = rawPath.replace(/\/+$/, '') || '/api/discovery/search';

  // -----------------------------------------------------------------
  // Route 1: GET /api/discovery/search (Live Discovery Lead Search)
  // Publicly accessible with contact masking; optional session auth
  // -----------------------------------------------------------------
  if (method === 'GET' && path === '/api/discovery/search') {
    // Optional session check for admin contact unmasking
    let authenticatedUser = null;
    const cookieHeader = headers.cookie || headers.Cookie;
    if (cookieHeader) {
      try {
        const auth = await authenticateSession(reqObj, authSvc);
        if (auth.authenticated && auth.user) {
          authenticatedUser = auth.user;
        }
      } catch {
        authenticatedUser = null;
      }
    }

    try {
      const searchResult = await service.searchLeads({
        trade: query.trade || query.niche || query.category,
        location: query.location || query.city || query.territory,
        verified: query.verified,
        limit: query.limit,
        cursor: query.cursor,
        authenticatedUser
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          leads: searchResult.leads,
          totalCount: searchResult.totalCount,
          nextCursor: searchResult.nextCursor
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
  // Route 2: POST /api/discovery/recrawl or POST /api/admin/recrawl
  // Admin-Only Crawler Ingestion Pipeline
  // -----------------------------------------------------------------
  if (method === 'POST' && (path === '/api/discovery/recrawl' || path === '/api/admin/recrawl')) {
    // 1. Worker-to-Lambda Secret Check
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

    // 3. Admin Role Check
    if (auth.user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Access denied: Administrator privileges required to trigger crawler ingestion.' }
      };
    }

    // 4. CSRF & Origin Check
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

    // 5. Content-Type Check if body present
    const contentType = headers['content-type'] || headers['Content-Type'] || '';
    if (reqObj.body && Object.keys(reqObj.body).length > 0 && !validateJsonContentType(contentType)) {
      return {
        statusCode: 415,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Content-Type must be application/json.' }
      };
    }

    const body = typeof reqObj.body === 'string' ? JSON.parse(reqObj.body || '{}') : (reqObj.body || {});
    const customLeads = body.leads || null;

    try {
      const recrawlResult = await service.triggerRecrawl(auth.user, customLeads);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: recrawlResult
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
  // Route 3: GET /api/admin/overview
  // Role-gated Admin Overview metrics, orders, inventory & custom requests
  // -----------------------------------------------------------------
  if (method === 'GET' && (path === '/api/admin/overview' || path === '/api/admin')) {
    // 1. Worker Secret Validation
    const workerAuth = validateWorkerSecret(headers);
    if (!workerAuth.valid) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: workerAuth.reason }
      };
    }

    // 2. Authentication Check
    const auth = await authenticateSession(reqObj, authSvc);
    if (!auth.authenticated || !auth.user) {
      return {
        statusCode: auth.statusCode || 401,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: auth.error || 'Authentication required.' }
      };
    }

    // 3. Admin Role Check
    if (auth.user.role !== 'admin') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { success: false, error: 'Access denied: Administrator privileges required.' }
      };
    }

    try {
      // Aggregate from persistent repositories only. Missing data is never replaced with sample values.
      const [users, orders, customRequests, activeLeadsPool] = await Promise.all([
        authService.repo.listAllUsers(),
        paymentsService.repo.listAllOrders(),
        requestsService.listCustomRequests(auth.user),
        service.repo.countLeads()
      ]);

      const sortedOrders = [...orders].sort((a, b) =>
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      const paidOrders = sortedOrders.filter(order =>
        ['paid', 'fulfilled', 'delivered'].includes(String(order.status || '').toLowerCase())
      );
      const usdRevenueCents = paidOrders
        .filter(order => String(order.currency || 'usd').toLowerCase() === 'usd')
        .reduce((total, order) => {
          const cents = Number.isFinite(Number(order.amountInCents))
            ? Number(order.amountInCents)
            : Math.round((Number(order.amount) || 0) * 100);
          return total + cents;
        }, 0);

      const formatOrderAmount = order => {
        const cents = Number.isFinite(Number(order.amountInCents))
          ? Number(order.amountInCents)
          : Math.round((Number(order.amount) || 0) * 100);
        const currency = String(order.currency || 'usd').toLowerCase();
        try {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
          }).format(cents / 100);
        } catch {
          return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
        }
      };

      const recentOrders = sortedOrders.slice(0, 10).map(order => {
        const product = getProductByKey(order.productKey);
        const status = String(order.status || 'unknown');
        return {
          id: order.orderId,
          time: order.createdAt || null,
          customerEmail: order.userEmail || null,
          agency: order.companyName || order.company || null,
          product: order.productName || product?.title || order.productKey || 'Dataset',
          tier: product ? `${product.leadsCount} records` : null,
          amount: formatOrderAmount(order),
          processor: order.stripeSessionId ? 'Stripe Checkout' : null,
          status,
          statusColor: ['paid', 'fulfilled', 'delivered'].includes(status.toLowerCase()) ? 'emerald' : 'amber'
        };
      });

      const inventorySummary = listProducts().map(product => ({
        packKey: product.key,
        title: product.title,
        count: product.leadsCount,
        status: 'Catalogued'
      }));

      const recentCustomRequests = [...customRequests]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10)
        .map(request => ({
          requestId: request.requestId,
          userId: request.userId,
          status: request.status,
          industry: request.industry || null,
          territory: request.territory || null,
          volume: request.volume || request.recordCount || null,
          createdAt: request.createdAt || null,
          updatedAt: request.updatedAt || null
        }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          metrics: {
            totalRevenue: usdRevenueCents / 100,
            revenueCurrency: 'USD',
            paidOrdersCount: paidOrders.length,
            totalUsers: users.length,
            activeLeadsPool,
            customRequestsCount: customRequests.length,
            pendingCustomRequests: customRequests.filter(request =>
              ['submitted', 'reviewing', 'mining'].includes(String(request.status || '').toLowerCase())
            ).length
          },
          recentOrders,
          inventorySummary,
          customRequests: recentCustomRequests
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
    body: { success: false, error: `Discovery route not found: ${method} ${path}` }
  };
}

/**
 * Node.js HTTP Request Adapter for local development server (serve.js)
 */
export async function handleNodeDiscoveryHttpRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const query = Object.fromEntries(urlObj.searchParams.entries());

  let body = '';
  let bytesRead = 0;

  req.on('data', chunk => {
    bytesRead += chunk.length;
    if (bytesRead > MAX_BODY_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Request body exceeds maximum allowed size (1MB).' }));
      req.destroy();
      return;
    }
    body += chunk;
  });

  req.on('end', async () => {
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
      ip: req.socket.remoteAddress
    };

    try {
      const result = await dispatchDiscoveryRoute(reqObj);
      res.writeHead(result.statusCode, result.headers);
      res.end(JSON.stringify(result.body));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Internal discovery error.' }));
    }
  });
}

/**
 * AWS Lambda Handler for API Gateway v2.0 or Lambda Function URL.
 * @param {object} event 
 * @param {import('./service.js').DiscoveryService} [service]
 * @returns {Promise<object>}
 */
export async function handleLambdaDiscoveryEvent(event, service = discoveryService) {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/api/discovery/search';
  const headers = { ...(event.headers || {}) };

  // For mutating routes: check worker secret
  if (httpMethod !== 'GET') {
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
    query: event.queryStringParameters || {},
    ip: clientIp,
    userAgent: event.requestContext?.http?.userAgent || headers['user-agent'] || ''
  };

  const response = await dispatchDiscoveryRoute(reqObj, service);

  return {
    statusCode: response.statusCode,
    headers: { ...response.headers },
    body: JSON.stringify(response.body)
  };
}
