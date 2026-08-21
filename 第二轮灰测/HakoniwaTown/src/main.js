/**
 * 箱庭小镇 · 入口
 * 组装地形 / 水系 / 小镇 / 生活 / 天空 / 粒子，并驱动昼夜循环与交互。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, lerp, damp, TAU } from './lib/utils.js';
import { windUniforms } from './lib/wind.js';
import { buildTerrain } from './world/terrain.js';
import { buildWater, riverSurfaceAt } from './world/water.js';
import { buildTown } from './world/town.js';
import { buildLife } from './world/life.js';
import { buildSky } from './world/sky.js';
import {
  buildSmoke, buildJets, buildMist, buildFireflies, buildHalos, buildTrainSmoke,
  buildNightLights, pointScale,
} from './world/effects.js';
import { makeRailCurve } from './world/layout.js';

const canvas = document.getElementById('scene');
const hud = {
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loadingText'),
  clock: document.getElementById('clockLabel'),
  phase: document.getElementById('phaseLabel'),
  slider: document.getElementById('timeSlider'),
  play: document.getElementById('playBtn'),
  speed: document.getElementById('speedSel'),
  fps: document.getElementById('fpsLabel'),
  stats: document.getElementById('statsLabel'),
  presets: document.querySelectorAll('[data-time]'),
  views: document.querySelectorAll('[data-view]'),
  shadow: document.getElementById('shadowSel'),
  spin: document.getElementById('spinBtn'),
  panel: document.getElementById('panel'),
  toggleUI: document.getElementById('toggleUI'),
  info: document.getElementById('infoCard'),
  infoBtn: document.getElementById('infoBtn'),
};

const setLoading = (msg) => { if (hud.loadingText) hud.loadingText.textContent = msg; };

/* ---------------------------------------------------------- renderer */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 900);
camera.position.set(56, 40, 62);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 5.5, 2);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 22;
controls.maxDistance = 165;
controls.maxPolarAngle = Math.PI * 0.492;
controls.minPolarAngle = 0.12;
controls.panSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.autoRotateSpeed = 0.35;

/* ---------------------------------------------------------- 世界 */
setLoading('雕刻台地与河谷…');
const terrain = buildTerrain(scene);
const railCurve = makeRailCurve();

setLoading('注入海水与溪流…');
const water = buildWater(scene);

setLoading('建造街区与屋顶…');
const town = buildTown(scene, { railCurve, roadCurve: terrain.roadCurve });

setLoading('让小镇活起来…');
const life = buildLife(scene, { railCurve, roadCurve: terrain.roadCurve, riverSurfaceAt });

setLoading('点亮天空与灯火…');
const sky = buildSky(scene, renderer);

const smoke = buildSmoke(scene, town.chimneys);
const jets = buildJets(scene, town.jets);
const mist = buildMist(scene, water.falls);
const fireflies = buildFireflies(scene, town.fireflySpots);
const halos = buildHalos(scene, town.lampSpots, '#ffd9a0', 2.6);
const trainSmoke = buildTrainSmoke(scene, 54);
const nightLights = buildNightLights(scene, town.nightLightSpots);

/* ---------------------------------------------------------- 环境反射（随天色更新） */
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const ENV_W = 24, ENV_H = 12;
const envData = new Float32Array(ENV_W * ENV_H * 4);
const envTex = new THREE.DataTexture(envData, ENV_W, ENV_H, THREE.RGBAFormat, THREE.FloatType);
envTex.mapping = THREE.EquirectangularReflectionMapping;
let envRT = null;
const envGround = new THREE.Color();
function updateEnv() {
  const top = sky.dome.material.uniforms.uTop.value;
  const bot = sky.dome.material.uniforms.uBot.value;
  envGround.copy(bot).lerp(new THREE.Color('#4a4436'), 0.65);
  const k = 0.5;
  for (let y = 0; y < ENV_H; y++) {
    const t = y / (ENV_H - 1);
    let r, g, b;
    if (t < 0.45) {
      const u = t / 0.45;
      r = lerp(envGround.r, bot.r, u); g = lerp(envGround.g, bot.g, u); b = lerp(envGround.b, bot.b, u);
    } else {
      const u = (t - 0.45) / 0.55;
      r = lerp(bot.r, top.r, u); g = lerp(bot.g, top.g, u); b = lerp(bot.b, top.b, u);
    }
    for (let x = 0; x < ENV_W; x++) {
      const i = (y * ENV_W + x) * 4;
      envData[i] = r * k; envData[i + 1] = g * k; envData[i + 2] = b * k; envData[i + 3] = 1;
    }
  }
  envTex.needsUpdate = true;
  const rt = pmrem.fromEquirectangular(envTex);
  scene.environment = rt.texture;
  if (envRT) envRT.dispose();
  envRT = rt;
}

/* ---------------------------------------------------------- 时间状态 */
const state = {
  hours: 8.6,
  playing: true,
  speed: 1,
  autoRotate: false,
  minutesPerSecond: 6,   // 1 秒 = 6 分钟 → 1 天 ≈ 4 分钟
};

const VIEWS = {
  all: { pos: [56, 40, 62], target: [0, 5.5, 2] },
  harbor: { pos: [10, 15, 52], target: [1, 3, 24] },
  plaza: { pos: [12, 18, 30], target: [1, 7, 0] },
  hill: { pos: [-44, 30, -6], target: [-16, 13, -19] },
  station: { pos: [48, 22, 4], target: [24, 9, 6] },
  fair: { pos: [44, 22, 44], target: [22, 5, 20] },
};
let camGoal = null;

function applyView(name) {
  const v = VIEWS[name];
  if (!v) return;
  camGoal = {
    pos: new THREE.Vector3(...v.pos),
    target: new THREE.Vector3(...v.target),
    t: 0,
  };
}

const PHASES = [
  [0, '深夜'], [4.4, '黎明前'], [5.8, '日出'], [7.6, '清晨'], [10.5, '上午'],
  [12, '正午'], [14.5, '午后'], [17, '黄昏前'], [18.2, '日落'], [19.6, '暮色'], [21, '夜晚'],
];
function phaseName(h) {
  let n = PHASES[0][1];
  for (const [t, name] of PHASES) if (h >= t) n = name;
  return n;
}
function fmtClock(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/* ---------------------------------------------------------- UI */
function syncHud() {
  if (hud.clock) hud.clock.textContent = fmtClock(state.hours);
  if (hud.phase) hud.phase.textContent = phaseName(state.hours);
  if (hud.slider) hud.slider.value = String(state.hours);
  if (hud.play) hud.play.textContent = state.playing ? '⏸ 暂停时间' : '▶ 播放时间';
}

if (hud.slider) {
  hud.slider.addEventListener('input', () => {
    state.hours = parseFloat(hud.slider.value);
    syncHud();
  });
}
if (hud.play) hud.play.addEventListener('click', () => { state.playing = !state.playing; syncHud(); });
if (hud.speed) hud.speed.addEventListener('change', () => { state.speed = parseFloat(hud.speed.value); });
hud.presets.forEach((b) => b.addEventListener('click', () => {
  state.hours = parseFloat(b.dataset.time);
  syncHud();
}));
hud.views.forEach((b) => b.addEventListener('click', () => {
  applyView(b.dataset.view);
  hud.views.forEach((x) => x.classList.toggle('active', x === b));
}));
if (hud.spin) hud.spin.addEventListener('click', () => {
  state.autoRotate = !state.autoRotate;
  controls.autoRotate = state.autoRotate;
  hud.spin.classList.toggle('active', state.autoRotate);
});
if (hud.shadow) hud.shadow.addEventListener('change', () => {
  const v = hud.shadow.value;
  if (v === 'off') {
    renderer.shadowMap.enabled = false;
  } else {
    renderer.shadowMap.enabled = true;
    sky.sun.shadow.mapSize.set(v === 'high' ? 2048 : 1024, v === 'high' ? 2048 : 1024);
    if (sky.sun.shadow.map) { sky.sun.shadow.map.dispose(); sky.sun.shadow.map = null; }
  }
  scene.traverse((o) => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
});
if (hud.toggleUI) hud.toggleUI.addEventListener('click', () => document.body.classList.toggle('hide-ui'));
if (hud.infoBtn) hud.infoBtn.addEventListener('click', () => hud.info.classList.toggle('open'));

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); state.playing = !state.playing; syncHud(); }
  else if (e.key === '1') { state.hours = 6.3; syncHud(); }
  else if (e.key === '2') { state.hours = 12; syncHud(); }
  else if (e.key === '3') { state.hours = 18.4; syncHud(); }
  else if (e.key === '4') { state.hours = 22.5; syncHud(); }
  else if (e.key === 'r' || e.key === 'R') applyView('all');
  else if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('hide-ui');
});

window.addEventListener('resize', onResize);
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  pointScale.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
}
onResize();

/* ---------------------------------------------------------- 循环 */
const clk = new THREE.Clock();
let elapsed = 0;
let smokeAcc = 0;
let envAcc = 99;
let fpsAcc = 0, fpsFrames = 0;
const smokeP = new THREE.Vector3();
const smokeF = new THREE.Vector3();

/* URL 参数（便于截图与调试）：?t=22.5&view=plaza&play=0&hud=0 */
{
  const q = new URLSearchParams(location.search);
  if (q.has('t')) state.hours = clamp(parseFloat(q.get('t')) || 0, 0, 23.99);
  if (q.get('play') === '0') state.playing = false;
  if (q.get('hud') === '0') document.body.classList.add('hide-ui');
  const v = q.get('view');
  if (v && VIEWS[v]) {
    camera.position.set(...VIEWS[v].pos);
    controls.target.set(...VIEWS[v].target);
  }
  const cam = q.get('cam');
  if (cam) {
    const n = cam.split(',').map(Number);
    if (n.length >= 6 && n.every((x) => Number.isFinite(x))) {
      camera.position.set(n[0], n[1], n[2]);
      controls.target.set(n[3], n[4], n[5]);
    }
  }
}

sky.apply(state.hours, 0);
updateEnv();
syncHud();

function frame() {
  const dt = Math.min(clk.getDelta(), 0.066);
  elapsed += dt;

  if (state.playing) {
    state.hours = (state.hours + (dt * state.speed * state.minutesPerSecond) / 60) % 24;
  }

  sky.apply(state.hours, elapsed);
  sky.update(dt, elapsed);
  const night = sky.state.night;

  envAcc += dt;
  if (envAcc > 0.5) { envAcc = 0; updateEnv(); }

  windUniforms.uTime.value = elapsed;
  windUniforms.uStrength.value = 0.85 + Math.sin(elapsed * 0.23) * 0.35;

  water.update(elapsed);
  town.update(dt, elapsed, night, state.hours);
  life.update(dt, elapsed, night);

  smoke.update(dt, elapsed, night);
  jets.update(dt, elapsed, night);
  mist.update(dt, elapsed, night);
  fireflies.update(dt, elapsed, night);
  halos.update(dt, elapsed, night);
  nightLights.update(dt, elapsed, night);

  // 火车汽笛烟
  smokeAcc += dt;
  const loco = life.train.cars[0];
  if (smokeAcc > 0.085 && loco) {
    smokeAcc = 0;
    smokeP.set(loco.smoke.x, loco.smoke.y, loco.smoke.z);
    loco.obj.localToWorld(smokeP);
    smokeF.set(0, 0, 1).applyQuaternion(loco.obj.quaternion);
    trainSmoke.emit(smokeP.x, smokeP.y, smokeP.z, -smokeF.x * 1.6, -smokeF.z * 1.6);
  }
  trainSmoke.update(dt);

  // 镜头过渡
  if (camGoal) {
    camGoal.t += dt;
    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(camGoal.pos, k);
    controls.target.lerp(camGoal.target, k);
    if (camGoal.t > 2.4 || camera.position.distanceTo(camGoal.pos) < 0.4) camGoal = null;
  }
  controls.update();

  renderer.render(scene, camera);

  // HUD
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 0.5) {
    if (hud.fps) hud.fps.textContent = `${Math.round(fpsFrames / fpsAcc)} FPS`;
    fpsAcc = 0; fpsFrames = 0;
    syncHud();
  }
  requestAnimationFrame(frame);
}

/* 首帧统计 */
let meshCount = 0, triCount = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshCount++;
  const g = o.geometry;
  if (g && g.attributes.position) triCount += (g.index ? g.index.count : g.attributes.position.count) / 3;
});
if (hud.stats) hud.stats.textContent = `${meshCount} 物件 · ${(triCount / 1000).toFixed(0)}k 三角面`;

renderer.compile(scene, camera);
requestAnimationFrame(() => {
  document.body.classList.add('ready');
  if (hud.loading) {
    hud.loading.classList.add('done');
    setTimeout(() => hud.loading.remove(), 900);
  }
  frame();
});

// 便于调试
window.__town = { scene, camera, renderer, sky, state, town, life, water, controls };
