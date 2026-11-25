# ApexIntel B2B — AWS Lambda & Cloudflare Worker Deployment Guide

**Document Version:** 1.0.0  
**Target Environment:** Production AWS Lambda (ap-southeast-2) & Cloudflare Workers  
**AWS Account ID:** `129264592603`  
**Primary Domain:** `https://apexintel-b2b.shop`  
**Deployment Artifact:** `dist/apexintel-auth-lambda.zip`  
**Handler:** `aws/lambda-auth-handler.handler` (or `index.handler`)

---

## 1. Architectural Overview & Security Boundary

```
[ Client Browser / HTTPS ]
          │
          ▼
[ Cloudflare Edge CDN / Worker ] (apexintel-b2b.shop)
   • Enforces CF-Connecting-IP & WAF rate limits
   • Attaches Header: X-ApexIntel-Worker-Secret: <SECRET>
   • Overwrites / strips client X-Forwarded-For with true client IP
          │
          ▼ HTTPS
[ AWS Lambda Function URL ] (ap-southeast-2)
   • Handler: aws/lambda-auth-handler.handler
   • Validates Worker-to-Lambda shared secret in constant time (403 if invalid/missing)
   • Enforces Strict-Transport-Security & Secure, HttpOnly, SameSite=Lax cookies
   • Role: apexintel-auth-lambda-execution-role (Least-Privilege Policy)
          │
          ▼ AWS SDK v3
[ Amazon DynamoDB Tables ] (ap-southeast-2)
   • apexintel_users (User profiles, password hashes, email locks)
   • apexintel_sessions (Token hashes, lastActivityAt, TTL auto-purge)
   • apexintel_rate_limits (Rate limit counters)
   • apexintel_password_resets (One-time reset token hashes, TTL auto-purge)
```

---

## 2. Pre-Deployment Verification Checklist

Before creating or modifying cloud resources, verify local prerequisites:

### `[READ-ONLY]` Step 2.1 — Verify Local Auth Tests Pass
```bash
node scripts/run-auth-tests.mjs
```
*Expected Result:* 60/60 tests pass with 0 failures.

### `[READ-ONLY]` Step 2.2 — Verify AWS CLI Identity & Region
```bash
aws sts get-caller-identity --profile apexintel
```
*Expected Result:* Account `129264592603`, User `AaronJasper` or configured IAM identity.

### `[READ-ONLY]` Step 2.3 — Verify DynamoDB Tables are ACTIVE in ap-southeast-2
```bash
aws dynamodb list-tables --region ap-southeast-2 --profile apexintel
```
*Expected Result:* Contains `apexintel_users`, `apexintel_sessions`, `apexintel_rate_limits`, `apexintel_password_resets`.

---

## 3. Package Generation & Local Verification

### `[MODIFIES LOCAL ARTIFACTS]` Step 3.1 — Build the Deployment Package
```bash
node scripts/package-auth-lambda.mjs
```
*Output:* Generates `dist/apexintel-auth-lambda.zip` (~3.0 MB) containing Node.js 20 ESM code and minimal auth dependencies (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `validator`).

### `[READ-ONLY]` Step 3.2 — Audit and Verify Package Integrity
```bash
node scripts/verify-auth-lambda-package.mjs
```
*Expected Result:* 46/46 verifications pass, including archive structure, exclusion of `.env` and `public/` files, ESM import resolution, and mock API Gateway v2 smoke tests.

---

## 4. AWS IAM Least-Privilege Execution Role Setup

The Lambda function requires an IAM execution role governed strictly by the least-privilege policy in `aws/iam/apexintel-auth-lambda-policy.json`.

### `[MODIFIES INFRASTRUCTURE]` Step 4.1 — Create Trust Policy File
Create a temporary trust policy file `trust-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### `[MODIFIES INFRASTRUCTURE]` Step 4.2 — Create the IAM Role
```bash
aws iam create-role \
  --role-name apexintel-auth-lambda-execution-role \
  --assume-role-policy-document file://trust-policy.json \
  --description "Execution role for ApexIntel B2B auth service Lambda" \
  --profile apexintel
```

### `[MODIFIES INFRASTRUCTURE]` Step 4.3 — Put the Scoped Inline Policy
```bash
aws iam put-role-policy \
  --role-name apexintel-auth-lambda-execution-role \
  --policy-name apexintel-auth-dynamodb-cw-policy \
  --policy-document file://aws/iam/apexintel-auth-lambda-policy.json \
  --profile apexintel
```

### `[READ-ONLY]` Step 4.4 — Verify Role Policy Attachment
```bash
aws iam get-role-policy \
  --role-name apexintel-auth-lambda-execution-role \
  --policy-name apexintel-auth-dynamodb-cw-policy \
  --profile apexintel
```

---

## 5. Lambda Function Creation & Configuration

### `[MODIFIES INFRASTRUCTURE]` Step 5.1 — Generate Worker-to-Backend Shared Secret
```bash
# Generate high-entropy 256-bit hexadecimal secret
WORKER_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "Generated Worker Secret: $WORKER_SECRET"
```

### `[MODIFIES INFRASTRUCTURE]` Step 5.2 — Create the Lambda Function
```bash
aws lambda create-function \
  --function-name apexintel-auth \
  --runtime nodejs20.x \
  --role arn:aws:iam::129264592603:role/apexintel-auth-lambda-execution-role \
  --handler aws/lambda-auth-handler.handler \
  --zip-file fileb://dist/apexintel-auth-lambda.zip \
  --description "ApexIntel B2B Production Authentication Service" \
  --timeout 10 \
  --memory-size 256 \
  --region ap-southeast-2 \
  --profile apexintel \
  --environment "Variables={NODE_ENV=production,AWS_REGION=ap-southeast-2,DYNAMODB_USERS_TABLE=apexintel_users,DYNAMODB_SESSIONS_TABLE=apexintel_sessions,DYNAMODB_RATE_LIMITS_TABLE=apexintel_rate_limits,DYNAMODB_RESETS_TABLE=apexintel_password_resets,WORKER_BACKEND_SECRET=$WORKER_SECRET}"
```

### `[MODIFIES INFRASTRUCTURE]` Step 5.3 — If Updating an Existing Lambda
```bash
# Update code
aws lambda update-function-code \
  --function-name apexintel-auth \
  --zip-file fileb://dist/apexintel-auth-lambda.zip \
  --region ap-southeast-2 \
  --profile apexintel

# Update configuration
aws lambda update-function-configuration \
  --function-name apexintel-auth \
  --runtime nodejs20.x \
  --handler aws/lambda-auth-handler.handler \
  --timeout 10 \
  --memory-size 256 \
  --region ap-southeast-2 \
  --profile apexintel \
  --environment "Variables={NODE_ENV=production,AWS_REGION=ap-southeast-2,DYNAMODB_USERS_TABLE=apexintel_users,DYNAMODB_SESSIONS_TABLE=apexintel_sessions,DYNAMODB_RATE_LIMITS_TABLE=apexintel_rate_limits,DYNAMODB_RESETS_TABLE=apexintel_password_resets,WORKER_BACKEND_SECRET=$WORKER_SECRET}"
```

---

## 6. Configure Lambda Function URL (Public Endpoint Protected by Secret)

### `[MODIFIES INFRASTRUCTURE]` Step 6.1 — Create Function URL
```bash
aws lambda create-function-url-config \
  --function-name apexintel-auth \
  --auth-type NONE \
  --cors "AllowOrigins=[\"https://apexintel-b2b.shop\"],AllowMethods=[\"GET\",\"POST\"],AllowHeaders=[\"content-type\",\"cookie\",\"x-apexintel-worker-secret\"],AllowCredentials=true,MaxAge=86400" \
  --region ap-southeast-2 \
  --profile apexintel
```

### `[MODIFIES INFRASTRUCTURE]` Step 6.2 — Grant Public Invoke Permission for Function URL
```bash
aws lambda add-permission \
  --function-name apexintel-auth \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region ap-southeast-2 \
  --profile apexintel
```

### `[READ-ONLY]` Step 6.3 — Retrieve the Assigned Function URL
```bash
aws lambda get-function-url-config \
  --function-name apexintel-auth \
  --region ap-southeast-2 \
  --profile apexintel \
  --query "FunctionUrl" \
  --output text
```
*Note the returned URL (e.g. `https://abcdefgh12345678.lambda-url.ap-southeast-2.on.aws/`).*

---

## 7. Cloudflare Worker Binding Configuration

Once the Lambda Function URL and Secret are generated:

### `[MODIFIES INFRASTRUCTURE]` Step 7.1 — Set Cloudflare Worker Secrets via Wrangler
```bash
# Bind the shared worker secret
echo "$WORKER_SECRET" | npx wrangler secret put WORKER_BACKEND_SECRET

# Bind the target Lambda Function URL
echo "https://<YOUR_LAMBDA_URL_ID>.lambda-url.ap-southeast-2.on.aws" | npx wrangler secret put BACKEND_AUTH_URL
```

### `[MODIFIES INFRASTRUCTURE]` Step 7.2 — Deploy Cloudflare Worker
```bash
npx wrangler deploy
```

---

## 8. Post-Deployment Verification & Smoke Testing

### `[READ-ONLY]` Test 8.1 — Verify Direct Lambda URL Access is BLOCKED (HTTP 403)
Execute directly against the raw AWS Lambda Function URL:
```bash
curl -i -X GET "https://<YOUR_LAMBDA_URL_ID>.lambda-url.ap-southeast-2.on.aws/api/auth/me"
```
*Expected Output:*
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{"success":false,"error":"Missing worker authentication secret."}
```

### `[READ-ONLY]` Test 8.2 — Verify Cloudflare Proxying with Worker Secret (HTTP 401)
Execute against the public Cloudflare domain without session cookies:
```bash
curl -i -X GET "https://apexintel-b2b.shop/api/auth/me"
```
*Expected Output:*
```http
HTTP/2 401 Unauthorized
content-type: application/json

{"success":false,"error":"Authentication required."}
```
*(Confirms Cloudflare Worker injected secret, Lambda accepted the request, and auth service answered).*

### `[READ-ONLY]` Test 8.3 — Verify Admin Bootstrap Login
```bash
curl -i -X POST "https://apexintel-b2b.shop/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://apexintel-b2b.shop" \
  -d '{"email":"admin@apexintel.io","password":"<BOOTSTRAPPED_ADMIN_PASSWORD>"}'
```
*Expected Output:*
```http
HTTP/2 200 OK
set-cookie: apexintel_session=...; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax; Secure
content-type: application/json

{"success":true,"message":"Authentication successful.","user":{"email":"admin@apexintel.io","role":"admin",...}}
```

---

## 9. Rollback & Emergency Procedures

If any unexpected errors occur during deployment:

### 9.1 Emergency Revert Lambda Code
```bash
# Roll back Lambda to previous known working version or alias
aws lambda update-function-code \
  --function-name apexintel-auth \
  --s3-bucket apexintel-deployments \
  --s3-key backups/apexintel-auth-previous.zip \
  --region ap-southeast-2 \
  --profile apexintel
```

### 9.2 Emergency Cloudflare Bypass
If Lambda is experiencing degraded performance:
```bash
# Disable auth proxy route in Cloudflare Worker or point to maintenance response
npx wrangler rollback
```
