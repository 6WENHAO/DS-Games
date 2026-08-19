/**
 * main.js —— 场景装配、工况驱动、交互（悬浮信息卡/剖切/拆解/视角）、HUD
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { P, CYL_X, STROKES, VALVE_EVENTS } from './core/params.js';
import * as K from './core/kinematics.js';
import { createMaterials } from './core/materials.js';
import { World, LAYERS } from './core/registry.js';

const $ = (s) => document.querySelector(s);
const loadBar = $('#loadBar'), loadTxt = $('#loadTxt');
const setLoad = (p, t) => { loadBar.style.width = p + '%'; if (t) loadTxt.textContent = t; };
const errors = [];
function reportError(where, e) {
  errors.push(`[${where}] ${e && e.message ? e.message : e}`);
  const box = $('#err');
  box.style.display = 'block';
  box.textContent = '模块加载/构建异常（其余功能仍可使用）：\n' + errors.join('\n');
  console.error(where, e);
}

// ==================================================== 渲染器 / 场景
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d12);
scene.fog = new THREE.Fog(0x0a0d12, 2600, 6200);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 5, 14000);
camera.position.set(1080, 640, 1180);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 175, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 240;
controls.maxDistance = 4600;
controls.maxPolarAngle = Math.PI * 0.52;
controls.update();

// 环境光照（RoomEnvironment 生成 PBR 反射环境，无需外部 HDR）
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.62;
}
const hemi = new THREE.HemisphereLight(0x93b8ff, 0x191d24, 0.42);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.25);
key.position.set(900, 1400, 780);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 200; key.shadow.camera.far = 3600;
key.shadow.camera.left = -900; key.shadow.camera.right = 900;
key.shadow.camera.top = 900; key.shadow.camera.bottom = -900;
key.shadow.bias = -0.0007;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9dc6ff, 0.55);
fill.position.set(-820, 420, -960);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffd7a8, 0.4);
rim.position.set(-200, 260, 1200);
scene.add(rim);

// 地面 + 网格
{
  const g = new THREE.Mesh(new THREE.CircleGeometry(2600, 64),
    new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.95, metalness: 0.0 }));
  g.rotation.x = -Math.PI / 2;
  g.position.y = -266;
  g.receiveShadow = true;
  scene.add(g);
  const grid = new THREE.GridHelper(4000, 40, 0x22303f, 0x161d27);
  grid.position.y = -265;
  scene.add(grid);
}

// ==================================================== 建模
setLoad(8, '创建材质库');
const mats = createMaterials();
const world = new World(scene, mats, P, K);
let flowsApi = null;

const MODULES = [
  ['block', '气缸体 / 缸套 / 主轴承 / 油底壳 / 飞轮壳'],
  ['crankshaft', '曲轴 / 平衡重 / 飞轮 / 减振器'],
  ['piston', '活塞组 / 活塞环 / 连杆'],
  ['head', '气缸盖 / 气道 / 气门座 / 罩盖'],
  ['valvetrain', '凸轮轴 / 挺柱 / 推杆 / 摇臂 / 气门'],
  ['timing', '正时齿轮室'],
  ['fuel', '燃油系统'],
  ['lube', '润滑系统'],
  ['cooling', '冷却系统'],
  ['air', '进排气与增压系统'],
  ['flows', '流动可视化'],
];
for (let i = 0; i < MODULES.length; i++) {
  const [name, label] = MODULES[i];
  setLoad(10 + (i / MODULES.length) * 74, '构建：' + label);
  await new Promise((r) => setTimeout(r, 0));
  try {
    const mod = await import(`./parts/${name}.js`);
    const ret = mod.build(world);
    if (name === 'flows') flowsApi = ret;
  } catch (e) { reportError(name + '.js', e); }
}

// 收集各系统克隆出来的材质，使其一并参与 透视/剖切/流道显隐
const clonedMats = mats.collectFromScene(scene);
console.info('[materials] 库材质', mats.$all.length - clonedMats, '+ 模块克隆材质', clonedMats);

// 零件资料
setLoad(88, '装载零件资料库');
const INFO_FILES = ['core', 'block', 'crank', 'piston', 'head', 'valvetrain', 'timing',
  'fuel', 'lube', 'cooling', 'air', 'seals'];
const info = {};
for (const n of INFO_FILES) {
  try {
    const m = await import(`./data/info.${n}.js`);
    Object.assign(info, m.info || m.default || {});
  } catch (e) { /* 该资料文件可选 */ }
}
world.attachInfo(info);
console.info('[parts]', world.parts.size, '个零件已注册；缺少资料条目:', world.missingInfo);

// ==================================================== 工况与状态
const op = new K.OperatingModel();
const st = {
  crankAngle: 0, crankTotal: 0, rpm: 1400, load: 0.45, dt: 0, running: true,
  op, cyl: [], pistonSpeed1: 0, fps: 60,
};
const ui = { speed: 0.12, manual: false, mode: 'solid', explode: 0, secAxis: 'z', secPos: 0 };
// 悬浮拾取相关状态（提前声明：applyMode() 会调用 clearHighlight）
let hoverId = null, pinnedId = null, hiMesh = null, hiOrig = null, pointerMoved = false;
const hiCache = new Map();

function computeState(dt) {
  st.dt = dt;
  op.rpm = st.rpm; op.load = st.load;
  op.step(dt);
  st.cyl = CYL_X.map((x, i) => {
    const n = i + 1;
    const cycle = K.cycleAngle(st.crankAngle, n);
    const pinY = K.pinCenterY(st.crankAngle, n);
    const speed = K.pistonSpeed(st.crankAngle, st.rpm, n);
    const iL = K.valveLift(cycle, 'intake');
    const eL = K.valveLift(cycle, 'exhaust');
    const iL2 = K.valveLift((cycle + 2) % 720, 'intake');
    const eL2 = K.valveLift((cycle + 2) % 720, 'exhaust');
    return {
      n, x, cycle, stroke: K.strokeOf(cycle),
      pinY, pistonY: pinY + P.piston.compHeight, speed,
      swing: K.rodSwing(st.crankAngle, n),
      intakeLift: iL, exhaustLift: eL,
      camLiftIn: iL / P.valvetrain.rockerRatio, camLiftEx: eL / P.valvetrain.rockerRatio,
      intakeOpening: iL2 > iL, exhaustOpening: eL2 > eL,
      pressure: K.cylinderPressure(cycle, st.rpm, st.load, op.boost),
    };
  });
  st.pistonSpeed1 = st.cyl[0].speed;
}
computeState(0.016);

// ==================================================== HUD
// —— 分层开关
{
  const box = $('#layers');
  for (const l of LAYERS) {
    const id = 'lay_' + l.key;
    const row = document.createElement('label');
    row.className = 'chk';
    row.innerHTML = `<input type="checkbox" id="${id}" checked><span>${l.cn}</span>`;
    box.appendChild(row);
    row.querySelector('input').addEventListener('change', (e) => {
      world.setLayerVisible(l.key, e.target.checked);
    });
  }
}
// —— 流动开关
const FLOWS = [
  ['oil', '润滑油（压力油路）', '#ffb02e'],
  ['oilReturn', '润滑油（回油）', '#a86a12'],
  ['coolant', '冷却液（大循环）', '#35b6ff'],
  ['bypass', '冷却液（小循环）', '#7fe0ff'],
  ['intake', '进气 / 增压空气', '#7fe8ff'],
  ['exhaust', '废气', '#ff7a3c'],
];
{
  const box = $('#flowToggles');
  for (const [k, label, color] of FLOWS) {
    const row = document.createElement('label');
    row.className = 'chk';
    row.innerHTML = `<input type="checkbox" checked><i class="sw" style="background:${color}"></i><span>${label}</span>`;
    box.appendChild(row);
    row.querySelector('input').addEventListener('change', (e) => flowsApi && flowsApi.setVisible(k, e.target.checked));
  }
  const r1 = document.createElement('label');
  r1.className = 'chk';
  r1.innerHTML = `<input type="checkbox" checked><span>显示流线（半透明管道）</span>`;
  box.appendChild(r1);
  r1.querySelector('input').addEventListener('change', (e) => flowsApi && flowsApi.setTubesVisible(e.target.checked));
  const r2 = document.createElement('label');
  r2.className = 'chk';
  r2.innerHTML = `<input type="checkbox" checked><span>显示流动粒子</span>`;
  box.appendChild(r2);
  r2.querySelector('input').addEventListener('change', (e) => flowsApi && flowsApi.setParticlesVisible(e.target.checked));
}
// —— 面板折叠
document.querySelectorAll('.panel h3').forEach((h) => {
  h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
});

// —— 滑块
const bind = (sel, out, fn, fmt) => {
  const el = $(sel), o = $(out);
  const upd = () => { const v = parseFloat(el.value); o.textContent = fmt ? fmt(v) : v; fn(v); };
  el.addEventListener('input', upd);
  upd();
  return el;
};
bind('#sRpm', '#oRpm', (v) => { st.rpm = v; }, (v) => v.toFixed(0));
bind('#sLoad', '#oLoad', (v) => { st.load = v / 100; }, (v) => v.toFixed(0) + '%');
bind('#sSpeed', '#oSpeed', (v) => { ui.speed = v; }, (v) => v.toFixed(2) + '×');
const sAngle = bind('#sAngle', '#oAngle', (v) => {
  if (!st.running) { st.crankAngle = v; ui.manual = true; }
}, (v) => v.toFixed(0) + '°');
bind('#sExp', '#oExp', (v) => { ui.explode = v / 100; world.setExplode(v / 100); }, (v) => v.toFixed(0) + '%');
bind('#sFluid', '#oFluid', (v) => mats.setFluidOpacity(v / 100), (v) => v.toFixed(0) + '%');

// —— 渲染画质（保证动画帧率 ≥60fps）
const QUALITY = {
  high: { dpr: Math.min(window.devicePixelRatio || 1, 1.75), shadow: true, shadowSize: 2048 },
  mid: { dpr: 1.0, shadow: true, shadowSize: 1024 },
  low: { dpr: 0.85, shadow: false, shadowSize: 512 },
};
let quality = 'high', autoDropped = false;
function setQuality(q, auto = false) {
  quality = q;
  const cfg = QUALITY[q];
  renderer.setPixelRatio(cfg.dpr);
  renderer.shadowMap.enabled = cfg.shadow;
  if (cfg.shadow && key.shadow.mapSize.width !== cfg.shadowSize) {
    key.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  }
  renderer.setSize(innerWidth, innerHeight);
  for (const b of ['#qHigh', '#qMid', '#qLow']) $(b).classList.remove('on');
  $({ high: '#qHigh', mid: '#qMid', low: '#qLow' }[q]).classList.add('on');
  if (auto) $('#qTip').textContent = `帧率偏低，已自动切换到「${q === 'mid' ? '中' : '低'}」画质（可手动改回）。`;
}
$('#qHigh').onclick = () => { autoDropped = true; setQuality('high'); };
$('#qMid').onclick = () => { autoDropped = true; setQuality('mid'); };
$('#qLow').onclick = () => { autoDropped = true; setQuality('low'); };

// —— 剖切
const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
function applyMode() {
  const axis = ui.secAxis;
  clipPlane.normal.set(axis === 'x' ? -1 : 0, axis === 'y' ? -1 : 0, axis === 'z' ? -1 : 0);
  clipPlane.constant = ui.secPos * (axis === 'y' ? 1 : 1);
  mats.setMode(ui.mode, [clipPlane]);
  for (const b of ['#mSolid', '#mGhost', '#mSection']) $(b).classList.remove('on');
  $({ solid: '#mSolid', ghost: '#mGhost', section: '#mSection' }[ui.mode]).classList.add('on');
  clearHighlight();
}
$('#mSolid').onclick = () => { ui.mode = 'solid'; applyMode(); };
$('#mGhost').onclick = () => { ui.mode = 'ghost'; applyMode(); };
$('#mSection').onclick = () => { ui.mode = 'section'; applyMode(); };
$('#secAxis').onchange = (e) => {
  ui.secAxis = e.target.value;
  const s = $('#sSec');
  s.min = ui.secAxis === 'y' ? -200 : -350;
  s.max = ui.secAxis === 'y' ? 500 : 350;
  applyMode();
};
bind('#sSec', '#oSec', (v) => { ui.secPos = v; if (ui.mode === 'section') applyMode(); }, (v) => v.toFixed(0));
applyMode();

// —— 运行控制
const bRun = $('#bRun');
bRun.onclick = () => {
  st.running = !st.running;
  bRun.textContent = st.running ? '⏸ 暂停' : '▶ 运行';
  bRun.classList.toggle('primary', st.running);
};
$('#bStep').onclick = () => { st.crankAngle = (st.crankAngle + 15) % 720; sAngle.value = st.crankAngle; $('#oAngle').textContent = st.crankAngle.toFixed(0) + '°'; };
$('#bReset').onclick = () => {
  st.crankAngle = 0; st.crankTotal = 0; op.coolantTemp = 22; op.oilTemp = 22; op.boost = 0;
  sAngle.value = 0; $('#oAngle').textContent = '0°';
};

// —— 视角预设
const VIEWS = {
  free: { pos: [1080, 640, 1180], tgt: [0, 175, 0] },
  side: { pos: [40, 300, 1520], tgt: [0, 190, 0] },
  top: { pos: [30, 1700, 60], tgt: [0, 120, 0] },
  front: { pos: [-1560, 300, 120], tgt: [-120, 180, 0] },
  section: { pos: [520, 420, 980], tgt: [-40, 200, -20], mode: 'section' },
  valve: { pos: [-360, 620, 520], tgt: [-140, 400, -40], mode: 'section' },
  crank: { pos: [420, 120, 760], tgt: [0, 60, 0], mode: 'ghost' },
  turbo: { pos: [900, 520, 700], tgt: [320, 300, 200] },
};
let tween = null;
document.querySelectorAll('[data-view]').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('[data-view]').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    const v = VIEWS[b.dataset.view];
    if (v.mode && ui.mode !== v.mode) { ui.mode = v.mode; applyMode(); }
    tween = {
      t: 0, from: camera.position.clone(), to: new THREE.Vector3(...v.pos),
      fromT: controls.target.clone(), toT: new THREE.Vector3(...v.tgt),
    };
  };
});

// ==================================================== 悬浮信息卡
const card = $('#card');
const ray = new THREE.Raycaster();
ray.params.Points.threshold = 7;
const pointer = new THREE.Vector2(-10, -10);
let hoverEntry = null;

function highlightMat(m) {
  if (hiCache.has(m)) return hiCache.get(m);
  const c = m.clone();
  c.emissive = new THREE.Color(0x2f7fff);
  c.emissiveIntensity = 0.55;
  c.name = m.name;
  c.userData = { ...m.userData };
  hiCache.set(m, c);
  return c;
}
function clearHighlight() {
  if (hiMesh && hiOrig) hiMesh.material = hiOrig;
  hiMesh = null; hiOrig = null;
}
function setHighlight(mesh) {
  if (hiMesh === mesh) return;
  clearHighlight();
  if (!mesh) return;
  hiMesh = mesh; hiOrig = mesh.material;
  mesh.material = highlightMat(mesh.material);
}
function visibleChain(o) {
  let p = o;
  while (p) { if (!p.visible) return false; p = p.parent; }
  return true;
}
renderer.domElement.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerMoved = true;
  card.style.left = Math.min(innerWidth - 360, e.clientX + 18) + 'px';
  card.style.top = Math.min(innerHeight - 300, Math.max(8, e.clientY - 40)) + 'px';
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (hoverId) { pinnedId = hoverId; card.classList.add('pinned'); }
  else { pinnedId = null; card.classList.remove('pinned'); }
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { pinnedId = null; card.classList.remove('pinned'); }
  if (e.code === 'Space') { e.preventDefault(); bRun.click(); }
  if (e.code === 'ArrowRight') $('#bStep').click();
  if (e.code === 'ArrowLeft') { st.crankAngle = (st.crankAngle + 705) % 720; sAngle.value = st.crankAngle; }
  if (e.key === 'c' || e.key === 'C') { ui.mode = ui.mode === 'section' ? 'solid' : 'section'; applyMode(); }
  if (e.key === 'g' || e.key === 'G') { ui.mode = ui.mode === 'ghost' ? 'solid' : 'ghost'; applyMode(); }
  const n = parseInt(e.key, 10);
  const names = ['free', 'side', 'top', 'front', 'section'];
  if (n >= 1 && n <= 5) document.querySelector(`[data-view="${names[n - 1]}"]`).click();
});

function pickAt() {
  ray.setFromCamera(pointer, camera);
  const list = world.pickables.filter(visibleChain);
  const hits = ray.intersectObjects(list, false);
  return hits.length ? hits[0].object : null;
}

function cardHTML(entry, id) {
  const d = entry && entry.info;
  const state = entry && entry.state ? safe(() => entry.state(st)) : '—';
  if (!d) {
    return `<div class="hd"><div class="cn">${id}</div>
      <div class="en">该零件的资料条目待补充 / metadata pending</div></div>
      <div class="bd"><div class="st">${state}</div></div>`;
  }
  const specs = (d.specs || []).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  return `<div class="hd">
      <div class="cn">${d.cn}${d.qty ? `<span class="tag">×${d.qty}</span>` : ''}</div>
      <div class="en">${d.en || ''}</div>
    </div>
    <div class="bd">
      ${d.system ? `<div class="k">所属系统 SYSTEM</div><div class="v">${d.system}</div>` : ''}
      ${d.material ? `<div class="k">材料 MATERIAL</div><div class="v">${d.material}</div>` : ''}
      ${d.process ? `<div class="k">制造工艺 PROCESS</div><div class="v">${d.process}</div>` : ''}
      ${d.func ? `<div class="k">功能 FUNCTION</div><div class="v">${d.func}</div>` : ''}
      ${specs ? `<div class="k">关键设计参数 KEY SPECS</div><table>${specs}</table>` : ''}
      <div class="k">当前运动/工作状态 LIVE STATE</div>
      <div class="st">${state}</div>
    </div>`;
}
const safe = (fn) => { try { return fn(); } catch (e) { return '—'; } };

let cardTick = 0;
function updateCard(force) {
  const id = pinnedId || hoverId;
  if (!id) { card.style.display = 'none'; return; }
  const entry = world.get(id);
  card.style.display = 'block';
  if (force) card.innerHTML = cardHTML(entry, id);
  else {
    const stEl = card.querySelector('.st');
    if (stEl && entry && entry.state) stEl.textContent = safe(() => entry.state(st));
  }
}

// ==================================================== 零件搜索 / 定位
{
  const inp = $('#qSearch'), list = $('#qList');
  const box = new THREE.Box3(), ctr = new THREE.Vector3(), size = new THREE.Vector3();
  const entries = [...world.parts.entries()].map(([id, e]) => ({
    id, e,
    key: (id + ' ' + (e.info ? `${e.info.cn} ${e.info.en} ${e.info.system || ''}` : '')).toLowerCase(),
    label: e.info ? `${e.info.cn}　<small>${e.info.en}</small>` : id,
    sys: e.info ? (e.info.system || '') : '',
  }));
  const focus = (rec) => {
    box.makeEmpty();
    for (const o of rec.e.objects) box.expandByObject(o);
    if (box.isEmpty()) return;
    box.getCenter(ctr); box.getSize(size);
    const d = Math.max(170, size.length() * 1.9);
    const dir = new THREE.Vector3(0.72, 0.42, 0.86).normalize();
    tween = {
      t: 0, from: camera.position.clone(), to: ctr.clone().addScaledVector(dir, d),
      fromT: controls.target.clone(), toT: ctr.clone(),
    };
    pinnedId = rec.id;
    card.classList.add('pinned');
    updateCard(true);
    // 闪烁高亮，帮助在密集装配中定位
    const meshes = [];
    for (const o of rec.e.objects) o.traverse((c) => { if (c.isMesh || c.isInstancedMesh) meshes.push(c); });
    const orig = meshes.map((m) => m.material);
    let n = 0;
    const blink = setInterval(() => {
      n++;
      meshes.forEach((m, i) => { m.material = (n % 2) ? highlightMat(orig[i]) : orig[i]; });
      if (n > 6) { clearInterval(blink); meshes.forEach((m, i) => { m.material = orig[i]; }); }
    }, 200);
  };
  const render = (q) => {
    if (!q) { list.style.display = 'none'; return; }
    const hits = entries.filter((r) => r.key.includes(q)).slice(0, 40);
    list.innerHTML = hits.length
      ? hits.map((r, i) => `<div data-i="${i}" style="padding:5px 9px;border-bottom:1px solid #1a2431;cursor:pointer;font-size:12px">
          ${r.label}${r.sys ? `<span class="tag">${r.sys}</span>` : ''}</div>`).join('')
      : '<div style="padding:7px 9px;color:#7f8ea3;font-size:12px">未找到匹配零件</div>';
    list.style.display = 'block';
    list.querySelectorAll('[data-i]').forEach((el) => {
      el.onmouseenter = () => { el.style.background = '#1b2739'; };
      el.onmouseleave = () => { el.style.background = 'transparent'; };
      el.onclick = () => { focus(hits[+el.dataset.i]); list.style.display = 'none'; inp.value = ''; };
    });
  };
  inp.addEventListener('input', () => render(inp.value.trim().toLowerCase()));
  inp.addEventListener('blur', () => setTimeout(() => { list.style.display = 'none'; }, 220));
  window.DSH_focus = (id) => { const r = entries.find((x) => x.id === id); if (r) focus(r); };
}

// ==================================================== 气门升程图（静态底图 + 动态游标）
const chart = $('#chart'), cx = chart.getContext('2d');
const chartBase = document.createElement('canvas');
chartBase.width = chart.width; chartBase.height = chart.height;
function drawChartBase() {
  const g = chartBase.getContext('2d');
  const W = chartBase.width, H = chartBase.height;
  g.clearRect(0, 0, W, H);
  const x = (a) => (a / 720) * W;
  const y = (v) => H - 14 - (v / (P.valvetrain.valveLift * 1.18)) * (H - 34);
  // 冲程带
  for (const s of STROKES) {
    g.fillStyle = s.color + '22';
    g.fillRect(x(s.from), 0, x(s.to) - x(s.from), H);
    g.fillStyle = s.color;
    g.font = '10px sans-serif';
    g.fillText(s.cn.replace(/（.*/, ''), x(s.from) + 6, 12);
  }
  // 网格
  g.strokeStyle = '#22303f'; g.lineWidth = 1;
  for (let a = 0; a <= 720; a += 90) {
    g.beginPath(); g.moveTo(x(a), 14); g.lineTo(x(a), H - 14); g.stroke();
    g.fillStyle = '#5b6a7e'; g.font = '9px sans-serif';
    g.fillText(a + '°', x(a) + 2, H - 3);
  }
  // 活塞位置曲线
  g.strokeStyle = '#6b7c93'; g.lineWidth = 1.2; g.beginPath();
  for (let a = 0; a <= 720; a += 2) {
    const f = K.pistonFraction(a);
    const py = H - 14 - f * (H - 34);
    a === 0 ? g.moveTo(x(a), py) : g.lineTo(x(a), py);
  }
  g.stroke();
  // 气门升程曲线
  const draw = (which, color) => {
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
    let started = false;
    for (let a = 0; a <= 720; a += 1) {
      const v = K.valveLift(a, which);
      const py = y(v);
      if (!started) { g.moveTo(x(a), py); started = true; } else g.lineTo(x(a), py);
    }
    g.stroke();
  };
  draw('intake', '#7fe8ff');
  draw('exhaust', '#ff7a3c');
  g.fillStyle = '#7fe8ff'; g.font = '10px sans-serif'; g.fillText('进气门', 8, H - 20);
  g.fillStyle = '#ff7a3c'; g.fillText('排气门', 58, H - 20);
}
drawChartBase();
$('#timingTxt').textContent =
  `进气门 ${P.valvetrain.timing.IVO}°BTDC 开 / ${P.valvetrain.timing.IVC}°ABDC 闭（持续 ${VALVE_EVENTS.intake.close - VALVE_EVENTS.intake.open}°CA）；` +
  `排气门 ${P.valvetrain.timing.EVO}°BBDC 开 / ${P.valvetrain.timing.EVC}°ATDC 闭（${VALVE_EVENTS.exhaust.close - VALVE_EVENTS.exhaust.open}°CA）；` +
  `气门最大升程 ${P.valvetrain.valveLift} mm，摇臂比 ${P.valvetrain.rockerRatio}。`;

function drawChart() {
  const W = chart.width, H = chart.height;
  cx.clearRect(0, 0, W, H);
  cx.drawImage(chartBase, 0, 0);
  const a = st.cyl[0].cycle;
  const px = (a / 720) * W;
  cx.strokeStyle = '#ffffff'; cx.lineWidth = 1.4;
  cx.beginPath(); cx.moveTo(px, 0); cx.lineTo(px, H); cx.stroke();
  cx.fillStyle = '#fff'; cx.font = 'bold 10px sans-serif';
  cx.fillText('①' + a.toFixed(0) + '°', Math.min(W - 46, px + 4), 24);
}

// ==================================================== HUD 数值刷新
const cylBody = $('#cylBody');
cylBody.innerHTML = [1, 2, 3, 4].map((n) => `<tr>
  <td>${n}</td><td id="cs${n}"></td><td id="ca${n}"></td><td id="cp${n}"></td><td id="cv${n}"></td></tr>`).join('');
$('#bDisp').textContent = P.meta.displacementL + ' L';
$('#bCR').textContent = 'ε=' + P.compressionRatio;
$('#bOrder').textContent = '点火 ' + P.meta.firingOrder.join('-');

const setBar = (id, v) => { $(id).style.width = Math.max(0, Math.min(100, v)) + '%'; };
let hudTick = 0;
function updateHUD() {
  $('#kAngle').textContent = st.crankAngle.toFixed(0) + '°';
  $('#kCycle').textContent = st.cyl[0].stroke.cn.replace(/（.*/, '');
  $('#kFps').textContent = st.fps.toFixed(0);
  $('#kTri').textContent = (renderer.info.render.triangles / 1000).toFixed(0) + 'k';
  $('#vRpm').textContent = st.rpm.toFixed(0);
  setBar('#bRpmBar', (st.rpm / P.meta.maxSpeed) * 100);
  $('#vTw').textContent = op.coolantTemp.toFixed(0);
  setBar('#bTwBar', (op.coolantTemp / 110) * 100);
  $('#vOil').textContent = op.oilPressure.toFixed(2);
  setBar('#bOilBar', (op.oilPressure / 0.5) * 100);
  $('#vBoost').textContent = (op.boost * 1000).toFixed(0);
  setBar('#bBoostBar', (op.boost / P.air.maxBoost) * 100);
  $('#vTq').textContent = op.torque.toFixed(0);
  setBar('#bTqBar', (op.torque / P.meta.peakTorqueNm) * 100);
  $('#vPw').textContent = op.power.toFixed(1);
  setBar('#bPwBar', (op.power / P.meta.ratedPowerKW) * 100);
  $('#vEgt').textContent = op.egt.toFixed(0);
  setBar('#bEgtBar', (op.egt / 800) * 100);
  $('#vTb').textContent = (op.turboRpm / 1000).toFixed(0);
  setBar('#bTbBar', (op.turboRpm / 130000) * 100);
  for (const c of st.cyl) {
    $('#cs' + c.n).innerHTML = `<span class="pill" style="background:${c.stroke.color}">${c.stroke.cn.replace(/（.*/, '')}</span>`;
    $('#ca' + c.n).textContent = c.cycle.toFixed(0) + '°';
    $('#cp' + c.n).textContent = (c.speed > 0 ? '↑' : '↓') + c.pistonY.toFixed(0);
    $('#cv' + c.n).textContent = `${c.intakeLift.toFixed(1)}/${c.exhaustLift.toFixed(1)}`;
  }
}

// ==================================================== 主循环
setLoad(97, '启动渲染循环');
const clock = new THREE.Clock();
let acc = 0, frames = 0;

function animate() {
  const dt = Math.min(0.05, clock.getDelta());
  frames++; acc += dt;
  if (acc > 0.5) {
    st.fps = frames / acc; frames = 0; acc = 0;
    // 自动降档（仅一次），保证动画流畅度
    if (!autoDropped && st.fps < 45) {
      autoDropped = true;
      setQuality(quality === 'high' ? 'mid' : 'low', true);
    }
  }

  if (st.running) {
    const dAngle = (st.rpm / 60) * 360 * dt * ui.speed;
    st.crankAngle = (st.crankAngle + dAngle) % 720;
    st.crankTotal += dAngle;
    sAngle.value = st.crankAngle;
    $('#oAngle').textContent = st.crankAngle.toFixed(0) + '°';
  }
  computeState(dt);
  world.update(st);

  // 相机补间
  if (tween) {
    tween.t = Math.min(1, tween.t + dt * 1.7);
    const e = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2;
    camera.position.lerpVectors(tween.from, tween.to, e);
    controls.target.lerpVectors(tween.fromT, tween.toT, e);
    if (tween.t >= 1) tween = null;
  }
  controls.update();

  // 拾取
  if (pointerMoved) {
    pointerMoved = false;
    const obj = pickAt();
    const id = obj ? obj.userData.partId : null;
    if (id !== hoverId) {
      hoverId = id;
      setHighlight(obj && id ? obj : null);
      updateCard(true);
      renderer.domElement.style.cursor = id ? 'pointer' : 'default';
    }
  }
  cardTick += dt;
  if (cardTick > 0.12) { cardTick = 0; updateCard(false); }
  hudTick += dt;
  if (hudTick > 0.1) { hudTick = 0; updateHUD(); drawChart(); }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.compile(scene, camera);
animate();
setLoad(100, '完成');
setTimeout(() => { $('#load').style.display = 'none'; }, 260);

// 调试 / 自动化审查入口
window.DSH = {
  THREE, scene, world, st, op, mats, camera, controls, renderer, P, K,
  recompute: computeState, ui, applyMode, VIEWS, setQuality,
};
