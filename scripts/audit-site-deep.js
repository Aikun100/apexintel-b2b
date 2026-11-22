import fs from 'fs';

const html = fs.readFileSync('public/index.html', 'utf8');

console.log('=== SITE DEEP AUDIT ===');
console.log('Total characters:', html.length);
console.log('Total lines:', html.split('\n').length);

// Extract all section tags or main containers
const sections = html.match(/<section[^>]*id="([^"]*)"[^>]*>/g) || [];
console.log('\nSections with IDs:', sections);

// Extract all modals
const modals = html.match(/id="([^"]*modal[^"]*)"/gi) || [];
console.log('\nModals:', modals);

// Extract all forms
const forms = html.match(/<form[^>]*id="([^"]*)"[^>]*>/g) || [];
console.log('\nForms:', forms);

// Check existing tools
console.log('\nTool Checks:');
console.log('- Scanner present:', html.includes('scanner') || html.includes('Scan') || html.includes('audit'));
console.log('- ROI Calculator present:', html.includes('calculator') || html.includes('Calculator') || html.includes('ROI'));
console.log('- Cold Email Generator present:', html.includes('pitch') || html.includes('pitchModal') || html.includes('generator') || html.includes('emailGenerator'));
console.log('- Lead Quality Analyzer present:', html.includes('analyzer') || html.includes('Analyzer') || html.includes('qualityScore'));
console.log('- Dataset Preview present:', html.includes('leadTableBody') || html.includes('previewTable'));
console.log('- Custom Data Request Builder present:', html.includes('customData') || html.includes('customRequest') || html.includes('customOrder'));

// Check Dashboards
console.log('\nDashboard Checks:');
console.log('- Customer Dashboard present:', html.includes('customerDashboardModal') || html.includes('openCustomerDashboard'));
console.log('- Admin Command Center present:', html.includes('adminDashboardModal') || html.includes('openAdminDashboard'));
console.log('- Auth modal present:', html.includes('authModal') || html.includes('openAuthModal'));

// Check Navigation & Footers
console.log('\nNavigation & Footer Checks:');
console.log('- Nav links:', html.match(/<nav[\s\S]*?<\/nav>/i)?.[0]?.match(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g));
console.log('- Footer present:', html.includes('<footer'));
