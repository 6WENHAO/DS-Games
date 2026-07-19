const http = require('http'), fs = require('fs'), path = require('path');
const mt = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const f = path.join(process.cwd(), u);
  fs.readFile(f, (e, d) => {
    if (e) { s.statusCode = 404; s.end('nf'); return; }
    s.setHeader('Content-Type', mt[path.extname(f)] || 'application/octet-stream');
    s.end(d);
  });
}).listen(8765, () => console.log('serving on 8765'));
