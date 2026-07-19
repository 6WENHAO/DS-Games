const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const URL = `http://localhost:${PORT}`;
const noOpen = process.argv.includes('--no-open');

function openBrowser() {
  if (noOpen) return;
  require('child_process').exec(`start "" "${URL}"`);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // 服务器已在运行，直接打开浏览器
    console.log(`服务器已在运行：${URL}`);
    openBrowser();
    process.exit(0);
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`The Forest (web) 已启动：${URL}`);
  console.log('保持此窗口开启，关闭窗口即停止游戏服务。');
  openBrowser();
});
