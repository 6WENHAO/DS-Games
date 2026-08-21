#!/usr/bin/env node
/**
 * =====================================================================
 *  server.mjs —— Voxel Space Station 零依赖静态文件服务器
 * =====================================================================
 *
 *  用法：
 *    node server.mjs                      # 生产模式，监听 127.0.0.1:8181
 *    node server.mjs --dev                # 开发模式（Cache-Control: no-store，不发 ETag）
 *    node server.mjs --host 0.0.0.0       # 允许局域网访问
 *    PORT=9000 node server.mjs            # 指定起始端口（被占用则自动 +1，最多 10 次）
 *
 *  说明：
 *    - 仅使用 node: 内置模块，零依赖，无需 npm install。
 *    - 根目录取本文件所在目录（即项目根目录）。
 *    - 已实现：路径穿越防护、ETag/304、gzip/br 压缩、单区间 Range、
 *      MIME 表、跨域隔离头（COOP/COEP）、彩色访问日志、优雅退出。
 * =====================================================================
 */

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

/* ------------------------------------------------------------------ *
 *  常量与命令行参数
 * ------------------------------------------------------------------ */
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 8181;
const MAX_PORT_TRIES = 10;

const args = process.argv.slice(2);
const DEV = args.includes('--dev');

let HOST = '127.0.0.1';
const hostIndex = args.indexOf('--host');
if (hostIndex !== -1 && args[hostIndex + 1]) HOST = args[hostIndex + 1];

const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const START_PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536
  ? parsedPort
  : DEFAULT_PORT;

/* ------------------------------------------------------------------ *
 *  MIME 表：二进制类型不加 charset，文本类型统一追加 charset=utf-8
 * ------------------------------------------------------------------ */
const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.js', '.mjs', '.css', '.json',
  '.svg', '.glsl', '.map', '.txt', '.xml', '.md', '.webmanifest',
]);

const MIME_TYPES = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glsl': 'text/plain',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.md': 'text/markdown',
  '.webmanifest': 'application/manifest+json',
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = MIME_TYPES[ext] || 'application/octet-stream';
  return TEXT_EXTENSIONS.has(ext) ? `${base}; charset=utf-8` : base;
}

function isTextType(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/* ------------------------------------------------------------------ *
 *  ANSI 颜色
 * ------------------------------------------------------------------ */
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const CYAN = (s) => `\x1b[36m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

function colorStatus(code) {
  if (code < 300) return GREEN(String(code));
  if (code < 400) return CYAN(String(code));
  if (code < 500) return YELLOW(String(code));
  return RED(String(code));
}

/* 跨域隔离与安全响应头：对 WebGL2 / Worker / 同源 ES Module 加载均安全 */
function securityHeaders() {
  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

/* ------------------------------------------------------------------ *
 *  从原始请求目标中提取路径（不做任何路径规范化）
 *  注意：不能用 new URL(req.url).pathname，因为 WHATWG URL 解析会把
 *  %2e%2e 预先规范化为 ..，导致后续穿越校验形同虚设。
 * ------------------------------------------------------------------ */
function extractRawPathname(requestTarget) {
  if (typeof requestTarget !== 'string') return null;
  let rawPath = requestTarget;

  // 绝对形式（如经过代理）：http://host/path → 仅保留 /path 部分
  if (/^https?:\/\//i.test(rawPath)) {
    const schemeEnd = rawPath.indexOf('://') + 3;
    const pathStart = rawPath.indexOf('/', schemeEnd);
    rawPath = pathStart === -1 ? '/' : rawPath.slice(pathStart);
  }

  // 去掉查询串（HTTP 请求目标不含片段，故无需处理 #）
  const queryIndex = rawPath.indexOf('?');
  if (queryIndex !== -1) rawPath = rawPath.slice(0, queryIndex);

  return rawPath;
}

/* ------------------------------------------------------------------ *
 *  路径安全解析：阻止路径穿越（..、绝对路径、根目录外逃逸 → null）
 * ------------------------------------------------------------------ */
function safeResolve(decodedPath) {
  if (decodedPath.includes('\0')) return null;

  // 统一分隔符，兼容 URL 中混入反斜杠的 Windows 风格路径
  const normalized = decodedPath.replace(/\\/g, '/');

  // 1) 显式拒绝任何 .. 段（路径穿越）
  if (normalized.split('/').includes('..')) return null;

  // 2) 拒绝 Windows 盘符绝对路径（C:/...）与 UNC 绝对路径（//server/...）
  if (/^[a-zA-Z]:/.test(normalized) || normalized.startsWith('//')) return null;

  // 3) 作为相对路径拼接到根目录下，再做包含性校验（纵深防御）
  const resolved = path.resolve(ROOT_DIR, '.' + normalized);
  const relative = path.relative(ROOT_DIR, resolved);
  if (relative === '') return resolved;
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

/* ------------------------------------------------------------------ *
 *  缓存与 ETag
 * ------------------------------------------------------------------ */
function weakETag(stat) {
  // 弱 ETag：基于 mtime + size，用 SHA-1 压成短指纹
  const seed = `${Math.floor(stat.mtimeMs)}-${stat.size}`;
  const digest = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
  return `W/"${stat.size.toString(16)}-${digest}"`;
}

function cacheControlFor(filePath) {
  if (DEV) return 'no-store';
  const name = path.basename(filePath);
  // index.html 与 sw.js 必须可重新验证，避免版本更新后客户端用旧外壳
  if (name === 'index.html' || name === 'sw.js') return 'no-cache';
  return 'public, max-age=300';
}

function ifNoneMatchMatches(headerValue, etag) {
  if (!headerValue) return false;
  const wanted = etag.replace(/^W\//, '');
  return headerValue.split(',').some((candidate) => {
    const c = candidate.trim();
    return c === '*' || c.replace(/^W\//, '') === wanted;
  });
}

/* ------------------------------------------------------------------ *
 *  Range 解析（仅支持单区间）
 * ------------------------------------------------------------------ */
function parseRange(headerValue, size) {
  if (!headerValue) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(headerValue.trim());
  if (!match) return null; // 多区间或非法格式：忽略，按 200 全量返回

  const [, startText, endText] = match;
  if (startText === '' && endText === '') return null;

  let start;
  let end;
  if (startText === '') {
    // 后缀区间：最后 N 字节（N 大于文件大小时返回全量）
    const suffix = Number.parseInt(endText, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(startText, 10);
    if (!Number.isFinite(start) || start < 0) return null;

    if (endText === '') {
      // 开区间：从 start 到末尾；start 超出文件大小 → 416
      if (start >= size) return { unsatisfiable: true };
      end = size - 1;
    } else {
      end = Number.parseInt(endText, 10);
      if (!Number.isFinite(end)) return null;
      if (end < start) return null; // 非法区间（start>end）：忽略，按 200 全量返回
      if (start >= size) return { unsatisfiable: true };
      end = Math.min(end, size - 1);
    }
  }

  if (start >= size) return { unsatisfiable: true };
  return { start, end };
}

/* ------------------------------------------------------------------ *
 *  错误页（深色风格）
 * ------------------------------------------------------------------ */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function errorPage(status, title, message, requestPath) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${status} · ${title}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #0b0e14; color: #e6edf3;
           font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .card { border: 1px solid #2b3442; border-radius: 12px; padding: 40px 48px; max-width: 720px;
            box-shadow: 0 12px 40px rgba(0,0,0,.45); }
    h1 { margin: 0 0 6px; font-size: 52px; color: #ff7b72; }
    h2 { margin: 0 0 18px; font-weight: 600; }
    p { margin: 8px 0; color: #9aa7b8; line-height: 1.6; }
    code { background: #161b22; padding: 2px 8px; border-radius: 6px;
           color: #79c0ff; word-break: break-all; }
  </style>
</head>
<body>
  <main class="card">
    <h1>${status}</h1>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    <p>请求路径：<code>${escapeHtml(requestPath || '/')}</code></p>
  </main>
</body>
</html>`;
}

/* 发送错误页，返回发送的字节数（供访问日志使用） */
function sendError(res, status, title, message, requestPath) {
  const body = errorPage(status, title, message, requestPath);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...securityHeaders(),
  });
  res.end(body);
  return Buffer.byteLength(body);
}

/* ------------------------------------------------------------------ *
 *  访问日志：方法 状态 耗时ms 体积 路径（状态码按 2xx/3xx/4xx/5xx 着色）
 * ------------------------------------------------------------------ */
function logAccess(method, status, startTime, bytes, requestPath) {
  const ms = Date.now() - startTime;
  console.log(
    `${DIM(method.padEnd(4))} ${colorStatus(status)} ${ms}ms ${bytes} ${requestPath}`
  );
}

/* ------------------------------------------------------------------ *
 *  请求处理主逻辑
 * ------------------------------------------------------------------ */
async function handle(req, res) {
  const startTime = Date.now();
  const method = (req.method || 'GET').toUpperCase();

  // 只允许 GET / HEAD，其余方法 405 + Allow 头
  if (method !== 'GET' && method !== 'HEAD') {
    const body = '405 Method Not Allowed\n';
    res.writeHead(405, {
      'Allow': 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      ...securityHeaders(),
    });
    res.end(body);
    logAccess(method, 405, startTime, Buffer.byteLength(body), req.url);
    return;
  }

  // 从原始请求目标中提取路径（仍为百分号编码，且未经任何规范化）
  const rawPathname = extractRawPathname(req.url);
  if (rawPathname === null) {
    const sent = sendError(res, 400, 'Bad Request', '无法解析请求目标。', req.url);
    logAccess(method, 400, startTime, sent, req.url);
    return;
  }

  // 解码为真实路径（仅解码一次；解码之后再校验 .. 等穿越特征）
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPathname);
  } catch {
    const sent = sendError(res, 400, 'Bad Request', 'URL 包含非法的百分号编码。', rawPathname);
    logAccess(method, 400, startTime, sent, rawPathname);
    return;
  }

  try {
    const safePath = safeResolve(decodedPath);
    if (!safePath) {
      const sent = sendError(res, 403, 'Forbidden', '禁止访问此路径。', decodedPath);
      logAccess(method, 403, startTime, sent, decodedPath);
      return;
    }

    // 目录 → 该目录下的 index.html
    let filePath = safePath;
    let stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fs.stat(filePath);
    }

    const data = await fs.readFile(filePath);
    const size = stat.size;
    const contentType = contentTypeFor(filePath);
    const cacheControl = cacheControlFor(filePath);
    const etag = DEV ? null : weakETag(stat);

    // 协商缓存：If-None-Match → 304
    if (etag && ifNoneMatchMatches(req.headers['if-none-match'], etag)) {
      const headers = {
        'Cache-Control': cacheControl,
        'ETag': etag,
        ...securityHeaders(),
      };
      if (isTextType(filePath)) headers['Vary'] = 'Accept-Encoding';
      res.writeHead(304, headers);
      res.end();
      logAccess(method, 304, startTime, 0, decodedPath);
      return;
    }

    // Range 请求（单区间）
    let statusCode = 200;
    let body = data;
    const range = parseRange(req.headers.range, size);

    if (range && range.unsatisfiable) {
      res.writeHead(416, {
        'Content-Range': `bytes */${size}`,
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Accept-Ranges': 'bytes',
        ...securityHeaders(),
      });
      res.end();
      logAccess(method, 416, startTime, 0, decodedPath);
      return;
    }
    if (range) {
      body = data.subarray(range.start, range.end + 1);
      statusCode = 206;
    }

    // 压缩：文本类型、>1024 字节、客户端支持、且未使用 Range
    let contentEncoding = null;
    if (!range && isTextType(filePath) && size > 1024) {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      if (/\bbr\b/.test(acceptEncoding)) {
        body = zlib.brotliCompressSync(body);
        contentEncoding = 'br';
      } else if (/\bgzip\b/.test(acceptEncoding)) {
        body = zlib.gzipSync(body);
        contentEncoding = 'gzip';
      }
    }

    const headers = {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': cacheControl,
      'Accept-Ranges': 'bytes',
      ...securityHeaders(),
    };
    if (etag) headers['ETag'] = etag;
    if (contentEncoding) headers['Content-Encoding'] = contentEncoding;
    if (isTextType(filePath)) headers['Vary'] = 'Accept-Encoding';
    if (statusCode === 206) {
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
    }

    res.writeHead(statusCode, headers);
    if (method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }
    logAccess(method, statusCode, startTime, body.length, decodedPath);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      const sent = sendError(res, 404, 'Not Found', '请求的资源不存在。', decodedPath);
      logAccess(method, 404, startTime, sent, decodedPath);
    } else if (err.code === 'EACCES' || err.code === 'EPERM') {
      const sent = sendError(res, 403, 'Forbidden', '没有权限读取该文件。', decodedPath);
      logAccess(method, 403, startTime, sent, decodedPath);
    } else {
      console.error('服务器内部错误：', err);
      if (!res.headersSent) {
        const sent = sendError(res, 500, 'Internal Server Error', '服务器发生内部错误。', decodedPath);
        logAccess(method, 500, startTime, sent, decodedPath);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 *  启动：监听端口，EADDRINUSE 自动 +1，最多尝试 10 次
 * ------------------------------------------------------------------ */
function listen(host, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/* 终端显示宽度：中日韩全角字符按 2 列计算，保证方框对齐 */
function displayWidth(text) {
  let width = 0;
  for (const ch of text) {
    width += /[\u2E80-\u9FFF\uAC00-\uD7A3\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 2 : 1;
  }
  return width;
}

function padDisplay(text, width) {
  return text + ' '.repeat(Math.max(0, width - displayWidth(text)));
}

function printBanner(host, port) {
  const url = `http://${host}:${port}/`;
  const mode = DEV ? '开发模式（no-store，无 ETag）' : '生产模式（ETag + max-age=300）';
  const lines = [
    `URL     ${url}`,
    `根目录  ${ROOT_DIR}`,
    `模式    ${mode}`,
    `压缩    br / gzip（文本类型，>1024 字节）`,
  ];
  const innerWidth = Math.max(...lines.map(displayWidth)) + 2;
  const bar = '═'.repeat(innerWidth);
  console.log(`\n╔${bar}╗`);
  for (const line of lines) {
    console.log(`║ ${padDisplay(line, innerWidth - 2)} ║`);
  }
  console.log(`╚${bar}╝\n`);
}

function setupGracefulShutdown(server) {
  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`\n收到 ${signal}，正在关闭服务器…`);
    server.close(() => {
      console.log('服务器已关闭，再见！');
      process.exit(0);
    });
    // 兜底：3 秒后仍有连接未关闭则强制退出
    setTimeout(() => {
      console.error('等待连接关闭超时，强制退出。');
      process.exit(1);
    }, 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main() {
  let server = null;
  let port = null;

  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const candidate = START_PORT + i;
    try {
      server = await listen(HOST, candidate);
      port = candidate;
      break;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
      console.log(`端口 ${candidate} 已被占用，尝试 ${candidate + 1} …`);
    }
  }

  if (!server) {
    console.error(`连续 ${MAX_PORT_TRIES} 次尝试均无法绑定端口（起始 ${START_PORT}），启动失败。`);
    process.exit(1);
  }

  printBanner(HOST, port);
  setupGracefulShutdown(server);
}

main().catch((err) => {
  console.error('启动失败：', err);
  process.exit(1);
});
