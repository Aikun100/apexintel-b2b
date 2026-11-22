# ApexIntel B2B — AWS Infrastructure Cost Estimate & ROI Model
**Document ID:** `COST-2026-v2.0`  
**Classification:** Financial & Cloud Capacity Planning  
**Target Region:** `ap-southeast-2` (Sydney)  
**Model:** Pay-Per-Request Serverless  

---

## 1. Executive Cost Summary

ApexIntel B2B's serverless cloud architecture on AWS is specifically designed to achieve **near-zero fixed operational overhead**. Unlike traditional architectures relying on EC2 instances or container clusters costing $30 to $120/month at idle, our serverless stack scales strictly with data crawling activity and customer transactions.

$$\text{Monthly Cloud Cost} = \mathbf{\$0.00} \text{ to } \mathbf{\$0.45} \text{ USD at current production volume.}$$

Gross profit margin on digital intelligence packs ($79 to $99 per pack) exceeds **98.5%**.

---

## 2. Granular AWS Component Breakdown

### 2.1 AWS Lambda (`apex-web-app`)
- **Invocation Schedule:** Daily cron job (22 days/month) + on-demand customer deduplication queries (~150 executions/month).
- **Execution Duration:** Average 4.2 seconds per batch on Graviton2 (ARM64).
- **Memory:** 512 MB ($0.0000000067 per ms).
- **Free Tier Allowance:** 1,000,000 free requests per month; 3,200,000 seconds of compute time.
- **Monthly Invocations:** ~200.
- **Compute Used:** $200 \times 4.2\text{s} = 840\text{ seconds}$.
- **Net Cost:** **$0.00 USD** (Completely inside Free Tier).

### 2.2 Amazon DynamoDB (`leads_cache`)
- **Capacity Mode:** On-Demand (Pay per request).
- **Write Request Units (WRU):** ~5,000 writes/month for newly mined leads.
- **Read Request Units (RRU):** ~2,500 reads/month for deduplication checks.
- **Free Tier Allowance:** 25 GB of storage free; 25 WCU and 25 RCU free forever.
- **Storage Consumption:** 5,000 records $\times$ 1.5 KB = 7.5 MB.
- **Net Cost:** **$0.00 USD** (0.03% of free storage capacity).

### 2.3 Amazon S3 (`apexintel-datasets-production`)
- **Storage:** Packaged `.csv` and `.xlsx` archives (~250 MB total).
- **Free Tier Allowance:** 5 GB Standard Storage; 20,000 GET requests, 2,000 PUT requests.
- **PUT / GET Requests:** Under 500 requests per month.
- **Net Cost:** **$0.00 USD** (5% of free tier limit).

### 2.4 Amazon EventBridge (`apex-daily-lead-crawler`)
- **Rule Invocations:** 22 scheduled triggers per month.
- **Free Tier Allowance:** All state-change and scheduled rule invocations are **free**.
- **Net Cost:** **$0.00 USD**.

### 2.5 AWS CloudWatch Logs
- **Log Ingestion:** ~15 MB/month.
- **Free Tier Allowance:** 5 GB log ingestion and 5 GB archival free per month.
- **Net Cost:** **$0.00 USD**.

---

## 3. Cloudflare Edge Delivery Cost

- **Tier:** Cloudflare Workers Free Tier.
- **Monthly Worker Requests Included:** 100,000 requests/day (3,000,000 requests/month).
- **Current Bandwidth & Hits:** ~15,000 hits/month.
- **Net Cost:** **$0.00 USD**.
- **SSL / DDoS Defense:** Free included certificate & L3/L4/L7 mitigation.

---

## 4. Unit Economics & Profitability Analysis

| Metric | Pack: Texas / Florida ($79) | Pack: MedSpas / HVAC ($89-$99) | Custom 500 Leads ($399) |
|---|---|---|---|
| **Gross Revenue** | $79.00 | $99.00 | $399.00 |
| **PayPal Processing Fee (2.99% + $0.49)** | $2.85 | $3.45 | $12.42 |
| **AWS Crawling & Verification Compute** | $0.0001 | $0.0001 | $0.0005 |
| **Cloudflare Edge Serving** | $0.0000 | $0.0000 | $0.0000 |
| **Net Contribution Profit** | **$76.15** | **$95.55** | **$386.58** |
| **Net Profit Margin** | **96.4%** | **96.5%** | **96.9%** |

---

## 5. Scalability Runway: When Do AWS Costs Rise?

Even if platform volume scales $100\times$:
- **1,000 Active Customers / Month:**
  - DynamoDB writes: 500,000 records = $0.62.
  - S3 Storage: 25 GB = $0.58.
  - Lambda Compute: 150,000 seconds = $2.10.
  - Total Monthly Cloud Cost at 1,000 Customers: **$3.30 USD**.
  - Total Monthly Revenue at 1,000 Customers: **$79,000+ USD**.
  - Operational Efficiency: **99.99% Gross Profit Margin on Cloud**.
