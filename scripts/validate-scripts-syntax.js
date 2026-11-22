import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('public/index.html', 'utf8');

const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];

console.log(`Found ${scriptMatches.length} script tags in public/index.html`);

scriptMatches.forEach((m, idx) => {
  const code = m[1].trim();
  if (!code) {
    console.log(`Script ${idx + 1}: Empty or external src`);
    return;
  }
  try {
    new vm.Script(code);
    console.log(`✓ Script ${idx + 1} (${code.length} chars): Syntax VALID`);
  } catch (err) {
    console.error(`✗ Script ${idx + 1} SYNTAX ERROR:`, err.message);
    const lines = code.split('\n');
    console.error('Line context:', lines.slice(Math.max(0, err.lineNumber - 5), err.lineNumber + 5).join('\n'));
  }
});
