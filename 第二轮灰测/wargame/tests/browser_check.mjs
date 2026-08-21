/* 浏览器端验收（CDP 直连无头 Chrome）：
 *   渲染像素、标签投影、指令下达、回合结算动画、政治阶段、多回合推进、移动端布局 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodePng, analyze } from './png.mjs';

const SHOT = resolve('.shots'); mkdirSync(SHOT, { recursive: true });
const PORT = 9500 + Math.floor(Math.random() * 300);
const FILE = 'file://' + resolve('index.html');
const profile = mkdtempSync(join(tmpdir(), 'cdp-wg-'));
const chrome = spawn('/opt/node/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter',
  '--user-data-dir=' + profile, '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=1560,900', '--hide-scrollbars', '--remote-debugging-port=' + PORT, 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
let cerr = ''; chrome.stderr.on('data', d => { cerr += d.toString(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function httpJson(path, method) {
  let last = '';
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + path, { method: method || 'GET' });
      if (r.ok) return r.json();
      last = 'HTTP ' + r.status;
    } catch (e) { last = e.message; }
    await sleep(250);
  }
  throw new Error('无法连接 DevTools (' + last + ') ' + cerr.slice(-300));
}
let ws, id = 0; const pend = new Map(); const consoleErrors = [], pageErrors = [];
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
async function ev(expr, aw) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!aw });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = join(SHOT, name); writeFileSync(p, Buffer.from(r.data, 'base64')); return p;
}
const mouse = (type, x, y, btn) => send('Input.dispatchMouseEvent', {
  type, x, y, button: btn || 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1
});
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fails++; };

(async () => {
  let target;
  try { target = await httpJson('/json/new?' + encodeURIComponent(FILE), 'PUT'); }
  catch (e) { const l = await httpJson('/json/list'); target = l.find(t => t.type === 'page'); if (!target) throw e; }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 失败')); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map(a => a.value || a.description).join(' '));
    else if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  };
  await send('Runtime.enable'); await send('Page.enable');
  if (!target.url || target.url === 'about:blank') await send('Page.navigate', { url: FILE });
  await sleep(3200);

  /* ---- 1 初始化 ---- */
  ok(await ev('!!(window.__WG__ && window.__WG__.ready)'), '应用初始化完成（场景/内核/渲染器/界面就绪）');
  const gl = await ev('(() => { const g = window.__WG__.renderer.gl; return { err: g.getError(), ver: g.getParameter(g.VERSION) }; })()');
  ok(gl && gl.err === 0, 'WebGL 无错误（' + (gl && gl.ver) + '）');
  ok(await ev('document.querySelector("#modal.show") !== null'), '启动弹窗（选择阵营）已显示');
  const brief = await ev(`(() => { window.__WG__.showBrief(); const n = document.querySelectorAll('#modal .bi').length,
      a = document.querySelectorAll('#modal .bi .src a').length; return { n, a }; })()`);
  ok(brief.n >= 6 && brief.a >= 10, `情报简报含 ${brief.n} 个条目、${brief.a} 条可点击信源链接`);
  await ev('window.__WG__.closeModal()');

  /* ---- 2 渲染与标签 ---- */
  await ev('window.__WG__.newGame("blue", 20260820)');
  await sleep(1200);
  const p1 = await shot('wg_01_map.png');
  const img = decodePng(p1);
  const mid = analyze(img, { x0: Math.round(img.w * 0.20), x1: Math.round(img.w * 0.78), y0: 60, y1: Math.round(img.h * 0.92) });
  console.log('  沙盘区域: 彩色像素=' + mid.colored + ' 深色=' + mid.dark + ' 颜色分布=' + JSON.stringify(mid.hues).slice(0, 120));
  ok(mid.colored > 12000, `三维沙盘已渲染出大量彩色地形（${mid.colored} px）`);
  ok(mid.bbox && mid.bbox.w > 300 && mid.bbox.h > 200, `地形覆盖范围合理（${mid.bbox && mid.bbox.w}x${mid.bbox && mid.bbox.h}）`);
  const lb = await ev(`(() => {
    const ls = [...document.querySelectorAll('#labels .lb')].filter(d => d.style.display !== 'none');
    const cv = document.getElementById('map').getBoundingClientRect();
    let inside = 0;
    ls.forEach(d => { const r = d.getBoundingClientRect(); if (r.left > cv.left - 40 && r.right < cv.right + 40 && r.top > 0 && r.bottom < cv.bottom) inside++; });
    return { total: ls.length, inside, sites: document.querySelectorAll('#labels .lb-site').length, units: document.querySelectorAll('#labels .lb-unit').length };
  })()`);
  console.log('  标签层: ' + JSON.stringify(lb));
  ok(lb.sites >= 20 && lb.units >= 20, `要点标签 ${lb.sites} 个、棋子标签 ${lb.units} 个`);
  ok(lb.inside >= lb.total * 0.8, `${lb.inside}/${lb.total} 个标签正确投影在视口内`);

  /* ---- 2b 地理着色校验：按国别采样地形顶面颜色，检查区域可区分且方位正确 ---- */
  {
    const samples = await ev(`(() => {
      const W = window.__WG__, R = W.renderer, E = W.ENGINE;
      const out = [];
      E.MAP.hexes.forEach(h => {
        const w = R.hexWorld(h.c, h.r);
        // 在顶面偏移采样，避开中心的棋子/要点标记
        const pts = [[0.62, 0.0], [-0.62, 0.0], [0.0, 0.66], [0.0, -0.66], [0.44, 0.44], [-0.44, -0.44]].map(o => R.project([w[0] + o[0], h.terrain.h + 0.02, w[2] + o[1]]));
        out.push({ n: h.n, t: h.terrain.id, c: h.c, r: h.r, pts });
      });
      return out;
    })()`);
    // 采样前隐藏 HTML 标签层与棋子标记，避免遮挡地形像素
    await ev(`document.getElementById('labels').style.display='none'`);
    await sleep(320);
    const img2 = decodePng(await shot('wg_01b_terrain.png'));
    await ev(`document.getElementById('labels').style.display=''`);
    const dpr = img2.w / (await ev('document.getElementById("map").clientWidth'));
    const px = (x, y) => { const i = (Math.round(y * dpr) * img2.w + Math.round(x * dpr)) * img2.ch; return [img2.data[i], img2.data[i + 1], img2.data[i + 2]]; };
    const acc = {};
    samples.forEach(sm => {
      sm.pts.forEach(pt => {
        if (!pt) return;
        const [x, y] = pt;
        if (x < 6 || y < 70 || x * dpr >= img2.w - 6 || y * dpr >= img2.h - 6) return;
        const c = px(x, y);
        if (c[0] + c[1] + c[2] < 40) return;             // 跳过背景
        (acc[sm.n] = acc[sm.n] || []).push(c);
      });
    });
    const mean = n => { const a = acc[n] || []; if (a.length < 8) return null; return [0, 1, 2].map(k => a.reduce((s, c) => s + c[k], 0) / a.length); };
    const G_ = mean('G'), M_ = mean('M'), I_ = mean('I'), U_ = mean('U'), Z_ = mean('Z'), Y_ = mean('Y');
    const fmt = c => c ? c.map(v => Math.round(v)).join(',') : 'n/a';
    console.log('  国别平均色: 波斯湾=' + fmt(G_) + ' 地中海=' + fmt(M_) + ' 伊朗=' + fmt(I_) + ' 海湾阿拉伯=' + fmt(U_) + ' 以色列=' + fmt(Z_) + ' 也门=' + fmt(Y_));
    ok(G_ && M_ && I_ && U_, '主要区域均有足量像素采样（海/陆均已渲染）');
    ok(G_ && G_[2] > G_[0] + 25, '海域渲染为偏蓝（B 明显高于 R）');
    ok(I_ && I_[0] > I_[2], '伊朗区域渲染为偏暖红（R > B）');
    ok(U_ && Math.abs(U_[0] - U_[2]) < 90 && U_[0] > 90, '海湾阿拉伯区域为浅荒漠色');
    const dist = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0;
    ok(dist(I_, U_) > 25 && dist(I_, G_) > 40, `不同势力区域颜色可区分（伊朗↔海湾 ${dist(I_, U_).toFixed(0)}，伊朗↔海域 ${dist(I_, G_).toFixed(0)}）`);
  }

  /* ---- 3 指标面板 ---- */
  const meters = await ev('document.querySelectorAll("#meters .mt").length');
  ok(meters >= 10, `战略指标仪表盘 ${meters} 项`);

  /* ---- 4 选择单位 + 下达指令 ---- */
  const sel = await ev(`(() => {
    const W = window.__WG__; W.selectUnit('us-bomb');
    const btns = [...document.querySelectorAll('#orders .obtn')].map(b => b.textContent);
    return { btns, head: document.querySelector('#orders .osel b') ? document.querySelector('#orders .osel b').textContent : '' };
  })()`);
  ok(sel.head.indexOf('B-2') >= 0 || sel.head.indexOf('轰炸') >= 0, `选中单位后显示指令面板（${sel.head}）`);
  ok(sel.btns.length >= 3, '可用指令按钮：' + sel.btns.join('/'));
  const assigned = await ev(`(() => {
    const W = window.__WG__, E = W.ENGINE, st = W.G.st;
    const u = st.byId('us-bomb');
    const t = E.targetsFor(st, u, 'strike').find(x => x.id === 'fordow');
    W.setOrder('us-bomb', 'strike', t);
    return { has: !!st.byId('us-bomb').order, target: st.byId('us-bomb').order && st.byId('us-bomb').order.target.label };
  })()`);
  ok(assigned.has && /福尔多/.test(assigned.target || ''), `指令已下达：B-2 → ${assigned.target}`);
  // 地图点击拾取
  const pick = await ev(`(() => {
    const W = window.__WG__, r = document.getElementById('map').getBoundingClientRect();
    const h = W.renderer.pickHex(r.width / 2, r.height / 2);
    return h;
  })()`);
  ok(pick && typeof pick.c === 'number', `地图拾取可用（中心命中格 ${pick && pick.key}）`);

  /* ---- 5 结算回合（含动画）---- */
  const before = await ev('JSON.stringify(window.__WG__.G.st.meters)');
  await ev('window.__WG__.autoOrders()');
  const orderedN = await ev(`window.__WG__.G.st.units.filter(u => u.side === 'blue' && u.order).length`);
  ok(orderedN >= 8, `参谋部代拟后我方 ${orderedN} 个单位有指令`);
  await ev('window.__WG__.resolve()');
  await sleep(900);
  const fxCount = await ev('window.__WG__.renderer.fxCount()');
  ok(fxCount > 0, `结算动画生效（当前活跃特效 ${fxCount} 个：弹道/闪光）`);
  await shot('wg_02_strike.png');
  await ev('window.__WG__.skipAnim()');
  await sleep(1500);
  const after = await ev('JSON.stringify(window.__WG__.G.st.meters)');
  ok(before !== after, '结算后战略指标发生变化');
  {
    // 动画像素证据：与无动画基线对比，地图区域应有明显变化（弹道/闪光）
    const p0 = await shot('wg_02b_base.png');
    const a0 = decodePng(p0);
    await ev('window.__WG__.renderer.addArc([9,2],[1,4],"red",{}); window.__WG__.renderer.addFlash([1,4],[1,0.6,0.3],2.4,0);');
    await sleep(260);
    const p1b = await shot('wg_02c_arc.png');
    const a1 = decodePng(p1b);
    let diff = 0, bright = 0;
    for (let y = 80; y < a0.h - 40; y += 2) for (let x = 300; x < a0.w - 400; x += 2) {
      const i = (y * a0.w + x) * a0.ch;
      const d = Math.abs(a0.data[i] - a1.data[i]) + Math.abs(a0.data[i + 1] - a1.data[i + 1]) + Math.abs(a0.data[i + 2] - a1.data[i + 2]);
      if (d > 40) { diff++; if (a1.data[i] > 150) bright++; }
    }
    console.log('  动画像素差异: ' + diff + '（其中偏亮暖色 ' + bright + '）');
    ok(diff > 150, `弹道/闪光在画面上可见（差异像素 ${diff}）`);
  }

  const phase = await ev('window.__WG__.G.st.phase');
  ok(phase === 'politics', '进入政治决策阶段');
  const polBtns = await ev('document.querySelectorAll("#orders .pbtn").length');
  ok(polBtns >= 4, `政治行动可选 ${polBtns} 项`);
  const tl = await ev(`(() => { const t = window.__WG__.G.st.timeline;
    return { strikes: t.filter(e => e.t === 'strike').length, events: t.filter(e => e.t === 'event').length,
             shots: t.filter(e => e.t === 'strike').reduce((a, e) => a + e.shots, 0),
             intercepted: t.filter(e => e.t === 'strike').reduce((a, e) => a + e.intercepted, 0) }; })()`);
  console.log('  本回合结算: ' + JSON.stringify(tl));
  ok(tl.strikes >= 4 && tl.shots > tl.intercepted, `双方共 ${tl.strikes} 次打击、发射 ${tl.shots} 枚、被拦 ${tl.intercepted} 枚`);

  /* ---- 6 连续推进多回合 ---- */
  await ev(`window.__WG__.politics('b-reinforce')`);
  await sleep(300);
  ok(await ev('window.__WG__.G.st.turn') === 2, '回合推进到第 2 回合');
  let overInfo = null;
  for (let i = 0; i < 8 && !overInfo; i++) {
    await ev('window.__WG__.autoOrders(); window.__WG__.resolve(); window.__WG__.skipAnim();');
    await sleep(700);
    const st = await ev(`(() => { const s = window.__WG__.G.st;
      const pol = window.__WG__.ENGINE.politicalOptions(s, 'blue');
      return { phase: s.phase, turn: s.turn, over: s.over, pol: pol.map(p => p.id) }; })()`);
    if (st.over) { overInfo = st.over; break; }
    if (st.phase === 'politics') {
      const pick = st.pol.find(p => p !== 'b-total') || st.pol[0];
      const o = await ev(`window.__WG__.politics('${pick}')`);
      if (o) { overInfo = o; break; }
    }
    await sleep(150);
  }
  const finalTurn = await ev('window.__WG__.G.st.turn');
  ok(finalTurn >= 6 || overInfo, `连续推进至第 ${finalTurn} 回合${overInfo ? '（已判定结局：' + overInfo.code + '）' : ''}`);
  const logN = await ev('document.querySelectorAll("#log .lg").length');
  ok(logN > 20, `战报日志累计 ${logN} 条`);
  await shot('wg_03_multiturn.png');
  const m2 = await ev('JSON.stringify(window.__WG__.G.st.meters)');
  const bad = await ev(`(() => { const m = window.__WG__.G.st.meters; return Object.keys(m).filter(k => !isFinite(m[k]) || m[k] === null); })()`);
  ok(bad.length === 0, '多回合后所有指标仍为有限数值');
  void m2;

  /* ---- 7 红方视角 ---- */
  await ev('window.__WG__.newGame("red", 777)');
  await sleep(700);
  const redOk = await ev(`(() => { const W = window.__WG__; W.selectUnit('ir-msl1');
    const st = W.G.st, u = st.byId('ir-msl1');
    const t = W.ENGINE.targetsFor(st, u, 'salvo')[0];
    W.setOrder('ir-msl1', 'salvo', t);
    return { side: W.G.side, tag: document.getElementById('sideTag').textContent, ord: !!u.order, target: t && t.label }; })()`);
  ok(redOk.side === 'red' && /红方/.test(redOk.tag) && redOk.ord, `可切换为红方并下达饱和齐射（目标 ${redOk.target}）`);
  await shot('wg_04_red.png');

  /* ---- 8 移动端布局 ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 414, height: 896, deviceScaleFactor: 2, mobile: true });
  await sleep(900);
  await ev('window.dispatchEvent(new Event("resize"))');
  await sleep(500);
  const mob = await ev(`(() => {
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return { vw: innerWidth, vh: innerHeight, left: r('pLeft'), right: r('pRight'), bottomBtn: r('btnResolve') }; })()`);
  console.log('  移动端: ' + JSON.stringify(mob));
  ok(mob.left.x >= 0 && mob.right.x + mob.right.w <= mob.vw + 2, '移动端左右面板不溢出屏幕');
  ok(mob.bottomBtn.y + mob.bottomBtn.h <= mob.vh + 2, '结算按钮在视口内');
  await shot('wg_05_mobile.png');
  await send('Emulation.clearDeviceMetricsOverride');

  ok(consoleErrors.length === 0, '无 console.error（' + consoleErrors.slice(0, 2).join(' | ') + '）');
  ok(pageErrors.length === 0, '无未捕获异常（' + pageErrors.slice(0, 2).join(' | ') + '）');
  console.log(fails === 0 ? '\n浏览器端全部通过 ✓' : '\n失败 ' + fails + ' 项');
  chrome.kill();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('测试异常: ' + e.message); console.error(cerr.slice(-800)); chrome.kill(); process.exit(1); });
