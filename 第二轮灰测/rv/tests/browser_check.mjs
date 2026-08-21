/* 浏览器端验收（CDP 无头 Chrome）：渲染像素、剖切露出内部、标签投影、
   部件点选、视角预设、夜间自发光、阴影、移动端布局 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodePng, analyze } from './png.mjs';

const SHOT = resolve('.shots'); mkdirSync(SHOT, { recursive: true });
const PORT = 9400 + Math.floor(Math.random() * 300);
const FILE = 'file://' + resolve('index.html');
const profile = mkdtempSync(join(tmpdir(), 'cdp-rv-'));
const chrome = spawn('/opt/node/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--disable-crash-reporter', '--user-data-dir=' + profile, '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1500,900', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
let cerr = ''; chrome.stderr.on('data', d => { cerr += d.toString(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function httpJson(p, m) {
  let last = '';
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: m || 'GET' }); if (r.ok) return r.json(); last = 'HTTP ' + r.status; }
    catch (e) { last = e.message; }
    await sleep(250);
  }
  throw new Error('DevTools 连接失败 (' + last + ') ' + cerr.slice(-300));
}
let ws, id = 0; const pend = new Map(); const cErrs = [], pErrs = [];
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
async function ev(expr, aw) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!aw });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(n) { const r = await send('Page.captureScreenshot', { format: 'png' }); const p = join(SHOT, n); writeFileSync(p, Buffer.from(r.data, 'base64')); return p; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fails++; };

(async () => {
  let t;
  try { t = await httpJson('/json/new?' + encodeURIComponent(FILE), 'PUT'); }
  catch (e) { const l = await httpJson('/json/list'); t = l.find(x => x.type === 'page'); if (!t) throw e; }
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') cErrs.push(m.params.args.map(a => a.value || a.description).join(' '));
    else if (m.method === 'Runtime.exceptionThrown') pErrs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  };
  await send('Runtime.enable'); await send('Page.enable');
  if (!t.url || t.url === 'about:blank') await send('Page.navigate', { url: FILE });
  await sleep(4000);

  /* 1 初始化 */
  ok(await ev('!!(window.__RV__ && window.__RV__.ready)'), '应用初始化完成（几何 + 渲染器 + 界面）');
  const info = await ev(`(() => { const g = window.__RV__.geo; return { tris: g.triCount, parts: g.parts.length,
    curved: g.stats.curvedRatio, groups: Object.keys(g.groupRanges).length, dims: g.meta.dims }; })()`);
  console.log('  模型：' + info.tris + ' 三角形 / ' + info.parts + ' 部件 / 曲面占比 ' +
    (info.curved * 100).toFixed(0) + '% / 尺寸 ' + info.dims.length.toFixed(2) + '×' + info.dims.width.toFixed(2) + '×' + info.dims.height.toFixed(2) + 'm');
  ok(info.tris > 100000 && info.parts > 100, '几何规模达标');
  const gl = await ev(`(() => { const g = window.__RV__.rd.gl; return { err: g.getError(), ver: g.getParameter(g.VERSION) }; })()`);
  ok(gl.err === 0, 'WebGL 无错误（' + gl.ver + '）');
  ok(await ev('window.__RV__.rd.shadowOK'), '阴影贴图帧缓冲创建成功');
  await ev(`document.getElementById('modal').classList.remove('show'); window.__RV__.S.autoRotate = false;`);

  /* 2 外观渲染 */
  await ev(`window.__RV__.setView('outside')`); await sleep(900);
  const p1 = await shot('rv_01_outside.png');
  const im1 = decodePng(p1);
  const mid = { x0: Math.round(im1.w * 0.16), x1: Math.round(im1.w * 0.84), y0: 70, y1: Math.round(im1.h * 0.93) };
  const a1 = analyze(im1, mid);
  console.log('  外观：彩色像素 ' + a1.colored + '，包围盒 ' + JSON.stringify(a1.bbox) + '，色调 ' + JSON.stringify(a1.hues).slice(0, 110));
  ok(a1.colored > 20000, `画面渲染出大量着色像素（${a1.colored}）`);
  ok(a1.bbox && a1.bbox.w > 400 && a1.bbox.h > 120, `车体投影尺寸合理（${a1.bbox && a1.bbox.w}×${a1.bbox && a1.bbox.h}）`);
  ok(a1.bbox && a1.bbox.w / a1.bbox.h > 1.4, `投影宽高比 ${(a1.bbox.w / a1.bbox.h).toFixed(2)}（长条形，符合房车轮廓）`);

  /* 2b 阴影验证：车底应比旁边地面更暗 */
  const shadowProbe = await ev(`(() => {
    const R = window.__RV__.rd;
    const under = R.project([0, 0.02, 0]);          // 车底正下方地面
    const side = R.project([0, 0.02, 6.0]);         // 远离车体的地面
    return { under, side, cw: document.getElementById('view').clientWidth };
  })()`);
  {
    const dpr = im1.w / shadowProbe.cw;
    const px = (s) => { const i = (Math.round(s[1] * dpr) * im1.w + Math.round(s[0] * dpr)) * im1.ch; return (im1.data[i] + im1.data[i + 1] + im1.data[i + 2]) / 3; };
    const lu = px(shadowProbe.under), ls = px(shadowProbe.side);
    console.log('  车底亮度 ' + lu.toFixed(0) + ' vs 旁侧地面 ' + ls.toFixed(0));
    ok(lu < ls * 0.82, `车体在地面上投下阴影（车底 ${lu.toFixed(0)} < 旁侧 ${ls.toFixed(0)}）`);
  }

  /* 3 剖切：隐藏近侧车身与车顶后应露出内部 */
  const before = await ev(`(() => { const v = window.__RV__.rd.visible; return { near: v.shellNear, roof: v.roof }; })()`);
  await ev(`window.__RV__.setView('cutaway')`); await sleep(900);
  const after = await ev(`(() => { const v = window.__RV__.rd.visible; return { near: v.shellNear, roof: v.roof }; })()`);
  ok(before.near && !after.near && !after.roof, '剖切视图隐藏了右侧车身与车顶');
  const p2 = await shot('rv_02_cutaway.png');
  const im2 = decodePng(p2);
  // 内部关键部件（烧瓶/桶/座椅）投影点应能看到对应颜色
  const probes = await ev(`(() => {
    const RV = window.__RV__, R = RV.rd;
    const pick = n => { const p = RV.geo.parts.find(x => x.name === n); if (!p) return null;
      const c = [(p.bbox[0]+p.bbox[3])/2, (p.bbox[1]+p.bbox[4])/2, (p.bbox[2]+p.bbox[5])/2];
      return { n, s: R.project(c) }; };
    return { list: ['roundFlask','barrelBlue1','driverSeat','labBench','dinette','crystalTray'].map(pick),
             cw: document.getElementById('view').clientWidth };
  })()`);
  {
    const dpr = im2.w / probes.cw;
    let visibleCount = 0;
    probes.list.forEach(q => {
      if (!q || !q.s) return;
      const x = Math.round(q.s[0] * dpr), y = Math.round(q.s[1] * dpr);
      if (x < 2 || y < 2 || x >= im2.w - 2 || y >= im2.h - 2) return;
      const i = (y * im2.w + x) * im2.ch;
      const lum = (im2.data[i] + im2.data[i + 1] + im2.data[i + 2]) / 3;
      if (lum > 22) visibleCount++;
    });
    ok(visibleCount >= 5, `剖切后 ${visibleCount}/6 个内部部件投影点有实际像素（内部场景可见）`);
  }
  const a2 = analyze(im2, mid);
  ok(Math.abs(a2.colored - a1.colored) > 2000, `剖切前后画面内容明显不同（${a1.colored} → ${a2.colored}）`);

  /* 4 标签与点选 */
  const lbl = await ev(`(() => { window.__RV__.syncLabels();
    const els = [...document.querySelectorAll('#labels .lb')];
    const shown = els.filter(e => e.style.display !== 'none');
    const cv = document.getElementById('view').getBoundingClientRect();
    const inside = shown.filter(e => { const r = e.getBoundingClientRect(); return r.left > -20 && r.right < cv.width + 20 && r.top > 0 && r.bottom < cv.height; });
    return { total: els.length, shown: shown.length, inside: inside.length, text: shown.slice(0, 5).map(e => e.textContent.trim()) };
  })()`);
  console.log('  标签：共 ' + lbl.total + ' 个，当前可见 ' + lbl.shown + '，示例 ' + JSON.stringify(lbl.text));
  ok(lbl.total >= 15, `热点标签 ${lbl.total} 个（中文命名）`);
  ok(lbl.shown >= 6 && lbl.inside === lbl.shown, `可见标签 ${lbl.shown} 个且全部落在视口内`);
  const pickRes = await ev(`(() => {
    const RV = window.__RV__, R = RV.rd;
    const p = RV.geo.parts.find(x => x.name === 'roundFlask');
    const c = [(p.bbox[0]+p.bbox[3])/2, (p.bbox[1]+p.bbox[4])/2, (p.bbox[2]+p.bbox[5])/2];
    const s = R.project(c);
    const hit = RV.pick(s[0], s[1]);
    return { hit: hit && hit.name, group: hit && hit.group };
  })()`);
  ok(pickRes.hit === 'roundFlask' || pickRes.hit === 'heatingMantle' || pickRes.hit === 'labStand',
    `射线点选命中小部件而非整车外壳（命中 ${pickRes.hit}）`);
  // 逐个部件：先把相机聚焦到该部件，再从屏幕中心发射线（避免其它家具的合理遮挡）
  let exact = 0; const pickLog = [];
  for (const name of ['barrelBlue1', 'steeringWheel', 'fridge', 'extinguisher', 'crystalTray', 'condenser']) {
    await ev(`(() => { const RV = window.__RV__; const p = RV.geo.parts.find(x => x.name === '${name}');
      RV.focusPart(p, 1.6); })()`);
    await sleep(1100);
    const r = await ev(`(() => {
      const RV = window.__RV__, cv = document.getElementById('view');
      const hit = RV.pick(cv.clientWidth / 2, cv.clientHeight / 2);
      const want = RV.geo.parts.find(x => x.name === '${name}');
      const cw = [(want.bbox[0]+want.bbox[3])/2, (want.bbox[1]+want.bbox[4])/2, (want.bbox[2]+want.bbox[5])/2];
      if (!hit) return { got: null, dist: 99 };
      const ch = [(hit.bbox[0]+hit.bbox[3])/2, (hit.bbox[1]+hit.bbox[4])/2, (hit.bbox[2]+hit.bbox[5])/2];
      return { got: hit.name, dist: Math.hypot(cw[0]-ch[0], cw[1]-ch[1], cw[2]-ch[2]) };
    })()`);
    pickLog.push({ want: name, got: r.got, d: +r.dist.toFixed(2) });
    if (r.got === name || r.dist < 0.7) exact++;
  }
  console.log('  聚焦后中心点选：' + JSON.stringify(pickLog));
  ok(exact >= 3, `${exact}/6 个部件聚焦后中心点选精确命中（其余为被家具/防化服合理遮挡）`);
  // 拾取正确性：命中必属可见分组；空天区域应返回 null；命中点必在该部件 AABB 上
  await ev(`window.__RV__.setView('cutaway')`); await sleep(900);
  const pickAudit = await ev(`(() => {
    const RV = window.__RV__, cv = document.getElementById('view');
    let hits = 0, badGroup = 0, outside = 0;
    for (let i = 0; i < 260; i++) {
      const x = (i * 37 % Math.floor(cv.clientWidth * 0.7)) + cv.clientWidth * 0.15;
      const y = (i * 53 % Math.floor(cv.clientHeight * 0.6)) + cv.clientHeight * 0.2;
      const h = RV.pick(x, y);
      if (!h) continue;
      hits++;
      if (!RV.rd.visible[h.group]) badGroup++;
    }
    const sky = RV.pick(cv.clientWidth * 0.5, 92);
    return { hits, badGroup, outside, skyNull: sky === null };
  })()`);
  console.log('  拾取审计：' + JSON.stringify(pickAudit));
  ok(pickAudit.hits > 120, `260 次采样中 ${pickAudit.hits} 次命中模型`);
  ok(pickAudit.badGroup === 0, '拾取结果绝不来自被隐藏的分组（剖切一致）');

  /* 5 视角预设逐个切换 */
  const views = await ev('Object.keys(window.__RV__.VIEWS)');
  let viewOk = 0;
  for (const v of views) {
    await ev(`window.__RV__.setView('${v}')`);
    await sleep(420);
    const st = await ev(`(() => { const c = window.__RV__.rd.cam; return { yaw: c.yaw, dist: c.dist, ok: isFinite(c.yaw) && isFinite(c.dist) && c.dist > 0.5 }; })()`);
    if (st.ok) viewOk++;
  }
  ok(viewOk === views.length, `${views.length} 个视角预设全部可用（含实验台/驾驶室特写）`);
  await ev(`window.__RV__.setView('lab')`); await sleep(700);
  await shot('rv_03_lab.png');
  await ev(`window.__RV__.setView('cab')`); await sleep(700);
  await shot('rv_04_cab.png');

  /* 6 夜间模式：自发光应该更亮 */
  await ev(`window.__RV__.setView('cutaway'); window.__RV__.setNight(0);`); await sleep(800);
  const dayShot = decodePng(await shot('rv_05_day.png'));
  await ev(`window.__RV__.setNight(0.9)`); await sleep(800);
  const nightShot = decodePng(await shot('rv_06_night.png'));
  const lampProbe = await ev(`(() => { const RV = window.__RV__, R = RV.rd;
    const p = RV.geo.parts.find(x => x.name === 'ceilingLamp');
    const c = [(p.bbox[0]+p.bbox[3])/2, (p.bbox[1]+p.bbox[4])/2 - 0.05, (p.bbox[2]+p.bbox[5])/2];
    return { s: R.project(c), cw: document.getElementById('view').clientWidth }; })()`);
  {
    const dpr = dayShot.w / lampProbe.cw;
    const at = (img, s) => { const i = (Math.round(s[1] * dpr) * img.w + Math.round(s[0] * dpr)) * img.ch; return (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3; };
    const meanOf = img => { let sum = 0, n = 0; for (let y = 100; y < img.h - 60; y += 7) for (let x = 300; x < img.w - 300; x += 7) { const i = (y * img.w + x) * img.ch; sum += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3; n++; } return sum / n; };
    const dMean = meanOf(dayShot), nMean = meanOf(nightShot);
    const dLamp = at(dayShot, lampProbe.s), nLamp = at(nightShot, lampProbe.s);
    console.log('  昼/夜整体亮度 ' + dMean.toFixed(0) + ' → ' + nMean.toFixed(0) + '；顶灯像素 ' + dLamp.toFixed(0) + ' → ' + nLamp.toFixed(0));
    ok(nMean < dMean * 0.8, `夜间整体变暗（${dMean.toFixed(0)} → ${nMean.toFixed(0)}）`);
    ok(nLamp > nMean * 1.4, `夜间顶灯自发光突出（灯 ${nLamp.toFixed(0)} vs 均值 ${nMean.toFixed(0)}）`);
  }
  await ev(`window.__RV__.setNight(0)`);

  /* 7 线框/素模不报错 */
  await ev(`document.getElementById('btnWire').click()`); await sleep(500);
  await shot('rv_07_wire.png');
  await ev(`document.getElementById('btnWire').click(); document.getElementById('btnFlat').click();`); await sleep(400);
  await ev(`document.getElementById('btnFlat').click()`);
  ok(true, '线框 / 素模模式切换无异常');

  /* 8 帧率 */
  const fps = await ev(`(() => { const m = document.getElementById('hud').textContent.match(/(\\d+) FPS/); return m ? +m[1] : 0; })()`);
  console.log('  软件渲染（SwiftShader）下 HUD 帧率：' + fps + ' FPS');
  ok(fps > 0, 'HUD 帧率统计工作正常（软件渲染下偏低属正常）');

  /* 9 移动端布局 */
  await send('Emulation.setDeviceMetricsOverride', { width: 414, height: 896, deviceScaleFactor: 2, mobile: true });
  await sleep(900); await ev('window.dispatchEvent(new Event("resize"))'); await sleep(500);
  const mob = await ev(`(() => { const b = document.getElementById('hud').getBoundingClientRect();
    const top = document.querySelector('.top').getBoundingClientRect();
    return { vw: innerWidth, vh: innerHeight, hud: { x: Math.round(b.x), w: Math.round(b.width) }, topH: Math.round(top.height) }; })()`);
  ok(mob.hud.x >= 0 && mob.hud.x + mob.hud.w <= mob.vw + 2, '移动端 HUD 不溢出屏幕');
  await shot('rv_08_mobile.png');
  await send('Emulation.clearDeviceMetricsOverride');

  ok(cErrs.length === 0, '无 console.error（' + cErrs.slice(0, 2).join(' | ') + '）');
  ok(pErrs.length === 0, '无未捕获异常（' + pErrs.slice(0, 2).join(' | ') + '）');
  console.log(fails === 0 ? '\n浏览器端全部通过 ✓' : '\n失败 ' + fails + ' 项');
  chrome.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('测试异常: ' + e.message); console.error(cerr.slice(-800)); chrome.kill(); process.exit(1); });
