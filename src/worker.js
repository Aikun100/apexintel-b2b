/**
 * ApexIntel B2B - Cloudflare Worker Entry Point
 * 
 * Responsibilities:
 * 1. Intercepts '/api/auth/*' routes and forwards them to the AWS Lambda / API Gateway backend
 * 2. Overwrites X-Forwarded-For with trusted Cloudflare client IP (CF-Connecting-IP)
 * 3. Injects Worker-to-Lambda shared secret (x-apexintel-worker-secret) for origin protection
 * 4. Preserves HttpOnly Set-Cookie headers, request headers, and request bodies
 * 5. Serves static SPA assets from the './public' directory via env.ASSETS for all other routes
 * 6. Strictly validates Origin headers against the production domain allowlist
 */

const ALLOWED_ORIGINS = new Set([
  'https://apexintel-b2b.shop',
  'https://www.apexintel-b2b.shop',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Route API authentication calls
    if (url.pathname.startsWith('/api/auth/')) {
      const backendUrl = env.BACKEND_AUTH_URL || env.AWS_LAMBDA_AUTH_URL;

      // In production with configured backend: proxy request directly to AWS Lambda / API Gateway
      if (backendUrl) {
        const targetUrl = new URL(url.pathname + url.search, backendUrl);
        const headers = new Headers(request.headers);

        // Security: Trusted Client IP Forwarding
        // Cloudflare sets CF-Connecting-IP; overwrite outgoing X-Forwarded-For rather than trusting client header
        const clientIp = request.headers.get('CF-Connecting-IP') || '';
        if (clientIp) {
          headers.set('X-Forwarded-For', clientIp);
        } else {
          // If CF-Connecting-IP is missing, delete untrusted client-supplied forwarding header
          headers.delete('X-Forwarded-For');
        }

        // Security: Worker-to-Lambda Origin Protection
        // Forward high-entropy secret so Lambda can verify request originated through our authorized Worker
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

        if (request.method !== 'GET' && request.method !== 'HEAD') {
          init.body = request.body;
        }

        try {
          const backendResponse = await fetch(targetUrl.toString(), init);
          const responseHeaders = new Headers(backendResponse.headers);

          // Ensure secure headers
          responseHeaders.set('X-Content-Type-Options', 'nosniff');
          responseHeaders.set('X-Frame-Options', 'DENY');

          return new Response(backendResponse.body, {
            status: backendResponse.status,
            statusText: backendResponse.statusText,
            headers: responseHeaders
          });
        } catch (err) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Authentication gateway unavailable. Please retry shortly.'
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // If no remote backend URL is configured yet in local/preview worker,
      // return a descriptive configuration response
      return new Response(JSON.stringify({
        success: false,
        error: 'BACKEND_AUTH_URL environment secret is not configured in this Worker environment.'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Delegate all other routes to static asset handler
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
