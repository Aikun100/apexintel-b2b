# ApexIntel B2B — API & Integration Specification
**Document ID:** `API-2026-v2.0`  
**Classification:** Developer & API Architecture  
**Base URL:** `https://apexintel-b2b.shop`  
**Authentication:** Bearer Token via Header `Authorization: Bearer <API_KEY>`  

---

## 1. Overview & Authentication

ApexIntel B2B provides REST and edge endpoints designed for automated lead syndication into outbound CRM platforms (GoHighLevel, HubSpot, Smartlead, Instantly, Clay).

### Header Convention:
```http
Authorization: Bearer apex_live_sec_xxxxxxxxxxxx2026
Content-Type: application/json
Accept: application/json
```

---

## 2. API Endpoints

### 2.1 Health & Service Telemetry
- **Endpoint:** `GET /api/health`
- **Auth:** Optional
- **Description:** Verifies Cloudflare edge worker status, AWS DynamoDB latency, and current crawler version.
- **Response (200 OK):**
```json
{
  "status": "operational",
  "version": "2.0.0",
  "edge_region": "SYD",
  "aws_dynamodb_status": "connected",
  "timestamp": "2026-11-22T19:55:00.000Z"
}
```

### 2.2 Website Intelligence Scanner
- **Endpoint:** `POST /api/scan`
- **Auth:** Bearer Token or Session Cookie
- **Request Body:**
```json
{
  "domain": "precisionroof.com"
}
```
- **Response (200 OK):**
```json
{
  "domain": "precisionroof.com",
  "status": "completed",
  "metrics": {
    "speed_ms": 980,
    "speed_rating": "Moderate Latency",
    "cms": "WordPress / Apache",
    "meta_pixel": false,
    "google_ads": true,
    "mx_status": "Active & Verified",
    "icp_score": 85,
    "priority": "P1 - High Opportunity"
  },
  "recommended_angle": "Prospect is actively spending on Google Ads without retargeting pixels, dropping 35%+ of ad clicks."
}
```

### 2.3 Lead Inventory & Territory Export
- **Endpoint:** `GET /api/leads`
- **Auth:** Mandatory
- **Query Parameters:**
  - `territory`: `texas` | `florida` | `medspas` | `hvac`
  - `limit`: `integer` (default 24, max 500)
  - `min_score`: `integer` (e.g. 75)
- **Response (200 OK):**
```json
{
  "territory": "texas",
  "count": 24,
  "leads": [
    {
      "id": "tx_001",
      "company_name": "T Rock Roofing & Restoration",
      "domain": "dallasroofer.com",
      "city": "Dallas, TX",
      "email": "info@dallasroofer.com",
      "phone": "+1 469 931 9867",
      "opportunity_score": 92,
      "priority": "P1"
    }
  ]
}
```

### 2.4 Custom Extraction Request Webhook
- **Endpoint:** `POST /api/custom-request`
- **Auth:** Mandatory
- **Request Body:**
```json
{
  "customer_email": "agency@velocitygrowth.io",
  "industry": "Commercial Solar & Roofing",
  "geography": "Phoenix & Scottsdale, AZ",
  "target_volume": 250,
  "tech_filter": "Google Ads Active, Missing Meta Pixel",
  "quoted_budget": 299.00
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "request_id": "REQ-2026-4491",
  "status": "Submitted",
  "estimated_fulfillment_hours": 24
}
```

---

## 3. Webhook Integration for Outbound Platforms

Users can configure webhooks to receive real-time JSON payloads whenever a new lead batch is unlocked or an order is confirmed.

### Event: `lead.delivered`
```json
{
  "event": "lead.delivered",
  "account_id": "acc_velocity_01",
  "delivery_id": "del_99812",
  "lead": {
    "company": "Freedom Solar Power",
    "domain": "freedomsolar.com",
    "email": "contact@freedomsolar.com",
    "phone": "+1 512 759 8320",
    "city": "Austin, TX",
    "tags": ["solar", "texas", "p1"]
  }
}
```
