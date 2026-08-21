/**
 * 极简静态服务器（零依赖）。
 *   node serve.mjs [port]
 * 因为项目使用 ES module + importmap，必须通过 http 访问（file:// 会被 CORS 拦住）。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path.endsWith('/')) path += 'index.html';
    const full = join(ROOT, normalize(path).replace(/^([/\\])+/, ''));
    if (!full.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(full);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`破晓号已就绪 → http://127.0.0.1:${PORT}/`);
  console.log(`静态根目录: ${ROOT}`);
});
