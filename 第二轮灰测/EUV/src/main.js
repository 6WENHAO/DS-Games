/**
 * main.js — 装配与播放主控
 * ==================================================================
 * 核心约束：整部影片的画面是「时间的纯函数」。
 *   setTime(t) 会把摄影机、光效、HUD、材质状态全部重算，
 *   不依赖任何 deltaTime 累积。因此：
 *     · 拖动时间条 = 正常播放的同一帧
 *     · 母版逐帧捕获可重复、可断点续跑、绝不产生帧间闪烁（§1.3）
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { BRAND, FILM, QUALITY, readUrlOverrides } from './config.js';
import { PARAMS, PROCESS_STEPS } from './params.js';
import { BOUNDS, CHAIN_BY_KEY, PLASMA, MASK, WAFER, POB, ILLUMINATOR, vec } from './layout.js';
import { buildEnvironment, createMaterials, srgb } from './materials.js';
import { buildStage } from './stage.js';
import { buildSourceFX, buildBeamFX, buildExposureFX, EXAGGERATION } from './fx.js';
import { buildPostFX, configureRenderer } from './postfx.js';
import { createCameraRig, createInspectCamera } from './camera.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { TIMELINE, shotAt, sampleFX, captionAt, stepSpans } from './script.js';

const OPT = readUrlOverrides();
const quality = QUALITY[OPT.quality];

// ═══════════════════════════════════════════════════════════════════
// 渲染器与画布
// ═══════════════════════════════════════════════════════════════════
const container = document.getElementById('app');
const canvas = document.createElement('canvas');
canvas.id = 'stage-canvas';
container.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,          // 逐帧捕获需要读取像素
  stencil: false,
});
configureRenderer(renderer, quality);

function computeSize() {
  let w = container.clientWidth, h = container.clientHeight;
  if (OPT.aspect === '9:16') {
    const target = 9 / 16;
    if (w / h > target) w = Math.round(h * target); else h = Math.round(w / target);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap);
  return { w, h, dpr, pw: Math.round(w * dpr), ph: Math.round(h * dpr) };
}
let SIZE = computeSize();
renderer.setPixelRatio(SIZE.dpr);
renderer.setSize(SIZE.w, SIZE.h, true);

// ═══════════════════════════════════════════════════════════════════
// 场景 / 光照
// ═══════════════════════════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(BRAND.colors.ink);
scene.fog = new THREE.FogExp2(new THREE.Color('#050810').getHex(), 0.0026);

const env = buildEnvironment(renderer);
scene.environment = env;
const mats = createMaterials(env);

const lights = new THREE.Group(); lights.name = 'LIGHTS'; scene.add(lights);
{
  // 半球光：给全场一个可读的基础照度（剖切腔体内部同样受益）
  const hemi = new THREE.HemisphereLight(srgb('#8ab4d8'), srgb('#1b2530'), 0.95);
  lights.add(hemi);

  // 主光：仅由「机架 + 外壳板」投射阴影（见 stage.js 阴影策略）
  const key = new THREE.DirectionalLight(srgb('#dceaff'), 2.1);
  key.position.set(BOUNDS.center.x - 40, BOUNDS.center.y + 70, 90);
  key.target.position.set(BOUNDS.center.x, BOUNDS.center.y, 0);
  if (quality.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const d = 95;
    key.shadow.camera.left = -d; key.shadow.camera.right = d;
    key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
    key.shadow.camera.near = 20; key.shadow.camera.far = 340;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.05;
  }
  lights.add(key, key.target);

  const fill = new THREE.DirectionalLight(srgb('#9cc2e2'), 0.85);
  fill.position.set(BOUNDS.center.x + 70, BOUNDS.center.y - 24, 66);
  lights.add(fill);

  const rim = new THREE.DirectionalLight(srgb('#ffd9a8'), 1.15);
  rim.position.set(BOUNDS.center.x + 24, BOUNDS.center.y + 34, -120);
  lights.add(rim);

  // 从观察侧（+Z）补一盏，保证剖切缺口内的结构有正面照度
  const front = new THREE.DirectionalLight(srgb('#cfe0f2'), 0.62);
  front.position.set(BOUNDS.center.x, BOUNDS.center.y + 10, 150);
  lights.add(front);

  // 各子系统内部实用光：让每个镜头都有可读的近景照度
  const accents = [
    { p: [PLASMA.x + 9, 7, 12], c: '#7fb8e8', i: 220, d: 46 },
    { p: [PLASMA.x - 6, 4, 11], c: '#6fa8dc', i: 180, d: 40 },
    { p: [PLASMA.x, 12.5, 9], c: '#a9cbe8', i: 150, d: 30 },
    { p: [PLASMA.x + 2.5, 6.5, 8], c: '#9dc4e4', i: 130, d: 26 },
    { p: [PLASMA.x - 2.5, -5.5, 8], c: '#7fa0bc', i: 100, d: 24 },
    { p: [PLASMA.x, -11.5, 9], c: '#6f90ac', i: 90, d: 26 },
    { p: [-18, 5.5, 11], c: '#83bde8', i: 150, d: 36 },
    { p: [ILLUMINATOR.fieldFacet.x + 3, ILLUMINATOR.fieldFacet.y + 4, 12], c: '#8cc4f0', i: 160, d: 40 },
    { p: [ILLUMINATOR.pupilFacet.x - 3, ILLUMINATOR.pupilFacet.y + 4, 12], c: '#8cc4f0', i: 140, d: 36 },
    { p: [MASK.pos.x + 5, MASK.pos.y - 5, 11], c: '#9ed0f8', i: 200, d: 34 },
    { p: [POB[1].pos.x + 7, POB[1].pos.y, 13], c: '#88bce8', i: 180, d: 44 },
    { p: [POB[4].pos.x + 7, POB[4].pos.y, 13], c: '#88bce8', i: 180, d: 44 },
    { p: [WAFER.pos.x + 4, WAFER.pos.y + 7, 11], c: '#a8d8ff', i: 210, d: 32 },
  ];
  for (const a of accents) {
    const l = new THREE.PointLight(srgb(a.c), a.i, a.d, 2);
    l.position.set(...a.p);
    lights.add(l);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 场景内容
// ═══════════════════════════════════════════════════════════════════
const stage = buildStage(scene, mats, quality);
const sourceFX = buildSourceFX(scene, quality);
const beamFX = buildBeamFX(scene, quality);
const exposureFX = buildExposureFX(scene, stage, quality);

// ═══════════════════════════════════════════════════════════════════
// 摄影机 / 后处理 / HUD / 音频
// ═══════════════════════════════════════════════════════════════════
const rig = createCameraRig(SIZE.w / SIZE.h);
const post = buildPostFX(renderer, scene, rig.camera, quality, { width: SIZE.pw, height: SIZE.ph });
const hud = createHUD(SIZE.pw, SIZE.ph, OPT.lang);
const audio = createAudio();
audio.setMuted(OPT.muted);

const inspect = createInspectCamera(SIZE.w / SIZE.h, canvas, OrbitControls, BOUNDS.center);
inspect.controls.enabled = false;

// ═══════════════════════════════════════════════════════════════════
// 播放状态
// ═══════════════════════════════════════════════════════════════════
const P = {
  time: Math.max(0, Math.min(TIMELINE.duration, OPT.startTime)),
  playing: false,
  speed: 1,
  inspectMode: false,
  frame: 0,
  lastWall: 0,
  captureMode: OPT.captureMode,
  fps: FILM.fps,
  stats: { fps: 0, ms: 0, frames: 0 },
};

// ═══════════════════════════════════════════════════════════════════
// 核心：把时间映射为完整画面状态（纯函数）
// ═══════════════════════════════════════════════════════════════════
const _v = new THREE.Vector3();

function setTime(t) {
  P.time = Math.max(0, Math.min(TIMELINE.duration, t));
  P.frame = Math.round(P.time * FILM.fps);

  const pose = rig.apply(P.time);
  const { shot, local, fx } = pose;

  // —— 后处理参数 ——
  post.setFrame(P.frame);
  post.setFocus(pose.focus);
  if (pose.aperture !== undefined) post.setAperture(pose.aperture);
  else post.setAperture(quality.dof.aperture);
  post.setFade(fx.fade ?? 0);
  post.setFlash(fx.flash ?? 0);
  post.setLetterbox(fx.letterbox ?? 0);
  if (shot.grade) post.setGrade(shot.grade);
  if (shot.bloom) {
    const b = shot.bloom;
    post.setBloom({
      strength: Array.isArray(b.strength) ? b.strength[0] + (b.strength[1] - b.strength[0]) * local : b.strength,
      threshold: Array.isArray(b.threshold) ? b.threshold[0] + (b.threshold[1] - b.threshold[0]) * local : b.threshold,
    });
  } else {
    post.setBloom(quality.bloom);
  }

  // —— 外壳板溶解 ——
  const housing = fx.housing ?? 0;
  stage.moving.housingMat.opacity = housing;
  stage.moving.housingMat.transparent = housing < 0.999;
  stage.moving.housingMat.depthWrite = housing > 0.5;
  for (const p of stage.housing) p.visible = housing > 0.004;

  // —— 光源模块 FX ——
  sourceFX.update(P.time, {
    dropletFlow: fx.dropletFlow, dropletSpeed: fx.dropletSpeed,
    heroPos: fx.heroPos, heroVisible: fx.heroVisible, pancake: fx.pancake,
    plasma: fx.plasma, prePulse: fx.prePulse, mainPulse: fx.mainPulse,
    laserUpstream: fx.laserUpstream,
    euvHead: fx.euvHead, euvSteady: fx.euvSteady,
    spray: fx.spray, spraySteady: fx.spraySteady, collected: fx.collected,
    gas: fx.gas,
  });

  // —— 下游光路 FX ——
  beamFX.update(P.time, {
    head: fx.beamHead ?? 0,
    intensity: fx.beamIntensity ?? 0,
    slit: fx.slit ?? 0,
    field: fx.field ?? 0,
    scanPhase: fx.scanPhase ?? 0,
  });

  // —— 曝光 FX ——
  exposureFX.update(P.time, {
    latent: fx.latent, develop: fx.develop, scan: fx.scan,
    chips: fx.chips, resist: fx.resist, maskGlow: fx.maskGlow,
  });

  // —— 掩模台 / 晶圆台同步扫描：掩模 4× 反向（PARAMS.scanRatio）——
  const ph = fx.scanPhase ?? 0;
  const waferStroke = WAFER.field.h * 0.42;
  if (stage.moving.waferHolder) {
    const base = stage.moving.waferHolder.userData.basePos ||= stage.moving.waferHolder.position.clone();
    stage.moving.waferHolder.position.copy(base);
    stage.moving.waferHolder.translateY(-ph * waferStroke);
  }
  if (stage.moving.maskHolder) {
    const base = stage.moving.maskHolder.userData.basePos ||= stage.moving.maskHolder.position.clone();
    stage.moving.maskHolder.position.copy(base);
    stage.moving.maskHolder.translateY(ph * waferStroke * 4);
  }

  // —— 弧形狭缝跟随台面 ——
  if (beamFX.maskSlit.visible) {
    beamFX.maskSlit.position.copy(new THREE.Vector3(MASK.pos.x, MASK.pos.y, MASK.pos.z));
    beamFX.maskSlit.quaternion.copy(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(MASK.normal.x, MASK.normal.y, MASK.normal.z)));
    beamFX.maskSlit.translateY(ph * waferStroke * 4);
    beamFX.maskSlit.translateZ(0.06);
  }
  if (beamFX.waferSlit.visible) {
    beamFX.waferSlit.position.copy(new THREE.Vector3(WAFER.pos.x, WAFER.pos.y, WAFER.pos.z));
    beamFX.waferSlit.quaternion.copy(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(WAFER.normal.x, WAFER.normal.y, WAFER.normal.z)));
    beamFX.waferSlit.translateY(-ph * waferStroke);
    beamFX.waferSlit.translateZ(0.05);
  }
  // —— 缩比对照方框 ——
  if (beamFX.maskField.visible) {
    beamFX.maskField.position.set(MASK.pos.x, MASK.pos.y, MASK.pos.z);
    beamFX.maskField.quaternion.copy(beamFX.maskSlit.quaternion);
    beamFX.maskField.translateZ(0.08);
  }
  if (beamFX.waferField.visible) {
    beamFX.waferField.position.set(WAFER.pos.x, WAFER.pos.y, WAFER.pos.z);
    beamFX.waferField.quaternion.copy(beamFX.waferSlit.quaternion);
    beamFX.waferField.translateZ(0.07);
  }

  // —— HUD ——
  const anchors = buildAnchors(shot, local, fx);
  hud.render({
    time: P.time, frame: P.frame, shot, local,
    camera: P.inspectMode ? inspect.camera : rig.camera,
    fx, anchors,
  });

  updateUI(shot, local);
  return pose;
}

/** 依据当前镜头挑选需要 3D 锚定的标签 */
function buildAnchors(shot, local, fx) {
  const A = [];
  const fade = (from, to) => Math.max(0, Math.min(1, (local - from) / Math.max(0.001, to - from)));
  switch (shot.hud?.label) {
    case 'DROPLET_GEN':
      A.push({ pos: { x: PLASMA.x, y: 14.4, z: 0 }, zh: '锡滴发生器', en: 'Droplet Generator', dx: 100, dy: -50, a: fade(0.05, 0.2) });
      A.push({ pos: { x: PLASMA.x, y: -13.0, z: 0 }, zh: '锡滴捕集器', en: 'Droplet Catcher', dx: 92, dy: 40, a: fade(0.5, 0.68) });
      break;
    case 'DROPLET_JET':
      A.push({ pos: PLASMA, zh: '等离子体生成点', en: 'Plasma Site', dx: 104, dy: -58, a: fade(0.35, 0.55) });
      A.push({ pos: { x: PLASMA.x - 8, y: 0, z: 0 }, zh: '集光镜中心孔（激光通路）', en: 'Collector Aperture (laser path)', dx: -150, dy: -66, a: fade(0.62, 0.82) });
      break;
    case 'PRE_PULSE':
      A.push({ pos: PLASMA, zh: '预脉冲：压扁成圆盘', en: 'Pre-pulse: flatten to a disc', dx: 96, dy: -62, a: fade(0.42, 0.6) });
      break;
    case 'MAIN_PULSE':
      A.push({ pos: PLASMA, zh: '主脉冲：汽化成等离子体', en: 'Main pulse: vaporise to plasma', dx: 100, dy: -66, a: fade(0.36, 0.54) });
      break;
    case 'EUV_EMISSION':
      A.push({ pos: PLASMA, zh: '13.5 nm EUV（4π 辐射）', en: '13.5 nm EUV (4π emission)', dx: 108, dy: -70, a: fade(0.2, 0.4) });
      break;
    case 'COLLECTOR':
      A.push({ pos: CHAIN_BY_KEY.COLLECTOR.pos, zh: 'Mo/Si 多层膜反射面', en: 'Mo/Si Multilayer Surface', dx: 118, dy: -60, a: fade(0.3, 0.5) });
      A.push({ pos: PLASMA, zh: '椭球第一焦点', en: 'First Focus', dx: 96, dy: 66, a: fade(0.78, 0.94) });
      break;
    case 'IF':
      A.push({ pos: PLASMA, zh: '第一焦点', en: 'First Focus', dx: -110, dy: -56, a: fade(0.05, 0.2) });
      break;
    case 'PURITY':
      A.push({ pos: { x: -19, y: 3.4, z: 0 }, zh: '氢气气流（碎屑防护）', en: 'Hydrogen Flow (debris mitigation)', dx: 104, dy: -62, a: fade(0.22, 0.42) });
      A.push({ pos: { x: -14.2, y: -2.4, z: 0 }, zh: '光谱纯化', en: 'Spectral Purity', dx: 96, dy: 54, a: fade(0.55, 0.72) });
      break;
    case 'ILLUMINATOR':
      A.push({ pos: ILLUMINATOR.fieldFacet, zh: '场面镜', en: 'Field Facet Mirror', dx: 96, dy: -56, a: fade(0.14, 0.3) });
      A.push({ pos: ILLUMINATOR.pupilFacet, zh: '光瞳面镜', en: 'Pupil Facet Mirror', dx: -128, dy: -50, a: fade(0.3, 0.46) });
      A.push({ pos: ILLUMINATOR.lastMirror, zh: '照明末镜', en: 'Relay Mirror', dx: 100, dy: 52, a: fade(0.44, 0.6) });
      break;
    case 'MASK':
      A.push({ pos: MASK.pos, zh: '反射式多层膜掩模', en: 'Reflective Multilayer Mask', dx: 104, dy: -74, a: fade(0.06, 0.22) });
      break;
    case 'POB':
      for (let i = 0; i < POB.length; i++) {
        A.push({
          pos: POB[i].pos, zh: POB[i].label, en: POB[i].label,
          dx: i % 2 ? -66 : 66, dy: i % 2 ? -34 : 34, a: fade(0.08 + i * 0.045, 0.16 + i * 0.045),
        });
      }
      break;
    case 'WAFER':
      A.push({ pos: WAFER.pos, zh: '晶圆 / 光刻胶', en: 'Wafer / Photoresist', dx: 104, dy: -64, a: fade(0.08, 0.24) });
      break;
    case 'CHIP':
      A.push({ pos: WAFER.pos, zh: '显影后的芯片图形', en: 'Developed Circuit Pattern', dx: 108, dy: -70, a: fade(0.4, 0.58) });
      break;
    default: break;
  }
  return A;
}

// ═══════════════════════════════════════════════════════════════════
// 渲染
// ═══════════════════════════════════════════════════════════════════
function renderFrame() {
  const cam = P.inspectMode ? inspect.camera : rig.camera;
  post.renderPass.camera = cam;
  if (post.bokeh) post.bokeh.camera = cam;
  post.composer.render();
  // HUD 叠加层
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(hud.scene, hud.camera);
  renderer.autoClear = true;
}

// ═══════════════════════════════════════════════════════════════════
// 主循环
// ═══════════════════════════════════════════════════════════════════
function loop(wall) {
  requestAnimationFrame(loop);
  if (P.captureMode) return;          // 捕获模式由 capture.js 驱动

  const t0 = performance.now();
  if (P.playing) {
    const audioT = audio.currentTime();
    if (audioT !== null && Math.abs(audioT - P.time) < 1.2) {
      P.time = audioT;                // 以音频时钟为准 → 音画不漂移
    } else {
      const dt = P.lastWall ? Math.min(0.1, (wall - P.lastWall) / 1000) : 0;
      P.time += dt * P.speed;
    }
    if (P.time >= TIMELINE.duration) { P.time = TIMELINE.duration; pause(); }
  }
  P.lastWall = wall;

  if (P.inspectMode) inspect.controls.update();
  setTime(P.time);
  renderFrame();

  const ms = performance.now() - t0;
  P.stats.ms = P.stats.ms * 0.9 + ms * 0.1;
  P.stats.fps = 1000 / Math.max(1e-3, P.stats.ms);
  P.stats.frames++;
}

// ═══════════════════════════════════════════════════════════════════
// 交互 UI
// ═══════════════════════════════════════════════════════════════════
const ui = {};
function bindUI() {
  ui.play = document.getElementById('btn-play');
  ui.scrub = document.getElementById('scrub');
  ui.time = document.getElementById('time-readout');
  ui.shot = document.getElementById('shot-readout');
  ui.lang = document.getElementById('sel-lang');
  ui.quality = document.getElementById('sel-quality');
  ui.inspect = document.getElementById('btn-inspect');
  ui.mute = document.getElementById('btn-mute');
  ui.stats = document.getElementById('stats');
  ui.chapters = document.getElementById('chapters');

  ui.play.addEventListener('click', () => (P.playing ? pause() : play()));
  ui.scrub.max = String(TIMELINE.duration);
  ui.scrub.addEventListener('input', () => {
    const t = parseFloat(ui.scrub.value);
    const wasPlaying = P.playing;
    if (wasPlaying) audio.play(t);
    P.time = t;
    setTime(t);
    if (!wasPlaying) renderFrame();
  });
  ui.lang.value = OPT.lang;
  ui.lang.addEventListener('change', () => { hud.setLang(ui.lang.value); setTime(P.time); renderFrame(); });
  ui.quality.value = OPT.quality;
  ui.quality.addEventListener('change', () => {
    const u = new URL(location.href);
    u.searchParams.set('q', ui.quality.value);
    u.searchParams.set('t', P.time.toFixed(2));
    location.href = u.toString();
  });
  ui.inspect.addEventListener('click', () => {
    P.inspectMode = !P.inspectMode;
    inspect.controls.enabled = P.inspectMode;
    ui.inspect.classList.toggle('active', P.inspectMode);
    ui.inspect.textContent = P.inspectMode ? '返回成片机位' : '自由观察';
  });
  ui.mute.addEventListener('click', () => {
    const m = !ui.mute.classList.contains('active');
    ui.mute.classList.toggle('active', m);
    audio.setMuted(m);
    ui.mute.textContent = m ? '取消静音' : '静音';
  });

  // 章节跳转
  for (const sp of stepSpans()) {
    const step = PROCESS_STEPS.find((s) => s.key === sp.step);
    const b = document.createElement('button');
    b.className = 'chapter';
    b.innerHTML = `<i>${String(step.order).padStart(2, '0')}</i><span>${step.zh}</span>`;
    b.addEventListener('click', () => { seek(sp.start + 0.05); });
    ui.chapters.appendChild(b);
  }

  window.addEventListener('keydown', (e) => {
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); P.playing ? pause() : play(); }
    if (e.code === 'ArrowRight') seek(P.time + (e.shiftKey ? 10 : 1 / FILM.fps));
    if (e.code === 'ArrowLeft') seek(P.time - (e.shiftKey ? 10 : 1 / FILM.fps));
    if (e.code === 'Home') seek(0);
    if (e.code === 'KeyI') ui.inspect.click();
    if (e.code === 'KeyM') ui.mute.click();
    if (e.code === 'KeyH') document.body.classList.toggle('hide-ui');
  });
}

function updateUI(shot, local) {
  if (!ui.time) return;
  const f = Math.round(P.time * FILM.fps);
  const mm = String(Math.floor(P.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(P.time % 60)).padStart(2, '0');
  const ff = String(f % FILM.fps).padStart(2, '0');
  ui.time.textContent = `${mm}:${ss}:${ff}  ·  帧 ${f} / ${TIMELINE.frames}`;
  ui.shot.textContent = `${shot.id} ${shot.name}`;
  if (document.activeElement !== ui.scrub) ui.scrub.value = String(P.time);
  ui.stats.textContent = `${P.stats.fps.toFixed(0)} fps · ${P.stats.ms.toFixed(1)} ms · ${OPT.quality} · ${SIZE.pw}×${SIZE.ph}`;
}

function play() {
  P.playing = true;
  P.lastWall = 0;
  audio.play(P.time);
  ui.play.textContent = '暂停';
  ui.play.classList.add('active');
}
function pause() {
  P.playing = false;
  audio.stop();
  ui.play.textContent = '播放';
  ui.play.classList.remove('active');
}
function seek(t) {
  const tt = Math.max(0, Math.min(TIMELINE.duration, t));
  P.time = tt;
  if (P.playing) audio.play(tt);
  setTime(tt);
  renderFrame();
}

// ═══════════════════════════════════════════════════════════════════
// 尺寸自适应
// ═══════════════════════════════════════════════════════════════════
function onResize() {
  SIZE = computeSize();
  renderer.setPixelRatio(SIZE.dpr);
  renderer.setSize(SIZE.w, SIZE.h, true);
  rig.setAspect(SIZE.w / SIZE.h);
  inspect.camera.aspect = SIZE.w / SIZE.h;
  inspect.camera.updateProjectionMatrix();
  post.setSize(SIZE.pw, SIZE.ph);
  hud.resize(SIZE.pw, SIZE.ph);
  setTime(P.time);
  renderFrame();
}
window.addEventListener('resize', onResize);

// ═══════════════════════════════════════════════════════════════════
// 对外接口（capture.js / 测试 / 评审工具使用）
// ═══════════════════════════════════════════════════════════════════
window.__EUV__ = {
  THREE, renderer, scene, rig, post, hud, stage, sourceFX, beamFX, exposureFX,
  audio, quality, OPT, P, TIMELINE,
  setTime, renderFrame, play, pause, seek,
  get canvas() { return renderer.domElement; },
  setRenderSize(w, h) {
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    rig.setAspect(w / h);
    post.setSize(w, h);
    hud.resize(w, h);
  },
  restoreRenderSize() { onResize(); },
  ready: true,
};

bindUI();
setTime(P.time);
renderFrame();
requestAnimationFrame(loop);

// 首帧就绪后移除加载遮罩
requestAnimationFrame(() => {
  const l = document.getElementById('loading');
  if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 700); }
  if (OPT.autoplay && !OPT.captureMode) {
    // 浏览器自动播放策略：等待首次用户交互再启动音频
    const kick = () => { play(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    P.playing = true; P.lastWall = 0;
    ui.play.textContent = '暂停'; ui.play.classList.add('active');
  }
});

console.log(`[EUV] 就绪 · ${TIMELINE.shots.length} 镜头 / ${TIMELINE.duration}s / ${TIMELINE.frames} 帧 · 质量档 ${OPT.quality}`);
console.log(`[EUV] 集光镜采样光线 ${sourceFX.collectedRayCount} 条，全部几何收敛于中间焦点`);
