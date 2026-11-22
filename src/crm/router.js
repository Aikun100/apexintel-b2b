/**
 * ApexIntel B2B - Multi-Tenant CRM HTTP Router & Gateway Adapter
 * 
 * Endpoints:
 * - GET    /api/crm/leads          (Paginated lead list with optional stage filter)
 * - GET    /api/crm/leads/:id      (Point lookup for lead details)
 * - POST   /api/crm/leads          (Create single lead or batch-ingest leads)
 * - PUT    /api/crm/leads/:id      (Update stage, notes, tags, followUpDate)
 * - DELETE /api/crm/leads/:id      (Delete lead)
 * 
 * Security:
 * - Server-authoritative HttpOnly session cookie authentication (/api/auth/me)
 * - Strict per-user data isolation (User A cannot access User B's records)
 * - CSRF & Origin validation on all state mutations (POST, PUT, DELETE)
 * - Worker-to-Lambda shared secret verification
 */

import { crmService } from './service.js';
import { authenticateSession } from '../auth/middleware.js';
import { validateWorkerSecret } from '../auth/router.js';
import { 
  validateRequestOrigin, 
  validateJsonContentType, 
  MAX_BODY_BYTES 
} from '../auth/csrf.js';

/**
 * Core Request Dispatcher for CRM Routes.
 * @param {object} reqObj - Normalized request { method, path, headers, body, query, ip }
 * @param {import('./service.js').CrmService} [service]
 * @returns {Promise<{ statusCode: number, headers: object, body: object }>}
 */
export async function dispatchCrmRoute(reqObj, service = crmService, authSvc = undefined) {
  const method = (reqObj.method || 'GET').toUpperCase();
  const rawPath = reqObj.path || '/api/crm/leads';
  const headers = reqObj.headers || {};
  const query = reqObj.query || {};

  // Strip trailing slashes and normalize path
  const path = rawPath.replace(/\/+$/, '') || '/api/crm/leads';

  // 1. Worker-to-Lambda Secret Check (Edge origin protection)
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

  // 3. CSRF & Content-Type validation on mutation operations
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
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

    if (['POST', 'PUT'].includes(method)) {
      const contentType = headers['content-type'] || headers['Content-Type'] || '';
      if (!validateJsonContentType(contentType)) {
        return {
          statusCode: 415,
          headers: { 'Content-Type': 'application/json' },
          body: { success: false, error: 'Content-Type must be application/json.' }
        };
      }
    }
  }

  try {
    // -------------------------------------------------------------
    // Route 1: GET /api/crm/leads
    // -------------------------------------------------------------
    if (method === 'GET' && path === '/api/crm/leads') {
      const result = await service.listLeads(userId, query);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          ...result
        }
      };
    }

    // -------------------------------------------------------------
    // Route 2: GET /api/crm/leads/:id
    // -------------------------------------------------------------
    const getMatch = path.match(/^\/api\/crm\/leads\/([a-zA-Z0-9_\-]+)$/);
    if (method === 'GET' && getMatch) {
      const leadId = getMatch[1];
      const lead = await service.getLead(userId, leadId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          lead
        }
      };
    }

    // -------------------------------------------------------------
    // Route 3: POST /api/crm/leads (Single create or batch ingestion)
    // -------------------------------------------------------------
    if (method === 'POST' && path === '/api/crm/leads') {
      const body = reqObj.body || {};
      if (Array.isArray(body.leads)) {
        const createdLeads = await service.batchCreateLeads(userId, body.leads);
        return {
          statusCode: 201,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: true,
            message: `Successfully saved ${createdLeads.length} leads.`,
            count: createdLeads.length,
            leads: createdLeads
          }
        };
      } else {
        const createdLead = await service.createLead(userId, body);
        return {
          statusCode: 201,
          headers: { 'Content-Type': 'application/json' },
          body: {
            success: true,
            message: 'Lead saved successfully.',
            lead: createdLead
          }
        };
      }
    }

    // -------------------------------------------------------------
    // Route 4: PUT /api/crm/leads/:id (Update stage, notes, tags, followUp)
    // -------------------------------------------------------------
    const putMatch = path.match(/^\/api\/crm\/leads\/([a-zA-Z0-9_\-]+)$/);
    if (method === 'PUT' && putMatch) {
      const leadId = putMatch[1];
      const updated = await service.updateLead(userId, leadId, reqObj.body || {});
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          message: 'Lead updated successfully.',
          lead: updated
        }
      };
    }

    // -------------------------------------------------------------
    // Route 5: DELETE /api/crm/leads/:id
    // -------------------------------------------------------------
    const delMatch = path.match(/^\/api\/crm\/leads\/([a-zA-Z0-9_\-]+)$/);
    if (method === 'DELETE' && delMatch) {
      const leadId = delMatch[1];
      await service.deleteLead(userId, leadId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          message: 'Lead deleted successfully.',
          leadId
        }
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: { success: false, error: `CRM route ${method} ${path} not found.` }
    };

  } catch (err) {
    const statusCode = err.statusCode || (err.status ? err.status : 500);
    return {
      statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: false,
        error: statusCode === 500 ? 'An unexpected CRM service error occurred.' : err.message
      }
    };
  }
}

/**
 * Handle Node.js http.IncomingMessage (used by serve.js and local test server).
 * @param {import('node:http').IncomingMessage} req 
 * @param {import('node:http').ServerResponse} res 
 */
export async function handleNodeCrmHttpRequest(req, res, service = crmService) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = urlObj.pathname;

  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
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

  const query = {};
  urlObj.searchParams.forEach((val, key) => {
    query[key] = val;
  });

  const reqObj = {
    method: req.method,
    path: pathname,
    headers: req.headers,
    body,
    query,
    ip: clientIp,
    userAgent: req.headers['user-agent'] || ''
  };

  const response = await dispatchCrmRoute(reqObj, service);

  res.writeHead(response.statusCode, response.headers);
  res.end(JSON.stringify(response.body));
}

/**
 * AWS Lambda Handler for API Gateway v2.0 or Lambda Function URL.
 * @param {object} event 
 * @returns {Promise<object>}
 */
export async function handleLambdaCrmEvent(event, service = crmService) {
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/api/crm/leads';
  const headers = { ...(event.headers || {}) };

  const workerAuth = validateWorkerSecret(headers);
  if (!workerAuth.valid) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: workerAuth.reason })
    };
  }

  let clientIp;
  if (workerAuth.isWorkerVerified && headers['x-forwarded-for']) {
    clientIp = headers['x-forwarded-for'].split(',')[0].trim();
  } else {
    clientIp = event.requestContext?.http?.sourceIp || '127.0.0.1';
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

  const response = await dispatchCrmRoute(reqObj, service);

  return {
    statusCode: response.statusCode,
    headers: { ...response.headers },
    body: JSON.stringify(response.body)
  };
}
