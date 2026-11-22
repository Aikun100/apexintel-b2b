#!/usr/bin/env node
/**
 * ApexIntel B2B - Lambda Deployment Packager
 * 
 * Builds a clean, minimal Node.js 20 ESM deployment ZIP for AWS Lambda.
 * Target: dist/apexintel-auth-lambda.zip
 * 
 * Includes:
 * - aws/lambda-auth-handler.mjs (and root index.mjs export)
 * - src/auth/** (full authentication module)
 * - package.json (ESM declaration & minimal runtime metadata)
 * - node_modules with ONLY auth production dependencies:
 *   - @aws-sdk/client-dynamodb
 *   - @aws-sdk/lib-dynamodb
 *   - validator
 * 
 * Strictly excludes:
 * - public/, output/, sales/, docs/, tests/, audits/, scripts/
 * - .git/, .env*, *.pem, credentials
 * - heavy non-auth modules (wrangler, stripe, crawlee, cheerio, exceljs, sharp, etc.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const stagingDir = path.join(distDir, 'lambda-auth-staging');
const outputZip = path.join(distDir, 'apexintel-auth-lambda.zip');

console.log('📦 Starting ApexIntel Auth Lambda Deployment Packaging...');
console.log(`- Project Root: ${rootDir}`);
console.log(`- Output Target: ${outputZip}\n`);

// 1. Prepare Dist & Staging Directory
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (fs.existsSync(outputZip)) {
  fs.rmSync(outputZip, { force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// 2. Copy AWS Handler & Create Entrypoints
const stagingAwsDir = path.join(stagingDir, 'aws');
fs.mkdirSync(stagingAwsDir, { recursive: true });
fs.copyFileSync(
  path.join(rootDir, 'aws', 'lambda-auth-handler.mjs'),
  path.join(stagingAwsDir, 'lambda-auth-handler.mjs')
);
console.log('  ✓ Included aws/lambda-auth-handler.mjs');

// Create root index.mjs for flexibility with handler configuration (supports index.handler or aws/lambda-auth-handler.handler)
const indexMjsContent = `/**
 * ApexIntel B2B - Lambda Root Entrypoint Alias
 */
export { handler } from './aws/lambda-auth-handler.mjs';
`;
fs.writeFileSync(path.join(stagingDir, 'index.mjs'), indexMjsContent, 'utf-8');
console.log('  ✓ Generated root index.mjs re-export');

// 3. Copy src/auth/ Modules
const stagingAuthDir = path.join(stagingDir, 'src', 'auth');
fs.mkdirSync(stagingAuthDir, { recursive: true });

const authSourceDir = path.join(rootDir, 'src', 'auth');
const authFiles = fs.readdirSync(authSourceDir);
for (const file of authFiles) {
  const srcPath = path.join(authSourceDir, file);
  if (fs.statSync(srcPath).isFile()) {
    fs.copyFileSync(srcPath, path.join(stagingAuthDir, file));
    console.log(`  ✓ Included src/auth/${file}`);
  }
}

// 4. Create Minimal Scoped package.json
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const lambdaPackageJson = {
  name: 'apexintel-auth-lambda',
  version: rootPackageJson.version || '1.0.0',
  type: 'module',
  main: 'aws/lambda-auth-handler.mjs',
  description: 'ApexIntel B2B Serverless Authentication Service for AWS Lambda Node.js 20',
  dependencies: {
    '@aws-sdk/client-dynamodb': rootPackageJson.dependencies['@aws-sdk/client-dynamodb'] || '^3.1175.0',
    '@aws-sdk/lib-dynamodb': rootPackageJson.dependencies['@aws-sdk/lib-dynamodb'] || '^3.1175.0',
    'validator': rootPackageJson.dependencies['validator'] || '^13.15.35'
  }
};

fs.writeFileSync(
  path.join(stagingDir, 'package.json'),
  JSON.stringify(lambdaPackageJson, null, 2),
  'utf-8'
);
console.log('  ✓ Generated scoped package.json (Node.js 20 ESM, 3 production dependencies)');

// 5. Install Minimal Production Dependencies
console.log('\n📥 Installing production dependencies in staging area...');
execSync('npm install --omit=dev --no-audit --no-fund --legacy-peer-deps', {
  cwd: stagingDir,
  stdio: 'inherit'
});

// Clean up any unnecessary staging artifacts (lockfile, npm cache)
const lockfile = path.join(stagingDir, 'package-lock.json');
if (fs.existsSync(lockfile)) {
  fs.rmSync(lockfile, { force: true });
}

// 6. Create Deployment ZIP Archive
console.log('\n🗜️  Compressing deployment package into ZIP...');
if (process.platform === 'win32') {
  // Use PowerShell .NET ZipFile for lightning-fast, POSIX-compliant ZIP archiving on Windows
  const psCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${stagingDir.replace(/'/g, "''")}', '${outputZip.replace(/'/g, "''")}')`;
  execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, {
    stdio: 'inherit'
  });
} else {
  execSync(`zip -q -r "${outputZip}" .`, {
    cwd: stagingDir,
    stdio: 'inherit'
  });
}

// 7. Clean up Staging Directory
fs.rmSync(stagingDir, { recursive: true, force: true });

// 8. Output Package Summary
const stats = fs.statSync(outputZip);
const sizeKb = (stats.size / 1024).toFixed(2);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n✨ Lambda deployment package created successfully!');
console.log(`- Archive: ${outputZip}`);
console.log(`- Size: ${stats.size} bytes (${sizeKb} KB / ${sizeMb} MB)`);
console.log('- Runtime Compatibility: AWS Lambda Node.js 20.x (x86_64 or ARM64)');
console.log('- Handlers Available: `aws/lambda-auth-handler.handler` or `index.handler`\n');
