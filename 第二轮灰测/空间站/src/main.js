/**
 * main.js —— 应用装配与主循环
 *
 * 启动流程：
 *   WebGL2 上下文 → HUD → Worker 池并行建模 → 上传 GPU → 取景 → 主循环
 *
 * 主循环每帧：
 *   相机阻尼求解 → 太阳/环境更新 → 舱段运动学 → 渲染管线 → 统计与遥测
 *   → 按需 GPU 拾取（悬停高亮）→ 自适应分辨率
 */

import { createContext } from './gfx/gl.js';
import { Renderer } from './gfx/renderer.js';
import { OrbitCamera } from './scene/camera.js';
import { Station } from './scene/station.js';
import { buildStation } from './voxel/factory.js';
import { MODULES, MODULE_MAP, STATION_INFO, L } from './voxel/blueprint.js';
import { HUD } from './ui/hud.js';
import { createAmbience } from './audio/ambience.js';
import { clamp, vec3, DEG } from './core/math.js';

/* ═══════════════════ 全局状态 ═══════════════════ */

const state = {
  animate: true, shadows: true, ssaoOn: true, bloomOn: true, godraysOn: true,
  flareOn: true, earth: true, fxaa: true, solo: false, cinema: false, audio: false,
  mode: 0,
  assembly: 100, explode: 0, exposure: 115, bloom: 85, detail: 100,
  hiddenIds: new Set(),
  selected: null, hovered: null,
  time: 0, paused: false,
};

const RENDER = {
  time: 0, mode: 0, detail: 1,
  exposure: 1.15, bloom: 0.85, bloomThreshold: 1.15,
  ssao: 0.85, ssaoRadius: 6.5,
  shadows: true, shadowStrength: 0.9,
  godrays: 0.5, flare: 1, earth: true, stars: 1, nebula: 1,
  fxaa: true, vignette: 0.36, grain: 0.018, chroma: 0.55,
  emissive: 1, highlightColor: new Float32Array([0.34, 0.86, 1.0]),
};

/* ═══════════════════ 启动 ═══════════════════ */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('stage'));
let gl, caps, renderer, camera, station, hud, audio;
let tourWaypoints = [];
let selftestFrames = 0;

async function boot() {
  /* ── 1. 图形设备 ── */
  try {
    const ctx = createContext(canvas);
    gl = ctx.gl; caps = ctx.caps;
  } catch (err) {
    document.getElementById('boot').style.display = 'none';
    document.getElementById('unsupported-msg').textContent =
      '无法初始化 WebGL2 渲染器。请使用 Chrome / Edge 90+、Firefox 89+ 或 Safari 15+ 的最新版本，' +
      `并在浏览器设置中确认已启用硬件加速。\n\n诊断信息：${String(err?.message || err)}`;
    document.getElementById('unsupported').hidden = false;
    console.error(err);
    return;
  }

  hud = new HUD({ state, actions });
  audio = createAmbience();
  hud.log(`图形设备：${caps.renderer}`);
  hud.log(`HDR 渲染目标：${caps.colorBufferFloat ? 'RGBA16F' : 'RGBA8（降级）'}${caps.colorBufferFloat ? '' : ' — 缺少 EXT_color_buffer_float'}`,
    caps.colorBufferFloat ? 'ok' : 'warn');
  hud.setProgress(0, 1, '正在编译着色器…');

  /* ── 2. 渲染器与相机 ── */
  await nextFrame();
  renderer = new Renderer(gl, caps);
  camera = new OrbitCamera(canvas, { distance: 520, azimuth: 0.85, elevation: 0.30, fov: 40 });
  station = new Station(gl);
  hud.log('渲染管线就绪：阴影 / 预通道 / SSAO / 前向 PBR / Bloom / 体积光 / FXAA', 'ok');

  /* ── 3. 并行建模 ── */
  hud.setProgress(0, MODULES.length, '正在并行建造舱段…');
  const t0 = performance.now();
  const result = await buildStation({
    onProgress: (done, total, id) => {
      const def = MODULE_MAP.get(id);
      hud.setProgress(done, total, `在轨装配 ${done}/${total} · ${def ? def.name : id}`);
    },
    onModule: (def, mesh, info) => station.add(def, mesh, info),
    onLog: (msg, level) => hud.log(msg, level),
  });
  station.computeBounds();
  hud.log(
    `装配完成：${station.modules.length} 个舱段 · ${station.totalVoxels.toLocaleString('zh-CN')} 体素 · ` +
    `${station.totalTriangles.toLocaleString('zh-CN')} 三角面 · ${(station.totalBytes / 1048576).toFixed(1)} MB 显存 · ` +
    `${(performance.now() - t0).toFixed(0)} ms${result.fallback ? '（主线程降级）' : ` / ${result.workers} 线程`}`, 'ok');

  /* ── 4. 取景与巡游航点 ── */
  resize();
  tourWaypoints = buildTour();
  focusAll(true);

  /* ── 5. 事件 ── */
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; setHover(null); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clock.last = 0; });
  gl.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    hud.fatal('WebGL 上下文丢失。请刷新页面重新载入。');
  });

  hud.setProgress(1, 1, '就绪');
  hud.bootDone();
  registerServiceWorker();
  requestAnimationFrame(frame);
}

/* ═══════════════════ 交互动作 ═══════════════════ */

const actions = {
  select(id, fromList = false) {
    if (state.selected === id) id = null;
    state.selected = id;
    hud.setSelected(id);
    if (id) {
      audio.select?.();
      if (fromList) actions.focus(id);
    } else audio.click?.();
  },
  hover(id) { setHover(id); },
  focus(id) {
    const m = station.byId.get(id);
    if (!m) return;
    const def = m.def;
    const dist = def.focus || Math.max(60, m.boundsRadius * 3.1);
    camera.stopTour();
    state.cinema = false;
    hud.refreshToggles();
    const c = m.worldCenter;
    camera.focus([c[0], c[1], c[2]], dist, {
      azimuth: Math.atan2(c[0] || 0.001, c[2] || 0.001) + 0.9,
      elevation: 0.24 + clamp(c[1] / 240, -0.5, 0.5),
    });
  },
  focusAll() { focusAll(false); },
  toggleHidden(id) {
    if (state.hiddenIds.has(id)) state.hiddenIds.delete(id);
    else state.hiddenIds.add(id);
    hud.markHidden(state.hiddenIds);
    audio.click?.();
  },
  setMode(v) { state.mode = v; hud.refreshToggles(); audio.click?.(); },
  toggle(key) {
    if (key === 'cinema') {
      state.cinema = !state.cinema;
      if (state.cinema) camera.startTour(tourWaypoints);
      else { camera.stopTour(); camera.autoRotate = true; }
    } else if (key === 'audio') {
      state.audio = !state.audio;
      if (state.audio) {
        audio.enable().then((ok) => {
          if (!ok) { state.audio = false; hud.refreshToggles(); }
        });
      } else audio.disable();
    } else {
      state[key] = !state[key];
    }
    if (key !== 'audio') audio.click?.();
    hud.refreshToggles();
  },
  getSlider(key) { return state[key]; },
  setSlider(key, v) {
    const prev = state[key];
    state[key] = v;
    if (key === 'explode' && Math.abs(v - prev) > 6) audio.whoosh?.(v > prev ? 1 : -1);
    if (key === 'assembly' && Math.abs(v - prev) > 8) audio.whoosh?.(v > prev ? 1 : -1);
  },
  getRuntime(id) {
    const m = station.byId.get(id);
    return m ? { voxelCount: m.voxelCount, triangleCount: m.triangleCount, bounds: m.bounds } : null;
  },
};

function setHover(id) {
  if (state.hovered === id) {
    if (id) hud.setHovered(id, pointer.x + 16, pointer.y + 18);
    return;
  }
  state.hovered = id;
  hud.setHovered(id, pointer.x + 16, pointer.y + 18);
  canvas.style.cursor = id ? 'pointer' : 'grab';
}

function focusAll(instant = false) {
  camera.stopTour();
  state.cinema = false;
  const d = station.radius * 2.05;
  camera.focus([0, 0, 0], d, { azimuth: 0.85, elevation: 0.30, fov: 40 });
  if (instant) {
    camera.target.set([0, 0, 0]);
    camera.distance = d; camera.azimuth = 0.85; camera.elevation = 0.30;
  }
  camera.autoRotate = true;
  hud?.refreshToggles();
}

/** 影院巡游航点：从总览逐步深入到各个关键舱段 */
function buildTour() {
  const wp = [];
  const push = (id, o = {}) => {
    const m = station.byId.get(id);
    if (!m) return;
    const c = m.worldCenter;
    wp.push({
      center: [c[0], c[1], c[2]],
      distance: o.distance ?? (m.def.focus || 120),
      azimuth: o.azimuth ?? 0.9,
      elevation: o.elevation ?? 0.25,
      fov: o.fov ?? 40,
      duration: o.duration ?? 6.5,
      hold: o.hold ?? 1.0,
      label: m.def.name,
    });
  };
  wp.push({ center: [0, 0, 0], distance: station.radius * 2.1, azimuth: 0.6, elevation: 0.34, fov: 42, duration: 7, hold: 1.4, label: '总览' });
  push('command', { distance: 96, azimuth: 1.5, elevation: 0.16, fov: 36 });
  push('ring', { distance: 205, azimuth: -0.6, elevation: 0.52, fov: 44 });
  push('solar-a', { distance: 250, azimuth: 2.3, elevation: 0.1, fov: 40 });
  push('dock', { distance: 84, azimuth: -1.9, elevation: -0.34, fov: 38 });
  push('shuttle', { distance: 72, azimuth: -2.6, elevation: -0.18, fov: 36 });
  push('hangar', { distance: 98, azimuth: 3.5, elevation: -0.42, fov: 40 });
  push('arm-base', { distance: 74, azimuth: 1.1, elevation: 0.44, fov: 34 });
  push('propulsion', { distance: 118, azimuth: 4.0, elevation: -0.08, fov: 40 });
  wp.push({ center: [0, 0, 0], distance: station.radius * 1.7, azimuth: 5.4, elevation: -0.22, fov: 46, duration: 8, hold: 1.2, label: '掠过' });
  return wp;
}

/* ═══════════════════ 输入 ═══════════════════ */

const pointer = { x: 0, y: 0, inside: false, dirty: false, lastPick: 0 };

function onPointerMove(e) {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.inside = true; pointer.dirty = true;
  if (state.hovered) hud.setHovered(state.hovered, pointer.x + 16, pointer.y + 18);
}

function onPointerUp(e) {
  if (e.button !== 0) return;
  if ((camera.lastDragDistance || 0) > 8) return;   // 拖拽过就不算点击
  const id = pickAt(e.clientX, e.clientY);
  actions.select(id);
}

function pickAt(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const px = (cx - rect.left) * (renderer.width / rect.width);
  const py = (cy - rect.top) * (renderer.height / rect.height);
  const idx = renderer.pick(station, camera, px, py, RENDER);
  if (idx < 0 || idx >= station.modules.length) return null;
  const m = station.modules[idx];
  if (!m.visible) return null;
  // 机械臂子段归到基座条目
  let def = m.def;
  while (def.listed === false && def.parent) def = MODULE_MAP.get(def.parent);
  return def.id;
}

function onKey(e) {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  switch (k) {
    case 'h': hud.toggleVisibility(); break;
    case 'c': actions.toggle('cinema'); break;
    case 'x': {
      const v = state.explode > 50 ? 0 : 100;
      actions.setSlider('explode', v); hud.refreshSlider('explode', v); break;
    }
    case 'b': actions.setMode(state.mode === 1 ? 0 : 1); break;
    case 'v': actions.setMode(state.mode === 2 ? 0 : 2); break;
    case 'o': actions.setMode(0); break;
    case 'r': focusAll(); break;
    case 's': actions.toggle('solo'); break;
    case 'm': actions.toggle('audio'); break;
    case 'f':
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
      break;
    case ' ': state.animate = !state.animate; hud.refreshToggles(); e.preventDefault(); break;
    case '?': case '/': hud.toggleHelp(); break;
    default:
      if (k >= '1' && k <= '9') {
        const listed = MODULES.filter((m) => m.listed !== false);
        const def = listed[+k - 1];
        if (def) actions.select(def.id, true);
      }
  }
}

/* ═══════════════════ 尺寸与自适应分辨率 ═══════════════════ */

const view = { scale: 1, dpr: 1, w: 0, h: 0 };

function resize() {
  const rect = canvas.getBoundingClientRect();
  view.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const w = Math.max(320, Math.round(rect.width * view.dpr * view.scale));
  const h = Math.max(240, Math.round(rect.height * view.dpr * view.scale));
  if (w === view.w && h === view.h) return;
  view.w = w; view.h = h;
  canvas.width = w; canvas.height = h;
  renderer.resize(w, h);
}

/** 帧时间偏高时逐步降低内部分辨率，恢复后再逐步升回 */
function adaptResolution(avgMs) {
  const prev = view.scale;
  if (avgMs > 27 && view.scale > 0.62) view.scale = Math.max(0.62, view.scale - 0.06);
  else if (avgMs < 13.5 && view.scale < 1) view.scale = Math.min(1, view.scale + 0.03);
  if (Math.abs(view.scale - prev) > 0.001) { view.w = 0; resize(); }
}

/* ═══════════════════ 主循环 ═══════════════════ */

const clock = { last: 0, acc: 0, frames: 0, avg: 16.7, frameAvg: 16.7 };

function frame(now) {
  requestAnimationFrame(frame);
  const t = now / 1000;
  if (!clock.last) clock.last = t;
  const dt = Math.min(0.05, Math.max(0.0005, t - clock.last));
  clock.last = t;
  const frameStart = performance.now();

  if (state.animate) state.time += dt;

  /* 相机 */
  const rect = canvas.getBoundingClientRect();
  camera.autoRotate = !state.cinema && !state.selected;
  camera.update(dt, Math.max(0.2, rect.width / Math.max(1, rect.height)));

  /* 环境与运动学 */
  station.updateSun(state.time);
  station.update(dt, state.time, {
    animate: state.animate,
    explode: state.explode / 100,
    assembly: state.assembly / 100,
    selected: state.selected,
    hovered: state.hovered,
    solo: state.solo,
    hiddenIds: state.hiddenIds,
  });

  /* 环境音强度随相机距离变化 */
  if (state.audio) audio.setIntensity?.(clamp(1 - (camera.distance - 80) / 520, 0, 1));

  /* 渲染设置 */
  RENDER.time = state.time;
  RENDER.mode = state.mode;
  RENDER.detail = state.detail / 100;
  RENDER.exposure = state.exposure / 100;
  RENDER.bloom = state.bloomOn ? state.bloom / 100 : 0;
  RENDER.ssao = state.ssaoOn ? 0.9 : 0;
  RENDER.shadows = state.shadows;
  RENDER.godrays = state.godraysOn ? 0.55 : 0;
  RENDER.flare = state.flareOn ? 1 : 0;
  RENDER.earth = state.earth;
  RENDER.fxaa = state.fxaa;
  RENDER.ssaoRadius = clamp(camera.distance * 0.022, 2.5, 12);

  renderer.render(station, camera, RENDER);

  /* 拾取（限频 ~14 Hz） */
  if (pointer.inside && pointer.dirty && now - pointer.lastPick > 70) {
    pointer.lastPick = now;
    pointer.dirty = false;
    setHover(pickAt(pointer.x, pointer.y));
  }

  /* 统计：帧间隔决定 FPS，CPU 提交耗时用于区分瓶颈 */
  const cpuMs = performance.now() - frameStart;
  clock.avg = clock.avg * 0.92 + cpuMs * 0.08;
  clock.frameAvg = clock.frameAvg * 0.9 + dt * 1000 * 0.1;
  hud.updateStats(dt * 1000, cpuMs, renderer.stats, station, [view.w, view.h]);
  hud.updateTelemetry(state.time, station);
  if ((clock.frames = (clock.frames + 1) % 60) === 0) adaptResolution(clock.frameAvg);
  if (SELFTEST && !selftestDone && ++selftestFrames > 45) runSelfTest();
}

/* ═══════════════════ 自检模式 ═══════════════════ */

/**
 * `?selftest=1` 诊断模式：稳定渲染若干帧后回读画面并输出结构化报告。
 * 报告同时写入 document.title 与 <pre id="selftest">，便于无头浏览器 / CI 抓取，
 * 也方便用户在遇到显卡兼容问题时把报告直接贴给我们。
 */
const SELFTEST = new URLSearchParams(location.search).has('selftest');
let selftestDone = false;

function runSelfTest() {
  selftestDone = true;
  const errors = [];
  let e;
  while ((e = gl.getError()) !== gl.NO_ERROR) errors.push('0x' + e.toString(16));

  const pixels = renderer.readbackStats(4);
  // 中心拾取：验证 GPU 拾取通道确实返回了舱段
  const centerPick = renderer.pick(station, camera, renderer.width / 2, renderer.height / 2, RENDER);

  const report = {
    ok: errors.length === 0 && pixels.nonBlack > 0.25 && station.modules.length === MODULES.length,
    renderer: caps.renderer,
    hdr: caps.colorBufferFloat ? 'RGBA16F' : 'RGBA8',
    glErrors: errors,
    programs: [
      'progShadow', 'progPrepass', 'progMain', 'progPick', 'progSky', 'progSSAO', 'progSSAOBlur',
      'progBright', 'progDown', 'progUp', 'progRays', 'progComposite', 'progFXAA',
    ].map((k) => ({ name: renderer[k].name, uniforms: renderer[k].uniforms.size })),
    station: {
      modules: station.modules.length,
      expected: MODULES.length,
      voxels: station.totalVoxels,
      triangles: station.totalTriangles,
      vramMB: +(station.totalBytes / 1048576).toFixed(2),
      radius: +station.radius.toFixed(1),
    },
    frame: {
      drawCalls: renderer.stats.drawCalls,
      triangles: renderer.stats.triangles,
      culled: renderer.stats.culled,
      passes: renderer.stats.passes,
      cpuMs: +clock.avg.toFixed(2),
      frameMs: +clock.frameAvg.toFixed(2),
      resolution: [view.w, view.h],
    },
    pixels,
    centerPick: centerPick >= 0 ? station.modules[centerPick].id : null,
    dom: {
      bootDone: document.getElementById('boot').classList.contains('boot--done'),
      modules: document.querySelectorAll('.modlist__item').length,
      toggles: document.querySelectorAll('.toggle').length,
      sliders: document.querySelectorAll('.slider input').length,
      telemetry: document.querySelectorAll('.telemetry__item').length,
    },
  };
  const json = JSON.stringify(report, null, 2);
  const pre = document.createElement('pre');
  pre.id = 'selftest';
  pre.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre';
  pre.textContent = json;
  document.body.appendChild(pre);
  document.title = `SELFTEST:${report.ok ? 'PASS' : 'FAIL'} ${JSON.stringify({
    px: pixels.nonBlack, mean: pixels.mean, uniq: pixels.unique,
    mods: report.station.modules, tris: report.frame.triangles, err: errors.length,
  })}`;
  console.info('[selftest]', report);
}

/* ═══════════════════ 杂项 ═══════════════════ */

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: './' })
    .then(() => console.info('[sw] 已注册，支持离线访问'))
    .catch((e) => console.info('[sw] 注册失败（不影响使用）：', e.message));
}

// 供控制台调试与自动化检查使用
Object.assign(globalThis, {
  __station: () => station, __camera: () => camera, __renderer: () => renderer,
  __state: state, __render: RENDER, __info: STATION_INFO, __layout: L, __vec3: vec3, __DEG: DEG,
});

/* ═══════════════════ 启动（必须位于所有声明之后） ═══════════════════ */

boot().catch((err) => {
  console.error(err);
  const msg = String(err?.message || err);
  if (hud) hud.fatal(`初始化失败：${msg}`);
  else {
    const boot = document.getElementById('boot');
    if (boot) boot.style.display = 'none';
    const el = document.getElementById('unsupported-msg');
    if (el) el.textContent = `初始化失败：${msg}`;
    const u = document.getElementById('unsupported');
    if (u) u.hidden = false;
  }
});
