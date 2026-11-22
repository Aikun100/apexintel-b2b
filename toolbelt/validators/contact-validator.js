import dns from 'node:dns/promises';
import validator from 'validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Validates an email address via format validation and domain MX record lookup.
 * @param {string} email
 * @returns {Promise<{ valid: boolean, reason?: string, mx?: string[] }>}
 */
export async function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Empty or non-string email' };
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!validator.isEmail(cleanEmail)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  const domain = cleanEmail.split('@')[1];
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: 'No MX records found for domain' };
    }
    return {
      valid: true,
      mx: mxRecords.map(r => r.exchange),
      cleanEmail
    };
  } catch (err) {
    return { valid: false, reason: `DNS MX check failed: ${err.code || err.message}` };
  }
}

/**
 * Validates and formats a phone number.
 * @param {string} phone
 * @param {string} [countryCode='US']
 * @returns {{ valid: boolean, formatted?: string, uri?: string, national?: string }}
 */
export function validatePhone(phone, countryCode = 'US') {
  if (!phone || typeof phone !== 'string') {
    return { valid: false };
  }

  try {
    const parsed = parsePhoneNumberFromString(phone, countryCode);
    if (parsed && parsed.isValid()) {
      return {
        valid: true,
        formatted: parsed.formatInternational(),
        national: parsed.formatNational(),
        uri: parsed.getURI()
      };
    }
  } catch {
    // ignore parse error
  }

  return { valid: false };
}
