import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 3000;
const PUBLIC_DIR = path.resolve('./public');
const COVERS_DIR = path.resolve('./output/covers');

if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  // Handle POST to save rendered cover images
  if (req.method === 'POST' && req.url.startsWith('/save-cover')) {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const filename = urlObj.searchParams.get('name') || 'cover.png';
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const base64Data = body.replace(/^data:image\/png;base64,/, '');
      const filePath = path.join(COVERS_DIR, filename);
      fs.writeFileSync(filePath, base64Data, 'base64');
      console.log(`📸 Saved cover image: ${filePath}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: filePath }));
    });
    return;
  }

  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath);
  let contentType = 'text/html';
  if (ext === '.css') contentType = 'text/css';
  if (ext === '.js') contentType = 'text/javascript';
  if (ext === '.json') contentType = 'application/json';
  if (ext === '.png') contentType = 'image/png';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`🚀 Sales Showcase live at http://localhost:${PORT}`);
});
