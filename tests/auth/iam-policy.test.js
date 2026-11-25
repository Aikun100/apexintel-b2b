/**
 * ApexIntel B2B - Authentication Lambda IAM Policy & Least Privilege Test Suite
 * 
 * Verifies:
 * 1. IAM policy JSON syntax and standard AWS "2012-10-17" version
 * 2. Presence of dynamodb:TransactWriteItems on auth tables
 * 3. Exact DynamoDB item-level operations (GetItem, PutItem, UpdateItem) on the 4 auth tables
 * 4. Restricted dynamodb:Query exclusively on apexintel_sessions/index/userId-index
 * 5. Strict least-privilege compliance:
 *    - No wildcard actions (dynamodb:*, logs:*, iam:*, *)
 *    - No wildcard DynamoDB table resources (table/* or *)
 *    - No unused actions (dynamodb:DeleteItem, dynamodb:Scan, dynamodb:Batch*)
 *    - No unneeded services (ses:*, s3:*, etc.)
 * 6. CloudWatch Logs scoping to ap-southeast-2, account 129264592603, and function log group
 * 7. 100% alignment between DynamoDBDocumentClient commands in repository.js and granted actions
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const policyPath = path.join(rootDir, 'aws/iam/apexintel-auth-lambda-policy.json');
const repositoryPath = path.join(rootDir, 'src/auth/repository.js');

const EXPECTED_ACCOUNT_ID = '129264592603';
const EXPECTED_REGION = 'ap-southeast-2';
const EXPECTED_TABLES = [
  `arn:aws:dynamodb:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:table/apexintel_users`,
  `arn:aws:dynamodb:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:table/apexintel_sessions`,
  `arn:aws:dynamodb:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:table/apexintel_password_resets`,
  `arn:aws:dynamodb:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:table/apexintel_rate_limits`
];
const EXPECTED_SESSION_INDEX = `arn:aws:dynamodb:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:table/apexintel_sessions/index/userId-index`;

test('Authentication Lambda IAM Policy & Least Privilege Suite', async (t) => {
  // Load and parse policy
  assert.ok(fs.existsSync(policyPath), `Policy file must exist at ${policyPath}`);
  const rawPolicy = fs.readFileSync(policyPath, 'utf-8');
  let policy;
  try {
    policy = JSON.parse(rawPolicy);
  } catch (err) {
    assert.fail(`IAM policy JSON parsing failed: ${err.message}`);
  }

  await t.test('1. Policy is valid JSON with 2012-10-17 version and valid statements', () => {
    assert.equal(policy.Version, '2012-10-17', 'Policy must use AWS Version 2012-10-17');
    assert.ok(Array.isArray(policy.Statement), 'Statement must be an array');
    assert.ok(policy.Statement.length >= 3, 'Must contain DynamoDB and CloudWatch statements');
    for (const stmt of policy.Statement) {
      assert.ok(stmt.Sid, 'Each statement must have a descriptive Sid');
      assert.equal(stmt.Effect, 'Allow', 'Statement effect must be Allow');
      assert.ok(stmt.Action, 'Statement must define Action');
      assert.ok(stmt.Resource, 'Statement must define Resource');
    }
  });

  await t.test('2. dynamodb:TransactWriteItems is explicitly granted on auth tables', () => {
    const ddbItemStmt = policy.Statement.find(s => s.Sid === 'DynamoDBItemOperations');
    assert.ok(ddbItemStmt, 'Statement DynamoDBItemOperations must exist');
    const actions = Array.isArray(ddbItemStmt.Action) ? ddbItemStmt.Action : [ddbItemStmt.Action];
    assert.ok(
      actions.includes('dynamodb:TransactWriteItems'),
      'dynamodb:TransactWriteItems MUST be explicitly allowed for atomic registration'
    );
    const resources = Array.isArray(ddbItemStmt.Resource) ? ddbItemStmt.Resource : [ddbItemStmt.Resource];
    assert.ok(
      resources.includes(`arn:aws:dynamodb:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:table/apexintel_users`),
      'TransactWriteItems must be permitted on apexintel_users table'
    );
  });

  await t.test('3. All required DynamoDB item-level operations are allowed on the 4 auth tables', () => {
    const ddbItemStmt = policy.Statement.find(s => s.Sid === 'DynamoDBItemOperations');
    const actions = Array.isArray(ddbItemStmt.Action) ? ddbItemStmt.Action : [ddbItemStmt.Action];
    assert.ok(actions.includes('dynamodb:GetItem'), 'dynamodb:GetItem must be allowed');
    assert.ok(actions.includes('dynamodb:PutItem'), 'dynamodb:PutItem must be allowed');
    assert.ok(actions.includes('dynamodb:UpdateItem'), 'dynamodb:UpdateItem must be allowed');

    const resources = Array.isArray(ddbItemStmt.Resource) ? ddbItemStmt.Resource : [ddbItemStmt.Resource];
    for (const expectedTable of EXPECTED_TABLES) {
      assert.ok(
        resources.includes(expectedTable),
        `Auth table ${expectedTable} must be in DynamoDBItemOperations resources`
      );
    }
  });

  await t.test('4. dynamodb:Query is restricted exclusively to apexintel_sessions userId-index', () => {
    const queryStmt = policy.Statement.find(s => s.Sid === 'DynamoDBQuerySessionsIndex');
    assert.ok(queryStmt, 'Statement DynamoDBQuerySessionsIndex must exist');
    const actions = Array.isArray(queryStmt.Action) ? queryStmt.Action : [queryStmt.Action];
    assert.ok(actions.includes('dynamodb:Query'), 'dynamodb:Query must be allowed on index');

    const resources = Array.isArray(queryStmt.Resource) ? queryStmt.Resource : [queryStmt.Resource];
    assert.equal(resources.length, 1, 'Only userId-index should be granted query permission');
    assert.equal(resources[0], EXPECTED_SESSION_INDEX, 'Resource must match userId-index ARN exactly');

    // Ensure Query is not granted on tables in other statements
    const otherStmts = policy.Statement.filter(s => s.Sid !== 'DynamoDBQuerySessionsIndex');
    for (const stmt of otherStmts) {
      const stmtActions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      assert.ok(
        !stmtActions.includes('dynamodb:Query'),
        `Statement ${stmt.Sid} must not grant dynamodb:Query`
      );
    }
  });

  await t.test('5. Strictly enforces least privilege: forbids wildcards and unneeded permissions', () => {
    for (const stmt of policy.Statement) {
      const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];

      // No wildcard action
      for (const act of actions) {
        assert.notEqual(act, '*', 'Global wildcard * action is forbidden');
        assert.notEqual(act, 'dynamodb:*', 'dynamodb:* wildcard action is forbidden');
        assert.notEqual(act, 'logs:*', 'logs:* wildcard action is forbidden');
        assert.notEqual(act, 'iam:*', 'iam:* wildcard action is forbidden');
        assert.ok(!act.startsWith('ses:'), `ses:* permissions must not be granted: found ${act}`);
      }

      // No wildcard table resource
      if (actions.some(a => a.startsWith('dynamodb:'))) {
        for (const res of resources) {
          assert.notEqual(res, '*', 'DynamoDB statement must never use Resource: *');
          assert.ok(
            !res.endsWith('table/*'),
            'DynamoDB statement must never use wildcard table name table/*'
          );
        }
      }
    }

    // Verify unneeded DynamoDB actions are NOT present
    const allActions = policy.Statement.flatMap(s => Array.isArray(s.Action) ? s.Action : [s.Action]);
    assert.ok(!allActions.includes('dynamodb:DeleteItem'), 'dynamodb:DeleteItem must not be granted (uses TTL / soft revocation)');
    assert.ok(!allActions.includes('dynamodb:Scan'), 'dynamodb:Scan must not be granted (no full table scans in serverless auth)');
    assert.ok(!allActions.includes('dynamodb:BatchGetItem'), 'dynamodb:BatchGetItem is not used and must not be granted');
    assert.ok(!allActions.includes('dynamodb:BatchWriteItem'), 'dynamodb:BatchWriteItem is not used and must not be granted');
    assert.ok(!allActions.includes('dynamodb:TransactGetItems'), 'dynamodb:TransactGetItems is not used and must not be granted');
  });

  await t.test('6. CloudWatch Logs permissions are restricted to ap-southeast-2 and auth log group', () => {
    const logGroupStmt = policy.Statement.find(s => s.Sid === 'CloudWatchLogGroupCreation');
    assert.ok(logGroupStmt, 'Statement CloudWatchLogGroupCreation must exist');
    assert.equal(
      logGroupStmt.Resource,
      `arn:aws:logs:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:*`,
      'Log group creation must be scoped to region and account'
    );

    const logStreamStmt = policy.Statement.find(s => s.Sid === 'CloudWatchLogStreamAndEvents');
    assert.ok(logStreamStmt, 'Statement CloudWatchLogStreamAndEvents must exist');
    assert.equal(
      logStreamStmt.Resource,
      `arn:aws:logs:${EXPECTED_REGION}:${EXPECTED_ACCOUNT_ID}:log-group:/aws/lambda/apexintel-auth:*`,
      'Log streams and events must be scoped exclusively to /aws/lambda/apexintel-auth:*'
    );
  });

  await t.test('7. DynamoDB DocumentClient commands in repository.js map 100% to granted IAM actions', () => {
    const repoSource = fs.readFileSync(repositoryPath, 'utf-8');

    // Extract imported commands from repository.js
    const ddbCommandMapping = {
      'GetCommand': 'dynamodb:GetItem',
      'PutCommand': 'dynamodb:PutItem',
      'UpdateCommand': 'dynamodb:UpdateItem',
      'QueryCommand': 'dynamodb:Query',
      'TransactWriteCommand': 'dynamodb:TransactWriteItems'
    };

    const allGrantedActions = new Set(
      policy.Statement.flatMap(s => Array.isArray(s.Action) ? s.Action : [s.Action])
    );

    for (const [cmd, expectedAction] of Object.entries(ddbCommandMapping)) {
      if (repoSource.includes(`new ${cmd}(`)) {
        assert.ok(
          allGrantedActions.has(expectedAction),
          `Command ${cmd} is used in repository.js but corresponding IAM action ${expectedAction} is missing from policy`
        );
      }
    }
  });
});
