# ApexIntel B2B — Lambda & Worker Environment Variables Reference

**Document Version:** 1.0.0  
**Last Updated:** November 22, 2026  
**Target Architecture:** AWS Lambda Node.js 20.x ESM (ap-southeast-2) & Cloudflare Workers  
**AWS Account ID:** `129264592603`  
**Base Domain:** `https://apexintel-b2b.shop`

---

## 1. AWS Lambda Runtime Environment Variables

Configure these variables on the `apexintel-auth` Lambda function in AWS region `ap-southeast-2`.

| Variable Name | Required | Default Value | Production Value | Sensitivity | Description & Security Impact |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `NODE_ENV` | **YES** | `development` | `production` | **Config** | Controls fail-closed database mode and cookie security. When `production`, fallback to `InMemoryAuthRepository` is forbidden. |
| `AWS_REGION` | **YES** | `ap-southeast-2` | `ap-southeast-2` | **Config** | AWS Region for DynamoDB client and CloudWatch logging. Defaulting to Sydney `ap-southeast-2`. |
| `WORKER_BACKEND_SECRET` | **YES** | *None* | `[Cryptographically Secure 64-char Hex/Base64]` | **CRITICAL SECRET** | Shared secret between Cloudflare Workers and Lambda. Direct internet requests to the Lambda without this header receive HTTP 403 Forbidden. |
| `DYNAMODB_USERS_TABLE` | **YES** | `apexintel_users` | `apexintel_users` | **Config** | Target DynamoDB table for user accounts, credentials, and email reservation locks. |
| `DYNAMODB_SESSIONS_TABLE` | **YES** | `apexintel_sessions` | `apexintel_sessions` | **Config** | Target DynamoDB table for active server sessions and TTL expiration. |
| `DYNAMODB_RATE_LIMITS_TABLE` | Optional | `apexintel_rate_limits` | `apexintel_rate_limits` | **Config** | Target DynamoDB table for sliding-window rate limit counters. |
| `DYNAMODB_RESETS_TABLE` | Optional | `apexintel_password_resets` | `apexintel_password_resets` | **Config** | Target DynamoDB table for password reset tokens and expiration TTL. |
| `USE_MOCK_STORAGE` | **NO** | `false` | `false` | **Config** | **Must NEVER be `true` in production.** If `true`, bypasses DynamoDB and stores data in volatile container memory. |

---

## 2. Cloudflare Worker Secrets & Variables

Configure these secrets and variables on the Cloudflare Worker that proxies `/api/auth/*` requests to AWS Lambda.

| Variable Name | Type | Production Example | Description & Security Impact |
| :--- | :---: | :--- | :--- |
| `BACKEND_AUTH_URL` | **Secret** | `https://abcdef123456.lambda-url.ap-southeast-2.on.aws` | The target AWS Lambda Function URL or API Gateway HTTP API v2 endpoint. Keep as a Worker secret or bound variable. |
| `WORKER_BACKEND_SECRET` | **Secret** | `[Identical 64-char Secret as Lambda]` | Must exactly match the Lambda `WORKER_BACKEND_SECRET`. Injected into outbound request as `x-apexintel-worker-secret`. |
| `ENVIRONMENT` | **Var** | `production` | Cloudflare Worker runtime execution context. |

---

## 3. Operator Verification Commands (Copy-Pasteable)

All commands are strictly labeled according to their operational safety level:

### 3.1 `[READ-ONLY]` AWS Lambda Configuration Verification
```bash
# Check current Lambda function configuration and environment variables
aws lambda get-function-configuration \
  --function-name apexintel-auth \
  --region ap-southeast-2 \
  --profile apexintel \
  --query "Environment.Variables"
```

### 3.2 `[READ-ONLY]` Cloudflare Worker Secret List
```bash
# Check installed secret names in Cloudflare Worker (values are hidden)
npx wrangler secret list
```

### 3.3 `[MODIFIES INFRASTRUCTURE]` Setting AWS Lambda Environment Variables
```bash
# Generate high-entropy 64-character secret
WORKER_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update Lambda function environment variables in ap-southeast-2
aws lambda update-function-configuration \
  --function-name apexintel-auth \
  --region ap-southeast-2 \
  --profile apexintel \
  --environment "Variables={NODE_ENV=production,AWS_REGION=ap-southeast-2,DYNAMODB_USERS_TABLE=apexintel_users,DYNAMODB_SESSIONS_TABLE=apexintel_sessions,DYNAMODB_RATE_LIMITS_TABLE=apexintel_rate_limits,DYNAMODB_RESETS_TABLE=apexintel_password_resets,WORKER_BACKEND_SECRET=$WORKER_SECRET}"
```

### 3.4 `[MODIFIES INFRASTRUCTURE]` Setting Cloudflare Worker Secrets
```bash
# Store the same secret in Cloudflare Worker
npx wrangler secret put WORKER_BACKEND_SECRET

# Store the Lambda Function URL target in Cloudflare Worker
npx wrangler secret put BACKEND_AUTH_URL
```
