async function verify() {
  console.log('=== VERIFYING LIVE CLOUDFLARE EDGE DEPLOYMENT ===');
  try {
    const live = await fetch('https://apexintel-b2b.shop');
    console.log('1. Live Domain Status:', live.status);
    const liveText = await live.text();
    console.log('2. Live Page Title:', liveText.match(/<title>(.*?)<\/title>/i)?.[1]);
    console.log('3. Contains Tool 1 (Scanner):', liveText.includes('TOOL 1 OF 6'));
    console.log('4. Contains Tool 2 (ROI Calc):', liveText.includes('TOOL 2 OF 6'));
    console.log('5. Contains Tool 3 (Outreach Gen):', liveText.includes('TOOL 3 OF 6'));
    console.log('6. Contains Tool 4 (Lead Analyzer):', liveText.includes('TOOL 4 OF 6'));
    console.log('7. Contains Tool 6 (Custom Request):', liveText.includes('TOOL 6 OF 6'));
    console.log('8. Contains Bento Value Prop:', liveText.includes('value-prop'));
    console.log('9. Contains Use Cases:', liveText.includes('use-cases'));
    console.log('10. Contains Comparison Matrix:', liveText.includes('comparisonModal'));
    console.log('11. Contains Knowledge Playbooks:', liveText.includes('openPlaybookModal'));
    console.log('12. Contains Verification Methodology:', liveText.includes('methodology'));
  } catch (err) {
    console.error('Error verifying live:', err.message);
  }

  try {
    const local = await fetch('http://localhost:3000');
    console.log('13. Localhost Status:', local.status);
  } catch (err) {
    console.error('Error verifying local:', err.message);
  }
}

verify();
