// CDP-based screenshot tool: waits for the game to signal readiness, then captures.
// usage: node tools/shoot.cjs <url> <outPng> [waitMs] [readyExpr] [actionsFile]
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const url = process.argv[2];
const out = process.argv[3];
const waitMs = parseInt(process.argv[4] || '240000', 10);
const readyExpr = process.argv[5] || "document.title === 'SHOT_READY'";
const actionsFile = process.argv[6] || null;

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const proc = spawn(EDGE, [
    '--headless=new', '--no-first-run', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${process.env.TEMP}\\edge-cdp`, '--disable-gpu',
    '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try { targets = await getJson('/json'); break; } catch {}
  }
  if (!targets) { console.log('FAIL: no CDP'); proc.kill(); process.exit(1); }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m.result ?? m.error);
      pending.delete(m.id);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });

  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < waitMs) {
    await sleep(1000);
    const r = await send('Runtime.evaluate', { expression: readyExpr, returnByValue: true });
    if (r?.result?.value === true) { ready = true; break; }
  }
  console.log(ready ? `READY in ${((Date.now() - t0) / 1000).toFixed(1)}s` : 'TIMEOUT waiting readiness');

  if (actionsFile && ready) {
    const actions = JSON.parse(fs.readFileSync(actionsFile, 'utf8'));
    for (const act of actions) {
      if (act.type === 'wait') await sleep(act.ms);
      else if (act.type === 'eval') {
        const r = await send('Runtime.evaluate', { expression: act.expr, returnByValue: true });
        if (r?.result?.value !== undefined) console.log('eval:', r.result.value);
      }
      else if (act.type === 'key') {
        const opts = { key: act.key, code: act.code, windowsVirtualKeyCode: act.vk || 0, nativeVirtualKeyCode: act.vk || 0 };
        await send('Input.dispatchKeyEvent', { type: 'keyDown', ...opts });
        if (act.holdMs) await sleep(act.holdMs);
        await send('Input.dispatchKeyEvent', { type: 'keyUp', ...opts });
      } else if (act.type === 'shot') {
        await sleep(300);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(act.out, Buffer.from(shot.data, 'base64'));
        console.log('saved', act.out);
      }
    }
  }

  await sleep(1200);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out);

  const errDump = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__errors||[])', returnByValue: true });
  console.log('page_errors:', errDump?.result?.value);
  fs.writeFileSync(out + '.log', logs.join('\n'));
  console.log('console lines:', logs.length);

  try { await send('Browser.close'); } catch {}
  proc.kill();
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
