/* autotest.js — 用 CDP 驱动真实浏览器跑自动回归（实时，不依赖 virtual-time）
   用法: node tools/autotest.js [query] [超时秒]
   例:   node tools/autotest.js "auto=all&turbo=300" 240 */
const { spawn } = require('child_process');
const path = require('path'), os = require('os'), fs = require('fs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const root = path.join(__dirname, '..').replace(/\\/g, '/');
const query = process.argv[2] || 'auto=all&turbo=300';
const timeoutS = parseInt(process.argv[3] || '240', 10);
const port = 9400 + (Date.now() % 300);
const tmp = path.join(os.tmpdir(), 'ep_cdp_' + Date.now());
const url = 'file:///' + root + '/index.html?' + query;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const proc = spawn(EDGE, [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-sync',
  '--disable-features=Translate,MediaRouter', '--user-data-dir=' + tmp,
  '--window-size=900,560', '--remote-debugging-port=' + port, url
], { stdio: 'ignore' });

let msgId = 0;
function rpc(ws, method, params) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    const on = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.id === id) { ws.removeEventListener('message', on); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    };
    ws.addEventListener('message', on);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evalJS(ws, expr) {
  const r = await rpc(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return '[JS EXCEPTION] ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text);
  return r.result.value;
}

(async () => {
  let target = null;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
      target = list.find(t => t.type === 'page' && /index\.html/.test(t.url)) || list.find(t => t.type === 'page');
      if (target && target.webSocketDebuggerUrl) break;
    } catch (e) { }
    await sleep(400);
  }
  if (!target) { console.log('FAILED: no CDP target'); proc.kill(); process.exit(1); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const errs = [];
  ws.addEventListener('message', ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push((d.exception && d.exception.description || d.text) + ' @' + (d.url || '').split('/').pop() + ':' + d.lineNumber);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errs.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' '));
    }
  });
  await rpc(ws, 'Runtime.enable');
  await rpc(ws, 'Page.enable');

  const t0 = Date.now();
  let lastLen = 0, done = false, txt = '';
  while ((Date.now() - t0) / 1000 < timeoutS) {
    await sleep(1500);
    txt = await evalJS(ws, "(document.getElementById('diag')||{}).textContent||''");
    if (typeof txt !== 'string') { console.log('eval problem: ' + txt); break; }
    if (txt.length !== lastLen) {
      process.stdout.write(txt.slice(lastLen));
      lastLen = txt.length;
    }
    if (/AUTO DONE/.test(txt)) { done = true; break; }
  }
  const fps = await evalJS(ws, "window.__DESCENT ? window.__DESCENT.fps.toFixed(1) : '?'");
  console.log('\n--- 实时耗时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's, 结束=' + done + ', 最后 fps(软件渲染)=' + fps);
  if (errs.length) { console.log('!! JS 异常 ' + errs.length + ' 条:'); errs.slice(0, 12).forEach(e => console.log('   ' + e)); }
  else console.log('无 JS 异常');
  try { ws.close(); } catch (e) { }
  proc.kill();
  await sleep(400);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }
  process.exit(done ? 0 : 2);
})();
