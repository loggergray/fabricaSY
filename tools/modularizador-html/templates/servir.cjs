// Servidor estático mínimo (módulos ES não abrem via file://).  Uso: node servir.cjs [pasta] [porta]
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.resolve(process.argv[2] || __dirname), porta = Number(process.argv[3]) || 5173;
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.normalize(path.join(raiz, p));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('404'); }
  s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(s);
}).listen(porta, '127.0.0.1', () => console.log('http://localhost:' + porta));
