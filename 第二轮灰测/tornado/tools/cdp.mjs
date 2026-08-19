/**
 * tools/cdp.mjs — 零依赖的无头浏览器探针（Chrome DevTools Protocol）。
 *
 * 用法：
 *   node tools/cdp.mjs "<url>" [输出png] 
 * 环境变量：
 *   W,H         窗口尺寸（默认 1280x720）
 *   WAIT        最长等待毫秒（默认 240000）
 *   FRAMES      等到 window.__app.frames 达到该值就截图（默认 0 = 等 selftest 标题）
 *   CHROME      浏览器路径
 *
 * 行为：等页面出现 selftest:pass / selftest:fail 标题，或帧数达标；
 *      期间收集 console 与 WebGL 日志；结束时截图并把诊断打到 stdout。
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL_ = process.argv[2] || 'http://127.0.0.1:8181/index.html';
const OUT = process.argv[3] || '';
const W = Number(process.env.W || 1280);
const H = Number(process.env.H || 720);
const WAIT = Number(process.env.WAIT || 240000);
const FRAMES = Number(process.env.FRAMES || 0);
const PORT = 9400 + (process.pid % 400);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader', '--disable-dev-shm-usage',
  `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--mute-audio', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion',
  `--user-data-dir=${process.env.TEMP || '/tmp'}\\dsh_cdp_${PORT}`,
  'about:blank',
], { stdio: 'ignore' });

let ws = null;
let msgId = 1;
const pending = new Map();
const consoleLines = [];

function send(method, params = {}, sessionId = null) {
  const id = msgId++;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }
    }, 60000);
  });
}

async function connect() {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(200); }
  }
  throw new Error('DevTools 未就绪');
}

const wsUrl = await connect();
ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('ws error')); });

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
    consoleLines.push(`[${m.params.type}] ${txt}`.slice(0, 1400));
  } else if (m.method === 'Log.entryAdded') {
    consoleLines.push(`[log:${m.params.entry.level}] ${m.params.entry.text}`.slice(0, 1400));
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    consoleLines.push(`[exception] ${d.text} ${d.exception?.description || ''}`.slice(0, 1400));
  }
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);
await send('Page.navigate', { url: URL_ }, sessionId);

const t0 = Date.now();
let status = 'timeout';
let frames = 0;
let diag = '';
while (Date.now() - t0 < WAIT) {
  await sleep(1200);
  let r;
  try {
    r = await send('Runtime.evaluate', {
      expression: `JSON.stringify({t: document.title, f: (window.__app && window.__app.frames)||0,
        d: (document.getElementById('diag')||{}).textContent || '',
        b: (document.getElementById('bootMsg')||{}).textContent || ''})`,
      returnByValue: true,
    }, sessionId);
  } catch (e) { continue; }
  let v;
  try { v = JSON.parse(r.result.value); } catch { continue; }
  frames = v.f; diag = v.d;
  if (/selftest:(pass|fail)/.test(v.t)) { status = v.t; break; }
  if (FRAMES && frames >= FRAMES) { status = 'frames:' + frames; break; }
  if (/失败|错误/.test(v.b)) { status = 'bootfail'; diag = diag || v.b; break; }
}

if (OUT) {
  try {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    console.log('SHOT ' + OUT);
  } catch (e) { console.log('SHOT FAILED: ' + e.message); }
}

/* 额外的页内断言：EVAL="表达式" node tools/cdp.mjs ... */
if (process.env.EVAL) {
  try {
    const r = await send('Runtime.evaluate', {
      expression: `(()=>{ try { return JSON.stringify(${process.env.EVAL}); } catch(e){ return 'EVAL ERROR: '+e.message; } })()`,
      returnByValue: true,
    }, sessionId);
    console.log('EVAL ' + r.result.value);
  } catch (e) { console.log('EVAL FAILED: ' + e.message); }
}

console.log('STATUS ' + status + '  frames=' + frames + '  elapsed=' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
const interesting = consoleLines.filter((l) => !/deprecated|Timer instead/i.test(l));
if (interesting.length) {
  console.log('--- console (' + interesting.length + ') ---');
  for (const l of interesting.slice(0, 40)) console.log(l);
}
if (diag) console.log('--- diag ---\n' + diag);

try { await send('Browser.close'); } catch { }
try { ws.close(); } catch { }
setTimeout(() => { try { proc.kill(); } catch { } process.exit(status.startsWith('selftest:pass') || status.startsWith('frames') ? 0 : 1); }, 400);
