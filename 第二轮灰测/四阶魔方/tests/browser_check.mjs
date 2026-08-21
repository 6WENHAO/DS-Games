/* 浏览器端自动验收（CDP 直连，无需 puppeteer）
 *   1. 渲染是否正常（截图 + 像素统计 + WebGL 错误）
 *   2. 控制台是否有错误
 *   3. 打乱 / 求解 / 分步播放 / 跳转 是否真的把魔方还原
 *   4. 鼠标拖拽表面是否触发转层（合成真实鼠标事件）
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodePng, analyze } from './png.mjs';

const SHOT = resolve('.shots');
mkdirSync(SHOT, { recursive: true });
const shotPath = n => join(SHOT, n);

const PORT = 9333 + Math.floor(Math.random() * 200);
const FILE = 'file://' + resolve(process.argv[2] || 'index.html');
const profile = mkdtempSync(join(tmpdir(), 'cdp-'));
const chrome = spawn('/opt/node/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter',
  '--user-data-dir=' + profile, '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=1440,900', '--hide-scrollbars', '--remote-debugging-port=' + PORT, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let chromeErr = '';
chrome.stderr.on('data', d => { chromeErr += d.toString(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function httpJson(path, method) {
  let lastErr = '';
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + path, { method: method || 'GET' });
      if (!r.ok) { lastErr = 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120); await sleep(250); continue; }
      return await r.json();
    } catch (e) { lastErr = e.message; await sleep(250); }
  }
  throw new Error('无法连接 Chrome DevTools (' + lastErr + ') ' + chromeErr.slice(-300));
}

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [], pageErrors = [];
function send(method, params) {
  const id = ++msgId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evalJs(expr, awaitPromise) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitPromise });
  if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
  return r.result.value;
}
async function screenshot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = shotPath(name);
  writeFileSync(p, Buffer.from(r.data, 'base64'));
  return p;
}
async function waitIdle(max) {
  for (let i = 0; i < (max || 80); i++) {
    if (await evalJs('!!(window.__APP__ && !window.__APP__.S.anim && !window.__APP__.S.queue.length)')) return true;
    await sleep(100);
  }
  return false;
}
async function mouse(type, x, y, button) {
  await send('Input.dispatchMouseEvent', {
    type, x, y, button: button || 'left', buttons: type === 'mouseMoved' && button === 'left' ? 1 : (type === 'mousePressed' ? 1 : 0),
    clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0
  });
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fails++; };

(async () => {
  let target;
  try {
    target = await httpJson('/json/new?' + encodeURIComponent(FILE), 'PUT');
  } catch (e) {
    const list = await httpJson('/json/list');
    target = list.find(t => t.type === 'page');
    if (!target) throw e;
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws error')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map(a => a.value || a.description).join(' '));
    } else if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  if (!target.url || target.url === 'about:blank') { await send('Page.navigate', { url: FILE }); }
  await sleep(3000);

  /* ---- 1. 初始化与渲染 ---- */
  const ready = await evalJs('!!(window.__APP__ && window.__APP__.ready)');
  ok(ready, '应用初始化完成（WebGL2 渲染器就绪）');
  const glInfo = await evalJs(`(() => { const g = window.__APP__.renderer.gl; return { err: g.getError(), ver: g.getParameter(g.VERSION) }; })()`);
  ok(glInfo && glInfo.err === 0, 'WebGL 无错误码 (getError=' + (glInfo && glInfo.err) + ')  ' + (glInfo && glInfo.ver));

  const shot1 = await screenshot('01_init.png');
  const img1 = decodePng(shot1);
  const gAll = analyze(img1);
  const mid = analyze(img1, { x0: Math.round(img1.w * 0.18), x1: Math.round(img1.w * 0.70), y0: Math.round(img1.h * 0.12), y1: Math.round(img1.h * 0.92) });
  console.log('  截图 ' + img1.w + 'x' + img1.h + ' 全图彩色像素=' + gAll.colored + ' 深色=' + gAll.dark);
  console.log('  魔方区域: 彩色=' + mid.colored + ' 包围盒=' + JSON.stringify(mid.bbox) + ' 颜色分布=' + JSON.stringify(mid.hues));
  ok(mid.colored > 20000, '画面中央渲染出大面积彩色贴纸（' + mid.colored + ' px）');
  const kinds = Object.keys(mid.hues).filter(k => k !== 'other' && mid.hues[k] > 400);
  ok(kinds.length >= 3, '同时可见 ' + kinds.length + ' 种以上魔方颜色: ' + kinds.join('/'));
  ok(mid.bbox && mid.bbox.w > 250 && mid.bbox.h > 250, '魔方投影尺寸合理（' + (mid.bbox && mid.bbox.w) + 'x' + (mid.bbox && mid.bbox.h) + '）');
  ok(mid.dark / mid.total > 0.05, '存在明显黑色卡线/描边（深色占比 ' + (100 * mid.dark / mid.total).toFixed(1) + '%）');

  /* ---- 1b. 逐贴纸校验：状态颜色 <-> 屏幕像素 一致 ---- */
  const facelets = await evalJs(`(() => {
    const A = window.__APP__, R = A.renderer, C = A.C;
    const eye = R.eyePos(); const out = [];
    for (let fid = 0; fid < 96; fid++) {
      const fc = R.faceletCenter(fid);
      const v = [eye[0] - fc.p[0], eye[1] - fc.p[1], eye[2] - fc.p[2]];
      const dot = v[0] * fc.n[0] + v[1] * fc.n[1] + v[2] * fc.n[2];
      if (dot <= 0.35) continue;                       // 背面不可见
      const s = R.project(fc.p);
      out.push({ fid: fid, color: A.S.cube[fid], x: Math.round(s[0]), y: Math.round(s[1]) });
    }
    return out;
  })()`);
  {
    const PAL = [[244, 246, 248], [255, 59, 48], [34, 197, 94], [255, 214, 10], [255, 138, 31], [47, 107, 255]];
    const img = decodePng(await screenshot('01b_facelets.png'));
    const dpr = img.w / (await evalJs('document.getElementById("cv").clientWidth'));
    let good = 0, bad = [], counted = 0;
    for (const f of facelets) {
      const x = Math.round(f.x * dpr), y = Math.round(f.y * dpr);
      if (x < 2 || y < 2 || x >= img.w - 2 || y >= img.h - 2) continue;
      // 取 3x3 邻域中位数，避免高光/描边像素
      const px = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const i = ((y + dy) * img.w + (x + dx)) * img.ch;
        px.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
      }
      px.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
      const [r, g, b] = px[4];
      counted++;
      // 归一化后比较色相（卡通着色会改变明度，但色相关系保持）
      const norm = c => { const m = Math.max(c[0], c[1], c[2]) || 1; return [c[0] / m, c[1] / m, c[2] / m]; };
      const a1 = norm([r, g, b]);
      let bestI = -1, bestD = 1e9;
      PAL.forEach((c, i) => {
        const a2 = norm(c);
        const d = Math.abs(a1[0] - a2[0]) + Math.abs(a1[1] - a2[1]) + Math.abs(a1[2] - a2[2]);
        if (d < bestD) { bestD = d; bestI = i; }
      });
      if (bestI === f.color) good++; else bad.push(f.fid + ':期望' + f.color + '实得' + bestI);
    }
    console.log('  可见贴纸 ' + counted + ' 张，颜色匹配 ' + good + ' 张' + (bad.length ? '，不匹配: ' + bad.slice(0, 8).join(' ') : ''));
    ok(counted >= 40, '可见贴纸数量合理（' + counted + ' ≥ 40，三个面 48 张）');
    ok(good / Math.max(1, counted) > 0.92, '贴纸颜色与魔方状态一致率 ' + (100 * good / Math.max(1, counted)).toFixed(1) + '%');
  }

  /* ---- 1c. 卡通渲染特征：面内平坦色阶 + 面间明度分层 + 贴纸间黑色卡线 ---- */
  {
    const geom = await evalJs(`(() => {
      const A = window.__APP__, R = A.renderer, C = A.C, eye = R.eyePos();
      const vis = [], mids = [];
      const cw = document.getElementById('cv').clientWidth;
      for (let f = 0; f < 6; f++) for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const fid = f * 16 + r * 4 + c;
        const g = C.GEOM[fid], fc = R.faceletCenter(fid);
        const v = [eye[0] - fc.p[0], eye[1] - fc.p[1], eye[2] - fc.p[2]];
        if (v[0] * fc.n[0] + v[1] * fc.n[1] + v[2] * fc.n[2] <= 0.6) continue;
        const s = R.project(fc.p);
        vis.push({ fid: fid, face: f, r: r, c: c, x: s[0], y: s[1] });
        if (c < 3) {
          const fc2 = R.faceletCenter(f * 16 + r * 4 + c + 1);
          const v2 = [eye[0] - fc2.p[0], eye[1] - fc2.p[1], eye[2] - fc2.p[2]];
          if (v2[0] * fc2.n[0] + v2[1] * fc2.n[1] + v2[2] * fc2.n[2] <= 0.6) continue;
          const s2 = R.project(fc2.p);
          mids.push({ a: [s[0], s[1]], b: [s2[0], s2[1]], m: [(s[0] + s2[0]) / 2, (s[1] + s2[1]) / 2] });
        }
      }
      return { vis: vis, mids: mids, cw: cw };
    })()`);
    const img = decodePng(await screenshot('01c_style.png'));
    const dpr = img.w / geom.cw;
    const at = (x, y) => { const i = (Math.round(y * dpr) * img.w + Math.round(x * dpr)) * img.ch; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
    const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    // 面内平坦度 + 面间分层
    const byFace = {};
    for (const v of geom.vis) { (byFace[v.face] = byFace[v.face] || []).push(lum(at(v.x, v.y))); }
    const faceStats = Object.entries(byFace).map(([f, ls]) => {
      const mean = ls.reduce((a, b) => a + b, 0) / ls.length;
      const sd = Math.sqrt(ls.reduce((a, b) => a + (b - mean) ** 2, 0) / ls.length);
      return { face: +f, n: ls.length, mean: +mean.toFixed(1), sd: +sd.toFixed(1) };
    });
    console.log('  各可见面亮度: ' + JSON.stringify(faceStats));
    ok(faceStats.length >= 3, '可见面数量 ' + faceStats.length + ' ≥ 3');
    ok(faceStats.every(f => f.sd < 26), '同一面内色阶平坦（各面亮度标准差 ' + faceStats.map(f => f.sd).join('/') + ' < 26，卡通平涂特征）');
    // 贴纸间必须存在更暗的黑色卡线
    let lineOk = 0;
    for (const m of geom.mids) {
      const la = lum(at(m.a[0], m.a[1])), lb = lum(at(m.b[0], m.b[1])), lm = lum(at(m.m[0], m.m[1]));
      if (lm < Math.min(la, lb) * 0.62) lineOk++;
    }
    console.log('  相邻贴纸中缝检测: ' + lineOk + '/' + geom.mids.length + ' 处为明显暗线');
    ok(geom.mids.length >= 8 && lineOk / geom.mids.length > 0.8,
      '相邻贴纸之间存在黑色卡线描边（' + lineOk + '/' + geom.mids.length + '）');
  }

  /* ---- 2. 拖拽转层 ---- */
  const before = await evalJs('Array.from(window.__APP__.S.cube).join("")');
  // 从画面中心（魔方正面）向右拖动
  await mouse('mousePressed', 620, 470); await sleep(60);
  for (let i = 1; i <= 12; i++) { await mouse('mouseMoved', 620 + i * 12, 470, 'left'); await sleep(16); }
  await mouse('mouseReleased', 620 + 144, 470); await waitIdle(); await sleep(100);
  const after = await evalJs('Array.from(window.__APP__.S.cube).join("")');
  const dragMoved = await evalJs('window.__APP__.S.moveCount');
  ok(before !== after && dragMoved > 0, '拖拽魔方表面成功转动切片层（moveCount=' + dragMoved + '）');
  await screenshot('02_drag.png');

  /* ---- 2b. 拖拽方向不变量：来回拖动应互为逆操作；同向 4 次应回到原状 ---- */
  {
    const st0 = await evalJs('Array.from(window.__APP__.S.cube).join("")');
    const drag = async (x, y, dx, dy) => {
      await mouse('mousePressed', x, y); await sleep(50);
      const N = 10;
      for (let i = 1; i <= N; i++) { await mouse('mouseMoved', x + dx * i / N, y + dy * i / N, 'left'); await sleep(14); }
      await mouse('mouseReleased', x + dx, y + dy);
      await waitIdle(); await sleep(80);
    };
    await drag(620, 470, 130, 0);
    const st1 = await evalJs('Array.from(window.__APP__.S.cube).join("")');
    await drag(620, 470, -130, 0);
    const st2 = await evalJs('Array.from(window.__APP__.S.cube).join("")');
    ok(st1 !== st0 && st2 === st0, '同一位置左右对拖互为逆操作（状态精确回退）');
    for (let i = 0; i < 4; i++) await drag(620, 470, 130, 0);
    const st3 = await evalJs('Array.from(window.__APP__.S.cube).join("")');
    ok(st3 === st0, '同向连续拖动 4 次回到原状态（每次恰好 90°）');
    // 垂直拖动应使用不同的转轴
    const axH = await evalJs(`(() => { const A = window.__APP__; return A.S.lastTurn ? A.S.lastTurn.axis : -1; })()`);
    await drag(620, 470, 0, 130);
    const axV = await evalJs(`(() => { const A = window.__APP__; return A.S.lastTurn ? A.S.lastTurn.axis : -1; })()`);
    ok(axH >= 0 && axV >= 0 && axH !== axV, '横向 / 纵向拖动分别绕不同轴转动（axis ' + axH + ' vs ' + axV + '）');
    await evalJs('window.__APP__.doReset()'); await sleep(200);
  }

  /* ---- 3. 拖拽背景转视角 ---- */
  const camBefore = await evalJs('window.__APP__.renderer.cam.yaw');
  await mouse('mousePressed', 250, 200); await sleep(40);
  for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', 250 + i * 15, 200, 'left'); await sleep(16); }
  await mouse('mouseReleased', 370, 200); await sleep(200);
  const camAfter = await evalJs('window.__APP__.renderer.cam.yaw');
  ok(Math.abs(camAfter - camBefore) > 0.05, '拖拽背景自由旋转视角（yaw ' + camBefore.toFixed(2) + ' → ' + camAfter.toFixed(2) + '）');
  await screenshot('03_orbit.png');

  /* ---- 4. 打乱 + 两种解法求解 + 播放 ---- */
  for (const method of ['cfop', 'roux']) {
    await evalJs('window.__APP__.doReset(); window.__APP__.setMethod("' + method + '")');
    await sleep(200);
    // 直接注入打乱（比等动画快）
    await evalJs(`(() => { const A = window.__APP__, C = A.C;
      A.S.queue.length = 0; A.S.anim = null; A.S.scrambling = false;
      A.S.cube = C.applySeq(C.solvedState(), C.randomScramble(36));
      A.renderer.setState(A.S.cube); A.S.solution = null; })()`);
    await sleep(120);
    const scrambled = await evalJs('window.__APP__.isSolved()');
    ok(!scrambled, `[${method}] 已进入打乱状态`);
    await screenshot('04_' + method + '_scrambled.png');

    await evalJs('window.__APP__.doSolve()');
    let sol = null;
    for (let i = 0; i < 240; i++) {
      await sleep(500);
      sol = await evalJs(`(() => { const s = window.__APP__.S.solution; return s ? { n: s.flat.length, steps: s.steps.length, method: s.method, phases: s.steps.map(x => x.phase) } : (window.__APP__.S.solving ? null : 'idle'); })()`);
      if (sol && sol !== 'idle') break;
      if (sol === 'idle') break;
    }
    ok(sol && sol !== 'idle' && sol.n > 0, `[${method}] 求解成功：${sol && sol.n} 步 / ${sol && sol.steps} 阶段`);
    if (sol && sol !== 'idle') {
      const ph = [...new Set(sol.phases)];
      console.log('  阶段类型: ' + ph.join(' / '));
      ok(ph.includes('归约'), `[${method}] 含归约阶段`);
      ok(ph.includes(method === 'roux' ? 'Roux' : 'CFOP'), `[${method}] 含 ${method === 'roux' ? '桥式' : 'CFOP'} 阶段`);
      // 步骤列表 DOM
      const domSteps = await evalJs('document.querySelectorAll("#steps .step").length');
      ok(domSteps === sol.steps, `[${method}] 步骤面板渲染 ${domSteps} 个阶段`);
      // 分步：前进 3 步再后退 3 步应回到原状态
      await evalJs('window.__APP__.setPlaying(false); window.__APP__.gotoIndex(0)');
      await sleep(150);
      const s0 = await evalJs('Array.from(window.__APP__.S.cube).join("")');
      for (let i = 0; i < 3; i++) { await evalJs('window.__APP__.stepOnce(1)'); await waitIdle(); await sleep(60); }
      const s3 = await evalJs('Array.from(window.__APP__.S.cube).join("")');
      for (let i = 0; i < 3; i++) { await evalJs('window.__APP__.stepOnce(-1)'); await waitIdle(); await sleep(60); }
      const sBack = await evalJs('Array.from(window.__APP__.S.cube).join("")');
      ok(s0 !== s3 && s0 === sBack, `[${method}] 单步前进/后退状态同步正确`);
      // 跳到结尾 → 必须复原
      await evalJs('window.__APP__.gotoIndex(window.__APP__.S.solution.flat.length)');
      await sleep(400);
      const solved = await evalJs('window.__APP__.isSolved()');
      ok(solved, `[${method}] 播放到最后一步后魔方完全复原`);
      await screenshot('05_' + method + '_solved.png');
      // 播放模式跑一小段
      await evalJs('window.__APP__.gotoIndex(0); document.getElementById("speed").value="4"; window.__APP__.setPlaying(true)');
      await sleep(2200);
      const idx = await evalJs('window.__APP__.S.playIdx');
      ok(idx > 3, `[${method}] 自动播放推进正常（已播 ${idx} 步）`);
      await evalJs('window.__APP__.setPlaying(false)');
      await screenshot('06_' + method + '_playing.png');
    }
  }

  /* ---- 4b. 移动端布局（390×844）：控件在视口内且不重叠 ---- */
  {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(900);
    await evalJs('window.dispatchEvent(new Event("resize"))');
    await sleep(500);
    const layout = await evalJs(`(() => {
      const r = id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const top = document.querySelector('.topbar').getBoundingClientRect();
      const acts = document.querySelector('.acts').getBoundingClientRect();
      return { vw: innerWidth, vh: innerHeight, playbar: r('playbar'), panel: r('panel'),
               topRight: Math.round(acts.right), topH: Math.round(top.height), cv: r('cv') };
    })()`);
    console.log('  移动端布局: ' + JSON.stringify(layout));
    ok(layout.topRight <= layout.vw + 1, '顶栏按钮未溢出屏幕（右边界 ' + layout.topRight + ' ≤ ' + layout.vw + '）');
    ok(layout.playbar.y + layout.playbar.h <= layout.vh + 1 && layout.playbar.w <= layout.vw, '播放条完整位于视口内');
    ok(layout.panel.y >= layout.vh - 30, '步骤面板默认收起（y=' + layout.panel.y + '）');
    await evalJs('document.body.classList.add("panel-open")');
    await sleep(500);
    const openY = await evalJs('Math.round(document.getElementById("panel").getBoundingClientRect().y)');
    ok(openY < layout.vh - 200, '点击「步骤」后面板弹出（y=' + openY + '）');
    await screenshot('07_mobile.png');
    const im = decodePng(shotPath('07_mobile.png'));
    const a = analyze(im, { x0: 0, x1: im.w, y0: 0, y1: Math.round(im.h * 0.4) });
    ok(a.colored > 3000, '移动端上半屏仍可见魔方（彩色 ' + a.colored + ' px）');
    await send('Emulation.clearDeviceMetricsOverride');
    await sleep(300);
  }

  /* ---- 5. 控制台无错误 ---- */
  ok(consoleErrors.length === 0, '无 console.error（' + consoleErrors.slice(0, 3).join(' | ') + '）');
  ok(pageErrors.length === 0, '无未捕获异常（' + pageErrors.slice(0, 2).join(' | ') + '）');

  console.log(fails === 0 ? '\n浏览器端全部通过 ✓' : '\n失败 ' + fails + ' 项');
  await send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(fails ? 1 : 0);
})().catch(async e => {
  console.error('测试异常: ' + e.message);
  console.error(chromeErr.slice(-1200));
  chrome.kill();
  process.exit(1);
});
