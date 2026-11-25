import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execSync } from 'child_process';

let totalFiles = 0;
let totalScripts = 0;
let errorsCount = 0;

function validateCode(code, label) {
  totalScripts++;
  try {
    new vm.Script(code);
    console.log(`✓ ${label} (${code.length} chars): Syntax VALID`);
    return true;
  } catch (err) {
    errorsCount++;
    console.error(`✗ ${label} SYNTAX ERROR: ${err.message}`);
    const lines = code.split('\n');
    console.error('Line context:', lines.slice(Math.max(0, (err.lineNumber || 1) - 5), (err.lineNumber || 1) + 5).join('\n'));
    return false;
  }
}

// 1. Validate inline scripts in public/index.html
if (fs.existsSync('public/index.html')) {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
  console.log(`Found ${scriptMatches.length} script tags in public/index.html`);

  scriptMatches.forEach((m, idx) => {
    const code = m[1].trim();
    if (!code) {
      console.log(`Script ${idx + 1}: Empty or external src`);
      return;
    }
    validateCode(code, `public/index.html Script #${idx + 1}`);
  });
}

// 2. Validate standalone JS files in public/js/*.js
if (fs.existsSync('public/js')) {
  const jsFiles = fs.readdirSync('public/js').filter(f => f.endsWith('.js'));
  console.log(`\nValidating ${jsFiles.length} standalone modules in public/js/`);
  for (const f of jsFiles) {
    const fullPath = path.join('public/js', f);
    const code = fs.readFileSync(fullPath, 'utf8');
    validateCode(code, fullPath);
  }
}

// 3. Validate backend modules in src/**/*.js using `node --check`
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      totalFiles++;
      totalScripts++;
      try {
        execSync(`node --check "${full}"`, { stdio: 'pipe' });
        console.log(`✓ ${full}: Syntax VALID (ESM)`);
      } catch (err) {
        errorsCount++;
        console.error(`✗ ${full} SYNTAX ERROR:\n${err.stderr?.toString() || err.message}`);
      }
    }
  }
}

if (fs.existsSync('src')) {
  console.log(`\nValidating backend source modules in src/`);
  scanDir('src');
}

console.log(`\n--------------------------------------------------`);
console.log(`Validation Complete: ${totalScripts} scripts checked across public and src/`);
if (errorsCount > 0) {
  console.error(`💥 Found ${errorsCount} syntax errors!`);
  process.exit(1);
} else {
  console.log(`✨ All scripts have valid JavaScript syntax!`);
  process.exit(0);
}
