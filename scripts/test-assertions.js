import fs from 'fs';

const html = fs.readFileSync('public/index.html', 'utf8');

console.log('--- VERIFYING CHECKOUT MODAL & SCRIPT BUNDLE ---');
console.log('1. No Apple Pay button:', !html.includes('payTab-applepay'));
console.log('2. No Zero-Duplicate Ledger in modal:', !html.includes('Zero-Duplicate Ledger Enabled'));
console.log('3. No Bank-Level 256-bit AES:', !html.includes('Stripe / Bank-Level 256-bit AES'));
console.log('4. Has Credit/Debit Card tab:', html.includes('payTab-card'));
console.log('5. Has PayPal tab (@ApexIntelB2B):', html.includes('payTab-paypal') && html.includes('@ApexIntelB2B'));
console.log('6. Has cardBrandBadge:', html.includes('cardBrandBadge'));
console.log('7. Has formatCardNumberInput:', html.includes('formatCardNumberInput'));
console.log('8. Has formatExpiryInput:', html.includes('formatExpiryInput'));
console.log('9. Has Encrypted Checkout footer:', html.includes('🔒 Encrypted Checkout'));
console.log('10. Has Instant Digital Delivery footer:', html.includes('Instant Digital Delivery'));

// Test formatting function logic directly
let fakeInput = { value: '4242424242424242' };
let fakeBadge = { innerText: '', className: '' };
global.document = {
  getElementById: (id) => (id === 'cardBrandBadge' ? fakeBadge : null)
};

// Evaluate formatCardNumberInput
const evalMatch = html.match(/window\.formatCardNumberInput = function[\s\S]*?\n  \};/);
if (evalMatch) {
  const formatCardNumberInput = new Function('input', evalMatch[0].replace('window.formatCardNumberInput = function (input) {', '').replace(/\n  \};$/, ''));
  formatCardNumberInput(fakeInput);
  console.log('Test Card formatting 4242... ->', fakeInput.value, '| Badge ->', fakeBadge.innerText);

  fakeInput.value = '5555555555555555';
  formatCardNumberInput(fakeInput);
  console.log('Test Card formatting 5555... ->', fakeInput.value, '| Badge ->', fakeBadge.innerText);

  fakeInput.value = '378282246310005';
  formatCardNumberInput(fakeInput);
  console.log('Test Card formatting 3782... ->', fakeInput.value, '| Badge ->', fakeBadge.innerText);

  fakeInput.value = '6011111111111111';
  formatCardNumberInput(fakeInput);
  console.log('Test Card formatting 6011... ->', fakeInput.value, '| Badge ->', fakeBadge.innerText);
}

// Evaluate formatExpiryInput
const expMatch = html.match(/window\.formatExpiryInput = function[\s\S]*?\n  \};/);
if (expMatch) {
  const formatExpiryInput = new Function('input', 'e', expMatch[0].replace('window.formatExpiryInput = function (input, e) {', '').replace(/\n  \};$/, ''));
  let fakeExp = { value: '1228' };
  formatExpiryInput(fakeExp, null);
  console.log('Test Expiry formatting "1228" ->', fakeExp.value);

  let fakeExp2 = { value: '12/' };
  formatExpiryInput(fakeExp2, { inputType: 'deleteContentBackward' });
  console.log('Test Expiry backspace on "12/" ->', fakeExp2.value);
}
