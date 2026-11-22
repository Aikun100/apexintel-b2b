import fs from 'fs';

const html = fs.readFileSync('public/index.html', 'utf-8');

console.log('--- AUDITING INDEX.HTML ---');

// 1. Check local images
const imgMatches = html.match(/src="([^"]+)"/g) || [];
const uniqueImages = [...new Set(imgMatches.map(m => m.replace(/src="|"/g, '')))].filter(s => !s.startsWith('http') && !s.startsWith('data:'));
console.log('Images to verify:', uniqueImages);
uniqueImages.forEach(img => {
  const p = 'public' + (img.startsWith('/') ? img : '/' + img);
  console.log(`Image [${img}]:`, fs.existsSync(p) ? '✅ OK' : '❌ MISSING');
});

// 2. Check anchor links
const anchorMatches = html.match(/href="(#[^"]+)"/g) || [];
const uniqueAnchors = [...new Set(anchorMatches.map(m => m.replace(/href="|"/g, '')))];
console.log('\nAnchors to verify:', uniqueAnchors);
uniqueAnchors.forEach(a => {
  if (a.length > 1) {
    const targetId = a.substring(1);
    const exists = html.includes(`id="${targetId}"`) || html.includes(`name="${targetId}"`);
    console.log(`Anchor [${a}]:`, exists ? '✅ OK' : `❌ TARGET MISSING (#${targetId})`);
  }
});

// 3. Inspect onclick handlers
const onclickMatches = html.match(/onclick="([^"]+)"/g) || [];
const uniqueHandlers = [...new Set(onclickMatches.map(m => m.replace(/onclick="|"/g, '')))];
console.log('\nUnique onclick handlers found:', uniqueHandlers.length);

// 4. Check for mobile viewport friendliness and text contrast
console.log('Meta viewport:', html.includes('name="viewport" content="width=device-width, initial-scale=1.0"'));
console.log('Tailwind loaded:', html.includes('cdn.tailwindcss.com'));
console.log('Google fonts loaded:', html.includes('fonts.googleapis.com'));
