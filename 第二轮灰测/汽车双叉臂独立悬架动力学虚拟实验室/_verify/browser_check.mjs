/* ---------------------------------------------------------------------------
   端到端浏览器自检：无头启动 Edge/Chrome，通过 DevTools Protocol 驱动 index.html
   真实时钟下运行 requestAnimationFrame，检查运动学、动力学、图表与布局。
     用法:  node _verify/browser_check.mjs
   --------------------------------------------------------------------------- */
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
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
];
const exe = BROWSERS.find((p) => p && fs.existsSync(p));
if (!exe) { console.error('未找到 Chrome / Edge'); process.exit(1); }
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slalab-'));
fs.copyFileSync(path.join(root, 'index.html'), path.join(tmp, 'index.html'));
const url = 'file:///' + path.join(tmp, 'index.html').replace(/\\/g, '/');
const child = spawn(exe, ['--headless=new', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1680,1000',
  '--remote-debugging-port=9222', '--user-data-dir=' + path.join(tmp, 'prof'), '--no-first-run', '--disable-sync', url],
  { stdio: 'ignore', detached: false });
const kill = () => { try { child.kill('SIGKILL'); } catch (e) {} };

async function findPage() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9222/json')).json();
      const p = list.find((t) => t.type === 'page' && /index\.html/.test(t.url));
      if (p && p.webSocketDebuggerUrl) return p;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('DevTools 目标未就绪');
}
try {
  const page = await findPage();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let seq = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  const send = (method, params) => new Promise((r) => { const i = ++seq; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Runtime.enable'); await send('Log.enable');
  const probe = fs.readFileSync(path.join(here, 'browser_probe.js'), 'utf8');
  const out = await send('Runtime.evaluate', { expression: probe, awaitPromise: true, returnByValue: true, timeout: 90000 });
  console.log('=== 自检结果 ===');
  const v = out.result?.result?.value;
  if (Array.isArray(v)) v.forEach((l) => console.log('  ' + l)); else console.log(JSON.stringify(out.result).slice(0, 800));
  console.log('=== 页面控制台 ===');
  console.log(logs.join('\n') || '(clean)');
  ws.close();
} finally { kill(); }
