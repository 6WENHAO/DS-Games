#!/usr/bin/env node
/**
 * tools/serve.js — 零依赖本地静态服务器（Node 14+ 即可，Linux/Windows/macOS 通用）
 *
 * 为什么需要它：浏览器在 file:// 下会把同目录的视频当作「跨源资源」，
 * WebGL 就无法把视频帧上传成纹理。用 http:// 打开就完全没有这个限制。
 * 本服务器实现了 HTTP Range（206），这是视频拖动定位必须的。
 *
 * 用法：
 *   node tools/serve.js                 # http://127.0.0.1:8321
 *   node tools/serve.js --port 9000 --open
 *   node tools/serve.js --host 0.0.0.0  # 允许局域网访问（谨慎）
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
}
const ROOT = path.resolve(arg('root', path.join(__dirname, '..')));
const HOST = arg('host', '127.0.0.1');
let PORT = parseInt(arg('port', '8321'), 10);
const OPEN = argv.includes('--open');
const QUIET = argv.includes('--quiet');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2'
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const p = path.normalize(path.join(root, decoded));
  if (!p.startsWith(root)) return null;   // 阻止 ../ 越权
  return p;
}

function send(res, code, headers, body) {
  res.writeHead(code, Object.assign({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff'
  }, headers));
  if (body) res.end(body); else res.end();
}

const server = http.createServer((req, res) => {
  const t0 = Date.now();
  let target = safeJoin(ROOT, url.parse(req.url).pathname || '/');
  if (!target) return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, '403 越权路径');

  fs.stat(target, (err, st) => {
    if (!err && st.isDirectory()) {
      target = path.join(target, 'index.html');
      st = null;
      err = null;
      try { st = fs.statSync(target); } catch (e) { err = e; }
    }
    if (err || !st || !st.isFile()) {
      log(404, req, target, t0);
      return send(res, 404, { 'Content-Type': 'text/html; charset=utf-8' },
        '<h1>404</h1><p>找不到：' + req.url + '</p><p><a href="/">回到播放器</a></p>');
    }

    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;

    // HTTP Range：视频精确定位必需
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        let start = m[1] === '' ? null : parseInt(m[1], 10);
        let end = m[2] === '' ? null : parseInt(m[2], 10);
        if (start === null && end !== null) { start = Math.max(0, st.size - end); end = st.size - 1; }
        if (start !== null && end === null) end = st.size - 1;
        if (start === null) { start = 0; end = st.size - 1; }
        if (start > end || start >= st.size) {
          return send(res, 416, { 'Content-Range': 'bytes */' + st.size });
        }
        end = Math.min(end, st.size - 1);
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Length': end - start + 1,
          'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(target, { start, end }).pipe(res);
        log(206, req, target, t0, (end - start + 1));
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
    log(200, req, target, t0, st.size);
  });
});

function log(code, req, file, t0, bytes) {
  if (QUIET) return;
  const rel = path.relative(ROOT, file) || '/';
  const size = bytes ? (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + 'MB' : Math.round(bytes / 1024) + 'KB') : '-';
  console.log(`  ${code}  ${req.method}  ${rel}  ${size}  ${Date.now() - t0}ms`);
}

function openBrowser(u) {
  const cmd = process.platform === 'win32' ? 'cmd'
    : (process.platform === 'darwin' ? 'open' : 'xdg-open');
  const args = process.platform === 'win32' ? ['/c', 'start', '""', u] : [u];
  try {
    const p = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    p.on('error', () => {});
    p.unref();
  } catch (e) { /* 打不开就算了，用户自己点链接 */ }
}

let tries = 0;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && tries < 12) {
    tries++;
    PORT++;
    console.log(`  端口被占用，换到 ${PORT} …`);
    server.listen(PORT, HOST);
  } else {
    console.error('启动失败：', err.message);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  const u = `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/index.html`;
  console.log('');
  console.log('  dsv4p max stantard imdoing — 本地服务器已启动');
  console.log('  根目录: ' + ROOT);
  console.log('  地址:   ' + u);
  console.log('  (Ctrl+C 退出)');
  console.log('');
  if (OPEN) openBrowser(u);
});
