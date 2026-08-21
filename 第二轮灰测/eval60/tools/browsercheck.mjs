/**
 * 浏览器自动巡检（零依赖 CDP 驱动）。
 * 启动无头 Chrome/Edge，打开 ?selftest=1，轮询页面自检结果并打印。
 *
 *   node tools/browsercheck.mjs [url] [--mobile] [--keep] [--shot=out.png]
 *
 * --mobile 会用 CDP 模拟 iPhone 视口 + 触摸 + 移动 UA，
 *          并额外输出触屏 UI 的布局巡检（是否出界 / 重叠 / 触控面积）。
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const URL_ARG = process.argv.find((a) => a.startsWith('http'))
  ?? 'http://127.0.0.1:5199/?selftest=1&quality=medium';
const SHOT = process.argv.find((a) => a.startsWith('--shot='))?.slice(7) ?? null;
const MOBILE = process.argv.includes('--mobile');
const PORT = 9333 + Math.floor(Math.random() * 200);
const TIMEOUT_MS = 240000;

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : null,
];
const browser = CANDIDATES.find((p) => p && existsSync(p));
if (!browser) {
  console.error('找不到 Chrome / Edge');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profileDir = await mkdtemp(join(tmpdir(), 'dsh-cdp-'));
const args = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu-sandbox',
  '--enable-unsafe-swiftshader',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--hide-scrollbars',
  '--mute-audio',
  '--disable-extensions',
  '--force-device-scale-factor=1',
  '--window-size=1280,780',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profileDir}`,
  MOBILE ? 'about:blank' : URL_ARG,
];

console.log(`浏览器: ${browser}`);
console.log(`URL   : ${URL_ARG}`);
const proc = spawn(browser, args, { stdio: 'ignore', windowsHide: true });
let killed = false;
const kill = () => {
  if (killed) return;
  killed = true;
  try { proc.kill(); } catch { /* noop */ }
};
process.on('exit', kill);

/* ---- 等待 CDP 端口 ---- */
let wsUrl = null;
const t0 = Date.now();
while (Date.now() - t0 < 40000 && !wsUrl) {
  await sleep(400);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const list = await res.json();
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (page) wsUrl = page.webSocketDebuggerUrl;
  } catch { /* 还没起来 */ }
}
if (!wsUrl) {
  console.error('CDP 未就绪');
  kill();
  process.exit(3);
}

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
});

let msgId = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.error) return { error: r.error.message };
  const res = r.result?.result;
  if (r.result?.exceptionDetails) {
    return { error: r.result.exceptionDetails.exception?.description ?? 'exception' };
  }
  return { value: res?.value };
};

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

/* ---- 移动端模拟（必须在导航前设置） ---- */
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
  + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
async function applyViewport(w, h, dpr) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: dpr, mobile: true,
    screenOrientation: { angle: w > h ? 90 : 0, type: w > h ? 'landscapePrimary' : 'portraitPrimary' },
  });
}
if (MOBILE) {
  await send('Emulation.setUserAgentOverride', { userAgent: MOBILE_UA, platform: 'iPhone' });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await applyViewport(844, 390, 3);   // 横屏 iPhone
  await send('Page.navigate', { url: URL_ARG });
}

/* ---- 轮询自检完成 ---- */
let ready = false;
const start = Date.now();
let lastLabel = '';
while (Date.now() - start < TIMEOUT_MS) {
  const done = await evaluate('!!window.__SELFTEST_DONE');
  if (done.value) { ready = true; break; }
  const state = await evaluate(
    '(function(){var l=document.getElementById("loadLabel");'
    + 'return (l?l.textContent:"?")+" | diag="+((window.__DIAG||[]).length);})()',
  );
  if (state.value && state.value !== lastLabel) {
    lastLabel = state.value;
    console.log(`  … ${state.value}`);
  }
  await sleep(700);
}

const report = await evaluate('window.__SELFTEST || "(无自检输出)"');
const diag = await evaluate('(window.__DIAG||[]).join("\\n") || "(无错误)"');

console.log('\n================ DIAG ================');
console.log(diag.value ?? diag.error);
console.log('\n================ SELFTEST ================');
console.log(report.value ?? report.error);

/* ---- 移动端布局巡检 ---- */
const LAYOUT_PROBE = `(function(){
  var ids = ['stickL','knobL','stickR','knobR','btnBoost','btnWarp','btnBrake','btnAlign','btnCam','btnTgt','radar','warnBox'];
  var cls = ['panel-tl','panel-tr','throttle-col','btn-cluster','reticle'];
  var vw = window.innerWidth, vh = window.innerHeight;
  var out = { vw: vw, vh: vh, dpr: window.devicePixelRatio,
    touchEnabled: document.getElementById('touchUI').classList.contains('enabled'),
    canvas: (function(){ var c=document.getElementById('scene'); return c.width+'x'+c.height+' css '+Math.round(c.clientWidth)+'x'+Math.round(c.clientHeight); })(),
    items: [], problems: [] };
  function push(name, el){
    if (!el) { out.problems.push(name+' 缺失'); return; }
    var r = el.getBoundingClientRect();
    var st = getComputedStyle(el);
    var visible = st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0;
    out.items.push({ name: name, x: Math.round(r.left), y: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height), visible: visible });
    if (!visible) return;
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
      out.problems.push(name+' 超出视口 ('+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+')');
    }
    if (/^(stick|btn)/.test(name) && (r.width < 40 || r.height < 40)) {
      out.problems.push(name+' 触控区过小 '+Math.round(r.width)+'x'+Math.round(r.height));
    }
  }
  ids.forEach(function(id){ push(id, document.getElementById(id)); });
  cls.forEach(function(c){ push(c, document.querySelector('.'+c)); });
  // 重叠检查：摇杆/按钮簇 与 HUD 面板
  function rect(sel){ var e = sel[0]==='.' ? document.querySelector(sel) : document.getElementById(sel); return e ? e.getBoundingClientRect() : null; }
  var pairs = [['stickL','.throttle-col'],['stickR','.btn-cluster'],['stickL','.panel-tl'],['stickR','.panel-tr'],['.btn-cluster','.panel-tr']];
  pairs.forEach(function(p){
    var a = rect(p[0]), b = rect(p[1]);
    if (!a || !b) return;
    var ox = Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left));
    var oy = Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    if (ox*oy > 260) out.problems.push(p[0]+' 与 '+p[1]+' 重叠 '+Math.round(ox)+'x'+Math.round(oy));
  });
  return JSON.stringify(out, null, 1);
})()`;

if (MOBILE) {
  const land = await evaluate(LAYOUT_PROBE);
  console.log('\n================ 横屏布局 (844x390 @3x) ================');
  console.log(land.value ?? land.error);

  await applyViewport(390, 844, 3);
  await sleep(1200);
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await sleep(900);
  const port = await evaluate(LAYOUT_PROBE);
  console.log('\n================ 竖屏布局 (390x844 @3x) ================');
  console.log(port.value ?? port.error);
  const hint = await evaluate(
    'getComputedStyle(document.getElementById("rotateHint")).display',
  );
  console.log(`竖屏旋转提示 display=${hint.value}`);

  // 触摸交互：模拟按住左摇杆，检查输入是否被读取
  await applyViewport(844, 390, 3);
  await sleep(900);
  await evaluate('window.dispatchEvent(new Event("resize"))');
  const stick = await evaluate(
    '(function(){var r=document.getElementById("stickL").getBoundingClientRect();'
    + 'return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2});})()',
  );
  const c = JSON.parse(stick.value);
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: c.x, y: c.y - 30 }],
  });
  await sleep(400);
  const stickState = await evaluate(
    '(function(){var i=window.DAWNBREAKER.input;'
    + 'return JSON.stringify({active:!!(i.stickL&&i.stickL.active),y:i.stickL?i.stickL.y.toFixed(2):null,'
    + 'pitch:i.state.pitch.toFixed(2),touchMode:i.touchMode});})()',
  );
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log(`\n触摸摇杆响应: ${stickState.value ?? stickState.error}`);
}

if (SHOT) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) {
    await writeFile(SHOT, Buffer.from(shot.result.data, 'base64'));
    console.log(`\n截图已保存: ${SHOT}`);
  }
}

if (!process.argv.includes('--keep')) kill();
process.exit(ready ? 0 : 1);
