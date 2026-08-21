#!/usr/bin/env node
/**
 * serve.mjs —— 零依赖本地静态服务器
 * 本仿真使用原生 ES Module，浏览器禁止 file:// 下的模块跨源加载，因此必须经 HTTP 打开。
 *   用法： node serve.mjs [端口]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2] || '8791', 10);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/') pathname = '/index.html';
  const target = path.join(ROOT, path.normalize(pathname).replace(/^([/\\])+/, ''));
  if (!target.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(target, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + pathname); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = 'http://127.0.0.1:' + PORT + '/index.html';
  console.log('烟支缺陷检测系统仿真已启动： ' + addr);
  console.log('按 Ctrl+C 停止。');
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '""', addr], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [addr], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [addr], { detached: true, stdio: 'ignore' }).unref();
  }
});
server.on('error', (e) => {
  console.error('启动失败：' + e.message + '（端口可能被占用，试试 node serve.mjs 8899）');
  process.exit(1);
});
