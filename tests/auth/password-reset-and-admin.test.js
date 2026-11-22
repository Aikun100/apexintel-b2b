/**
 * ApexIntel B2B - Password Reset, Change, and Admin Provisioning Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuthRepository } from '../../src/auth/repository.js';
import { RateLimiter } from '../../src/auth/rate-limiter.js';
import { AuditLogger } from '../../src/auth/audit-logger.js';
import { AuthService } from '../../src/auth/service.js';

function setup() {
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

test('Password Change Suite', async (t) => {
  const { service, repository } = setup();

  const reg = await service.register({
    email: 'change@apexintel.io',
    password: 'InitialPassword2026!'
  });

  await t.test('changing password with correct current password succeeds and rotates session', async () => {
    const res = await service.changePassword(reg.rawToken, {
      currentPassword: 'InitialPassword2026!',
      newPassword: 'BrandNewPassword2026!',
      newPasswordConfirmation: 'BrandNewPassword2026!'
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.newRawToken);
    assert.notStrictEqual(res.newRawToken, reg.rawToken, 'Session token must rotate');

    // Old token must now fail
    await assert.rejects(async () => {
      await service.getMe(reg.rawToken);
    }, /revoked/);

    // New token must authenticate
    const profile = await service.getMe(res.newRawToken);
    assert.strictEqual(profile.email, 'change@apexintel.io');

    // Logging in with old password must fail
    await assert.rejects(async () => {
      await service.login({ email: 'change@apexintel.io', password: 'InitialPassword2026!' });
    }, /Invalid email or password/);

    // Logging in with new password must succeed
    const newLogin = await service.login({ email: 'change@apexintel.io', password: 'BrandNewPassword2026!' });
    assert.ok(newLogin.rawToken);
  });

  await t.test('changing password with wrong current password fails', async () => {
    const reg2 = await service.register({
      email: 'wrongpass@apexintel.io',
      password: 'CorrectOldPass2026!'
    });

    await assert.rejects(async () => {
      await service.changePassword(reg2.rawToken, {
        currentPassword: 'WrongPassword2026!',
        newPassword: 'NewValidPassword2026!',
        newPasswordConfirmation: 'NewValidPassword2026!'
      });
    }, err => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Current password is incorrect/);
      return true;
    });
  });
});

test('Password Reset Suite', async (t) => {
  const { service, repository, auditLogs } = setup();

  await service.register({
    email: 'resetme@apexintel.io',
    password: 'OriginalPassword2026!'
  });

  await t.test('forgotPassword returns generic message without enumerating user', async () => {
    const res1 = await service.forgotPassword('resetme@apexintel.io');
    assert.strictEqual(res1.success, true);
    assert.match(res1.message, /instructions have been dispatched/);

    const res2 = await service.forgotPassword('nonexistent-ghost@apexintel.io');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res1.message, res2.message, 'Messages must be identical');
  });

  await t.test('resetPassword with valid token updates password and invalidates token', async () => {
    // Generate reset token directly in repository for test
    const rawResetToken = 'test-raw-reset-token-1234567890abcdef';
    const crypto = await import('node:crypto');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const user = await repository.findUserByNormalizedEmail('resetme@apexintel.io');

    await repository.createPasswordResetToken({
      tokenHash,
      userId: user.userId,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    const res = await service.resetPassword({
      resetToken: rawResetToken,
      newPassword: 'ResetApproved2026!',
      newPasswordConfirmation: 'ResetApproved2026!'
    });

    assert.strictEqual(res.success, true);

    // Verify token cannot be reused
    await assert.rejects(async () => {
      await service.resetPassword({
        resetToken: rawResetToken,
        newPassword: 'AnotherPassword2026!',
        newPasswordConfirmation: 'AnotherPassword2026!'
      });
    }, /invalid or has already been used/);

    // Verify new password works
    const loginRes = await service.login({
      email: 'resetme@apexintel.io',
      password: 'ResetApproved2026!'
    });
    assert.ok(loginRes.rawToken);
  });
});
