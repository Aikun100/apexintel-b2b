/**
 * ApexIntel B2B - Cloudflare Worker Entry Point
 * 
 * Responsibilities:
 * 1. Intercepts all '/api/*' routes and forwards them to AWS Lambda / API Gateway backend
 * 2. Overwrites X-Forwarded-For with trusted Cloudflare client IP (CF-Connecting-IP)
 * 3. Injects Worker-to-Lambda shared secret (x-apexintel-worker-secret) for origin protection
 * 4. Preserves raw body for Stripe webhook signatures and all HttpOnly Set-Cookie headers
 * 5. Returns clean 404 JSON for unknown /api/* routes (never leaks into static assets)
 * 6. Enforces enterprise security headers (HSTS, nosniff, DENY, CSP, Referrer-Policy)
 * 7. Serves static SPA assets from './public' via env.ASSETS for non-API routes
 */

const ALLOWED_ORIGINS = new Set([
  'https://apexintel-b2b.shop',
  'https://www.apexintel-b2b.shop',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

function applySecurityHeaders(headers, isHtml = false) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isHtml) {
    // Compatible CSP permitting Tailwind CDN and inline scripts/styles while blocking clickjacking & plugins
    headers.set('Content-Security-Policy', "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none'; object-src 'none';");
  }
  return headers;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. API Route Interception & Forwarding
    if (url.pathname.startsWith('/api/')) {
      const isKnownApiRoute = 
        url.pathname.startsWith('/api/auth/') || 
        url.pathname.startsWith('/api/crm/') || 
        url.pathname.startsWith('/api/orders') || 
        url.pathname.startsWith('/api/webhooks/') || 
        url.pathname.startsWith('/api/downloads/') || 
        url.pathname.startsWith('/api/discovery/') || 
        url.pathname.startsWith('/api/admin/') || 
        url.pathname.startsWith('/api/tools/') || 
        url.pathname.startsWith('/api/requests/');

      // Unknown /api/* route -> fail closed with 404 JSON
      if (!isKnownApiRoute) {
        const errorHeaders = new Headers({ 'Content-Type': 'application/json' });
        applySecurityHeaders(errorHeaders, false);
        return new Response(JSON.stringify({
          success: false,
          error: `API endpoint '${url.pathname}' not found.`
        }), {
          status: 404,
          headers: errorHeaders
        });
      }

      const backendUrl = env.BACKEND_AUTH_URL || env.AWS_LAMBDA_AUTH_URL || env.BACKEND_API_URL;

      // In production with configured backend: proxy request directly to AWS Lambda / API Gateway
      if (backendUrl) {
        const targetUrl = new URL(url.pathname + url.search, backendUrl);
        const headers = new Headers(request.headers);

        // Security: Trusted Client IP Forwarding
        const clientIp = request.headers.get('CF-Connecting-IP') || '';
        if (clientIp) {
          headers.set('X-Forwarded-For', clientIp);
        } else {
          headers.delete('X-Forwarded-For');
        }

        // Security: Worker-to-Lambda Origin Protection
        if (env.WORKER_BACKEND_SECRET) {
          headers.set('x-apexintel-worker-secret', env.WORKER_BACKEND_SECRET);
        }

        headers.set('X-Forwarded-Host', url.host);
        headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

        const init = {
          method: request.method,
          headers,
          redirect: 'manual'
        };

        // Preserve raw binary/text body (crucial for Stripe webhook cryptographic signature verification)
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          init.body = request.body;
        }

        try {
          const backendResponse = await fetch(targetUrl.toString(), init);
          const responseHeaders = new Headers(backendResponse.headers);

          // Apply security headers
          applySecurityHeaders(responseHeaders, false);

          return new Response(backendResponse.body, {
            status: backendResponse.status,
            statusText: backendResponse.statusText,
            headers: responseHeaders
          });
        } catch (err) {
          const errHeaders = new Headers({ 'Content-Type': 'application/json' });
          applySecurityHeaders(errHeaders, false);
          return new Response(JSON.stringify({
            success: false,
            error: 'Backend API gateway unavailable. Please retry shortly.'
          }), {
            status: 502,
            headers: errHeaders
          });
        }
      }

      // If backend URL is not configured yet in local/preview worker
      const unconfigHeaders = new Headers({ 'Content-Type': 'application/json' });
      applySecurityHeaders(unconfigHeaders, false);
      return new Response(JSON.stringify({
        success: false,
        error: 'BACKEND_AUTH_URL environment secret is not configured in this Worker environment.'
      }), {
        status: 503,
        headers: unconfigHeaders
      });
    }

    // 2. Delegate non-API routes to static asset handler with security headers
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const assetResponse = await env.ASSETS.fetch(request);
      const isHtml = (assetResponse.headers.get('Content-Type') || '').includes('text/html') || url.pathname === '/' || url.pathname.endsWith('.html');
      const secureHeaders = new Headers(assetResponse.headers);
      applySecurityHeaders(secureHeaders, isHtml);

      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: secureHeaders
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
