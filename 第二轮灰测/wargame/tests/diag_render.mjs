/* 渲染诊断：统计各国别地形格在画面上是否真的被绘制（readPixels 同任务内取样） */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const PORT = 9860 + Math.floor(Math.random() * 90);
const FILE = 'file://' + resolve('index.html');
const profile = mkdtempSync(join(tmpdir(), 'cdp-diag-'));
const chrome = spawn('/opt/node/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--user-data-dir=' + profile, '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=1560,900', '--remote-debugging-port=' + PORT, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
const ev = async e => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};
async function j(p, m) { for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: m || 'GET' }); if (r.ok) return r.json(); } catch (e) { } await sleep(250); } throw new Error('no cdp'); }
const t = await j('/json/new?' + encodeURIComponent(FILE), 'PUT');
ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
await send('Runtime.enable'); await send('Page.enable'); await sleep(3000);
await ev('window.__WG__.closeModal(); window.__WG__.newGame("blue", 1)');
await sleep(900);
const out = await ev(`(() => {
  const W = window.__WG__, R = W.renderer, E = W.ENGINE, gl = R.gl;
  R.draw(performance.now());
  const cv = document.getElementById('map');
  const dpr = cv.width / cv.clientWidth;
  const stats = { bg: 0, drawn: 0, byNation: {} }, samples = [];
  E.MAP.hexes.forEach(h => {
    const w = R.hexWorld(h.c, h.r);
    const s = R.project([w[0], h.terrain.h + 0.02, w[2]]);
    if (!s) { stats.bg++; return; }
    const x = Math.round(s[0] * dpr), y = cv.height - Math.round(s[1] * dpr);
    if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) { stats.bg++; return; }
    const px = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const isBg = px[0] < 14 && px[1] < 18 && px[2] < 26;
    stats.byNation[h.n] = stats.byNation[h.n] || { bg: 0, ok: 0, rgb: [0, 0, 0], n: 0 };
    const b = stats.byNation[h.n];
    if (isBg) { stats.bg++; b.bg++; } else {
      stats.drawn++; b.ok++; b.n++;
      b.rgb[0] += px[0]; b.rgb[1] += px[1]; b.rgb[2] += px[2];
    }
    if (isBg && samples.length < 8) samples.push({ key: h.key, n: h.n, t: h.terrain.id, screen: [Math.round(s[0]), Math.round(s[1])], rgb: [px[0], px[1], px[2]], onScreen: !(x < 0 || y < 0 || x >= cv.width || y >= cv.height) });
  });
  Object.values(stats.byNation).forEach(b => { if (b.n) b.rgb = b.rgb.map(v => Math.round(v / b.n)); });
  return { stats, samples, canvas: [cv.width, cv.height, cv.clientWidth, cv.clientHeight, dpr], cam: R.cam };
})()`);
console.log('canvas =', JSON.stringify(out.canvas), 'cam =', JSON.stringify(out.cam));
console.log('绘制统计: 命中地形 ' + out.stats.drawn + ' / 背景 ' + out.stats.bg);
console.log('按国别: ' + JSON.stringify(out.stats.byNation));
console.log('样本: ' + JSON.stringify(out.samples));
chrome.kill(); process.exit(0);
