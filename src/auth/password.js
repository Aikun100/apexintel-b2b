/**
 * ApexIntel B2B - Cryptographic Password Utilities
 * Native Node.js crypto using scrypt + timing-safe verification.
 * 
 * Features:
 * - 32-byte cryptographically secure random salt
 * - scrypt memory-hard key derivation (N=16384, r=8, p=1, keylen=64)
 * - Versioned hash serialization: scrypt$N=16384,r=8,p=1$<salt_hex>$<key_hex>
 * - Constant-time comparison via crypto.timingSafeEqual
 * - Password policy validation (12-128 chars, passphrases permitted)
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

export const PASSWORD_POLICY = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
  DEFAULT_N: 16384,
  DEFAULT_R: 8,
  DEFAULT_P: 1,
  DEFAULT_KEYLEN: 64,
  SALT_BYTE_LENGTH: 32
};

/**
 * Validate password against production security policy.
 * @param {string} password 
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePasswordPolicy(password) {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password must be a valid string.' };
  }
  if (password.length < PASSWORD_POLICY.MIN_LENGTH) {
    return { 
      valid: false, 
      message: `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long.` 
    };
  }
  if (password.length > PASSWORD_POLICY.MAX_LENGTH) {
    return { 
      valid: false, 
      message: `Password cannot exceed ${PASSWORD_POLICY.MAX_LENGTH} characters.` 
    };
  }
  return { valid: true };
}

/**
 * Hash a password using scrypt with a unique cryptographically random salt.
 * @param {string} password 
 * @param {object} [options]
 * @returns {Promise<{ hash: string, salt: string }>}
 */
export async function hashPassword(password, options = {}) {
  const policyCheck = validatePasswordPolicy(password);
  if (!policyCheck.valid) {
    throw new Error(policyCheck.message);
  }

  const N = options.N || PASSWORD_POLICY.DEFAULT_N;
  const r = options.r || PASSWORD_POLICY.DEFAULT_R;
  const p = options.p || PASSWORD_POLICY.DEFAULT_P;
  const keylen = options.keylen || PASSWORD_POLICY.DEFAULT_KEYLEN;

  const saltBuffer = crypto.randomBytes(PASSWORD_POLICY.SALT_BYTE_LENGTH);
  const derivedKey = await scryptAsync(password, saltBuffer, keylen, { N, r, p });

  const saltHex = saltBuffer.toString('hex');
  const keyHex = derivedKey.toString('hex');
  const serialized = `scrypt$N=${N},r=${r},p=${p}$${saltHex}$${keyHex}`;

  return {
    hash: serialized,
    salt: saltHex
  };
}

/**
 * Verify a candidate password against a stored scrypt serialized hash in constant time.
 * @param {string} candidatePassword 
 * @param {string} storedHash 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(candidatePassword, storedHash) {
  if (!candidatePassword || !storedHash || typeof candidatePassword !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') {
    return false;
  }

  const paramsStr = parts[1]; // e.g. "N=16384,r=8,p=1"
  const saltHex = parts[2];
  const expectedKeyHex = parts[3];

  const params = {};
  paramsStr.split(',').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v) params[k] = parseInt(v, 10);
  });

  const N = params.N || PASSWORD_POLICY.DEFAULT_N;
  const r = params.r || PASSWORD_POLICY.DEFAULT_R;
  const p = params.p || PASSWORD_POLICY.DEFAULT_P;
  const keylen = Buffer.from(expectedKeyHex, 'hex').length;

  try {
    const saltBuffer = Buffer.from(saltHex, 'hex');
    const expectedKeyBuffer = Buffer.from(expectedKeyHex, 'hex');

    const derivedKey = await scryptAsync(candidatePassword, saltBuffer, keylen, { N, r, p });

    if (derivedKey.length !== expectedKeyBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedKeyBuffer);
  } catch (err) {
    return false;
  }
}
