/**
 * main.js — 应用主程序
 *
 * 布局：一个 WebGLRenderer，两个 scissor 视口
 *   上半屏 = 传统被动悬架（无魔毯）
 *   下半屏 = 主动悬架（可选算法，默认 LQR + 路面预瞄 = 魔毯）
 * 两个视口共享同一套相机参数（严格同视角），两台车共享同一条路面与同一时刻，
 * 保证对比公平；差异只来自悬架控制。
 */

import * as THREE from 'three';
import { Sim } from './sim.js';
import { COURSES, COURSE_KEYS } from './road.js';
import { ALGOS } from './controllers.js';
import { comfortRating } from './iso2631.js';
import { CarRig, RoadMesh, setupEnvironment, RoadsidePosts, WHEEL_R } from './build3d.js';
import { Chart, SIGNALS, drawKinematicsChart } from './charts.js';

/* ================= 启动 ================= */
const boot = document.getElementById('boot');
const bootMsg = document.getElementById('bootMsg');
const setBoot = (t) => { if (bootMsg) bootMsg.textContent = t; };

let sim, renderer, viewA, viewB, roadMesh, charts = [], ui = {};
/* 诊断模式：URL 带 ?diag=1 时开启，把运行期自检结果写入 <body data-diag>，
   便于无头浏览器（--dump-dom）验证「确实渲染出了画面」，而不仅仅是没报错。 */
const DIAG = /(\?|&)diag=1/.test(location.search);
const errLog = [];
window.addEventListener('error', (e) => {
  errLog.push(`${e.message} @ ${e.filename}:${e.lineno}`);
  document.body.dataset.err = errLog.join(' | ');
});
window.addEventListener('unhandledrejection', (e) => {
  errLog.push('promise: ' + (e.reason && e.reason.message || e.reason));
  document.body.dataset.err = errLog.join(' | ');
});
let camState = { theta: -1.06, phi: 1.20, dist: 8.4, target: new THREE.Vector3(0, 0.55, 0) };
const VIEWS = {
  side: { theta: -Math.PI / 2, phi: 1.40, dist: 7.6, ty: 0.55 },
  iso: { theta: -1.06, phi: 1.20, dist: 8.4, ty: 0.55 },
  front: { theta: -0.02, phi: 1.34, dist: 7.0, ty: 0.55 },
  rear: { theta: Math.PI - 0.02, phi: 1.34, dist: 7.0, ty: 0.55 },
  top: { theta: -Math.PI / 2, phi: 0.24, dist: 8.2, ty: 0.40 },
  frontSusp: { theta: -0.85, phi: 1.30, dist: 3.5, ty: 0.42, tz: 1.45, tx: -0.75 },
  rearSusp: { theta: -2.35, phi: 1.30, dist: 3.5, ty: 0.42, tz: -1.50, tx: -0.75 },
};

async function init() {
  setBoot('正在求解 LQR 最优控制增益（在线求解离散 Riccati 方程）…');
  await frame();

  sim = new Sim({ course: 'pothole', speedKmh: 50 });
  window.__sim = sim;
  setBoot(`LQR 已收敛（${sim.lqrInfo.iters} 次迭代, ${sim.lqrInfo.ms.toFixed(0)} ms）· 正在构建 3D 场景…`);
  await frame();

  /* --- 渲染器 --- */
  const canvas = document.getElementById('gl');
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
    preserveDrawingBuffer: DIAG,
  });
  renderer.setPixelRatio(Math.min(1.85, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setScissorTest(true);

  /* --- 共享路面几何 --- */
  roadMesh = new RoadMesh(sim.road);

  /* --- 两个视口 --- */
  viewA = makeView({
    label: '① 传统被动悬架', sub: '螺旋弹簧 + 液压减振器 · 无魔毯系统',
    bg: 0x22262e, ground: 0x3a4436,
    accent: { body: 0xd8dde4, edge: 0xff8a3d, spring: 0xff8a3d, caliper: 0xff8a3d, marker: 0xff8a3d },
    active: false, unit: sim.A,
  });
  viewB = makeView({
    label: '② 主动悬架（魔毯系统）', sub: 'LQR 最优反馈 + 路面预瞄前馈 · 4×4.8 kN 作动器',
    bg: 0x1b2028, ground: 0x36402f,
    accent: { body: 0xd8dde4, edge: 0x3ddcff, spring: 0x3ddcff, caliper: 0x3ddcff, marker: 0x3ddcff },
    active: true, unit: sim.B,
  });

  setBoot('构建 UI…');
  await frame();
  buildUI();
  applyView('iso');
  onResize();
  window.addEventListener('resize', onResize);
  installCameraControls(canvas);

  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 700);
  if (DIAG) window.__app = { sim, viewA, viewB, ui, camState, renderer, THREE };
  requestAnimationFrame(loop);
}

function frame() { return new Promise(r => requestAnimationFrame(() => r())); }

function makeView(cfg) {
  const scene = new THREE.Scene();
  const env = setupEnvironment(scene, { bg: cfg.bg, ground: cfg.ground });
  roadMesh.addTo(scene);
  const posts = new RoadsidePosts(scene);
  const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 260);
  const rig = new CarRig(scene, sim.p, cfg.accent, { active: cfg.active });
  return { scene, camera, rig, posts, env, cfg, unit: cfg.unit };
}

/* ================= 相机 ================= */
function applyView(name) {
  const v = VIEWS[name];
  if (!v) return;
  camState.theta = v.theta; camState.phi = v.phi; camState.dist = v.dist;
  camState.target.set(v.tx || 0, v.ty ?? 0.55, v.tz || 0);
  ui.viewName = name;
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
}

function updateCameras() {
  const { theta, phi, dist, target } = camState;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const px = target.x + dist * sp * Math.cos(theta);
  const py = target.y + dist * cp;
  const pz = target.z + dist * sp * Math.sin(theta);
  for (const v of [viewA, viewB]) {
    v.camera.position.set(px, py, pz);
    v.camera.lookAt(target);
  }
}

function installCameraControls(canvas) {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, b: e.button, sx: camState.theta, sy: camState.phi, tx: camState.target.x, ty: camState.target.y };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.b === 0) {
      camState.theta = drag.sx + dx * 0.006;
      camState.phi = Math.max(0.10, Math.min(1.56, drag.sy + dy * 0.005));
    } else {
      camState.target.x = drag.tx - dx * 0.004 * camState.dist;
      camState.target.y = Math.max(0, drag.ty + dy * 0.004 * camState.dist);
    }
    document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('on'));
  });
  const end = (e) => { drag = null; try { canvas.releasePointerCapture(e.pointerId); } catch { } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camState.dist = Math.max(1.6, Math.min(30, camState.dist * (1 + Math.sign(e.deltaY) * 0.09)));
  }, { passive: false });
}

/* ================= UI ================= */
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function buildUI() {
  /* ---------- 左侧控制面板 ---------- */
  const L = document.getElementById('left');

  // 路面
  const gRoad = group(L, '路面工况');
  const courseSel = el('select', 'sel');
  for (const k of COURSE_KEYS) courseSel.appendChild(el('option', null, COURSES[k].name)).value = k;
  courseSel.value = 'pothole';
  courseSel.onchange = () => { sim.setCourse(courseSel.value); roadDesc.textContent = COURSES[courseSel.value].desc; };
  gRoad.appendChild(row('路面', courseSel));
  const roadDesc = el('div', 'hint', COURSES.pothole.desc);
  gRoad.appendChild(roadDesc);

  ui.speed = slider(gRoad, '车速', 15, 100, 1, 50, 'km/h', (v) => sim.setSpeedKmh(v));

  const btns = el('div', 'btnrow');
  const bPause = el('button', 'btn', '⏸ 暂停');
  bPause.onclick = () => {
    sim.running = !sim.running;
    bPause.innerHTML = sim.running ? '⏸ 暂停' : '▶ 继续';
    bPause.classList.toggle('on', !sim.running);
  };
  const bReset = el('button', 'btn', '↺ 重置统计');
  bReset.onclick = () => sim.reset();
  btns.append(bPause, bReset);
  gRoad.appendChild(btns);

  // 控制算法
  const gCtl = group(L, '下方车辆：主动悬架控制算法');
  const algoSel = el('select', 'sel');
  for (const k of Object.keys(ALGOS)) algoSel.appendChild(el('option', null, ALGOS[k].label)).value = k;
  algoSel.value = 'lqrpv';
  algoSel.onchange = () => { sim.B.ctrl.setAlgo(algoSel.value); sim.reset(); updateAlgoHint(); };
  gCtl.appendChild(row('算法', algoSel));
  const algoHint = el('div', 'hint');
  gCtl.appendChild(algoHint);
  ui.algoSel = algoSel;
  const ALGO_HINT = {
    off: '作动器出力恒为 0，与上方完全一致 —— 用于验证两条曲线重合（对照组自检）。',
    skyhook: '经典「天棚阻尼」：把车身想象成挂在天上的阻尼器。仅用车身速度反馈，无预瞄，对冲击工况效果有限。',
    modal: '把 4 个作动器解耦为 浮沉 / 侧倾 / 俯仰 三个模态分别 PD 控制，姿态控制好但对垂向冲击一般。',
    lqr: '整车 14 状态线性二次型最优反馈，在线求解离散 Riccati 方程得到 4×14 增益矩阵。',
    lqrpv: '★ 魔毯：LQR 最优反馈 + 前视扫描预瞄前馈。遇坑主动伸长把车轮"送"进坑里，遇包主动回缩让车轮抬起，车身几乎不动。',
  };
  const updateAlgoHint = () => { algoHint.textContent = ALGO_HINT[algoSel.value]; };
  updateAlgoHint();

  ui.actF = slider(gCtl, '作动器出力上限', 800, 8000, 100, sim.p.actMaxF, 'N', (v) => { sim.p.actMaxF = v; });
  ui.ffGain = slider(gCtl, '预瞄前馈权重', 0, 1.4, 0.05, sim.B.ctrl.gains.ffGain, '', (v) => { sim.B.ctrl.gains.ffGain = v; });

  // 显示
  const gView = group(L, '显示 / 剖视');
  ui.opacity = slider(gView, '车壳透明度', 0, 100, 1, 28, '%', (v) => {
    viewA.rig.setShellOpacity(v / 100);
    viewB.rig.setShellOpacity(v / 100);
  });
  const vrow = el('div', 'btnrow wrap');
  for (const [k, t] of [['iso', '等轴'], ['side', '侧视'], ['front', '前视'], ['rear', '后视'], ['top', '俯视'], ['frontSusp', '前悬特写'], ['rearSusp', '后悬特写']]) {
    const b = el('button', 'btn sm', t);
    b.dataset.view = k;
    b.onclick = () => applyView(k);
    vrow.appendChild(b);
  }
  gView.appendChild(vrow);
  const flags = { shell: true, wheels: true, chassis: true, keyPoint: true, trail: true, scan: true, arb: true };
  const frow = el('div', 'btnrow wrap');
  for (const [k, t] of [['shell', '车壳'], ['wheels', '车轮'], ['chassis', '底盘件'], ['trail', '振动留痕'], ['scan', '预瞄扫描'], ['arb', '稳定杆'], ['keyPoint', '测点']]) {
    const b = el('button', 'btn sm on', t);
    b.onclick = () => {
      flags[k] = !flags[k];
      b.classList.toggle('on', flags[k]);
      viewA.rig.setVisible(flags); viewB.rig.setVisible(flags);
    };
    frow.appendChild(b);
  }
  gView.appendChild(frow);
  ui.flags = flags;

  // 悬架结构说明
  const gStruct = group(L, '悬架结构（几何真解）');
  gStruct.appendChild(el('div', 'hint',
    '<b>前：双叉臂</b> — 上/下 A 臂 + 转向横拉杆，共 5 个运动约束<br>' +
    '<b>后：五连杆</b> — 5 根定长两力杆约束轮架 6 自由度<br>' +
    '每帧用牛顿-拉夫逊迭代求解 6×6 非线性约束方程组，' +
    '外倾角变化 / 前束变化 / 摆臂摆角 / 减振器行程 全部为几何真解。'));
  const kc = el('canvas', 'kincanvas');
  gStruct.appendChild(kc);
  ui.kinCanvas = kc;
  ui.kinReadout = el('div', 'hint mono');
  gStruct.appendChild(ui.kinReadout);

  /* ---------- 右侧曲线 / 指标 ---------- */
  const R = document.getElementById('right');

  ui.headline = el('div', 'headline');
  R.appendChild(ui.headline);

  const gKey = group(R, '关键点振动曲线对比');
  gKey.appendChild(el('div', 'legend',
    '<span><i class="dot p"></i>被动</span><span><i class="dot a"></i>主动</span>' +
    '<span><i class="dot r"></i>路面输入</span>' +
    '<em>测点：驾驶员座椅（质心前 0.28 m / 左 0.36 m）</em>'));
  const chartHost = el('div', 'charts');
  gKey.appendChild(chartHost);
  const sigPick = el('div', 'btnrow wrap');
  gKey.appendChild(sigPick);

  charts = [
    new Chart(chartHost, 'aSeat'),
    new Chart(chartHost, 'zSeat'),
    new Chart(chartHost, 'awSeat'),
  ];
  ui.extraChart = new Chart(chartHost, 'theta');
  charts.push(ui.extraChart);
  for (const [k, t] of [['theta', '俯仰角'], ['phi', '侧倾角'], ['trav', '悬架行程'], ['load', '轮胎动载'], ['force', '作动器力']]) {
    const b = el('button', 'btn sm' + (k === 'theta' ? ' on' : ''), t);
    b.onclick = () => {
      ui.extraChart.setSignal(k);
      sigPick.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    };
    sigPick.appendChild(b);
  }
  ui.win = slider(gKey, '时间窗', 2, 10, 0.5, 6.5, 's', () => { });

  const gM = group(R, '量化指标（本次测试累计）');
  ui.metrics = el('div', 'metrics');
  gM.appendChild(ui.metrics);
  gM.appendChild(el('div', 'hint',
    '主指标 <b>a<sub>w,rms</sub></b> = ISO 2631-1 Wk 频率加权垂向加速度均方根 —— ' +
    '汽车行业乘坐舒适性标准判据（人体对 4~12.5 Hz 最敏感，>25 Hz 几乎不敏感）。'));

  ui.status = document.getElementById('status');
}

function group(parent, title) {
  const g = el('div', 'group');
  g.appendChild(el('div', 'gtitle', title));
  const b = el('div', 'gbody');
  g.appendChild(b);
  parent.appendChild(g);
  return b;
}
function row(label, ctrl) {
  const r = el('div', 'row');
  r.appendChild(el('label', null, label));
  r.appendChild(ctrl);
  return r;
}
function slider(parent, label, min, max, step, val, unit, onChange) {
  const r = el('div', 'row slider');
  const lab = el('label', null, label);
  const inp = el('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
  const out = el('span', 'val', fmtV(val, step) + (unit ? ' ' + unit : ''));
  inp.oninput = () => {
    const v = parseFloat(inp.value);
    out.textContent = fmtV(v, step) + (unit ? ' ' + unit : '');
    onChange(v);
  };
  r.append(lab, inp, out);
  parent.appendChild(r);
  onChange(val);          // 立即应用初始值，避免「显示值」与「实际状态」不一致
  return { input: inp, out, get value() { return parseFloat(inp.value); } };
}
const fmtV = (v, step) => (step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v)));

/* ================= 指标面板 ================= */
function renderMetrics() {
  const r = sim.report();
  const rows = [
    ['加权加速度 a_w,rms', r.passive.awRms, r.active.awRms, 'm/s²', 3, true],
    ['加权加速度 峰值', r.passive.awPeak, r.active.awPeak, 'm/s²', 2, true],
    ['冲击剂量 VDV', r.passive.awVdv, r.active.awVdv, 'm/s^1.75', 2, true],
    ['未加权加速度 rms', r.passive.aRms, r.active.aRms, 'm/s²', 3, true],
    ['车身垂向位移 rms', r.passive.zRms, r.active.zRms, 'mm', 1, true],
    ['俯仰角 rms', r.passive.thetaRms, r.active.thetaRms, '°', 3, true],
    ['侧倾角 rms', r.passive.phiRms, r.active.phiRms, '°', 3, true],
    ['轮胎动载荷 rms', r.passive.loadRms, r.active.loadRms, '%', 1, true],
    ['轮胎离地时间', r.passive.airPct, r.active.airPct, '%', 2, true],
    ['悬架行程 峰值', r.passive.travPeak, r.active.travPeak, 'mm', 1, false],
    ['作动器平均功率', 0, r.active.avgPowerW, 'W', 0, false],
  ];
  let h = `<div class="mh"><span>指标</span><span>被动</span><span>主动</span><span>改善</span></div>`;
  for (const [name, a, b, u, d, better] of rows) {
    const imp = Math.abs(a) < 1e-12 ? null : ((a - b) / a) * 100;
    const cls = imp == null ? '' : (imp >= 0.5 ? 'good' : imp <= -0.5 ? 'bad' : 'flat');
    h += `<div class="mr"><span>${name}<em>${u}</em></span><span class="p">${a.toFixed(d)}</span>` +
      `<span class="a">${b.toFixed(d)}</span>` +
      `<span class="${cls}">${imp == null ? '—' : (imp >= 0 ? '↓' : '↑') + Math.abs(imp).toFixed(1) + '%'}</span></div>`;
  }
  const cp = r.passive.comfort, ca = r.active.comfort;
  h += `<div class="mr big"><span>ISO 2631 舒适性评级</span><span class="p ${cp.cls}">${cp.txt}</span>` +
    `<span class="a ${ca.cls}">${ca.txt}</span><span class="${ca.idx < cp.idx ? 'good' : 'flat'}">${ca.idx < cp.idx ? '↑' + (cp.idx - ca.idx) + '级' : '—'}</span></div>`;
  ui.metrics.innerHTML = h;

  /* ---- 顶部「优越性」结论卡 ---- */
  const big = (v) => `${v >= 0 ? '↓' : '↑'}${Math.abs(v).toFixed(0)}%`;
  const cls = (v) => (v >= 0.5 ? 'good' : v <= -0.5 ? 'bad' : 'flat');
  const lvl = cp.idx - ca.idx;
  ui.headline.innerHTML =
    `<div class="hl-title">主动悬架相对传统被动悬架的改善<span class="hl-t">累计 ${r.passive.time.toFixed(0)} s</span></div>` +
    `<div class="hl-grid">` +
    `<div class="hl-cell"><b class="${cls(r.improve.awRms)}">${big(r.improve.awRms)}</b><span>加权加速度<br>a<sub>w,rms</sub></span></div>` +
    `<div class="hl-cell"><b class="${cls(r.improve.awPeak)}">${big(r.improve.awPeak)}</b><span>冲击峰值<br>a<sub>w,max</sub></span></div>` +
    `<div class="hl-cell"><b class="${cls(r.improve.thetaRms)}">${big(r.improve.thetaRms)}</b><span>俯仰<br>θ<sub>rms</sub></span></div>` +
    `<div class="hl-cell"><b class="${cls(r.improve.airPct)}">${r.passive.airPct < 0.05 ? '—' : big(r.improve.airPct)}</b><span>轮胎离地<br>时间占比</span></div>` +
    `</div>` +
    `<div class="hl-foot">乘坐舒适性等级：<i class="${cp.cls}">${cp.txt}</i> → <i class="${ca.cls}">${ca.txt}</i>` +
    (lvl > 0 ? ` <b class="good">提升 ${lvl} 级</b>` : '') + `</div>`;
  return r;
}

/* ================= 主循环 ================= */
let last = performance.now(), fps = 60, acc = 0, metricT = 0;

function loop(now) {
  const dtWall = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps += ((1 / Math.max(1e-4, dtWall)) - fps) * 0.06;

  sim.advance(dtWall);
  const simDt = sim.running ? dtWall : 0;   // 暂停时车轮也应停转

  roadMesh.update(sim.s);
  for (const v of [viewA, viewB]) {
    v.rig.update(v.unit, sim.s, sim.speed, simDt, sim.road);
    v.posts.update(sim.s);
  }
  updateCameras();
  render();

  acc += dtWall;
  if (acc > 1 / 22) {
    acc = 0;
    for (const c of charts) c.draw(sim, ui.win.value);
  }
  metricT += dtWall;
  if (metricT > 0.32) { metricT = 0; renderMetrics(); renderStatus(); }
  if (DIAG) { diagT += dtWall; if (diagT > 0.5) { diagT = 0; writeDiag(); } }

  requestAnimationFrame(loop);
}

/* ---------- 无头自检探针 ---------- */
let diagT = 0, diagCanvas = null, artCanvas = null;
function writeDiag() {
  try {
    const gl = renderer.getContext();
    const info = renderer.info.render;
    const W = renderer.domElement.width, H = renderer.domElement.height;
    if (!diagCanvas) { diagCanvas = document.createElement('canvas'); diagCanvas.width = 64; diagCanvas.height = 64; }
    const c2 = diagCanvas.getContext('2d');
    // 上半屏 / 下半屏 分别缩放采样，统计均值与方差 -> 证明确有画面且两半不同
    const stat = (sy, sh) => {
      c2.clearRect(0, 0, 64, 32);
      c2.drawImage(renderer.domElement, 0, sy, W, sh, 0, 0, 64, 32);
      const d = c2.getImageData(0, 0, 64, 32).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      r /= n; g /= n; b /= n;
      let v = 0;
      for (let i = 0; i < d.length; i += 4) v += (d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2;
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b), sd: Math.round(Math.sqrt(v / (n * 3))) };
    };
    const top = stat(0, Math.floor(H / 2));
    const bot = stat(Math.floor(H / 2), H - Math.floor(H / 2));
    // 亮度字符图：在无法查看截图的环境下用于核对画面构图
    const art = (sy, sh) => {
      const AW = 76, AH = 24;
      const cc = artCanvas || (artCanvas = document.createElement('canvas'));
      cc.width = AW; cc.height = AH;
      const g2 = cc.getContext('2d');
      g2.clearRect(0, 0, AW, AH);
      g2.drawImage(renderer.domElement, 0, sy, W, sh, 0, 0, AW, AH);
      const d2 = g2.getImageData(0, 0, AW, AH).data;
      const ramp = ' .:-=+*#%@';
      const rows = [];
      for (let y = 0; y < AH; y++) {
        let line = '';
        for (let x = 0; x < AW; x++) {
          const i = (y * AW + x) * 4;
          const l = (0.299 * d2[i] + 0.587 * d2[i + 1] + 0.114 * d2[i + 2]) / 255;
          line += ramp[Math.max(0, Math.min(9, Math.round(l * 9)))];
        }
        rows.push(line);
      }
      return rows;
    };
    const rep = sim.report();
    const ro = viewB.rig.readout();
    /* 整车在屏幕上的归一化包围盒（NDC，-1..1）—— 精确核对取景构图 */
    const box = new THREE.Box3().setFromObject(viewB.rig.shell.group);
    let nx0 = 9, nx1 = -9, ny0 = 9, ny1 = -9;
    const cv = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      cv.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      cv.project(viewB.camera);
      nx0 = Math.min(nx0, cv.x); nx1 = Math.max(nx1, cv.x);
      ny0 = Math.min(ny0, cv.y); ny1 = Math.max(ny1, cv.y);
    }
    document.body.dataset.art = JSON.stringify({ top: art(0, Math.floor(H / 2)), bot: art(Math.floor(H / 2), H - Math.floor(H / 2)) });
    document.body.dataset.diag = JSON.stringify({
      ok: true,
      boot: !document.getElementById('boot'),
      glVendor: gl.getParameter(gl.VERSION),
      canvas: `${W}x${H}`,
      drawCalls: info.calls, triangles: info.triangles,
      charts: document.querySelectorAll('.chart canvas').length,
      metricRows: document.querySelectorAll('.mr').length,
      t: +sim.t.toFixed(2), s: +sim.s.toFixed(1), fps: Math.round(fps),
      substeps: sim.stats.substeps,
      pixTop: top, pixBot: bot,
      awPassive: +rep.passive.awRms.toFixed(4),
      awActive: +rep.active.awRms.toFixed(4),
      improveAw: +rep.improve.awRms.toFixed(2),
      comfortP: rep.passive.comfort.txt, comfortA: rep.active.comfort.txt,
      actPeakN: Math.round(Math.max(...[0, 1, 2, 3].map(i => Math.abs(sim.B.ctrl.force[i])))),
      camberFL: +ro[0].camber.toFixed(3), camberRL: +ro[2].camber.toFixed(3),
      toeFL: +ro[0].toe.toFixed(4), toeRL: +ro[2].toe.toFixed(4),
      kinErr: Math.max(...ro.map(o => o.err)).toExponential(1),
      trailPts: viewB.rig.trailData.length,
      algo: sim.B.ctrl.algo,
      shellOpacity: viewB.rig.shellOpacity,
      // 取景：车身在屏幕中的位置与占比
      frameCx: +((nx0 + nx1) / 2).toFixed(3), frameCy: +((ny0 + ny1) / 2).toFixed(3),
      frameW: +(nx1 - nx0).toFixed(3), frameH: +(ny1 - ny0).toFixed(3),
      view: ui.viewName || '-',
    });
  } catch (e) {
    document.body.dataset.diag = JSON.stringify({ ok: false, err: e.message });
  }
}

function render() {
  const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
  const half = Math.floor(H / 2);
  // 上：被动
  renderer.setViewport(0, H - half, W, half);
  renderer.setScissor(0, H - half, W, half);
  viewA.camera.aspect = W / half; viewA.camera.updateProjectionMatrix();
  renderer.render(viewA.scene, viewA.camera);
  // 下：主动
  renderer.setViewport(0, 0, W, H - half);
  renderer.setScissor(0, 0, W, H - half);
  viewB.camera.aspect = W / (H - half); viewB.camera.updateProjectionMatrix();
  renderer.render(viewB.scene, viewB.camera);
}

function renderStatus() {
  const f = sim.road.nearestFeature(sim.s + sim.p.lf, 10);
  const ctl = sim.B.ctrl;
  const sat = (ctl.satFrac * 100).toFixed(0);
  let fmax = 0; for (let i = 0; i < 4; i++) fmax = Math.max(fmax, Math.abs(ctl.force[i]));
  const lead = ctl.previewLeadM || 0;
  ui.status.innerHTML =
    `<span><b>${fps.toFixed(0)}</b> FPS</span>` +
    `<span>物理 <b>1 kHz</b> RK4 ×${sim.stats.substeps}/帧</span>` +
    `<span>里程 <b>${sim.s.toFixed(0)}</b> m</span>` +
    `<span>车速 <b>${sim.speedKmh.toFixed(0)}</b> km/h</span>` +
    `<span>作动器峰值 <b>${fmax.toFixed(0)}</b> N ${sat > 0 ? `<i class="warn">饱和${sat}%</i>` : ''}</span>` +
    `<span>预瞄超前 <b>${(lead * 100).toFixed(0)}</b> cm</span>` +
    (f && f.gap < 6 ? `<span class="ev">${f.gap <= 0 ? '▶ 正在通过' : `前方 ${f.gap.toFixed(1)} m`}：<b>${f.f.note}</b></span>` : '');

  // 悬架几何读数
  const ro = viewB.rig.readout();
  const nm = ['左前', '右前', '左后', '右后'];
  ui.kinReadout.innerHTML = ro.map((o, i) =>
    `${nm[i]} 轮跳<b>${o.travel >= 0 ? '+' : ''}${o.travel.toFixed(0)}</b>mm 外倾<b>${o.camber >= 0 ? '+' : ''}${o.camber.toFixed(2)}</b>° 前束<b>${o.toe >= 0 ? '+' : ''}${o.toe.toFixed(3)}</b>°`
  ).join('<br>') + `<br><span class="dim">约束残差 &lt; ${Math.max(...ro.map(o => o.err)).toExponential(0)} m · 迭代 ${Math.max(...ro.map(o => o.iters))} 次</span>`;
}

/* ================= 尺寸 ================= */
function onResize() {
  const host = document.getElementById('stage');
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px';
  renderer.domElement.style.height = h + 'px';
  for (const c of charts) { c.resize(); c.draw(sim, ui.win.value); }
  // 悬架特性曲线（一次性）
  const sF = viewB.rig.corners[0].solver.sweep(-0.085, 0.085, 35);
  const sR = viewB.rig.corners[2].solver.sweep(-0.085, 0.085, 35);
  drawKinematicsChart(ui.kinCanvas, sF, sR);
  // 复位求解器到当前状态
  for (const v of [viewA, viewB]) v.rig.update(v.unit, sim.s, sim.speed, 0, sim.road);
}

init().catch((e) => {
  console.error(e);
  setBoot('初始化失败：' + e.message);
  if (boot) boot.classList.add('err');
});
