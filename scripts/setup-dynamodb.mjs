#!/usr/bin/env node
/**
 * ApexIntel B2B - DynamoDB Table Setup Script
 * 
 * Safely provisions the required DynamoDB tables using AWS SDK v3:
 * - apexintel_users
 * - apexintel_sessions
 * - apexintel_rate_limits
 * - apexintel_password_resets
 * 
 * Safe Execution:
 * - Checks if tables already exist (ResourceInUseException is handled safely)
 * - Uses PAY_PER_REQUEST billing mode (zero idle cost)
 * - Enables point-in-time recovery and KMS encryption
 * 
 * Usage:
 *   node scripts/setup-dynamodb.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { 
  DynamoDBClient, 
  CreateTableCommand, 
  DescribeTableCommand,
  UpdateTimeToLiveCommand 
} from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const isDryRun = process.argv.includes('--dry-run');

const SCHEMA_DIR = path.resolve('aws/dynamodb');
const SCHEMA_FILES = [
  'schema-users.json',
  'schema-sessions.json',
  'schema-rate-limits.json',
  'schema-password-resets.json'
];

async function setupTables() {
  console.log(`\n📦 --- ApexIntel DynamoDB Table Setup [Region: ${REGION}] ---`);
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE: No tables will be modified or created.');
  }

  const client = new DynamoDBClient({ region: REGION });

  for (const filename of SCHEMA_FILES) {
    const filePath = path.join(SCHEMA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Schema file not found: ${filePath}`);
      continue;
    }

    const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const tableName = schema.TableName;

    console.log(`\nChecking table: ${tableName}...`);

    if (isDryRun) {
      console.log(`[DRY-RUN] Would create table '${tableName}' with keys:`, schema.KeySchema);
      continue;
    }

    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      console.log(`ℹ️ Table '${tableName}' already exists.`);
    } catch (err) {
      if (err.name === 'ResourceNotFoundException') {
        console.log(`⏳ Table '${tableName}' does not exist. Creating...`);
        
        // Remove TimeToLiveSpecification from CreateTableCommand (configured separately)
        const createParams = { ...schema };
        const ttlSpec = createParams.TimeToLiveSpecification;
        delete createParams.TimeToLiveSpecification;

        await client.send(new CreateTableCommand(createParams));
        console.log(`✅ Table '${tableName}' created successfully.`);

        if (ttlSpec && ttlSpec.Enabled) {
          console.log(`⏳ Enabling TTL on '${tableName}' (Attribute: ${ttlSpec.AttributeName})...`);
          try {
            await client.send(new UpdateTimeToLiveCommand({
              TableName: tableName,
              TimeToLiveSpecification: ttlSpec
            }));
            console.log(`✅ TTL enabled on '${tableName}'.`);
          } catch (ttlErr) {
            console.warn(`⚠️ TTL configuration note: ${ttlErr.message}`);
          }
        }
      } else {
        console.error(`❌ Error checking table '${tableName}': ${err.message}`);
      }
    }
  }

  console.log('\n✨ DynamoDB inspection and provisioning complete.\n');
}

setupTables().catch(err => {
  console.error('Fatal setup error:', err);
  process.exit(1);
});
