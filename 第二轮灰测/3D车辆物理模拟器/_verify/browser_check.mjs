/* 无头浏览器端到端自检（DevTools Protocol 驱动真实页面）
   用法: node _verify/browser_check.mjs        */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe')
];
const exe = BROWSERS.find((p) => p && fs.existsSync(p));
if (!exe) { console.error('未找到 Chrome / Edge'); process.exit(1); }
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'offroad-'));
const guard = '<script>window.__errs=[];addEventListener("error",e=>window.__errs.push("ERR:"+e.message));' +
  'addEventListener("unhandledrejection",e=>window.__errs.push("REJ:"+(e.reason&&e.reason.message||e.reason)));</script>';
fs.writeFileSync(path.join(tmp, 'index.html'),
  fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('</head>', guard + '</head>'), 'utf8');
const url = 'file:///' + path.join(tmp, 'index.html').replace(/\\/g, '/');
const PORT = 9300 + Math.floor(Math.random() * 400);          // 每次唯一，避免连到残留实例
const child = spawn(exe, ['--headless=new', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1600,940',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(tmp, 'prof'), '--no-first-run', '--disable-sync', url],
  { stdio: 'ignore' });
try {
  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
      page = list.find((t) => t.type === 'page' && t.url === url) || null;   // 必须是本次的临时文件
    } catch (e) {}
    if (!page) await new Promise((r) => setTimeout(r, 400));
  }
  if (!page) throw new Error('DevTools 目标未就绪');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let seq = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('[LOG] ' + m.params.entry.text + ' @' + (m.params.entry.lineNumber || '?'));
  });
  const send = (method, params) => new Promise((r) => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Runtime.enable'); await send('Log.enable');
  const probe = fs.readFileSync(path.join(here, 'browser_probe.js'), 'utf8');
  const res = await send('Runtime.evaluate', { expression: probe, awaitPromise: true, returnByValue: true, timeout: 180000 });
  console.log('=== 自检结果 ===');
  const v = res.result?.result?.value;
  if (Array.isArray(v)) v.forEach((l) => console.log('  ' + l));
  else console.log(JSON.stringify(res.result).slice(0, 900));
  console.log('=== 页面日志 ===');
  console.log(logs.slice(0, 14).join('\n') || '(clean)');
  ws.close();
} finally {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGKILL');
  } catch (e) {}
}
