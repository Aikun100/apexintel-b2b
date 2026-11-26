# ApexIntel B2B — Operator Deployment Runbook

**Document Version:** 1.0.0  
**Target Architecture:** AWS Serverless (ap-southeast-2) + Cloudflare Workers Edge  
**Node.js Runtime:** 20.x ESM (Node.js >= 20.0.0)  
**Security Level:** Production / High-Assurance Multi-Tenant B2B Platform  

---

## Overview & Execution Safety Rules

This runbook provides unambiguous, reproducible, step-by-step instructions for a human cloud engineer or DevOps operator to deploy the ApexIntel B2B platform to AWS and Cloudflare.

> [!IMPORTANT]
> **Safety Designations:**
> - Every command is explicitly tagged with either `[READ-ONLY]` (safe inspection, zero state modification) or `[MODIFIES INFRASTRUCTURE]` (provisions, mutates, or uploads cloud resources).
> - Never execute `[MODIFIES INFRASTRUCTURE]` commands without verifying that the preceding verification steps have completed with `0` errors.
> - Never commit `.env` files or hardcode secrets into terminal scripts.

---

## 1. Pre-Deployment Security Hygiene & AWS Credentials Verification

### Step 1.1: Verify Node.js Environment & Clean Git State `[READ-ONLY]`
Confirm that Node.js 20+ and npm are present, and that git working tree is clean.
```bash
# Verify Node.js version (Must be >= 20.0.0)
node -v

# Verify clean git status and commit hash
git status
git rev-parse HEAD
```

### Step 1.2: Verify Active AWS IAM Identity `[READ-ONLY]`
Confirm your active AWS caller identity matches the authorized deployment account (`129264592603`) in `ap-southeast-2`:
```bash
aws sts get-caller-identity --region ap-southeast-2
```
*Expected Output:*
```json
{
  "UserId": "AIDAI...",
  "Account": "129264592603",
  "Arn": "arn:aws:iam::129264592603:user/AaronJasper"
}
```

### Step 1.3: Audit and Rotate Stale IAM Access Keys `[READ-ONLY]`
Inspect active access keys to verify no obsolete credentials exist:
```bash
aws iam list-access-keys --user-name AaronJasper
```

---

## 2. Run All Automated Test Suites & Package Verification

### Step 2.1: Execute Unified Test Suite (192 Tests) `[READ-ONLY]`
Run the end-to-end automated test runner covering Auth, CRM, Payments, Crawler/Discovery, Scanner, and Custom Requests:
```bash
node scripts/run-all-tests.mjs
```
*Verification Check:* Must display `All 192 tests across 7 suites PASSED with 0 failures`.

### Step 2.2: Build All 6 Lambda Deployment Packages `[MODIFIES INFRASTRUCTURE]`
Generate minimal, production-grade Node.js 20 ESM ZIP bundles into `dist/`:
```bash
node scripts/package-all-lambdas.mjs
```
*Expected Output:* Generates 6 ZIP archives in `dist/` with total size < 15MB:
- `dist/apexintel-auth-lambda.zip` (~3.0 MB)
- `dist/apexintel-crm-lambda.zip` (~3.0 MB)
- `dist/apexintel-payments-lambda.zip` (~4.8 MB)
- `dist/apexintel-crawler-lambda.zip` (~3.0 MB)
- `dist/apexintel-tools-lambda.zip` (~3.0 MB)
- `dist/apexintel-requests-lambda.zip` (~3.0 MB)

### Step 2.3: Verify Package Contents & ESM Resolution `[READ-ONLY]`
Audit every ZIP for strict exclusion of `.env`, tests, docs, and public assets, and test local ESM handler boot:
```bash
node scripts/verify-all-lambda-packages.mjs
```
*Verification Check:* Must output `✓ PASS` across all 6 packages.

---

## 3. DynamoDB Database Provisioning

### Step 3.1: Execute Automated DynamoDB Provisioning Script `[MODIFIES INFRASTRUCTURE]`
Provisions all 6 required DynamoDB tables in `ap-southeast-2` with Pay-Per-Request (On-Demand) billing, server-side KMS encryption, Point-in-Time Recovery (PITR), and TTL where appropriate:
```bash
node scripts/setup-dynamodb.mjs
```

### Step 3.2: Verify DynamoDB Table Status `[READ-ONLY]`
Verify that all 6 tables exist and are `ACTIVE`:
```bash
aws dynamodb describe-table --table-name apexintel_users --region ap-southeast-2 --query "Table.TableStatus"
aws dynamodb describe-table --table-name apexintel_sessions --region ap-southeast-2 --query "Table.TableStatus"
aws dynamodb describe-table --table-name apexintel_user_crm --region ap-southeast-2 --query "Table.TableStatus"
aws dynamodb describe-table --table-name apexintel_orders --region ap-southeast-2 --query "Table.TableStatus"
aws dynamodb describe-table --table-name leads_cache --region ap-southeast-2 --query "Table.TableStatus"
aws dynamodb describe-table --table-name apexintel_custom_requests --region ap-southeast-2 --query "Table.TableStatus"
```
*Verification Check:* All tables must return `"ACTIVE"`.

---

## 4. Amazon S3 Bucket Provisioning & Private Dataset Ingestion

### Step 4.1: Create Private S3 Dataset Bucket `[MODIFIES INFRASTRUCTURE]`
Create the fulfillment storage bucket in `ap-southeast-2` and block all public access:
```bash
# Create bucket
aws s3api create-bucket \
  --bucket apexintel-datasets-production \
  --region ap-southeast-2 \
  --create-bucket-configuration LocationConstraint=ap-southeast-2

# Block all public ACLs and bucket policies
aws s3api put-public-access-block \
  --bucket apexintel-datasets-production \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --region ap-southeast-2

# Enable SSE-S3 default encryption
aws s3api put-bucket-encryption \
  --bucket apexintel-datasets-production \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}' \
  --region ap-southeast-2
```

### Step 4.2: Upload Master Pack Datasets `[MODIFIES INFRASTRUCTURE]`
Upload pre-audited B2B lead datasets to the private bucket:
```bash
# Verify local datasets exist
ls -la data/datasets/

# Upload to S3 under datasets/ prefix
aws s3 cp data/datasets/texas-commercial-contractors.xlsx s3://apexintel-datasets-production/datasets/texas-commercial-contractors.xlsx --region ap-southeast-2
aws s3 cp data/datasets/california-medspas.xlsx s3://apexintel-datasets-production/datasets/california-medspas.xlsx --region ap-southeast-2
aws s3 cp data/datasets/florida-solar-storm.xlsx s3://apexintel-datasets-production/datasets/florida-solar-storm.xlsx --region ap-southeast-2
aws s3 cp data/datasets/commercial-hvac-mechanical.xlsx s3://apexintel-datasets-production/datasets/commercial-hvac-mechanical.xlsx --region ap-southeast-2
```

### Step 4.3: Verify S3 Bucket Security `[READ-ONLY]`
Confirm that public access is blocked and files are stored:
```bash
aws s3api get-public-access-block --bucket apexintel-datasets-production --region ap-southeast-2
aws s3 ls s3://apexintel-datasets-production/datasets/ --region ap-southeast-2
```

---

## 5. IAM Least-Privilege Execution Roles Provisioning

### Step 5.1: Create Lambda Trust Policy `[MODIFIES INFRASTRUCTURE]`
Create a local trust document allowing Lambda service to assume execution roles:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```
Save as `aws/iam/lambda-trust-policy.json`.

### Step 5.2: Create Roles & Attach Least-Privilege Policies `[MODIFIES INFRASTRUCTURE]`
Create each dedicated role and attach its policy from `aws/iam/`:
```bash
# Trust policy creation
cat << 'EOF' > aws/iam/lambda-trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# 1. Auth Lambda Role
aws iam create-role --role-name ApexIntel-Auth-Lambda-Role --assume-role-policy-document file://aws/iam/lambda-trust-policy.json
aws iam put-role-policy --role-name ApexIntel-Auth-Lambda-Role --policy-name ApexIntel-Auth-Policy --policy-document file://aws/iam/apexintel-auth-lambda-policy.json

# 2. CRM Lambda Role
aws iam create-role --role-name ApexIntel-CRM-Lambda-Role --assume-role-policy-document file://aws/iam/lambda-trust-policy.json
aws iam put-role-policy --role-name ApexIntel-CRM-Lambda-Role --policy-name ApexIntel-CRM-Policy --policy-document file://aws/iam/apexintel-crm-lambda-policy.json

# 3. Payments Lambda Role
aws iam create-role --role-name ApexIntel-Payments-Lambda-Role --assume-role-policy-document file://aws/iam/lambda-trust-policy.json
aws iam put-role-policy --role-name ApexIntel-Payments-Lambda-Role --policy-name ApexIntel-Payments-Policy --policy-document file://aws/iam/apexintel-payments-lambda-policy.json

# 4. Crawler & Discovery Lambda Role
aws iam create-role --role-name ApexIntel-Crawler-Lambda-Role --assume-role-policy-document file://aws/iam/lambda-trust-policy.json
aws iam put-role-policy --role-name ApexIntel-Crawler-Lambda-Role --policy-name ApexIntel-Crawler-Policy --policy-document file://aws/iam/apexintel-crawler-discovery-lambda-policy.json

# 5. Tools & Scanner Lambda Role
aws iam create-role --role-name ApexIntel-Tools-Lambda-Role --assume-role-policy-document file://aws/iam/lambda-trust-policy.json
aws iam put-role-policy --role-name ApexIntel-Tools-Lambda-Role --policy-name ApexIntel-Tools-Policy --policy-document file://aws/iam/apexintel-tools-lambda-policy.json

# 6. Custom Requests Lambda Role
aws iam create-role --role-name ApexIntel-Requests-Lambda-Role --assume-role-policy-document file://aws/iam/lambda-trust-policy.json
aws iam put-role-policy --role-name ApexIntel-Requests-Lambda-Role --policy-name ApexIntel-Requests-Policy --policy-document file://aws/iam/apexintel-requests-lambda-policy.json
```

---

## 6. AWS Lambda Functions Deployment

### Step 6.1: Deploy All 6 Lambda Functions `[MODIFIES INFRASTRUCTURE]`
Create the 6 serverless Lambda functions in `ap-southeast-2` using the packaged ZIP archives:

```bash
# Variables
ACCOUNT_ID="129264592603"
REGION="ap-southeast-2"
WORKER_SECRET="<GENERATE_RANDOM_32_BYTE_HEX_SECRET>"

# 1. Auth Lambda
aws lambda create-function \
  --function-name apexintel-auth-service \
  --runtime nodejs20.x \
  --architectures arm64 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ApexIntel-Auth-Lambda-Role \
  --handler aws/lambda-auth-handler.handler \
  --zip-file fileb://dist/apexintel-auth-lambda.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment "Variables={NODE_ENV=production,AWS_REGION_CUSTOM=${REGION},WORKER_BACKEND_SECRET=${WORKER_SECRET}}" \
  --region ${REGION}

# 2. CRM Lambda
aws lambda create-function \
  --function-name apexintel-crm-service \
  --runtime nodejs20.x \
  --architectures arm64 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ApexIntel-CRM-Lambda-Role \
  --handler aws/lambda-crm-handler.handler \
  --zip-file fileb://dist/apexintel-crm-lambda.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment "Variables={NODE_ENV=production,AWS_REGION_CUSTOM=${REGION},WORKER_BACKEND_SECRET=${WORKER_SECRET}}" \
  --region ${REGION}

# 3. Payments Lambda
aws lambda create-function \
  --function-name apexintel-payments-service \
  --runtime nodejs20.x \
  --architectures arm64 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ApexIntel-Payments-Lambda-Role \
  --handler aws/lambda-payments-handler.handler \
  --zip-file fileb://dist/apexintel-payments-lambda.zip \
  --timeout 15 \
  --memory-size 512 \
  --environment "Variables={NODE_ENV=production,AWS_REGION_CUSTOM=${REGION},WORKER_BACKEND_SECRET=${WORKER_SECRET},STRIPE_SECRET_KEY=<STRIPE_LIVE_KEY>,STRIPE_WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET>,S3_DATASET_BUCKET=apexintel-datasets-production}" \
  --region ${REGION}

# 4. Crawler & Discovery Lambda
aws lambda create-function \
  --function-name apexintel-crawler-service \
  --runtime nodejs20.x \
  --architectures arm64 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ApexIntel-Crawler-Lambda-Role \
  --handler aws/lambda-crawler-handler.handler \
  --zip-file fileb://dist/apexintel-crawler-lambda.zip \
  --timeout 60 \
  --memory-size 512 \
  --environment "Variables={NODE_ENV=production,AWS_REGION_CUSTOM=${REGION},WORKER_BACKEND_SECRET=${WORKER_SECRET}}" \
  --region ${REGION}

# 5. Tools Scanner Lambda
aws lambda create-function \
  --function-name apexintel-tools-service \
  --runtime nodejs20.x \
  --architectures arm64 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ApexIntel-Tools-Lambda-Role \
  --handler aws/lambda-tools-handler.handler \
  --zip-file fileb://dist/apexintel-tools-lambda.zip \
  --timeout 15 \
  --memory-size 256 \
  --environment "Variables={NODE_ENV=production,AWS_REGION_CUSTOM=${REGION},WORKER_BACKEND_SECRET=${WORKER_SECRET}}" \
  --region ${REGION}

# 6. Custom Requests Lambda
aws lambda create-function \
  --function-name apexintel-requests-service \
  --runtime nodejs20.x \
  --architectures arm64 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ApexIntel-Requests-Lambda-Role \
  --handler aws/lambda-requests-handler.handler \
  --zip-file fileb://dist/apexintel-requests-lambda.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment "Variables={NODE_ENV=production,AWS_REGION_CUSTOM=${REGION},WORKER_BACKEND_SECRET=${WORKER_SECRET}}" \
  --region ${REGION}
```

---

## 7. Amazon API Gateway HTTP API (v2) & EventBridge Crawler Rule

### Step 7.1: Create Unified HTTP API Gateway `[MODIFIES INFRASTRUCTURE]`
Create an API Gateway v2 HTTP API and configure routes:
```bash
# Create HTTP API
API_ID=$(aws apigatewayv2 create-api \
  --name apexintel-b2b-api \
  --protocol-type HTTP \
  --region ap-southeast-2 \
  --query "ApiId" --output text)

echo "Created HTTP API with ID: ${API_ID}"
```

### Step 7.2: Wire Routes to Lambda Integrations `[MODIFIES INFRASTRUCTURE]`
Configure route prefixes to their respective microservices:
- `/api/auth/{proxy+}` -> `apexintel-auth-service`
- `/api/crm/{proxy+}` -> `apexintel-crm-service`
- `/api/orders` & `/api/orders/{proxy+}` -> `apexintel-payments-service`
- `/api/webhooks/payment` -> `apexintel-payments-service`
- `/api/downloads/{proxy+}` -> `apexintel-payments-service`
- `/api/discovery/{proxy+}` -> `apexintel-crawler-service`
- `/api/admin/{proxy+}` -> `apexintel-crawler-service`
- `/api/tools/{proxy+}` -> `apexintel-tools-service`
- `/api/requests/{proxy+}` -> `apexintel-requests-service`

### Step 7.3: Configure EventBridge Daily Crawler Schedule `[MODIFIES INFRASTRUCTURE]`
Schedule `apexintel-crawler-service` to run daily at 02:00 UTC:
```bash
# Create EventBridge rule
aws events put-rule \
  --name apex-daily-lead-crawler \
  --schedule-expression "cron(0 2 * * ? *)" \
  --state ENABLED \
  --description "Daily automated B2B lead ingestion and MX verification" \
  --region ap-southeast-2

# Add Lambda target
aws events put-targets \
  --rule apex-daily-lead-crawler \
  --targets "Id"="1","Arn"="arn:aws:lambda:ap-southeast-2:129264592603:function:apexintel-crawler-service" \
  --region ap-southeast-2

# Allow EventBridge to invoke Lambda
aws lambda add-permission \
  --function-name apexintel-crawler-service \
  --statement-id EventBridgeCrawlerInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:ap-southeast-2:129264592603:rule/apex-daily-lead-crawler \
  --region ap-southeast-2
```

---

## 8. Cloudflare Worker Edge Configuration & Deployment

### Step 8.1: Configure Cloudflare Worker Secrets `[MODIFIES INFRASTRUCTURE]`
Store the backend API Gateway URL and shared Worker secret securely in Cloudflare:
```bash
# Put backend API Gateway URL
npx wrangler secret put BACKEND_API_URL

# Put shared backend secret (must match Lambda WORKER_BACKEND_SECRET)
npx wrangler secret put WORKER_BACKEND_SECRET
```

### Step 8.2: Deploy Cloudflare Worker `[MODIFIES INFRASTRUCTURE]`
Deploy edge routing, security headers, and static asset distribution:
```bash
npx wrangler deploy
```

---

## 9. Production Admin Bootstrapping & Live Smoke Test

### Step 9.1: Seed Production Lead Catalog `[MODIFIES INFRASTRUCTURE]`
Trigger an initial ingestion batch to populate `leads_cache`:
```bash
aws lambda invoke \
  --function-name apexintel-crawler-service \
  --payload '{"dryRun": false}' \
  --region ap-southeast-2 \
  response.json

cat response.json
```

### Step 9.2: Bootstrap Primary Admin Account `[MODIFIES INFRASTRUCTURE]`
Run the administrative bootstrap script to create the master administrator user in DynamoDB:
```bash
# Set production environment variables
export NODE_ENV=production
export AWS_REGION_CUSTOM=ap-southeast-2
export ADMIN_EMAIL="admin@apexintel-b2b.shop"
export ADMIN_PASSWORD="<STRONG_ADMIN_PASSWORD_MIN_16_CHARS>"

node scripts/bootstrap-admin.mjs
```

### Step 9.3: Live Production Smoke Test `[READ-ONLY]`
Run the live deployment smoke verifier against the production domain:
```bash
node scripts/verify-live-deployment.js
```
*Verification Check:* Must confirm 200 OK on frontend, proper security headers (HSTS, nosniff, DENY, CSP), 404 JSON on invalid API routes, and active authentication endpoints.

---

## 10. Emergency Rollback & Incident Response Procedures

### Immediate Incident Actions:
1. **Compromised Secrets:**
   - In Cloudflare: `npx wrangler secret put WORKER_BACKEND_SECRET` (generate new secret).
   - In AWS Lambda: Update `WORKER_BACKEND_SECRET` across all 6 Lambda functions simultaneously.
2. **Abuse / DDoS on Scan Tool:**
   - Temporarily disable the tools route in `src/worker.js` or set concurrency limit to 0 on `apexintel-tools-service`:
     ```bash
     aws lambda put-function-concurrency --function-name apexintel-tools-service --reserved-concurrent-executions 0 --region ap-southeast-2
     ```
3. **Rollback Worker to Previous Version:**
   - Via Cloudflare Dashboard: Deployments -> Select previous version -> Rollback.
   - Via Wrangler CLI: `npx wrangler rollback <DEPLOYMENT_ID>`.
4. **DynamoDB Point-In-Time Recovery:**
   - Restore table to any second within the retention window:
     ```bash
     aws dynamodb restore-table-to-point-in-time \
       --source-table-name apexintel_users \
       --target-table-name apexintel_users_restored \
       --restore-date-time <ISO_TIMESTAMP> \
       --region ap-southeast-2
     ```
