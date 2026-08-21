/**
 * ZTZ-99A 结构演示 —— 主程序
 *
 * 职责：装配场景 → 绑定 UI → 主循环。
 * 交互核心（对应验收点）：
 *   1) 右侧面板点击组件 → CameraRig 自动运镜到该部位
 *   2) 目标零件换红色材质 + OutlinePass 红色描边
 *   3) 相机与目标之间的遮挡零件自动半透明（几何遮挡判定，非全车透明）
 *   4) 反向选择：直接点击 3D 视图里的零件也能定位到目录条目
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { D } from './tank/dims.js';
import { MaterialLibrary } from './tank/materials.js';
import { buildTank, resolveItem } from './tank/index.js';
import { CATEGORIES, DISCLAIMER, GENERAL_SPECS, ITEMS } from './data/components.js';
import { Environment } from './scene/env.js';
import { Highlighter } from './scene/highlight.js';
import { FiringFX } from './scene/fx.js';
import { CameraRig } from './scene/rig.js';
import { Panel } from './ui/panel.js';
import * as EX from './export/exporters.js';

const DEG = Math.PI / 180;
const $ = (s) => document.querySelector(s);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

const state = {
  scheme: 'jungle',
  light: 'morning',
  internals: false,
  xray: false,
  ghost: true,
  outline: true,
  wireframe: false,
  ground: true,
  autoRotate: false,
  ruler: false,
  turretSpin: false,
  hatches: false,
  exportInternal: true,
  turretDeg: 0,
  gunDeg: 0,
  dpr: 0,
  selected: null,
};

function toast(msg, isErr = false) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.toggle('err', !!isErr);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 3400);
}

function setLoad(txt) {
  const n = $('#ldSub');
  if (n) n.textContent = txt;
}

/* ------------------------------------------------------------------ *
 * 文本精灵（用于尺寸标尺）
 * ------------------------------------------------------------------ */
function textSprite(text, color = '#ffd9a0') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,10,12,0.72)';
  x.fillRect(0, 0, 256, 64);
  x.strokeStyle = color;
  x.lineWidth = 2;
  x.strokeRect(1, 1, 254, 62);
  x.fillStyle = color;
  x.font = 'bold 34px Consolas, monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(1.05, 0.26, 1);
  s.userData.noExport = true;
  return s;
}

function buildRuler() {
  const g = new THREE.Group();
  g.name = 'ruler';
  g.userData.noExport = true;
  g.visible = false;
  const mat = new THREE.LineBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.75, depthTest: false });
  const pts = [];
  const L0 = -3.92;
  const L1 = 7.08;
  const W = D.overallWidth / 2;
  const H = D.turretRoofY;
  const add = (a, b) => pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
  // 全长（含炮）
  add([W + 0.7, 0.02, L0], [W + 0.7, 0.02, L1]);
  add([W + 0.55, 0.02, L0], [W + 0.85, 0.02, L0]);
  add([W + 0.55, 0.02, L1], [W + 0.85, 0.02, L1]);
  // 全宽
  add([-W, 0.02, L1 + 0.6], [W, 0.02, L1 + 0.6]);
  add([-W, 0.02, L1 + 0.45], [-W, 0.02, L1 + 0.75]);
  add([W, 0.02, L1 + 0.45], [W, 0.02, L1 + 0.75]);
  // 全高
  add([-W - 0.7, 0, -2.0], [-W - 0.7, H, -2.0]);
  add([-W - 0.85, 0, -2.0], [-W - 0.55, 0, -2.0]);
  add([-W - 0.85, H, -2.0], [-W - 0.55, H, -2.0]);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  g.add(new THREE.LineSegments(geo, mat));
  const s1 = textSprite('11.00 m');
  s1.position.set(W + 0.7, 0.3, 1.6);
  const s2 = textSprite('3.40 m');
  s2.position.set(0, 0.3, L1 + 0.6);
  const s3 = textSprite('2.33 m');
  s3.position.set(-W - 0.7, H / 2, -2.0);
  g.add(s1, s2, s3);
  return g;
}

/* ------------------------------------------------------------------ *
 * 启动
 * ------------------------------------------------------------------ */
async function boot() {
  /* ---- 主循环状态（提前声明，避免被回调提前引用时落入 TDZ）---- */
  let ghostDirty = true;
  let ghostTimer = 0;
  let sunDirty = false;
  let sunTimer = 0;
  let turretTween = null;
  let hatchTarget = 0;
  let hatchK = 0;
  let fpsAcc = 0;
  let fpsN = 0;

  /* ---- 渲染器 ---- */
  setLoad('初始化 WebGL2 渲染器');
  const canvas = $('#view');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    stencil: false,
  });
  // MSAA 4× 已在 composer 里开启，像素比不必拉满（497 个 draw call + 后处理链更吃填充率）
  const autoDpr = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(autoDpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.userData.viewportHeight = window.innerHeight;
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.08, 900);
  camera.position.set(9.4, 5.2, 10.6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.25, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 1.6;
  controls.maxDistance = 62;
  controls.maxPolarAngle = 91 * DEG;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.95;
  controls.panSpeed = 0.8;
  controls.autoRotateSpeed = 0.55;
  controls.update();

  /* ---- 材质 / 贴图 ---- */
  await nextFrame();
  setLoad('生成程序化涂装与贴图（Canvas）');
  const matlib = new MaterialLibrary();
  matlib.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const M = matlib.m;

  /* ---- 整车装配 ---- */
  await nextFrame();
  setLoad('装配车体 / 炮塔 / 火炮 / 行动装置 / 内部结构');
  const tank = buildTank(M);
  scene.add(tank.root);
  const { refs, byPid, meshes, stats } = tank;

  /* ---- 环境光影 ---- */
  await nextFrame();
  setLoad('生成物理天空、环境反射与阴影');
  const env = new Environment(renderer, scene, camera);
  env.applyPreset(state.light);

  const ruler = buildRuler();
  scene.add(ruler);

  /* ---- 车灯光束（夜间/黄昏预案下点亮，挂在车体上随车运动）---- */
  const headlights = new THREE.Group();
  headlights.name = 'headlights';
  headlights.userData.noExport = true;
  refs.hull.add(headlights);
  const beams = [];
  for (const [lx, color, ang] of [
    [1.02, 0xfff0d0, 0.3],
    [1.32, 0xff4530, 0.26],
  ]) {
    const sp = new THREE.SpotLight(color, 0, 55, ang, 0.5, 1.3);
    sp.position.set(lx, 1.12, 3.3);
    sp.target.position.set(lx * 0.7, -0.2, 24);
    sp.castShadow = false;
    headlights.add(sp, sp.target);
    beams.push(sp);
  }
  function applyLamps(k) {
    M.lamp.emissiveIntensity = k;
    M.lampIR.emissiveIntensity = k * 0.7;
    beams[0].intensity = Math.max(0, (k - 0.3) * 62);
    beams[1].intensity = Math.max(0, (k - 0.3) * 16);
  }

  /* ---- 高亮 / 特效 / 运镜 ---- */
  await nextFrame();
  setLoad('装配高亮、开火特效与界面');
  const hl = new Highlighter(meshes);
  const fx = new FiringFX(scene, refs, { reloadTime: 5 });
  const rig = new CameraRig(camera, controls);

  /* ---- 反查表：零件 → 目录条目（跳过总览类，避免全命中） ---- */
  const meshToItem = new Map();
  for (const cat of CATEGORIES) {
    if (cat.id === 'overview') continue;
    for (const item of cat.items) {
      for (const m of resolveItem(byPid, item)) if (!meshToItem.has(m)) meshToItem.set(m, item.id);
    }
  }

  /* ---- 内部结构显隐 ---- */
  const interiorMeshes = meshes.filter((m) => m.userData.interior);
  function applyInternals() {
    for (const m of interiorMeshes) m.visible = state.internals;
  }
  applyInternals();

  /* ---- 装甲透视 ---- */
  const shellMats = [M.armor, M.armorDark, M.era, M.skirt];
  function applyXray() {
    for (const mt of shellMats) {
      mt.transparent = state.xray;
      mt.opacity = state.xray ? 0.24 : 1;
      mt.depthWrite = !state.xray;
      mt.needsUpdate = true;
    }
    if (state.xray && !state.internals) {
      state.internals = true;
      applyInternals();
      panel.setInternalsValue(true);
    }
  }

  /* ---- 选择逻辑 ---- */
  let selectedItem = null;
  function selectItem(id, { fly = true } = {}) {
    const item = id ? ITEMS.get(id) : null;
    selectedItem = item || null;
    state.selected = item ? item.id : null;
    panel.setActiveItem(item);
    const hudSel = $('#hudSel');
    if (!item) {
      hl.clear();
      env.setOutlineTargets([]);
      hudSel.hidden = true;
      return;
    }
    const objs = resolveItem(byPid, item);
    if (!objs.length) {
      toast('该组件在当前模型中未找到对应零件', true);
      return;
    }
    // 内部件：自动打开内部结构
    if (item.internal && !state.internals) {
      state.internals = true;
      applyInternals();
      panel.setInternalsValue(true);
    }
    const doHighlight = item.highlight !== false;
    hl.select(objs.filter((o) => o.visible), doHighlight);
    env.setOutlineTargets(doHighlight && state.outline ? objs.filter((o) => o.visible) : []);
    if (fly) rig.frame(objs, item.view || {}, 0.95);
    hudSel.hidden = false;
    $('#hudSelName').textContent = item.name;
    $('#hudSelCat').textContent = item.categoryName + (item.internal ? ' · 内部结构' : '');
    ghostDirty = true;
  }

  /* ---- 面板上下文 ---- */
  const ctx = {
    selectItem: (id) => selectItem(id),
    resetView: () => {
      rig.flyTo(new THREE.Vector3(9.4, 5.2, 10.6), new THREE.Vector3(0, 1.25, 0), 0.9);
      selectItem(null);
    },
    setScheme: (id) => {
      state.scheme = id;
      const s = matlib.applyScheme(id);
      matlib.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
      panel.setScheme(id);
      // 科幻涂装配夜间光照更好看，但不强制切换
      toast(`涂装已切换：<b>${s.name}</b>${s.fictional ? '（虚构方案）' : ''}`);
    },
    setWeather: (v) => {
      matlib.applyScheme(state.scheme, v);
      matlib.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    },
    regenerateCamo: () => {
      matlib.applyScheme(state.scheme, matlib.weather);
      toast('已重新生成迷彩贴图');
    },
    setLightPreset: (id) => {
      state.light = id;
      const p = env.applyPreset(id);
      state.sunAz = p.sun.az;
      state.sunEl = p.sun.el;
      applyLamps(p.lamps);
      panel.setLightPreset(id);
      toast(`光照预案：<b>${p.name}</b>`);
    },
    setSun: ({ az, el }) => {
      // 太阳变动要重烘 PMREM（较重），因此只记录目标值，由主循环限流应用
      if (az != null) state.sunAz = az;
      if (el != null) state.sunEl = el;
      sunDirty = true;
    },
    setExposure: (v) => env.setExposure(v),
    setBloom: (v) => env.setBloom(v),
    setShadowQuality: (n) => env.setShadowQuality(n),
    setDpr: (n) => {
      state.dpr = n;
      renderer.setPixelRatio(n === 0 ? autoDpr : n);
      env.setPixelRatio(renderer.getPixelRatio());
      onResize();
    },
    fire: () => {
      if (fx.busy) return;
      fx.fire();
      panel.setFireEnabled(false, '装填中…');
    },
    setTurret: (deg) => {
      state.turretDeg = deg;
      refs.turretYaw.rotation.y = deg * DEG;
      ghostDirty = true;
    },
    setGun: (deg) => {
      state.gunDeg = deg;
      refs.gunPivot.rotation.x = -deg * DEG;
      ghostDirty = true;
    },
    nudgeTurret: (deg, absolute = false) => {
      let v = absolute ? deg : state.turretDeg + deg;
      while (v > 180) v -= 360;
      while (v < -180) v += 360;
      state.turretDeg = v;
      panel.setTurretValue(v);
      turretTween = { from: refs.turretYaw.rotation.y, to: v * DEG, t: 0, dur: Math.abs(deg) / 90 * 1.1 + 0.3 };
    },
    setLoaderAnim: (v) => (fx.animateLoader = v),
    setSound: (v) => fx.setSound(v),
    setTurretSpin: (v) => (state.turretSpin = v),
    setHatches: (v) => {
      state.hatches = v;
      hatchTarget = v ? 1 : 0;
    },
    setReload: (v) => fx.setReloadTime(v),
    setSmoke: (v) => fx.setSmokeAmount(v),
    setInternals: (v) => {
      state.internals = v;
      applyInternals();
      if (selectedItem) selectItem(selectedItem.id, { fly: false });
    },
    setXray: (v) => {
      state.xray = v;
      applyXray();
    },
    setGhost: (v) => {
      state.ghost = v;
      hl.setGhostEnabled(v);
      ghostDirty = true;
    },
    setGhostOpacity: (v) => hl.setGhostOpacity(v),
    setOutline: (v) => {
      state.outline = v;
      env.setOutlineTargets(v && selectedItem ? hl.selection : []);
    },
    setWireframe: (v) => {
      state.wireframe = v;
      for (const mt of Object.values(M)) if ('wireframe' in mt) mt.wireframe = v;
    },
    setGround: (v) => {
      state.ground = v;
      env.ground.visible = v;
      env.sky.visible = v && env.preset.studio !== true;
      if (!v) scene.background = new THREE.Color(0x090b0d);
      else env.applyPreset(state.light);
    },
    setAutoRotate: (v) => {
      state.autoRotate = v;
      controls.autoRotate = v;
    },
    setRuler: (v) => {
      state.ruler = v;
      ruler.visible = v;
    },
    setExportInternal: (v) => (state.exportInternal = v),
    doExport: (kind) => doExport(kind),
  };

  /* ---- 面板 ---- */
  const panel = new Panel($('#panel'), ctx);
  panel.setScheme(state.scheme);
  panel.setLightPreset(state.light);
  state.sunAz = env.preset.sun.az;
  state.sunEl = env.preset.sun.el;
  panel.setStats(
    `${stats.parts} 类零件 / ${stats.meshes} 个网格 / ${stats.triangles.toLocaleString()} 三角面（其中内部结构 ${stats.interiorMeshes} 个网格）`,
  );
  $('#hudStats').textContent =
    `零件 ${stats.parts} 类 · 网格 ${stats.meshes} · 三角面 ${stats.triangles.toLocaleString()} · 1:1 实尺`;

  /* ---- 导出 ---- */
  async function doExport(kind) {
    const savedSel = selectedItem ? selectedItem.id : null;
    const savedRot = refs.root.rotation.x;
    const savedY = refs.root.position.y;
    try {
      // 清除高亮/半透明覆盖，复位车体姿态
      hl.restoreAll();
      env.setOutlineTargets([]);
      refs.root.rotation.x = 0;
      refs.root.position.y = 0;
      const hiddenByInternals = [];
      if (!state.exportInternal) {
        for (const m of interiorMeshes)
          if (m.visible) {
            m.visible = false;
            hiddenByInternals.push(m);
          }
      } else {
        for (const m of interiorMeshes) m.visible = true;
      }

      panel.setExportStatus('正在导出，请稍候…');
      await nextFrame();
      let r;
      if (kind === 'glb') r = await EX.exportGLTF(refs.root, { binary: true, scheme: state.scheme });
      else if (kind === 'gltf') r = await EX.exportGLTF(refs.root, { binary: false, scheme: state.scheme });
      else if (kind === 'obj') r = EX.exportOBJ(refs.root, { scheme: state.scheme });
      else if (kind === 'stl') r = EX.exportSTL(refs.root, { binary: true, scheme: state.scheme });
      else if (kind === 'json')
        r = EX.exportSpec({
          categories: CATEGORIES,
          general: GENERAL_SPECS,
          disclaimer: DISCLAIMER,
          stats,
          scheme: state.scheme,
        });
      else if (kind.startsWith('png')) {
        const scale = kind === 'png1' ? 1 : kind === 'png4' ? 4 : 2;
        r = EX.captureScreenshot({
          renderer,
          env,
          camera,
          scale,
          scheme: state.scheme,
          transparent: kind === 'png2t',
        });
      }
      for (const m of hiddenByInternals) m.visible = true;
      applyInternals();
      panel.setExportStatus(
        `✔ 已导出 <b>${r.name}</b><br/>大小 ${r.size}${r.pixels ? ' · ' + r.pixels : ''}`,
      );
      toast(`已导出 <b>${r.name}</b>（${r.size}）`);
    } catch (e) {
      console.error(e);
      panel.setExportStatus(`✖ 导出失败：${e && e.message ? e.message : e}`);
      toast('导出失败：' + (e && e.message ? e.message : e), true);
    } finally {
      refs.root.rotation.x = savedRot;
      refs.root.position.y = savedY;
      if (savedSel) selectItem(savedSel, { fly: false });
    }
  }

  /* ---- 点击拾取 ---- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downXY = null;
  let downT = 0;
  canvas.addEventListener('pointerdown', (e) => {
    downXY = [e.clientX, e.clientY];
    downT = performance.now();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downXY) return;
    const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
    const dt = performance.now() - downT;
    downXY = null;
    if (moved > 6 || dt > 450) return; // 拖拽/长按不算点击
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([refs.root], true).filter((h) => h.object.visible && h.object.isMesh);
    if (!hits.length) {
      selectItem(null);
      return;
    }
    // 跳过已经变成幽灵的遮挡件，找到第一个"实体"命中
    let pick = hits.find((h) => !hl.overrides.has(h.object) || hl.selection.includes(h.object)) || hits[0];
    const id = meshToItem.get(pick.object);
    if (id) selectItem(id);
    else toast(`零件「${pick.object.name || pick.object.userData.pid}」未收录在目录中`, true);
  });

  /* ---- 键盘 ---- */
  window.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') {
      e.preventDefault();
      ctx.fire();
    } else if (k === 'r') ctx.resetView();
    else if (k === 'x') {
      state.xray = !state.xray;
      applyXray();
      panel.tgXray.setValue(state.xray);
    } else if (k === 'i') {
      state.internals = !state.internals;
      applyInternals();
      panel.setInternalsValue(state.internals);
    } else if (k === 'h') togglePanel();
    else if (k === 'escape') selectItem(null);
  });

  /* ---- 面板收放 ---- */
  const toggleBtn = $('#panelToggle');
  function togglePanel() {
    const p = $('#panel');
    p.classList.toggle('hidden');
    toggleBtn.classList.toggle('collapsed');
    updateFilmOffset();
  }
  toggleBtn.addEventListener('click', togglePanel);

  /* ---- 尺寸变化 ---- */
  // 右侧面板会盖住画面，用 filmOffset 把投影中心左移，使模型在"可见区域"里居中。
  // 数学：left += near*skew/filmWidth —— skew 为正时画面内容左移，正好避开面板。
  function updateFilmOffset() {
    const open = !$('#panel').classList.contains('hidden');
    const frac = open ? Math.min(0.34, 352 / window.innerWidth) : 0;
    camera.filmOffset = frac * 0.5 * camera.getFilmWidth();
    camera.updateProjectionMatrix();
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    updateFilmOffset();
    env.setSize(w, h);
    scene.userData.viewportHeight = h;
  }
  window.addEventListener('resize', onResize);
  updateFilmOffset();

  /* ---- 主循环 ---- */
  let last = performance.now();
  const camPrev = camera.position.clone();

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAcc += dt;
    fpsN++;

    // 运镜优先于 OrbitControls
    if (!rig.update(dt)) controls.update();

    // 炮塔连续回转
    if (state.turretSpin) {
      state.turretDeg += dt * 11;
      while (state.turretDeg > 180) state.turretDeg -= 360;
      refs.turretYaw.rotation.y = state.turretDeg * DEG;
      panel.setTurretValue(state.turretDeg);
      ghostDirty = true;
    } else if (turretTween) {
      turretTween.t += dt;
      const k = Math.min(1, turretTween.t / turretTween.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      let a = turretTween.from + (turretTween.to - turretTween.from) * e;
      refs.turretYaw.rotation.y = a;
      if (k >= 1) turretTween = null;
      ghostDirty = true;
    }

    // 舱盖
    const hTargetK = hatchTarget;
    if (Math.abs(hatchK - hTargetK) > 0.001) {
      hatchK += (hTargetK - hatchK) * Math.min(1, dt * 3.4);
      for (const h of refs.turretParts.hatches || []) h.pivot.rotation.z = h.open * hatchK;
    }

    // 开火特效
    fx.update(dt, camera);
    if (!fx.busy && panel.fireBtn.disabled) panel.setFireEnabled(true);

    // 遮挡半透明：相机移动或选择变化时重算（限流 90 ms）
    ghostTimer += dt;
    if (camera.position.distanceToSquared(camPrev) > 0.0025) {
      ghostDirty = true;
      camPrev.copy(camera.position);
    }
    if (ghostDirty && ghostTimer > 0.09) {
      ghostTimer = 0;
      ghostDirty = false;
      if (state.ghost) hl.updateGhost(camera);
      if (state.outline && selectedItem && selectedItem.highlight !== false) {
        env.setOutlineTargets(hl.selection.filter((o) => o.visible));
      }
    }

    // 太阳角度变更（限流重烘环境贴图）
    sunTimer += dt;
    if (sunDirty && sunTimer > 0.13) {
      sunTimer = 0;
      sunDirty = false;
      const keepExposure = renderer.toneMappingExposure;
      const keepBloom = env.bloom.strength;
      env.applyPreset(state.light, { sunAz: state.sunAz, sunEl: state.sunEl, exposure: keepExposure });
      env.bloom.strength = keepBloom;
    }

    env.render();

    if (fpsAcc > 1) {
      const fps = Math.round(fpsN / fpsAcc);
      fpsAcc = 0;
      fpsN = 0;
      const s = $('#hudStats');
      if (s) {
        s.textContent =
          `零件 ${stats.parts} 类 · 网格 ${stats.meshes} · 三角面 ${stats.triangles.toLocaleString()} · ${fps} FPS`;
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---- 收尾 ---- */
  fx.onStateChange = (s) => {
    if (s === 'ready') panel.setFireEnabled(true);
  };
  panel.setFireEnabled(true);
  applyLamps(env.preset.lamps);

  await nextFrame();
  setLoad('就绪');
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 700);
  requestAnimationFrame(tick);

  // 首次进场：从右前方缓缓推近
  camera.position.set(13.5, 7.4, 15.2);
  rig.flyTo(new THREE.Vector3(9.4, 5.2, 10.6), new THREE.Vector3(0, 1.25, 0), 2.1);

  // 暴露调试句柄
  window.T99 = { scene, camera, renderer, tank, refs, byPid, matlib, env, fx, hl, rig, panel, state, ctx };
  console.log(
    `%c ZTZ-99A %c ${stats.parts} 类零件 / ${stats.meshes} 网格 / ${stats.triangles} 三角面 `,
    'background:#c02d13;color:#fff;font-weight:bold',
    'background:#1a1e22;color:#9ab',
  );
}

boot().catch((e) => {
  console.error(e);
  const l = $('#loading');
  if (l) {
    l.innerHTML =
      `<div class="ld-box"><div class="ld-txt" style="color:#ff6a4a">初始化失败</div>` +
      `<div class="ld-sub" style="max-width:60ch;white-space:pre-wrap">${(e && e.stack) || e}</div></div>`;
  }
});
