/* ==========================================================================
   本地静态服务器（零依赖）
   用法：  node serve.mjs  [端口]
   然后浏览器打开   http://127.0.0.1:8080/
   —— 两个游戏也支持直接双击 index.html（file://）运行，此服务器仅为方便调试。
   ========================================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.argv[2] || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.map': 'application/json'
};

const INDEX = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>网页 3D 游戏合集</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;
font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#e8f6fa;
background:radial-gradient(ellipse at 50% 0%,#2a7f99,#0d3852 45%,#04121e)}
.wrap{text-align:center;padding:40px}
h1{font-size:34px;letter-spacing:6px;margin:0 0 8px;
background:linear-gradient(180deg,#fff8e6,#e0ad6c);-webkit-background-clip:text;background-clip:text;color:transparent}
p{opacity:.7;margin:0 0 34px;font-size:14px}
.cards{display:flex;gap:26px;flex-wrap:wrap;justify-content:center}
a.card{display:block;width:300px;padding:26px 22px;border-radius:20px;text-decoration:none;color:inherit;
background:rgba(10,33,52,.78);border:2px solid rgba(224,173,108,.4);
box-shadow:0 18px 44px rgba(0,0,0,.5);transition:.18s}
a.card:hover{transform:translateY(-6px);border-color:#ffd166}
.ico{font-size:56px}.nm{font-size:20px;font-weight:800;margin:10px 0 6px;letter-spacing:2px}
.ds{font-size:12.5px;line-height:1.7;opacity:.75}
</style></head><body><div class="wrap">
<h1>网 页 3D 游 戏</h1><p>纯前端 · 离线可运行 · three.js r149</p>
<div class="cards">
<a class="card" href="/raft-survival/index.html"><div class="ico">🛶</div>
<div class="nm">木筏求生</div><div class="ds">海上漂流 · 打捞建造 · 钓鱼净水 · 鲨鱼布鲁斯 · 岛屿探索与潜水采矿</div></a>
<a class="card" href="/spore/index.html"><div class="ico">🧬</div>
<div class="nm">孢子 Spore</div><div class="ds">细胞 → 生物 → 部落 → 文明 → 星际，五阶段完整演化</div></a>
</div></div></body></html>`;

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/' || p === '/index.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      return res.end(INDEX);
    }
    const file = join(ROOT, normalize(p).replace(/^([/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    const st = await stat(file).catch(() => null);
    if (!st || st.isDirectory()) { res.writeHead(404); return res.end('404 ' + p); }
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(500); res.end('500 ' + e.message);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('服务器已启动：  http://127.0.0.1:' + PORT + '/');
  console.log('  木筏求生      http://127.0.0.1:' + PORT + '/raft-survival/index.html');
  console.log('  孢子 Spore    http://127.0.0.1:' + PORT + '/spore/index.html');
  console.log('（Ctrl+C 停止）');
});
