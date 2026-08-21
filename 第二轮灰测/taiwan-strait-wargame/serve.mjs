/**
 * serve.mjs — 可选的本地静态服务器（若你希望用 http:// 而非 file:// 打开）
 * 用法: node serve.mjs [端口]   然后浏览器访问 http://127.0.0.1:8787/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(import.meta.dirname);
const PORT = Number(process.argv[2] || 8787);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + p); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('台海兵棋推演系统: http://127.0.0.1:' + PORT + '/');
  console.log('直接跳转示例:      http://127.0.0.1:' + PORT + '/#sc=invasion&ff=36&z=8.4');
});
