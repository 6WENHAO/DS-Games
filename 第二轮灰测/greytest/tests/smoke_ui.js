/* =====================================================================
 * tests/smoke_ui.js —— 界面逻辑无头冒烟测试（node tests/smoke_ui.js）
 * ---------------------------------------------------------------------
 * 目的：不打开浏览器就把 app.js / scope.js / render.js 的运行期错误逼出来。
 * 做法：用最小 DOM + Canvas 打桩加载真实脚本，然后
 *   · 跑若干帧动画循环
 *   · 逐一切换 7 种控制模式
 *   · 逐一切换第四张图（相图 / 极点图 / 能量）
 *   · 逐一载入 10 个实验预设
 *   · 拖动每一个滑块到最小值、最大值、中间值
 *   · 触发键盘、按钮、复选框事件
 * 任何未捕获异常都会被记录为失败。
 * ===================================================================== */
'use strict';
const path = require('path');
const fs = require('fs');

let fails = [];
function fail(where, e) { fails.push(`${where}: ${e && e.message ? e.message : e}`); }

/* ---------------- 最小 DOM 打桩 ---------------- */
const ALL = [];
function makeCtx() {
  const noop = () => {};
  const ctx = {
    setTransform: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    arc: noop, quadraticCurveTo: noop, closePath: noop, save: noop, restore: noop,
    rect: noop, clip: noop, setLineDash: noop, fillText: noop, strokeText: noop,
    translate: noop, rotate: noop, scale: noop,
    measureText: () => ({ width: 30 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop })
  };
  return ctx;
}
function makeEl(tag, id) {
  const e = {
    tagName: (tag || 'div').toUpperCase(), id: id || '', className: '', textContent: '',
    innerHTML: '', children: [], parent: null, dataset: {}, style: {},
    _handlers: {}, value: '', checked: false, type: '', min: 0, max: 0, step: 0,
    width: 600, height: 300,
    appendChild(c) { c.parent = e; e.children.push(c); return c; },
    addEventListener(t, f) { (e._handlers[t] = e._handlers[t] || []).push(f); },
    removeEventListener() {},
    getContext() { return (e._ctx = e._ctx || makeCtx()); },
    getBoundingClientRect() { return { width: 600, height: 300, top: 0, left: 0 }; },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); }
    },
    dispatch(t, ev) { for (const f of (e._handlers[t] || [])) f(Object.assign({ target: e, preventDefault() {} }, ev || {})); },
    querySelectorAll(sel) { return queryIn(e, sel); }
  };
  ALL.push(e);
  return e;
}
function descendants(root, out) {
  out = out || [];
  for (const c of root.children) { out.push(c); descendants(c, out); }
  return out;
}
function queryIn(root, sel) {
  sel = sel.trim();
  const parts = sel.split(/\s+/);
  let scope = root ? descendants(root) : ALL;
  if (parts.length === 2 && parts[0][0] === '#') {
    const host = ALL.find((x) => x.id === parts[0].slice(1));
    if (!host) return [];
    scope = descendants(host);
    return scope.filter((x) => x.tagName === parts[1].toUpperCase());
  }
  const p = parts[parts.length - 1];
  if (p[0] === '.') return scope.filter((x) => x.classList.contains(p.slice(1)) || (x.className || '').split(/\s+/).includes(p.slice(1)));
  if (p[0] === '#') return scope.filter((x) => x.id === p.slice(1));
  return scope.filter((x) => x.tagName === p.toUpperCase());
}
const byId = {};
const requestedIds = new Set();
const document = {
  readyState: 'complete',
  _handlers: {},
  getElementById(id) { requestedIds.add(id); return (byId[id] = byId[id] || makeEl('div', id)); },
  createElement(tag) { return makeEl(tag); },
  addEventListener(t, f) { (document._handlers[t] = document._handlers[t] || []).push(f); },
  querySelectorAll(sel) { return queryIn(null, sel); },
  dispatch(t, ev) { for (const f of (document._handlers[t] || [])) f(Object.assign({ preventDefault() {} }, ev || {})); }
};
globalThis.document = document;
globalThis.devicePixelRatio = 2;
let rafCb = null, rafCount = 0;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; rafCount++; return rafCount; };
globalThis.window = globalThis;

/* ---------------- 解析真实 index.html ----------------
 * 这一步很关键：DOM 打桩会按需自动创建元素，从而**掩盖** index.html 里少写一个 id 的错误
 *（页面上表现为"某个面板永远空白"，而冒烟测试却全绿）。
 * 所以必须用真实 HTML 里的 id 集合，校验 app.js 请求过的每一个 id。
 * 脚本加载顺序也直接取自 index.html，避免测试与页面脱节。
 */
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const htmlIds = new Set(Array.from(HTML.matchAll(/id="([^"]+)"/g)).map((m) => m[1]));
const SRC = Array.from(HTML.matchAll(/<script src="src\/([^"]+)"><\/script>/g)).map((m) => m[1]);
if (SRC.length === 0) fail('index.html', new Error('未解析到任何 <script src="src/...">'));
console.log(`  index.html: ${htmlIds.size} 个 id，${SRC.length} 个脚本 (${SRC.join(', ')})`);

/* ---------------- 载入真实脚本 ---------------- */
for (const f of SRC) {
  const p = path.join(__dirname, '..', 'src', f);
  try {
    // 用 Function 包一层，模拟浏览器里的顶层脚本（this === window）
    const code = fs.readFileSync(p, 'utf8');
    new Function(code).call(globalThis);
  } catch (e) { fail('加载 ' + f, e); }
}

const APP = globalThis.__DSH_PENDULUM__;
if (!APP) { console.log('[FAIL] app.js 初始化未完成（__DSH_PENDULUM__ 未挂载）'); process.exit(1); }
const S = APP.S;

/* ---------------- 驱动动画帧 ---------------- */
let simTime = 0;
function frames(n, dtMs) {
  for (let i = 0; i < n; i++) {
    simTime += (dtMs === undefined ? 16.7 : dtMs);
    try { rafCb(simTime); } catch (e) { fail('动画帧', e); return; }
  }
}

console.log('=== 冒烟测试 ===');
frames(30);
console.log(`  初始 30 帧后：t=${S.t.toFixed(3)} s, 模式=${S.mode}, lane 数=${S.sims.length}`);
if (!(S.t > 0.1)) fail('主循环', new Error('仿真时间没有推进'));

/* 0. 数值回归：界面里算出的 K 必须与 selftest.js / Python 参考实现一致 */
{
  const K = Array.from(APP.S.design_.lqr.K[0]);
  // 全精度基准（与 Python 参考实现 + scipy 三方核对过）
  const want = [-20.0000000000, -29.5259377571, -216.7705431105, -23.6446060662];
  const err = Math.max(...K.map((v, i) => Math.abs(v - want[i])));
  console.log(`  默认参数下 K = [${K.map((v) => v.toFixed(4)).join(', ')}]，与基准最大偏差 ${err.toExponential(2)}`);
  if (!(err < 1e-8)) fail('K 值回归', new Error('与基准不一致'));
  const res = APP.S.design_.lqr.residual;
  if (!(res < 1e-8)) fail('ARE 残差', new Error('残差过大: ' + res));
}

/* 1. 切换全部模式 */
for (const m of ['none', 'pid', 'cascade', 'lqr', 'lqi', 'swingup', 'compare']) {
  const btn = queryIn(byId['modeTabs'], 'button').find((b) => b.dataset.mode === m);
  if (!btn) { fail('模式按钮 ' + m, new Error('未找到')); continue; }
  try { btn.dispatch('click'); } catch (e) { fail('切换模式 ' + m, e); continue; }
  frames(40);
  const th = S.sims.map((s) => s.s[2]);
  if (th.some((v) => !isFinite(v))) fail('模式 ' + m, new Error('状态出现 NaN/Inf'));
  console.log(`  模式 ${m.padEnd(8)} 40 帧 OK  lane=${S.sims.length}  θ=[${th.map((v) => v.toFixed(4)).join(', ')}]  t=${S.t.toFixed(2)}s`);
}

/* 2. 第四张图三种视图 */
for (const k of ['phase', 'poles', 'energy']) {
  const btn = queryIn(byId['plot4Tabs'], 'button').find((b) => b.dataset.plot === k);
  try { btn.dispatch('click'); frames(10); console.log(`  第四图 ${k} OK`); } catch (e) { fail('第四图 ' + k, e); }
}

/* 3. 面板切换 */
for (const p of ['ctrl', 'model', 'dist', 'analysis', 'theory', 'lab']) {
  const btn = queryIn(byId['panelTabs'], 'button').find((b) => b.dataset.panel === p);
  try { btn.dispatch('click'); frames(3); } catch (e) { fail('面板 ' + p, e); }
}
console.log('  6 个面板切换 OK');

/* 4. 载入 10 个实验预设 */
{
  const labBtns = queryIn(byId['panel-lab'], 'button');
  console.log(`  发现 ${labBtns.length} 个实验预设按钮`);
  if (labBtns.length < 10) fail('实验面板', new Error('实验数量少于 10'));
  labBtns.forEach((b, i) => {
    try {
      b.dispatch('click');
      frames(60);
      const bad = S.sims.some((s) => s.s.some((v) => !isFinite(v)));
      if (bad) throw new Error('状态出现 NaN');
      console.log(`    实验 ${i + 1}: 模式=${S.mode.padEnd(8)} t=${S.t.toFixed(2)}s θ=${S.sims[0].s[2].toFixed(4)} u=${S.sims[0].u.toFixed(2)}N`);
    } catch (e) { fail('实验 ' + (i + 1), e); }
  });
}

/* 5. 拖动每个滑块到 0 / 500 / 1000 */
{
  let count = 0;
  for (const pid of ['panel-ctrl', 'panel-model', 'panel-dist']) {
    const host = byId[pid];
    const inputs = descendants(host).filter((x) => x.tagName === 'INPUT' && x.type === 'range');
    for (const inp of inputs) {
      const orig = inp.value;
      for (const v of ['0', '1000', '500']) {
        inp.value = v;
        try { inp.dispatch('input'); frames(4); } catch (e) { fail('滑块 ' + pid, e); }
        if (S.sims.some((s) => s.s.some((x) => !isFinite(x)))) { fail('滑块 ' + pid, new Error('滑到极值后状态 NaN')); break; }
      }
      inp.value = orig; try { inp.dispatch('input'); } catch (e) { fail('滑块复位', e); }
      count++;
    }
    // 复选框
    for (const inp of descendants(host).filter((x) => x.tagName === 'INPUT' && x.type === 'checkbox')) {
      inp.checked = !inp.checked;
      try { inp.dispatch('change'); frames(4); } catch (e) { fail('复选框', e); }
    }
  }
  console.log(`  ${count} 个滑块 × 3 个极值位置全部无异常`);
}

/* 6. 预设按钮（物理预设 / 权重预设） */
{
  const btns = descendants(byId['panel-model']).concat(descendants(byId['panel-ctrl'])).filter((x) => x.tagName === 'BUTTON');
  let n = 0;
  for (const b of btns) {
    try { b.dispatch('click'); frames(5); n++; } catch (e) { fail('预设按钮 ' + b.textContent, e); }
  }
  console.log(`  ${n} 个按钮点击无异常`);
}

/* 7. 顶栏按钮与键盘 */
for (const id of ['btnPlay', 'btnStep', 'btnReset', 'btnKick']) {
  try { byId[id].dispatch('click'); frames(5); } catch (e) { fail(id, e); }
}
try { byId['btnPlay'].dispatch('click'); } catch (e) { fail('恢复运行', e); }
for (const key of [{ code: 'Space' }, { key: 'r' }, { key: 'k' }, { key: 'ArrowLeft' }, { key: 'ArrowRight' }]) {
  try { document.dispatch('keydown', key); frames(3); document.dispatch('keyup', key); } catch (e) { fail('键盘 ' + JSON.stringify(key), e); }
}
console.log('  顶栏按钮与键盘事件 OK');

/* 8. 极端参数压力测试：短摆 + 大采样周期 + 强噪声 + 模型误差 */
{
  try {
    S.design.L = 0.2; S.design.uMax = 3; S.Ts = 0.08; S.delaySteps = 4;
    S.sensor.sigTheta = 0.02; S.sensor.quantTheta = 0.01;
    S.mismatch = { m: 2.5, L: 1.8, M: 0.5 };
    S.dist.wind = 3; S.ref.mode = 'square';
    APP.redesign();
    frames(300);
    const ok = S.sims.every((s) => s.s.every((v) => isFinite(v)));
    console.log(`  极端参数 300 帧：${ok ? '数值未爆（θ=' + S.sims[0].s[2].toFixed(3) + ', failed=' + S.sims[0].failed + '）' : '出现 NaN'}`);
    if (!ok) fail('极端参数', new Error('数值爆炸'));
  } catch (e) { fail('极端参数', e); }
}

console.log('');
/* 9. 最重要的一条：app.js 请求过的每个 id 都必须真的存在于 index.html 里 */
{
  const missing = Array.from(requestedIds).filter((id) => !htmlIds.has(id)).sort();
  console.log(`  app.js 共请求 ${requestedIds.size} 个 DOM id，index.html 提供 ${htmlIds.size} 个`);
  if (missing.length) {
    fail('index.html 缺少 id', new Error(missing.join(', ')));
  } else {
    console.log('  ✓ 全部 id 都存在于真实 HTML 中（不存在"面板永远空白"的隐藏故障）');
  }
  // 反向检查：HTML 里定义了但 app.js 从未使用的 id（仅提示，不算失败）
  const unused = Array.from(htmlIds).filter((id) => !requestedIds.has(id) && !/^panel-/.test(id)).sort();
  if (unused.length) console.log(`  提示：HTML 中未被 getElementById 使用的 id（可能由 CSS/querySelector 使用）：${unused.join(', ')}`);
}

console.log('');
if (fails.length === 0) {
  console.log('===== 冒烟测试全部通过 =====');
} else {
  console.log(`===== 发现 ${fails.length} 个问题 =====`);
  fails.forEach((f) => console.log('  [FAIL] ' + f));
  process.exitCode = 1;
}
