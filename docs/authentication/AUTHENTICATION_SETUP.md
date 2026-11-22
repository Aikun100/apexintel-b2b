# ApexIntel B2B — Authentication Setup & Local Development Guide

**Task ID:** APEX-P0-01  
**Scope:** Local Development, AWS Infrastructure Setup, and Test Execution

---

## 1. Quick Start: Local Development

The project includes an in-memory repository adapter allowing instant local development and manual testing without live AWS credentials.

### 1.1 Start the Local Server
```bash
# 1. Start the server (runs on port 3000)
node serve.js
```

### 1.2 Access the Application
1. Open your browser and navigate to:
   `http://localhost:3000`
2. Click **Sign In** in the top navigation bar.
3. Test with the pre-seeded local development accounts:
   - **Alex (Customer Pro):** `alex@velocitygrowth.io` / `ApexDemo2026!`
   - **Sarah (Growth SDR):** `sarah@outboundsprint.com` / `ApexDemo2026!`
   - **Platform Admin:** `admin@apexintel.io` / `AdminMaster2026!`
4. Or register a new account directly through the **Create Account** tab with any email and a password of at least 12 characters.

---

## 2. Automated Test Execution

The authentication system includes 37 automated unit and integration tests using Node.js 20+ native test runner.

### Run All Authentication Tests:
```bash
node scripts/run-auth-tests.mjs
```
Or directly via Node:
```bash
node --test tests/auth/auth.test.js tests/auth/password-reset-and-admin.test.js
```

**Expected Output:**
```
🧪 Starting ApexIntel B2B Authentication Test Suite...
TAP version 13
ok 1 - Password Cryptography: enforces policy and handles scrypt hashing
ok 2 - Registration Suite: input validation, uniqueness, and role immutability
ok 3 - Login Suite: authentication, error safety, and abuse prevention
ok 4 - Session Lifecycle: hashing, validation, idle timeouts, and revocation
ok 5 - HTTP Router & CSRF: Origin checks, headers, and Set-Cookie compliance
ok 6 - Password Change Suite
ok 7 - Password Reset Suite
# tests 37
# pass 37
# fail 0
✨ All authentication tests passed successfully (0 failures).
```

---

## 3. Provisioning Administrator Accounts

Administrator accounts can never be registered through the public website. They must be provisioned using the operator script:

### Interactive Mode:
```bash
node scripts/bootstrap-admin.mjs --email admin@apexintel.io --name "Lead Administrator"
```
You will be securely prompted for an admin passphrase (minimum 12 characters).

### Scripted / CI Mode:
```bash
ADMIN_INITIAL_PASSWORD="YourSecurePassphrase2026!" node scripts/bootstrap-admin.mjs --email admin@apexintel.io --name "Lead Administrator"
```

---

## 4. AWS Infrastructure Deployment Prerequisites

When the operator decides to deploy the backend to AWS production:

### 4.1 Refresh AWS CLI Credentials
Ensure your AWS profile (`apexintel`) has active credentials:
```bash
aws sso login --profile apexintel
```

### 4.2 Provision DynamoDB Tables
Run the automated table creation script:
```bash
# Verify schemas first with dry run
node scripts/setup-dynamodb.mjs --dry-run

# Execute table creation in AWS region ap-southeast-2
node scripts/setup-dynamodb.mjs
```
This creates:
1. `apexintel_users` (Partition Key: `userId`, GSI: `normalizedEmail-index`)
2. `apexintel_sessions` (Partition Key: `tokenHash`, GSI: `userId-index`, TTL: `ttl`)
3. `apexintel_rate_limits` (Partition Key: `rateKey`, TTL: `ttl`)
4. `apexintel_password_resets` (Partition Key: `tokenHash`, TTL: `ttl`)

### 4.3 Deploy the Lambda Function
Package and deploy `aws/lambda-auth-handler.mjs`:
```bash
# Set environment variables on the Lambda function:
DYNAMODB_USERS_TABLE=apexintel_users
DYNAMODB_SESSIONS_TABLE=apexintel_sessions
DYNAMODB_RATE_LIMITS_TABLE=apexintel_rate_limits
DYNAMODB_RESETS_TABLE=apexintel_password_resets
NODE_ENV=production
```

### 4.4 Cloudflare Worker Configuration
Configure the Cloudflare Worker secret to point `/api/auth/*` traffic to the AWS Lambda Function URL or API Gateway:
```bash
npx wrangler secret put BACKEND_AUTH_URL
# Enter the AWS Lambda Function URL or API Gateway URL
```
