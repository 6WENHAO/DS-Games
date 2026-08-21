// ---------------------------------------------------------------------------
// 入口：渲染器 / 相机 / 场景装配 / 主循环
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { labelTexture } from './lib/textures.js';
import { buildTerrain, buildWater, buildForest } from './world/terrain.js';
import { buildTown } from './world/town.js';
import { DISTRICTS } from './world/districts.js';
import { createSky } from './fx/sky.js';
import { createSmoke, createSpray, createGlows, createBirds } from './fx/particles.js';
import { initUI } from './ui/ui.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingBar = document.getElementById('loading-bar');

/* ------------------------------- 渲染器 --------------------------------- */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 2600);
camera.position.set(168, 132, 226);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 6, 6);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 14;
controls.maxDistance = 760;
controls.maxPolarAngle = Math.PI * 0.492;
controls.keyPanSpeed = 18;
controls.zoomSpeed = 0.9;

/* -------------------------------- 状态 ---------------------------------- */
const params = new URLSearchParams(location.search);
const state = {
  tod: 9.6, // 当前时刻（小时）
  auto: true, // 自动昼夜循环
  speed: 0.32, // 小时 / 秒
  labels: true,
  shadows: true,
  smoke: true,
  fps: 0,
  nightK: 0,
};

// URL 参数：?quality=low 关阴影降分辨率；?tod=21.5 指定时刻；?shadows=0
if (params.get('quality') === 'low') {
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;
  state.shadows = false;
}
if (params.get('shadows') === '0') {
  renderer.shadowMap.enabled = false;
  state.shadows = false;
}
if (params.has('tod')) {
  const v = parseFloat(params.get('tod'));
  if (Number.isFinite(v)) {
    state.tod = ((v % 24) + 24) % 24;
    state.auto = false;
  }
}
if (params.get('cycle') === '0') state.auto = false;

/* ------------------------------ 分步加载 -------------------------------- */
const steps = [];
function step(text, fn) {
  steps.push({ text, fn });
}
async function runSteps() {
  for (let i = 0; i < steps.length; i++) {
    loadingText.textContent = steps[i].text;
    loadingBar.style.width = `${Math.round((i / steps.length) * 100)}%`;
    await new Promise((r) => requestAnimationFrame(() => r()));
    steps[i].fn();
  }
  loadingBar.style.width = '100%';
}

let sky;
let town;
let smoke;
let spray;
let glows;
let birds;
let waterFx;
const labelGroup = new THREE.Group();
labelGroup.name = 'labels';
const labelSprites = [];

step('生成天空与光照…', () => {
  sky = createSky(scene);
});
step('铺设地形与河流…', () => {
  scene.add(buildTerrain());
  waterFx = buildWater();
  scene.add(waterFx.group);
});
step('种植远景森林…', () => {
  scene.add(buildForest());
});
step('营建八个片区（约 3000 个构件）…', () => {
  town = buildTown();
  scene.add(town.group);
});
step('点亮灯火、升起炊烟…', () => {
  smoke = createSmoke(town.anchors.smoke ?? []);
  scene.add(smoke.points);
  spray = createSpray(town.anchors.fountain ?? []);
  scene.add(spray.points);
  glows = createGlows(town.anchors.glow ?? []);
  scene.add(glows.points);
  birds = createBirds(20);
  scene.add(birds.mesh);
});
step('挂上区域名牌…', () => {
  for (const d of DISTRICTS) {
    const tex = labelTexture(d.name, d.en, d.color);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
    );
    sp.scale.set(36, 11.25, 1);
    sp.position.set(d.center[0], d.labelY, d.center[1]);
    sp.userData.district = d.id;
    labelSprites.push(sp);
    labelGroup.add(sp);
  }
  scene.add(labelGroup);
});

/* ------------------------------ 相机飞行 -------------------------------- */
const tween = {
  active: false,
  t: 0,
  dur: 1.9,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromTar: new THREE.Vector3(),
  toTar: new THREE.Vector3(),
};
function flyTo(pos, target, dur = 1.9) {
  tween.fromPos.copy(camera.position);
  tween.toPos.set(pos[0], pos[1], pos[2]);
  tween.fromTar.copy(controls.target);
  tween.toTar.set(target[0], target[1], target[2]);
  tween.t = 0;
  tween.dur = dur;
  tween.active = true;
}
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function focusDistrict(id) {
  const d = DISTRICTS.find((x) => x.id === id);
  if (!d) return;
  flyTo(d.view.pos, d.view.target);
  ui?.setActive(id);
}
function overview() {
  flyTo([168, 132, 226], [0, 6, 6], 2.1);
  ui?.setActive(null);
}

/* -------------------------------- UI ----------------------------------- */
let ui = null;

/* ------------------------------ 交互事件 -------------------------------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;
canvas.addEventListener('pointerdown', (e) => {
  downPos = [e.clientX, e.clientY];
});
canvas.addEventListener('pointerup', (e) => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
  downPos = null;
  if (moved > 6 || !state.labels) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(labelSprites, false)[0];
  if (hit) focusDistrict(hit.object.userData.district);
});

window.addEventListener('keydown', (e) => {
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  const n = parseInt(e.key, 10);
  if (!Number.isNaN(n)) {
    if (n === 0) overview();
    else if (DISTRICTS[n - 1]) focusDistrict(DISTRICTS[n - 1].id);
    return;
  }
  switch (e.key.toLowerCase()) {
    case ' ':
      state.auto = !state.auto;
      ui?.sync();
      e.preventDefault();
      break;
    case 'l':
      state.labels = !state.labels;
      labelGroup.visible = state.labels;
      ui?.sync();
      break;
    case 'n':
      state.tod = 21.6;
      state.auto = false;
      ui?.sync();
      break;
    case 'm':
      state.tod = 12.4;
      state.auto = false;
      ui?.sync();
      break;
    case 'h':
      document.body.classList.toggle('hide-ui');
      break;
    default:
      break;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------- 主循环 -------------------------------- */
const clock = new THREE.Clock();
let acc = 0;
let frames = 0;
let simTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  simTime += dt;

  if (state.auto) {
    state.tod = (state.tod + dt * state.speed) % 24;
  }

  // 相机补间
  if (tween.active) {
    tween.t += dt;
    const k = easeInOut(Math.min(tween.t / tween.dur, 1));
    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
    controls.target.lerpVectors(tween.fromTar, tween.toTar, k);
    if (tween.t >= tween.dur) tween.active = false;
  }
  controls.update();

  const info = sky.update(state.tod, controls.target);
  state.nightK = info.nightK;
  sky.animateClouds(dt);
  sky.setShadowRange(camera.position.distanceTo(controls.target) * 0.55 + 90);

  for (const fn of town.updates) fn(dt, simTime);
  waterFx.updates.forEach((fn) => fn(dt, simTime));
  if (state.smoke) smoke.update(dt, simTime);
  spray.update(dt, simTime);
  glows.update(dt, simTime, info.nightK);
  birds.update(dt, simTime);

  // 名牌始终朝向相机（Sprite 自动），远处淡出
  if (state.labels) {
    for (const sp of labelSprites) {
      const dist = camera.position.distanceTo(sp.position);
      sp.material.opacity = THREE.MathUtils.clamp(1.35 - dist / 620, 0.12, 1);
      const k = THREE.MathUtils.clamp(dist / 200, 0.55, 3.4);
      sp.scale.set(36 * k, 11.25 * k, 1);
    }
  }

  renderer.render(scene, camera);

  // FPS
  frames++;
  acc += dt;
  if (acc >= 0.5) {
    state.fps = Math.round(frames / acc);
    frames = 0;
    acc = 0;
  }
  ui?.tick(state, camera, controls);
}

/* -------------------------------- 启动 --------------------------------- */
(async function boot() {
  try {
    await runSteps();
    ui = initUI({
      state,
      districts: DISTRICTS,
      focusDistrict,
      overview,
      onToggleShadows: (v) => {
        renderer.shadowMap.enabled = v;
        scene.traverse((o) => {
          if (o.isMesh && o.material) o.material.needsUpdate = true;
        });
      },
      onToggleLabels: (v) => {
        labelGroup.visible = v;
      },
      stats: town.stats,
    });
    loadingText.textContent = '完成';
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 900);
    window.__TOWN__ = { scene, camera, controls, renderer, state, town, sky, flyTo, focusDistrict };
    if (params.has('view')) focusDistrict(params.get('view'));
    animate();
    window.__READY__ = true;
  } catch (err) {
    console.error(err);
    loadingText.innerHTML = `构建失败：<br><code>${err && err.message ? err.message : err}</code>`;
    loading.classList.add('error');
  }
})();
