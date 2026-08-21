// ---------------------------------------------------------------------------
// 语义探针：把每种材质临时渲染成一个纯自发光「身份色」，回读像素后还原成材质名，
// 于是可以在没有图形界面的条件下「看见」画面上每个位置究竟是什么构件。
//   node tools/probe.mjs [url] [cols] [rows]
// ---------------------------------------------------------------------------
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const TARGET = process.argv[2] || 'http://localhost:5180/?quality=low';
const COLS = Number(process.argv[3] || 76);
const ROWS = Number(process.argv[4] || 30);
const PORT = 9500 + Math.floor(Math.random() * 300);

const EXES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const exe = EXES.find((p) => fs.existsSync(p));
if (!exe) {
  console.error('找不到浏览器');
  process.exit(2);
}
const profile = path.join(os.tmpdir(), 'probe-' + Date.now());
const child = spawn(
  exe,
  ['--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--mute-audio',
   '--no-first-run', '--no-default-browser-check', '--window-size=1200,700',
   `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, 'about:blank'],
  { stdio: 'ignore' }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
let id = 0;
const pending = new Map();
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const t = (await r.json()).find((x) => x.type === 'page');
      if (t?.webSocketDebuggerUrl) {
        ws = new WebSocket(t.webSocketDebuggerUrl);
        await new Promise((res) => ws.addEventListener('open', res, { once: true }));
        ws.addEventListener('message', (e) => {
          const m = JSON.parse(e.data);
          if (m.id && pending.has(m.id)) {
            pending.get(m.id)(m);
            pending.delete(m.id);
          }
        });
        return;
      }
    } catch {}
    await sleep(400);
  }
  throw new Error('CDP 未就绪');
}
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result?.result?.value;
};

await connect();
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 700, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: TARGET });
for (let i = 0; i < 90; i++) {
  await sleep(1000);
  if (await evaluate('!!window.__READY__')) break;
}
await sleep(2500);

/* 可选机位：node tools/probe.mjs <url> <cols> <rows> "x,y,z" "x,y,z" */
const camArg = process.argv[5];
const tgtArg = process.argv[6];
if (camArg && tgtArg) {
  await evaluate(`(() => { const P = window.__PAGODA__;
    P.camera.position.set(${camArg}); P.controls.target.set(${tgtArg});
    P.controls.update(); P.camera.updateMatrixWorld(true); return 1; })()`);
  await sleep(900);
}

/* ---------------- 页面内：材质身份色渲染 + 回读 ---------------- */
const script = `(() => {
  const P = window.__PAGODA__, THREE = P.THREE, R = P.renderer;
  const mats = new Map();
  P.scene.traverse(o => { if ((o.isMesh||o.isInstancedMesh) && o.visible && o.material && o.material.color && o.material.emissive) mats.set(o.material.name || o.material.uuid, o.material); });
  const names = [...mats.keys()].sort();
  const save = [];
  names.forEach((n, i) => {
    const m = mats.get(n);
    const v = i + 1;
    save.push({ m, map: m.map, color: m.color.clone(), em: m.emissive?.clone(), ei: m.emissiveIntensity, fog: m.fog, tone: m.toneMapped });
    m.map = null; m.color.setRGB(0,0,0);
    if (m.emissive) { m.emissive.setRGB((Math.floor(v/36)%6)/5, (Math.floor(v/6)%6)/5, (v%6)/5); m.emissiveIntensity = 1; }
    m.fog = false; m.toneMapped = false; m.needsUpdate = true;
  });
  const oldTone = R.toneMapping, oldCS = R.outputColorSpace, oldBG = P.scene.background, oldFog = P.scene.fog;
  R.toneMapping = THREE.NoToneMapping; R.outputColorSpace = THREE.LinearSRGBColorSpace;
  P.scene.fog = null;
  const skyM = []; P.scene.traverse(o => { if (o.material && o.material.type === 'ShaderMaterial') { skyM.push([o, o.visible]); o.visible = false; } });
  R.render(P.scene, P.camera);
  const data = R.domElement.toDataURL('image/png');
  skyM.forEach(([o, v]) => (o.visible = v));
  R.toneMapping = oldTone; R.outputColorSpace = oldCS; P.scene.fog = oldFog;
  save.forEach(s => { s.m.map = s.map; s.m.color.copy(s.color); if (s.em) { s.m.emissive.copy(s.em); s.m.emissiveIntensity = s.ei; } s.m.fog = s.fog; s.m.toneMapped = s.tone; s.m.needsUpdate = true; });
  R.render(P.scene, P.camera);
  const key = names.map((n,i) => { const v=i+1; return { n, c: [(Math.floor(v/36)%6)/5, (Math.floor(v/6)%6)/5, (v%6)/5] }; });
  return JSON.stringify({ data, key });
})()`;

const raw = await evaluate(script);
const { data, key } = JSON.parse(raw);
const png = Buffer.from(data.split(',')[1], 'base64');

/* ---------------- 解码 PNG 并还原材质名 ---------------- */
let off = 8;
let W = 0;
let H = 0;
let ch = 4;
const idat = [];
while (off < png.length) {
  const len = png.readUInt32BE(off);
  const type = png.toString('ascii', off + 4, off + 8);
  const d = png.subarray(off + 8, off + 8 + len);
  if (type === 'IHDR') {
    W = d.readUInt32BE(0);
    H = d.readUInt32BE(4);
    ch = d[9] === 6 ? 4 : 3;
  } else if (type === 'IDAT') idat.push(d);
  else if (type === 'IEND') break;
  off += 12 + len;
}
const inf = zlib.inflateSync(Buffer.concat(idat));
const stride = W * ch;
const px = Buffer.alloc(H * stride);
let p = 0;
for (let y = 0; y < H; y++) {
  const fl = inf[p++];
  const row = inf.subarray(p, p + stride);
  p += stride;
  const cur = px.subarray(y * stride, (y + 1) * stride);
  const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
  for (let x = 0; x < stride; x++) {
    const a = x >= ch ? cur[x - ch] : 0;
    const b = prev ? prev[x] : 0;
    const c = prev && x >= ch ? prev[x - ch] : 0;
    let v = row[x];
    if (fl === 1) v += a;
    else if (fl === 2) v += b;
    else if (fl === 3) v += (a + b) >> 1;
    else if (fl === 4) {
      const pa = Math.abs(b - c);
      const pb = Math.abs(a - c);
      const pc = Math.abs(a + b - 2 * c);
      v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    cur[x] = v & 0xff;
  }
}

/* ---------------- 统计 + 字符图 ---------------- */
const GLYPH = {
  柱: 'H', 内槽柱: 'h', 枋: '=', 拱: 'x', 斗: 'o', 昂: '/', 梁: 'L', 椽: 'c',
  板: 'W', 斜撑: '\\', 榫头: '+', 台基石: '#', 压阑石: '#', 柱础: '#',
  筒瓦: 'T', 脊瓦: 't', 拱眼壁: '`', 板壁: '`', 板门: 'D', 勾栏: 'r',
  铁件: 'I', 鎏金: '*', 地面: '.',
};
const keyed = key.map((k) => ({ ...k, rgb: k.c.map((v) => v * 255) }));
const tally = {};
const grid = [];
for (let r = 0; r < ROWS; r++) {
  let line = '';
  for (let cc = 0; cc < COLS; cc++) {
    const x = Math.floor(((cc + 0.5) / COLS) * W);
    const y = Math.floor(((r + 0.5) / ROWS) * H);
    const i = y * stride + x * ch;
    const R0 = px[i];
    const G0 = px[i + 1];
    const B0 = px[i + 2];
    if (R0 + G0 + B0 < 12) {
      line += ' ';
      tally['（空）'] = (tally['（空）'] || 0) + 1;
      continue;
    }
    let best = null;
    let bd = 1e9;
    for (const k of keyed) {
      const d = (k.rgb[0] - R0) ** 2 + (k.rgb[1] - G0) ** 2 + (k.rgb[2] - B0) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const nm = best.n;
    tally[nm] = (tally[nm] || 0) + 1;
    line += GLYPH[nm] ?? '?';
  }
  grid.push(line);
}
console.log(`\n画面 ${W}×${H} → 语义图 ${COLS}×${ROWS}（字符 = 该像素最前面的构件）`);
grid.forEach((l, i) => console.log(String(i).padStart(2) + '│' + l + '│'));
console.log('\n构件占屏比：');
const total = COLS * ROWS;
Object.entries(tally)
  .sort((a, b) => b[1] - a[1])
  .forEach(([n, v]) => console.log(`  ${(GLYPH[n] ?? '?').padEnd(2)} ${n.padEnd(8)} ${((v / total) * 100).toFixed(1).padStart(5)}%`));

ws.close();
child.kill('SIGKILL');
await sleep(400);
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch {}
process.exit(0);
