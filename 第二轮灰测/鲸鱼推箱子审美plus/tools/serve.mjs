/**
 * Zero-dependency static file server.
 *
 * ES modules are fetched with CORS rules that a file:// page cannot satisfy, so
 * the project is served over http. Everything else (three.js, the typefaces) is
 * fetched from a CDN by the browser.
 *
 *   node tools/serve.mjs [port]
 */
import { createServer } from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8123);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.hdr': 'image/vnd.radiance',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const target = path.join(root, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

    if (!target.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || stat.isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`404 ${rel}`);
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-cache',
    });
    createReadStream(target).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end(String(err));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Tallgrass is served from ${root}`);
  console.log(`Open  http://127.0.0.1:${port}/`);
  console.log('Stop with Ctrl+C.');
});
