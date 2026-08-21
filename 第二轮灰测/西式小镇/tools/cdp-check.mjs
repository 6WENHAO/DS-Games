// ---------------------------------------------------------------------------
// 用 Chrome DevTools Protocol 真机验收：
//   1. 无头启动 Chrome（软件 WebGL）
//   2. 打开页面，收集控制台错误 / 未捕获异常
//   3. 等 window.__READY__，读出场景统计
//   4. 截图保存到 tools/*.png
// 用法：node tools/cdp-check.mjs [url] [outPng] [waitSec]
// ---------------------------------------------------------------------------
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const TARGET = process.argv[2] || 'http://localhost:5173/?quality=low';
const OUT = process.argv[3] || path.join(ROOT, 'tools', 'shot.png');
const WAIT = Number(process.argv[4] || 150);
const PORT = 9300 + Math.floor(Math.random() * 400);

const CHROMES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const exe = CHROMES.find((p) => fs.existsSync(p));
if (!exe) {
  console.error('找不到 Chrome / Edge');
  process.exit(2);
}

const profile = path.join(os.tmpdir(), 'town-cdp-' + Date.now());
const child = spawn(
  exe,
  [
    '--headless=new',
    '--disable-gpu',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--window-size=1440,810',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* 还没起来 */
    }
    await sleep(400);
  }
  throw new Error('CDP 端口未就绪');
}

const wsUrl = await findTarget();
const ws = new WebSocket(wsUrl);
let msgId = 0;
const pending = new Map();
const logs = [];
const errors = [];

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = (m.params.args || [])
      .map((a) => a.value ?? a.description ?? a.unserializableValue ?? '')
      .join(' ');
    logs.push(`[${m.params.type}] ${text}`);
    if (m.params.type === 'error') errors.push(text);
  }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push(
      `未捕获异常: ${d.exception?.description || d.text} @ ${d.url || ''}:${d.lineNumber}`
    );
  }
  if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    logs.push(`[log:${e.level}] ${e.text}`);
    if (e.level === 'error') errors.push(e.text + ' ' + (e.url || ''));
  }
});

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((r) => ws.addEventListener('open', r, { once: true }));
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 810,
  deviceScaleFactor: 1,
  mobile: false,
});
console.log('→ 打开', TARGET);
await send('Page.navigate', { url: TARGET });

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false });
  return r.result?.result?.value;
}

let ready = false;
let stats = null;
const t0 = Date.now();
for (let i = 0; i < WAIT; i++) {
  await sleep(1000);
  const v = await evaluate(
    '(() => { const t = window.__TOWN__; if (!window.__READY__ || !t) return null;' +
      ' return { meshes: t.town.stats.meshes, pieces: t.town.stats.pieces, fps: t.state.fps,' +
      ' tod: Math.round(t.state.tod * 10) / 10, drawCalls: t.renderer.info.render.calls,' +
      ' tris: t.renderer.info.render.triangles, progs: t.renderer.info.programs?.length ?? 0,' +
      ' textures: t.renderer.info.memory.textures, geoms: t.renderer.info.memory.geometries }; })()'
  );
  if (v) {
    stats = v;
    ready = true;
    break;
  }
  const stage = await evaluate('document.getElementById("loading-text")?.textContent ?? ""');
  if (i % 4 === 0) console.log(`   …${i + 1}s 进度：${stage}`);
  if (errors.length) break;
}
console.log(`→ 用时 ${((Date.now() - t0) / 1000).toFixed(1)}s，ready=${ready}`);

if (ready) {
  // 多等几帧让画面稳定
  await sleep(4000);
  const s2 = await evaluate(
    '(() => { const t = window.__TOWN__; return { fps: t.state.fps, calls: t.renderer.info.render.calls, tris: t.renderer.info.render.triangles }; })()'
  );
  Object.assign(stats, s2);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const data = shot.result?.data;
  if (data) {
    fs.writeFileSync(OUT, Buffer.from(data, 'base64'));
    console.log('→ 截图', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
  }
  console.log('→ 运行时统计', JSON.stringify(stats));
}

if (errors.length) {
  console.log(`✗ 控制台错误 ${errors.length} 条：`);
  [...new Set(errors)].slice(0, 15).forEach((e) => console.log('   ' + e));
} else {
  console.log('✓ 控制台无错误');
}
const warnLogs = logs.filter((l) => /warn/i.test(l));
if (warnLogs.length) {
  console.log(`△ 警告 ${warnLogs.length} 条：`);
  [...new Set(warnLogs)].slice(0, 10).forEach((e) => console.log('   ' + e));
}

ws.close();
child.kill('SIGKILL');
await sleep(600);
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch {
  /* ignore */
}
process.exit(ready && !errors.length ? 0 : 1);
