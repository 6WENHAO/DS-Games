// tools/serve.mjs —— 零依赖静态服务器（因为 ES 模块不能从 file:// 加载）
//   node tools/serve.mjs            起服务
//   node tools/serve.mjs --open     起好后自动打开浏览器
//   PORT=8124 node tools/serve.mjs  换端口
//
//   退出码： 0 正常 / 1 起不来 / 3 端口上已经跑着同一个游戏（调用方可直接开浏览器）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8123);
const URL_ = `http://127.0.0.1:${PORT}/`;
const AUTO_OPEN = process.argv.includes('--open');
const QUIET = process.argv.includes('--quiet');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function banner() {
  if (QUIET) return;
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   千 禧 回 廊   ·   Millennium Corridor      ║');
  console.log('  ║   中式千禧年建筑 / 中式梦核 · 第一人称探索    ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`   打开：  ${URL_}`);
  console.log('');
  console.log('   操作：  W A S D 走路      鼠标 / 方向键 转头');
  console.log('           C 视角归正        Shift 快走');
  console.log('           E 看 / 用         Tab 记忆    M 静音');
  console.log('');
  console.log('   提示：  戴耳机。记得抬头看 —— 斗拱、玻璃采光顶、');
  console.log('           客厅那盏吸顶灯，都在头顶上。');
  console.log('');
  console.log('   停止：  Ctrl+C');
  console.log('');
}

function openBrowser() {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', URL_], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [URL_], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [URL_], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    console.log('   （打不开浏览器，请手动访问上面的地址）');
  }
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + p);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    }).end(buf);
  });
});

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error(`\n  ✘ 服务器起不来：${err.message}\n`);
    process.exit(1);
  }
  // 端口被占了 —— 先看看占用者是不是同一个游戏
  const req = http.get(URL_, { timeout: 1500 }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
    res.on('end', () => finish(body.includes('千禧回廊')));
  });
  req.on('error', () => finish(false));
  req.on('timeout', () => { req.destroy(); finish(false); });

  function finish(isUs) {
    if (isUs) {
      console.log('');
      console.log(`  ✔ 服务器本来就在跑：${URL_}`);
      console.log('    （不用再起一个，直接玩就行）');
      console.log('');
      process.exit(3);
    }
    console.error('');
    console.error(`  ✘ 端口 ${PORT} 被别的程序占了。`);
    console.error(`    换个端口：  set PORT=8124 && npm start`);
    console.error(`    或者：      启动游戏.bat 8124`);
    console.error('');
    process.exit(1);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  banner();
  if (AUTO_OPEN) openBrowser();
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n  服务器已停止。');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 400);
  });
}
