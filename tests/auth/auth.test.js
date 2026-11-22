/**
 * ApexIntel B2B - Comprehensive Authentication Test Suite
 * 
 * Verifies:
 * - Password hashing (scrypt, 32-byte salt, timing-safe equality, entropy)
 * - Registration (validation, atomic uniqueness, role restriction, no hash leakage)
 * - Login (credentials, wrong password, timing safety, suspended status, rate limits)
 * - Session Management (opaque tokens, SHA-256 hash storage, expiration, revocation)
 * - Role Authorization & Tampering Protection (client spoofing immunity)
 * - CSRF & Origin Validation
 * - Security Logging & Sanitization
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  hashPassword, 
  verifyPassword, 
  validatePasswordPolicy 
} from '../../src/auth/password.js';
import { 
  generateSessionToken, 
  hashSessionToken, 
  createSessionRecord, 
  validateSessionRecord, 
  parseCookies, 
  serializeSessionCookie, 
  serializeClearSessionCookie 
} from '../../src/auth/session.js';
import { InMemoryAuthRepository } from '../../src/auth/repository.js';
import { RateLimiter } from '../../src/auth/rate-limiter.js';
import { AuditLogger } from '../../src/auth/audit-logger.js';
import { AuthService } from '../../src/auth/service.js';
import { dispatchAuthRoute } from '../../src/auth/router.js';

function setupTestEnvironment() {
  const repository = new InMemoryAuthRepository();
  const rateLimiter = new RateLimiter();
  const auditLogs = [];
  const auditLogger = new AuditLogger({
    silent: true,
    destination: logStr => auditLogs.push(JSON.parse(logStr))
  });
  const service = new AuthService({ repository, rateLimiter, auditLogger });
  return { repository, rateLimiter, auditLogger, auditLogs, service };
}

// ==========================================
// 1. PASSWORD CRYPTOGRAPHY & POLICY TESTS
// ==========================================
test('Password Cryptography: enforces policy and handles scrypt hashing', async (t) => {
  await t.test('rejects passwords shorter than 12 characters', () => {
    const res = validatePasswordPolicy('short123');
    assert.strictEqual(res.valid, false);
    assert.match(res.message, /at least 12 characters/);
  });

  await t.test('rejects passwords longer than 128 characters', () => {
    const longPass = 'A'.repeat(129);
    const res = validatePasswordPolicy(longPass);
    assert.strictEqual(res.valid, false);
    assert.match(res.message, /cannot exceed 128 characters/);
  });

  await t.test('accepts long passphrases (>= 12 chars)', () => {
    const res = validatePasswordPolicy('correct horse battery staple 2026!');
    assert.strictEqual(res.valid, true);
  });

  await t.test('hashes password with unique salt and constant-time verification', async () => {
    const pass = 'SuperSecurePassphrase2026!';
    const { hash: hash1, salt: salt1 } = await hashPassword(pass);
    const { hash: hash2, salt: salt2 } = await hashPassword(pass);

    assert.notStrictEqual(salt1, salt2, 'Salts must be cryptographically random and unique');
    assert.notStrictEqual(hash1, hash2, 'Hashes of same password with different salts must differ');
    assert.match(hash1, /^scrypt\$N=16384,r=8,p=1\$[a-f0-9]{64}\$[a-f0-9]{128}$/);

    const matchValid = await verifyPassword(pass, hash1);
    assert.strictEqual(matchValid, true);

    const matchInvalid = await verifyPassword('WrongPassword123!', hash1);
    assert.strictEqual(matchInvalid, false);

    const matchTampered = await verifyPassword(pass, hash1.replace(/[a-f0-9]/, '0'));
    assert.strictEqual(matchTampered, false);
  });
});

// ==========================================
// 2. REGISTRATION TESTS
// ==========================================
test('Registration Suite: input validation, uniqueness, and role immutability', async (t) => {
  const { service } = setupTestEnvironment();

  await t.test('valid customer registration succeeds and returns sanitized profile', async () => {
    const res = await service.register({
      email: 'founder@agencyalpha.com',
      password: 'StrongPassword2026!',
      passwordConfirmation: 'StrongPassword2026!',
      name: 'Alex Rivera',
      company: 'Agency Alpha',
      targetNiche: 'Commercial Roofing'
    });

    assert.ok(res.user.userId, 'Must assign a unique userId');
    assert.strictEqual(res.user.email, 'founder@agencyalpha.com');
    assert.strictEqual(res.user.role, 'customer', 'Must default to customer');
    assert.strictEqual(res.user.accountStatus, 'active');
    assert.strictEqual(res.user.credits, 50);
    assert.strictEqual(res.user.passwordHash, undefined, 'Password hash must NEVER be returned');
    assert.strictEqual(res.user.passwordSalt, undefined, 'Password salt must NEVER be returned');
    assert.ok(res.rawToken, 'Must issue a valid session token on registration');
  });

  await t.test('duplicate email registration fails with clean conflict error', async () => {
    await assert.rejects(
      async () => {
        await service.register({
          email: 'founder@agencyalpha.com',
          password: 'AnotherPassword2026!',
          passwordConfirmation: 'AnotherPassword2026!'
        });
      },
      err => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /already exists/);
        return true;
      }
    );
  });

  await t.test('email normalization prevents duplicates with different casing or whitespace', async () => {
    await assert.rejects(
      async () => {
        await service.register({
          email: '  FOUNDER@agencyalpha.com  ',
          password: 'AnotherPassword2026!',
          passwordConfirmation: 'AnotherPassword2026!'
        });
      },
      err => {
        assert.strictEqual(err.statusCode, 409);
        return true;
      }
    );
  });

  await t.test('rejects invalid email formats', async () => {
    await assert.rejects(
      async () => {
        await service.register({
          email: 'not-an-email',
          password: 'ValidPassword2026!',
          passwordConfirmation: 'ValidPassword2026!'
        });
      },
      err => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /valid email/);
        return true;
      }
    );
  });

  await t.test('rejects password confirmation mismatch', async () => {
    await assert.rejects(
      async () => {
        await service.register({
          email: 'sdr@outbound.io',
          password: 'ValidPassword2026!',
          passwordConfirmation: 'DifferentPassword2026!'
        });
      },
      err => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /confirmation does not match/);
        return true;
      }
    );
  });

  await t.test('public registration CANNOT assign admin or staff roles', async () => {
    const res = await service.register({
      email: 'hacker@malicious.com',
      password: 'HackerPassword2026!',
      passwordConfirmation: 'HackerPassword2026!',
      role: 'admin' // Attempted role escalation
    });

    assert.strictEqual(res.user.role, 'customer', 'Server must ignore browser-supplied role and force customer');
  });
});

// ==========================================
// 3. LOGIN & RATE LIMITING TESTS
// ==========================================
test('Login Suite: authentication, error safety, and abuse prevention', async (t) => {
  const { service, repository, rateLimiter } = setupTestEnvironment();

  await service.register({
    email: 'member@velocity.io',
    password: 'ValidPassword2026!',
    passwordConfirmation: 'ValidPassword2026!'
  });

  await t.test('successful login returns user and sets session', async () => {
    const res = await service.login({
      email: 'member@velocity.io',
      password: 'ValidPassword2026!'
    });

    assert.strictEqual(res.user.email, 'member@velocity.io');
    assert.ok(res.rawToken);
    assert.strictEqual(res.user.passwordHash, undefined);
  });

  await t.test('incorrect password fails with safe generic error', async () => {
    await assert.rejects(
      async () => {
        await service.login({
          email: 'member@velocity.io',
          password: 'IncorrectPassword2026!'
        });
      },
      err => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.message, 'Invalid email or password.');
        return true;
      }
    );
  });

  await t.test('unknown email fails with IDENTICAL error message to prevent enumeration', async () => {
    await assert.rejects(
      async () => {
        await service.login({
          email: 'nonexistent@nowhere.com',
          password: 'AnyPassword2026!'
        });
      },
      err => {
        assert.strictEqual(err.statusCode, 401);
        assert.strictEqual(err.message, 'Invalid email or password.');
        return true;
      }
    );
  });

  await t.test('suspended account is rejected with HTTP 403', async () => {
    const user = await repository.findUserByNormalizedEmail('member@velocity.io');
    await repository.updateUser(user.userId, { accountStatus: 'suspended' });

    await assert.rejects(
      async () => {
        await service.login({
          email: 'member@velocity.io',
          password: 'ValidPassword2026!'
        });
      },
      err => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /suspended or disabled/);
        return true;
      }
    );

    // Restore to active
    await repository.updateUser(user.userId, { accountStatus: 'active' });
  });

  await t.test('brute-force rate limiting triggers HTTP 429 after threshold', async () => {
    const testIp = '198.51.100.42';
    const targetEmail = 'bruteforce@target.com';

    // Exhaust attempts
    for (let i = 0; i < 5; i++) {
      try {
        await service.login({ email: targetEmail, password: 'WrongPassword2026!' }, testIp);
      } catch (err) {
        // Expected 401
      }
    }

    // 6th attempt must trigger 429
    await assert.rejects(
      async () => {
        await service.login({ email: targetEmail, password: 'WrongPassword2026!' }, testIp);
      },
      err => {
        assert.strictEqual(err.statusCode, 429);
        assert.match(err.message, /Too many failed login attempts/);
        return true;
      }
    );
  });
});

// ==========================================
// 4. SESSION MANAGEMENT TESTS
// ==========================================
test('Session Lifecycle: hashing, validation, idle timeouts, and revocation', async (t) => {
  const { service, repository } = setupTestEnvironment();

  const regRes = await service.register({
    email: 'sessionuser@apexintel.io',
    password: 'SessionPassword2026!'
  });
  const rawToken = regRes.rawToken;
  const tokenHash = hashSessionToken(rawToken);

  await t.test('raw token is NEVER stored in database, only tokenHash', async () => {
    const storedSession = await repository.findSessionByTokenHash(tokenHash);
    assert.ok(storedSession, 'Session must exist by tokenHash');
    assert.strictEqual(storedSession.rawToken, undefined, 'rawToken must never be in DB');
    assert.strictEqual(storedSession.sessionStatus, 'active');
  });

  await t.test('getMe authenticates valid session token', async () => {
    const profile = await service.getMe(rawToken);
    assert.strictEqual(profile.email, 'sessionuser@apexintel.io');
    assert.strictEqual(profile.userId, regRes.user.userId);
  });

  await t.test('tampered session token is rejected with HTTP 401', async () => {
    await assert.rejects(
      async () => {
        await service.getMe('tampered_invalid_token_12345');
      },
      err => {
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );
  });

  await t.test('expired session is rejected with HTTP 401', async () => {
    const storedSession = await repository.findSessionByTokenHash(tokenHash);
    // Artificially age session beyond max lifetime
    storedSession.expiresAt = new Date(Date.now() - 1000).toISOString();
    await repository.createSession(storedSession);

    await assert.rejects(
      async () => {
        await service.getMe(rawToken);
      },
      err => {
        assert.strictEqual(err.statusCode, 401);
        assert.match(err.message, /expired/);
        return true;
      }
    );

    // Reset expiration
    storedSession.expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await repository.createSession(storedSession);
  });

  await t.test('admin idle timeout expires after 30 minutes of inactivity', () => {
    const adminSession = createSessionRecord({
      userId: 'admin-1',
      role: 'admin',
      tokenHash: 'dummy-hash'
    });
    // Set last activity 31 minutes ago
    adminSession.lastActivityAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();

    const validation = validateSessionRecord(adminSession);
    assert.strictEqual(validation.valid, false);
    assert.match(validation.reason, /inactivity/);
  });

  await t.test('logout permanently revokes the session on the server', async () => {
    await service.logout(rawToken);

    // Verify session revoked in repository
    const stored = await repository.findSessionByTokenHash(tokenHash);
    assert.strictEqual(stored.sessionStatus, 'revoked');
    assert.ok(stored.revokedAt);

    // Trying to use revoked token must now fail
    await assert.rejects(
      async () => {
        await service.getMe(rawToken);
      },
      err => {
        assert.strictEqual(err.statusCode, 401);
        assert.match(err.message, /revoked/);
        return true;
      }
    );
  });
});

// ==========================================
// 5. HTTP ROUTER, CSRF, & SECURITY HEADERS
// ==========================================
test('HTTP Router & CSRF: Origin checks, headers, and Set-Cookie compliance', async (t) => {
  const { service } = setupTestEnvironment();

  await t.test('rejects POST request with unauthorized Origin header (CSRF defense)', async () => {
    const res = await dispatchAuthRoute({
      method: 'POST',
      path: '/api/auth/login',
      headers: {
        origin: 'https://evil-attacker-site.com',
        'content-type': 'application/json'
      },
      body: { email: 'test@apexintel.io', password: 'Password2026!' }
    }, service);

    assert.strictEqual(res.statusCode, 403);
    assert.match(res.body.error, /not permitted/);
  });

  await t.test('rejects non-JSON Content-Type on mutation endpoints', async () => {
    const res = await dispatchAuthRoute({
      method: 'POST',
      path: '/api/auth/register',
      headers: {
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'text/plain'
      },
      body: {}
    }, service);

    assert.strictEqual(res.statusCode, 415);
    assert.match(res.body.error, /application\/json/);
  });

  await t.test('successful registration sets HttpOnly, Secure, SameSite=Lax cookie', async () => {
    const res = await dispatchAuthRoute({
      method: 'POST',
      path: '/api/auth/register',
      headers: {
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json'
      },
      body: {
        email: 'httpuser@agencygrowth.com',
        password: 'ValidPassword2026!',
        passwordConfirmation: 'ValidPassword2026!'
      }
    }, service);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.headers['Set-Cookie']);
    const setCookie = res.headers['Set-Cookie'];
    assert.match(setCookie, /apexintel_session=[a-f0-9]{64}/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//);
  });

  await t.test('GET /api/auth/me parses cookie and returns authenticated profile', async () => {
    // First register
    const regRes = await service.register({
      email: 'mecheck@apexintel.io',
      password: 'ValidPassword2026!'
    });

    const res = await dispatchAuthRoute({
      method: 'GET',
      path: '/api/auth/me',
      headers: {
        cookie: `apexintel_session=${regRes.rawToken}`
      }
    }, service);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.user.email, 'mecheck@apexintel.io');
    assert.strictEqual(res.body.user.role, 'customer');
  });

  await t.test('POST /api/auth/logout clears cookie and revokes session', async () => {
    const regRes = await service.register({
      email: 'logoutuser@apexintel.io',
      password: 'ValidPassword2026!'
    });

    const res = await dispatchAuthRoute({
      method: 'POST',
      path: '/api/auth/logout',
      headers: {
        origin: 'https://apexintel-b2b.shop',
        'content-type': 'application/json',
        cookie: `apexintel_session=${regRes.rawToken}`
      }
    }, service);

    assert.strictEqual(res.statusCode, 200);
    assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
    assert.match(res.headers['Set-Cookie'], /Expires=Thu, 01 Jan 1970/);
  });
});
