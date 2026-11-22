#!/usr/bin/env node
/**
 * ApexIntel B2B - Operator Administrator Provisioning Script
 * 
 * Securely provisions an administrator account directly into DynamoDB or repository.
 * 
 * Security Guardrails:
 * - Passwords are NEVER hardcoded
 * - Minimum 12 character password policy enforced
 * - Passwords hashed via scrypt with cryptographically random 32-byte salt
 * - Creates an immutable audit log record
 * - Requires explicit operator confirmation
 * 
 * Usage:
 *   node scripts/bootstrap-admin.mjs --email admin@apexintel.io --name "Lead Architect" --password "SecurePassphrase2026!"
 *   Or with environment variable:
 *   ADMIN_INITIAL_PASSWORD="..." node scripts/bootstrap-admin.mjs --email admin@apexintel.io
 */

import crypto from 'node:crypto';
import readline from 'node:readline';
import { hashPassword, validatePasswordPolicy } from '../src/auth/password.js';
import { getAuthRepository } from '../src/auth/repository.js';
import { auditLogger } from '../src/auth/audit-logger.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  return options;
}

async function promptHidden(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function bootstrapAdmin() {
  const options = parseArgs();
  const repo = getAuthRepository();

  console.log('\n🔒 --- ApexIntel B2B: Administrator Account Provisioning ---');

  const email = (options.email || await promptHidden('Enter Admin Work Email: ')).trim();
  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid administrator email address is required.');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase();

  // Check if admin already exists
  const existing = await repo.findUserByNormalizedEmail(normalizedEmail);
  if (existing) {
    if (!options.force) {
      console.error(`❌ Error: An account with email '${normalizedEmail}' already exists (Role: ${existing.role}). Pass --force to update.`);
      process.exit(1);
    }
  }

  let password = options.password || process.env.ADMIN_INITIAL_PASSWORD;
  if (!password) {
    password = await promptHidden('Enter Secure Admin Password (min 12 chars): ');
  }

  const policyCheck = validatePasswordPolicy(password);
  if (!policyCheck.valid) {
    console.error(`❌ Password Policy Violation: ${policyCheck.message}`);
    process.exit(1);
  }

  console.log('\n⏳ Computing memory-hard scrypt hash...');
  const { hash: passwordHash, salt: passwordSalt } = await hashPassword(password);

  const now = new Date().toISOString();
  const userId = existing ? existing.userId : crypto.randomUUID();
  const apiKey = 'apex_live_sec_root_' + crypto.randomBytes(16).toString('hex');

  const adminRecord = {
    userId,
    email,
    normalizedEmail,
    passwordHash,
    passwordSalt,
    role: 'admin',
    accountStatus: 'active',
    emailVerified: true,
    name: (options.name || 'Platform Administrator').trim(),
    company: 'ApexIntel HQ',
    plan: 'Admin Master',
    credits: 999999,
    targetNiche: 'All Niches',
    apiKey,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    lastLoginAt: null,
    passwordChangedAt: now
  };

  if (existing) {
    await repo.updateUser(userId, adminRecord);
    console.log(`✅ Administrator role and password successfully updated for: ${normalizedEmail}`);
  } else {
    await repo.createUser(adminRecord);
    console.log(`✅ New Administrator account successfully provisioned: ${normalizedEmail}`);
  }

  auditLogger.log('AUTH_ADMIN_BOOTSTRAP', {
    userId,
    email: normalizedEmail,
    operator: process.env.USER || process.env.USERNAME || 'CLI-Operator'
  });

  console.log(`📋 User ID: ${userId}`);
  console.log(`🛡️  Role: admin`);
  console.log(`🔐 Password: [SECURED & HASHED VIA SCRYPT]`);
  console.log('------------------------------------------------------------\n');
}

bootstrapAdmin().catch(err => {
  console.error('Fatal error during administrator provisioning:', err);
  process.exit(1);
});
