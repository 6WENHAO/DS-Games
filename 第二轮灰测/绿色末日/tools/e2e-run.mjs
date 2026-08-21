/* 端到端测试驱动：用 CDP 驱动无头 Edge/Chrome 打开 tools/e2e.html，
   等页面里的自测跑完，把报告抓回来打印。
   用法：node tools/e2e-run.mjs [端口=8123] */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const PORT = Number(process.argv[2] || 8123);
const CDP = 9333 + (process.pid % 200);
const CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
];
const exe = CANDIDATES.find((p) => p && fs.existsSync(p));
if (!exe) { console.error('找不到 Edge/Chrome，跳过端到端测试'); process.exit(0); }

const profile = path.join(os.tmpdir(), 'gf-e2e-' + Date.now());
const args = [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader',
  '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--mute-audio', '--window-size=1280,800',
  '--remote-allow-origins=*', '--remote-debugging-port=' + CDP,
  '--user-data-dir=' + profile,
  'about:blank',
];
console.log('启动:', path.basename(exe), 'CDP 端口', CDP);
const child = spawn(exe, args, { stdio: 'ignore', detached: false });

const getJSON = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); })
    .on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, msgId = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((res, rej) => {
    const id = ++msgId;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('CDP 超时: ' + method)); } }, 30000);
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
  return r.result.value;
}

(async () => {
  // 等调试端口就绪（只认真正的 page 目标，跳过扩展后台页）
  let target = null;
  for (let i = 0; i < 100 && !target; i++) {
    try {
      const list = await getJSON(`http://127.0.0.1:${CDP}/json/list`);
      target = list.find((t) => t.type === 'page' && !String(t.url).startsWith('chrome-extension'));
    } catch (e) { /* 还没起来 */ }
    if (!target) await sleep(200);
  }
  if (!target) throw new Error('浏览器调试端口没有就绪');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  const consoleLines = [];
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')));
  });
  ws.addEventListener('close', (e) => { if (pending.size) console.error('WS 已关闭', e.code); });
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = m.params.type;
      if (t === 'error' || t === 'warning') {
        consoleLines.push(t + ': ' + m.params.args.map((a) => a.value || a.description || a.type).join(' '));
      }
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      consoleLines.push('log: ' + m.params.entry.text);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      consoleLines.push('exception: ' + (d.exception && d.exception.description || d.text));
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/tools/e2e.html` });

  // 轮询页面报告
  let report = '', done = false;
  for (let i = 0; i < 300; i++) {
    await sleep(500);
    try {
      report = await evaluate("(document.getElementById('report')||{}).textContent||''");
    } catch (e) { continue; }
    if (report && report.includes('E2E-RESULT')) { done = true; break; }
    if (report && report.includes('无法继续')) { done = true; break; }
  }
  console.log('\n' + (report || '(页面没有产出报告)'));
  if (consoleLines.length) {
    console.log('\n--- 浏览器控制台（error/warning）---');
    for (const l of consoleLines.slice(0, 20)) console.log('  ' + l);
  }
  const green = report.includes('ALL-GREEN');
  console.log('\n' + (green ? '✅ 端到端全绿' : (done ? '❌ 端到端存在失败' : '⚠ 端到端未完成（超时）')));
  process.exitCode = green ? 0 : 1;
  try { ws.close(); } catch (e) { }
  try { await getJSON(`http://127.0.0.1:${CDP}/json/close/${target.id}`); } catch (e) { }
  child.kill();
  fs.rmSync(profile, { recursive: true, force: true });
  process.exit(process.exitCode);
})().catch((e) => {
  console.error('端到端驱动失败:', e.message);
  try { child.kill(); } catch (_) { }
  process.exit(1);
});
