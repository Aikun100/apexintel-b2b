#!/usr/bin/env node
/**
 * ApexIntel B2B - Unified Lambda Packager
 * 
 * Builds minimal, production-grade Node.js 20 ESM deployment ZIPs for all 6 AWS Lambdas:
 * 1. apexintel-auth-lambda.zip
 * 2. apexintel-crm-lambda.zip
 * 3. apexintel-payments-lambda.zip
 * 4. apexintel-crawler-lambda.zip
 * 5. apexintel-tools-lambda.zip
 * 6. apexintel-requests-lambda.zip
 * 
 * Enforces:
 * - ESM declaration ("type": "module")
 * - Root index.mjs re-export for handler alias flexibility
 * - Only required production dependencies
 * - Zero .env, git, tests, docs, public frontend, or dev dependencies
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

const BASE_DEPS = {
  '@aws-sdk/client-dynamodb': rootPackageJson.dependencies['@aws-sdk/client-dynamodb'] || '^3.1175.0',
  '@aws-sdk/lib-dynamodb': rootPackageJson.dependencies['@aws-sdk/lib-dynamodb'] || '^3.1175.0',
  'validator': rootPackageJson.dependencies['validator'] || '^13.15.35'
};

const PAYMENTS_DEPS = {
  ...BASE_DEPS,
  '@aws-sdk/client-s3': rootPackageJson.dependencies['@aws-sdk/client-s3'] || '^3.1175.0',
  '@aws-sdk/s3-request-presigner': rootPackageJson.dependencies['@aws-sdk/s3-request-presigner'] || '^3.1175.0',
  'stripe': rootPackageJson.dependencies['stripe'] || '^23.2.0'
};

const LAMBDA_CONFIGS = [
  {
    name: 'apexintel-auth-lambda',
    zipName: 'apexintel-auth-lambda.zip',
    handlerFile: 'lambda-auth-handler.mjs',
    srcDirs: ['auth'],
    extraAwsFiles: [],
    dependencies: BASE_DEPS,
    description: 'ApexIntel B2B Authentication & Session Lifecycle Service'
  },
  {
    name: 'apexintel-crm-lambda',
    zipName: 'apexintel-crm-lambda.zip',
    handlerFile: 'lambda-crm-handler.mjs',
    srcDirs: ['crm', 'auth'],
    extraSrcFiles: ['tools/opportunity-scorer.js'],
    extraAwsFiles: [],
    dependencies: BASE_DEPS,
    description: 'ApexIntel B2B Multi-Tenant CRM Backend Service'
  },
  {
    name: 'apexintel-payments-lambda',
    zipName: 'apexintel-payments-lambda.zip',
    handlerFile: 'lambda-payments-handler.mjs',
    srcDirs: ['payments', 'auth'],
    extraSrcFiles: [],
    extraAwsFiles: [],
    dependencies: PAYMENTS_DEPS,
    description: 'ApexIntel B2B Payments & S3 Presigned URL Fulfillment Service'
  },
  {
    name: 'apexintel-crawler-lambda',
    zipName: 'apexintel-crawler-lambda.zip',
    handlerFile: 'lambda-crawler-handler.mjs',
    srcDirs: ['discovery', 'auth'],
    extraSrcFiles: ['tools/opportunity-scorer.js', 'payments/repository.js', 'payments/catalog.js', 'requests/repository.js'],
    extraAwsFiles: ['deduplication-engine.mjs'],
    dependencies: BASE_DEPS,
    description: 'ApexIntel B2B Lead Crawler & Ingestion Pipeline'
  },
  {
    name: 'apexintel-tools-lambda',
    zipName: 'apexintel-tools-lambda.zip',
    handlerFile: 'lambda-tools-handler.mjs',
    srcDirs: ['tools', 'auth'],
    extraAwsFiles: [],
    dependencies: BASE_DEPS,
    description: 'ApexIntel B2B Website Intelligence Scanner & SSRF Guard'
  },
  {
    name: 'apexintel-requests-lambda',
    zipName: 'apexintel-requests-lambda.zip',
    handlerFile: 'lambda-requests-handler.mjs',
    srcDirs: ['requests', 'auth'],
    extraAwsFiles: [],
    dependencies: BASE_DEPS,
    description: 'ApexIntel B2B Custom Extraction Requests & Admin Queue Service'
  }
];

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function packageLambda(config, cacheDirs) {
  const stagingDir = path.join(distDir, `staging-${config.name}`);
  const outputZip = path.join(distDir, config.zipName);

  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`📦 Packaging: ${config.name}`);
  console.log(`   Target: dist/${config.zipName}`);
  console.log(`--------------------------------------------------------------------------------`);

  // Clean staging & existing zip
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  if (fs.existsSync(outputZip)) {
    fs.rmSync(outputZip, { force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  // 1. Copy aws handler & extras
  const stagingAwsDir = path.join(stagingDir, 'aws');
  fs.mkdirSync(stagingAwsDir, { recursive: true });
  fs.copyFileSync(
    path.join(rootDir, 'aws', config.handlerFile),
    path.join(stagingAwsDir, config.handlerFile)
  );

  for (const extra of config.extraAwsFiles) {
    const srcExtra = path.join(rootDir, 'aws', extra);
    if (fs.existsSync(srcExtra)) {
      fs.copyFileSync(srcExtra, path.join(stagingAwsDir, extra));
    }
  }

  // 2. Generate root index.mjs re-export alias
  const indexMjsContent = `/**
 * ApexIntel B2B - Lambda Entrypoint Alias
 */
export { handler } from './aws/${config.handlerFile}';
`;
  fs.writeFileSync(path.join(stagingDir, 'index.mjs'), indexMjsContent, 'utf-8');

  // 3. Copy required src/ modules
  for (const srcDirName of config.srcDirs) {
    const srcPath = path.join(rootDir, 'src', srcDirName);
    const destPath = path.join(stagingDir, 'src', srcDirName);
    if (fs.existsSync(srcPath)) {
      copyDirRecursive(srcPath, destPath);
    }
  }

  // Copy extra individual src files
  if (Array.isArray(config.extraSrcFiles)) {
    for (const extraFile of config.extraSrcFiles) {
      const srcFilePath = path.join(rootDir, 'src', extraFile);
      const destFilePath = path.join(stagingDir, 'src', extraFile);
      const destFileDir = path.dirname(destFilePath);
      if (fs.existsSync(srcFilePath)) {
        if (!fs.existsSync(destFileDir)) {
          fs.mkdirSync(destFileDir, { recursive: true });
        }
        fs.copyFileSync(srcFilePath, destFilePath);
      }
    }
  }

  // 4. Create scoped package.json
  const lambdaPkg = {
    name: config.name,
    version: rootPackageJson.version || '1.0.0',
    type: 'module',
    main: `aws/${config.handlerFile}`,
    description: config.description,
    dependencies: config.dependencies
  };
  fs.writeFileSync(
    path.join(stagingDir, 'package.json'),
    JSON.stringify(lambdaPkg, null, 2),
    'utf-8'
  );

  // 5. Copy pre-warmed production node_modules from cache
  const cacheKey = config.name === 'apexintel-payments-lambda' ? 'payments' : 'base';
  const cachedModules = path.join(cacheDirs[cacheKey], 'node_modules');
  console.log(`   Copying isolated production dependencies (${cacheKey})...`);
  copyDirRecursive(cachedModules, path.join(stagingDir, 'node_modules'));

  // 6. Compress into ZIP
  console.log(`   Creating ZIP archive...`);
  if (process.platform === 'win32') {
    const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingDir.replace(/'/g, "''")}', '${outputZip.replace(/'/g, "''")}')`;
    execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, { stdio: 'inherit' });
  } else {
    execSync(`zip -q -r "${outputZip}" .`, { cwd: stagingDir, stdio: 'inherit' });
  }

  // Clean staging directory
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const stats = fs.statSync(outputZip);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`   ✓ Done: ${config.zipName} (${sizeMb} MB)`);

  return {
    name: config.name,
    zipName: config.zipName,
    sizeBytes: stats.size,
    sizeMb
  };
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 ApexIntel B2B — Unified Multi-Lambda Packager');
  console.log(`📍 Project Root: ${rootDir}`);
  console.log(`📁 Target Directory: ${distDir}\n`);

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Prepare dependency caches
  const cacheBase = path.join(distDir, 'cache-base');
  const cachePayments = path.join(distDir, 'cache-payments');

  console.log('📥 Pre-warming base production dependency cache...');
  if (!fs.existsSync(path.join(cacheBase, 'node_modules'))) {
    fs.mkdirSync(cacheBase, { recursive: true });
    fs.writeFileSync(
      path.join(cacheBase, 'package.json'),
      JSON.stringify({ name: 'cache-base', type: 'module', dependencies: BASE_DEPS }, null, 2)
    );
    execSync('npm install --omit=dev --no-audit --no-fund --legacy-peer-deps', {
      cwd: cacheBase,
      stdio: 'inherit'
    });
  }

  console.log('\n📥 Pre-warming payments production dependency cache...');
  if (!fs.existsSync(path.join(cachePayments, 'node_modules'))) {
    fs.mkdirSync(cachePayments, { recursive: true });
    fs.writeFileSync(
      path.join(cachePayments, 'package.json'),
      JSON.stringify({ name: 'cache-payments', type: 'module', dependencies: PAYMENTS_DEPS }, null, 2)
    );
    execSync('npm install --omit=dev --no-audit --no-fund --legacy-peer-deps', {
      cwd: cachePayments,
      stdio: 'inherit'
    });
  }

  const cacheDirs = { base: cacheBase, payments: cachePayments };
  const results = [];

  for (const config of LAMBDA_CONFIGS) {
    const res = packageLambda(config, cacheDirs);
    results.push(res);
  }

  // Clean cache directories
  fs.rmSync(cacheBase, { recursive: true, force: true });
  fs.rmSync(cachePayments, { recursive: true, force: true });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================================');
  console.log('📦 LAMBDA PACKAGING SUMMARY');
  console.log('================================================================================\n');
  console.log('| Lambda Archive                    | Size (MB) | Status  |');
  console.log('|-----------------------------------|----------:|:-------:|');
  for (const r of results) {
    console.log(`| ${r.zipName.padEnd(33)} | ${(r.sizeMb + ' MB').padStart(9)} |  ✓ OK   |`);
  }
  console.log('|-----------------------------------|----------:|:-------:|');
  console.log(`Total packaging time: ${totalTime}s\n`);
  console.log('✨ All 6 Lambda packages generated successfully in dist/!\n');
}

main().catch(err => {
  console.error('Fatal packaging error:', err);
  process.exit(1);
});
