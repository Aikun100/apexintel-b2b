import fs from 'fs';

const auth = fs.readFileSync('public/js/auth.js', 'utf-8');
const cust = fs.readFileSync('public/js/customer-dashboard.js', 'utf-8');
const adm = fs.readFileSync('public/js/admin-dashboard.js', 'utf-8');
const pay = fs.readFileSync('public/js/payment-engine.js', 'utf-8');
const tools = fs.readFileSync('public/js/tools-suite.js', 'utf-8');
const modals = fs.readFileSync('public/js/modals-and-knowledge.js', 'utf-8');

let html = fs.readFileSync('public/index.html', 'utf-8');

// Clean up any old script bundles at bottom
const scriptStartIdx = html.indexOf('  <!-- Modular SaaS Application Engine');
if (scriptStartIdx !== -1) {
  html = html.substring(0, scriptStartIdx);
} else {
  const bodyCloseIdx = html.lastIndexOf('</body>');
  if (bodyCloseIdx !== -1) {
    html = html.substring(0, bodyCloseIdx);
  }
}

const finalBundle = `  <!-- Modular SaaS Application Engine & Native Payment (Self-Contained) -->
  <script>
${auth}

${cust}

${adm}

${pay}

${tools}

${modals}
  </script>
</body>
</html>`;

html = html.trim() + '\n' + finalBundle;

fs.writeFileSync('public/index.html', html, 'utf-8');
console.log('Successfully bundled auth, customer-dash, admin-dash, payment engine, tools suite, and knowledge modals into public/index.html!');
