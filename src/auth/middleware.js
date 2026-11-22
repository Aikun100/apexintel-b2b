/**
 * ApexIntel B2B - Authentication Middleware for Protected APIs
 * 
 * Verifies session cookies against server-authoritative DynamoDB sessions
 * and attaches verified user identity context (userId, email, role).
 */

import { authService } from './service.js';
import { SESSION_CONFIG, parseCookies } from './session.js';

/**
 * Authenticate an incoming request object via HttpOnly session cookie.
 * @param {object} reqObj - Normalized request { headers, cookies, ... }
 * @param {import('./service.js').AuthService} [service]
 * @returns {Promise<{ authenticated: boolean, user?: object, statusCode?: number, error?: string }>}
 */
export async function authenticateSession(reqObj, service = authService) {
  const headers = reqObj.headers || {};
  
  let cookieHeader = headers.cookie || headers.Cookie || '';
  if (!cookieHeader && Array.isArray(reqObj.cookies)) {
    cookieHeader = reqObj.cookies.join('; ');
  }

  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[SESSION_CONFIG.COOKIE_NAME];

  if (!sessionToken || typeof sessionToken !== 'string') {
    return {
      authenticated: false,
      statusCode: 401,
      error: 'Authentication required. Please sign in to access CRM intelligence.'
    };
  }

  try {
    const user = await service.getMe(sessionToken);
    if (!user || !user.userId) {
      return {
        authenticated: false,
        statusCode: 401,
        error: 'Session invalid or expired. Please sign in again.'
      };
    }

    return {
      authenticated: true,
      user
    };
  } catch (err) {
    const statusCode = err.statusCode || 401;
    return {
      authenticated: false,
      statusCode,
      error: err.message || 'Authentication required.'
    };
  }
}
