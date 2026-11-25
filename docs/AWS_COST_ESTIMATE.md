# ApexIntel B2B — AWS Infrastructure Cost Estimate & Unit Economics

- **Target Region:** `ap-southeast-2` (Sydney)
- **Model:** Serverless Pay-Per-Request (AWS Lambda, DynamoDB On-Demand, Amazon S3, Cloudflare Workers)

---

## 1. Monthly Cloud Cost Summary

Because ApexIntel uses serverless AWS Lambda, DynamoDB On-Demand, S3, and Cloudflare Workers instead of idle EC2 instances, baseline cloud cost at low-to-moderate volume sits within AWS and Cloudflare Free Tier allowances (**~$0.00 to $0.45 USD / month**).

---

## 2. Component Breakdown

- **Cloudflare Workers (`src/worker.js`):** Free Tier covers up to 100,000 requests/day plus TLS & L3/L4/L7 protection (**$0.00/mo**).
- **AWS Lambda (ARM64 Graviton2, 512 MB):** Free Tier includes 1M requests and 400,000 GB-seconds/month (**$0.00/mo** at current volume).
- **Amazon DynamoDB (9 On-Demand Tables):** `apexintel_users`, `apexintel_sessions`, `apexintel_rate_limits`, `apexintel_password_resets`, `apexintel_user_crm`, `apexintel_orders`, `apexintel_custom_requests`, `apexintel_scans_cache`, `leads_cache`. Free Tier includes 25 GB storage and 25 WCU/RCU equivalent (**$0.00/mo** at current volume).
- **Amazon S3 (`apexintel-datasets-production`):** Private Excel/CSV storage under 5 GB Free Tier (**$0.00/mo**).

---

## 3. Dataset Unit Economics (Stripe Card Processing)

Using standard Stripe US online card processing (`2.9% + $0.30`):

| Product | Gross Price | Stripe Fee (`2.9% + $0.30`) | Net Before Tax/Cloud |
| :--- | :---: | :---: | :---: |
| Texas / Florida Datasets | $79.00 | $2.59 | **$76.41** |
| California MedSpas Dataset | $89.00 | $2.88 | **$86.12** |
| Commercial HVAC Dataset | $99.00 | $3.17 | **$95.83** |
| Custom Research (500 leads base @ $0.45/rec) | $225.00 | $6.83 | **$218.17** |
