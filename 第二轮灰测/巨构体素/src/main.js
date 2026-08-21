/**
 * 巨构 · MEGASTRUCTURE —— 主程序
 *
 * 三种看法，同一个构筑物：
 *   沙盘（俯瞰它是“一个东西”） / 第一视角（被它压住） / 巡航（七个命题）
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';

import { createGenerator, CFG } from './generator.js';
import { createMesher } from './mesher.js';
import {
  createAtmoUniforms, createVoxelMaterial, createSky, createCloudDeck,
  makeCloudTexture, patchAtmosphere, SKY_PRESETS, sunDirFrom,
} from './shading.js';
import { createProps } from './props.js';
import { FirstPerson } from './fps.js';
import { createCinematic } from './cinematic.js';

const VOXEL_M = 0.6;                      // 1 体素 ≈ 0.6 m
const $ = (s) => document.querySelector(s);
const el = {
  boot: $('#boot'), bootBar: $('#bootBar'), bootStep: $('#bootStep'), bootStats: $('#bootStats'),
  vpList: $('#vpList'), panel: $('#panel'), help: $('#help'), annos: $('#annos'),
  fpsHud: $('#fpsHud'), lockHint: $('#lockHint'), cineHud: $('#cineHud'),
  hAlt: $('#hAlt'), hMet: $('#hMet'), lookup: $('#lookup'), rideHint: $('#rideHint'),
  cineTitle: $('#cineTitle'), cineText: $('#cineText'), cineBar: $('#cineBar'),
  fMode: $('#fMode'), fStats: $('#fStats'), stats: $('#stats'), skyPresets: $('#skyPresets'),
};

// ════════════════════════════════════════════════════════ 渲染器
const canvas = $('#stage');
// ?readback=1：给自动化测试用（保留绘制缓冲，readPixels 才稳定）
const READBACK = new URLSearchParams(location.search).has('readback');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance', stencil: false,
  preserveDrawingBuffer: READBACK,
});
renderer.setClearColor(0x05070a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.4, 8000);
camera.position.set(900, 620, 900);

const uni = createAtmoUniforms();
const voxMat = createVoxelMaterial(uni);

// 太阳 + 天光
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 4200;
sun.shadow.camera.left = -780;
sun.shadow.camera.right = 780;
sun.shadow.camera.top = 780;
sun.shadow.camera.bottom = -780;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 1.1;
sun.target.position.set(0, 240, 0);
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight(0x5f7ea8, 0x1a1712, 0.9);
scene.add(hemi);

// 天空 / 云
const sky = createSky(uni);
scene.add(sky);
const cloudTex = makeCloudTexture(512, 11);
const clouds = createCloudDeck(uni, cloudTex);
scene.add(clouds);

// ════════════════════════════════════════════════════════ 后处理
// 体素边缘极多，抗锯齿是必需品。实测这块集显上 4×MSAA 要吃掉 ~40% 帧率，
// 所以默认走 FXAA（一遍全屏，几乎免费）；?msaa=N 可以换回硬件多重采样。
const MSAA = (() => {
  const v = Number(new URLSearchParams(location.search).get('msaa'));
  return Number.isFinite(v) && v >= 0 && v <= 8 ? v : 0;
})();
const composerRT = new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType,
  samples: MSAA,
});
const composer = new EffectComposer(renderer, composerRT);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.50, 0.80, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new FXAAPass();
fxaa.enabled = MSAA === 0;
composer.addPass(fxaa);

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uVignette: { value: 1.0 },
    uGrain: { value: 0.026 },
    uSat: { value: 1.12 },
    uContrast: { value: 1.10 },
    uCa: { value: 1.0 },
    uBars: { value: 0.0 },
    uFade: { value: 1.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uVignette, uGrain, uSat, uContrast, uCa, uBars, uFade;
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      float ca = 0.0022 * r2 * uCa;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + d * ca).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - d * ca).b;
      c *= mix(1.0, smoothstep(1.05, 0.12, r2 * 1.75), uVignette);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      float n = fract(sin(dot(vUv * uRes, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
      c += (n - 0.5) * uGrain;
      float bar = step(vUv.y, uBars) + step(1.0 - uBars, vUv.y);
      c *= (1.0 - clamp(bar, 0.0, 1.0));
      gl_FragColor = vec4(max(c, 0.0) * uFade, 1.0);
    }
  `,
};
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);

let renderScale = 1.0;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = Math.min(window.devicePixelRatio, 1.5) * renderScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  bloom.setSize(w * pr, h * pr);
  fxaa.setSize(w * pr, h * pr);
  gradePass.uniforms.uRes.value.set(w * pr, h * pr);
}
window.addEventListener('resize', resize);

// ════════════════════════════════════════════════════════ 生成世界
const state = {
  mode: 'orbit', seed: 861204, time: 0, night: 0.55,
  preset: 'dusk', sunAz: 252, sunEl: 5.5,
  showAnno: true, showProps: true, showClouds: true, shadows: true, grade: true, aa: true,
  spin: false, cineT: 0, baseFov: 50, ready: false,
  fogBase: 0.0026,      // 预设的雾浓度
  fogMode: 1,           // 当前模式的雾系数（沙盘=模型，雾少；第一视角=身处其中，雾满）
};
// 沙盘是“桌上的模型”，本就不该有几公里的空气；第一视角是“身处其中”，大气透视必须拉满
const FOG_MODE = { orbit: 0.28, fps: 1.0, cine: 0.85 };

let world = null, genData = null, cityGroup = null, props = null, anchors = [];
let orbit = null, fp = null, cine = null;

async function nextFrame() { return new Promise((r) => requestAnimationFrame(r)); }

function setBoot(p, msg, extra) {
  el.bootBar.style.width = `${(p * 100).toFixed(1)}%`;
  if (msg) el.bootStep.textContent = msg;
  if (extra !== undefined) el.bootStats.textContent = extra;
}

async function build(seed) {
  const t0 = performance.now();
  const gen = createGenerator(seed);
  world = gen.world; genData = gen.data;
  const n = gen.steps.length;
  for (let i = 0; i < n; i++) {
    const [label, run] = gen.steps[i];
    setBoot((i / n) * 0.45, label + '…');
    await nextFrame();
    run();
  }
  const tGen = performance.now() - t0;
  setBoot(0.46, '贪心网格化 · 计算环境光遮蔽…',
    `实体体素 ${genData.stats.solid.toLocaleString()} · 区块 ${genData.stats.chunks.toLocaleString()} · ${genData.stats.memoryMB.toFixed(0)} MB · ${tGen.toFixed(0)} ms`);
  await nextFrame();

  // ——— 网格化（分批，保持界面可响应）———
  const t1 = performance.now();
  const mesher = createMesher(world, 900);
  while (true) {
    const more = mesher.step();
    setBoot(0.46 + mesher.progress * 0.46, null,
      `四边形 ${mesher.quadCount.toLocaleString()} / 区块 ${mesher.total.toLocaleString()}`);
    await nextFrame();
    if (!more) break;
  }
  const sectors = mesher.finish();
  const tMesh = performance.now() - t1;

  setBoot(0.94, '上传到显卡…');
  await nextFrame();

  cityGroup = new THREE.Group();
  let verts = 0, quads = 0, bytes = 0;
  for (const s of sectors) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Int16BufferAttribute(s.position, 3));
    g.setAttribute('normal', new THREE.Int8BufferAttribute(s.normal, 3));
    g.setAttribute('aCol', new THREE.Uint8BufferAttribute(s.color, 3, true));
    g.setAttribute('aAo', new THREE.Uint8BufferAttribute(s.ao, 1, true));
    g.setAttribute('aEmi', new THREE.Uint8BufferAttribute(s.emissive, 2, true));
    g.setIndex(new THREE.Uint32BufferAttribute(s.index, 1));
    const bb = new THREE.Box3(
      new THREE.Vector3(s.bmin[0], s.bmin[1], s.bmin[2]),
      new THREE.Vector3(s.bmax[0], s.bmax[1], s.bmax[2]),
    );
    g.boundingBox = bb;
    g.boundingSphere = bb.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(g, voxMat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    cityGroup.add(m);
    verts += s.verts; quads += s.quads;
    bytes += s.position.byteLength + s.normal.byteLength + s.color.byteLength
      + s.ao.byteLength + s.emissive.byteLength + s.index.byteLength;
  }
  scene.add(cityGroup);

  props = createProps({ data: genData, uni, voxMat, cfg: CFG });
  scene.add(props.group);

  buildAnnotations();
  buildViewpointList();

  const info = [
    `体素      ${genData.stats.solid.toLocaleString()}`,
    `四边形    ${quads.toLocaleString()}`,
    `三角形    ${(quads * 2).toLocaleString()}`,
    `绘制批次  ${sectors.length}`,
    `显存缓冲  ${(bytes / 1048576).toFixed(1)} MB`,
    `生成      ${tGen.toFixed(0)} ms`,
    `网格化    ${tMesh.toFixed(0)} ms`,
    `包围盒 y  ${genData.stats.bbox[0][1]} … ${genData.stats.bbox[1][1]}`,
  ].join('\n');
  el.stats.textContent = info;
  el.fStats.textContent = `${(quads * 2 / 1e6).toFixed(2)}M 三角形 · ${sectors.length} 批次 · ${genData.stats.solid.toLocaleString()} 体素`;

  setBoot(1, '就绪');
}

// ════════════════════════════════════════════════════════ 图解标签
function buildAnnotations() {
  el.annos.innerHTML = '';
  anchors = genData.annotations.map((a) => {
    const d = document.createElement('div');
    d.className = 'anno';
    d.innerHTML = `<b>${a.title}</b><span>${a.desc}</span>`;
    el.annos.appendChild(d);
    return { a, d, v: new THREE.Vector3(a.pos[0], a.pos[1], a.pos[2]) };
  });
}

const _p = new THREE.Vector3();
let annoTick = 0;
function updateAnnotations() {
  const show = state.showAnno && state.mode !== 'cine';
  if (!show) { for (const k of anchors) k.d.classList.remove('show'); return; }
  annoTick++;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < anchors.length; i++) {
    const k = anchors[i];
    _p.copy(k.v).project(camera);
    if (_p.z > 1 || _p.x < -1.05 || _p.x > 0.82 || _p.y < -0.95 || _p.y > 0.95) {
      k.d.classList.remove('show'); continue;
    }
    if (annoTick % 4 === i % 4) {
      k.occluded = occluded(camera.position, k.v);
    }
    if (k.occluded) { k.d.classList.remove('show'); continue; }
    k.d.style.left = `${(_p.x * 0.5 + 0.5) * w}px`;
    k.d.style.top = `${(-_p.y * 0.5 + 0.5) * h}px`;
    k.d.classList.add('show');
  }
}

const _dir = new THREE.Vector3();
function occluded(from, to) {
  _dir.copy(to).sub(from);
  const dist = _dir.length();
  if (dist < 12) return false;
  _dir.divideScalar(dist);
  const step = Math.max(2, dist / 260);
  for (let t = 8; t < dist - 10; t += step) {
    const x = Math.floor(from.x + _dir.x * t);
    const y = Math.floor(from.y + _dir.y * t);
    const z = Math.floor(from.z + _dir.z * t);
    if (world.get(x, y, z) !== 0) return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════ 视点
function buildViewpointList() {
  el.vpList.innerHTML = '';
  genData.viewpoints.forEach((vp, i) => {
    if (i === 2) {
      const sep = document.createElement('div');
      sep.className = 'vp-sep';
      el.vpList.appendChild(sep);
    }
    const b = document.createElement('button');
    b.textContent = vp.name;
    b.onclick = () => gotoViewpoint(vp);
    b.dataset.vp = vp.id;
    el.vpList.appendChild(b);
  });
}

function gotoViewpoint(vp) {
  for (const b of el.vpList.querySelectorAll('button')) b.classList.toggle('on', b.dataset.vp === vp.id);
  if (vp.fov) state.baseFov = vp.fov;
  if (vp.mode === 'orbit') {
    setMode('orbit');
    orbit.target.set(vp.target[0], vp.target[1], vp.target[2]);
    const d = vp.dist, ph = vp.phi, th = vp.theta;
    camera.position.set(
      orbit.target.x + d * Math.sin(ph) * Math.sin(th),
      orbit.target.y + d * Math.cos(ph),
      orbit.target.z + d * Math.sin(ph) * Math.cos(th),
    );
    orbit.update();
  } else {
    setMode('fps');
    fp.placeAt(vp.pos, vp.yaw, vp.pitch, !!vp.fly);
  }
  syncSliders();
}

// ════════════════════════════════════════════════════════ 模式
function setMode(m) {
  state.mode = m;
  for (const b of document.querySelectorAll('#topbar .modes button')) b.classList.toggle('on', b.dataset.mode === m);
  orbit.enabled = m === 'orbit';
  fp.enabled = m === 'fps';
  el.fpsHud.classList.toggle('hidden', m !== 'fps');
  el.cineHud.classList.toggle('hidden', m !== 'cine');
  el.lockHint.classList.toggle('hidden', !(m === 'fps' && !fp.locked));
  el.fMode.textContent = m === 'orbit' ? '沙盘' : m === 'fps' ? '第一视角' : '巡航';
  if (m !== 'fps') fp.releaseLock();
  if (m === 'cine') { state.cineT = 0; }
  camera.fov = m === 'fps' ? Math.max(state.baseFov, 68) : state.baseFov;
  camera.updateProjectionMatrix();
  document.body.style.cursor = m === 'fps' ? 'none' : '';
}

// ════════════════════════════════════════════════════════ 大气 / 时间
function applyPreset(key) {
  const p = SKY_PRESETS[key];
  state.preset = key;
  state.sunAz = p.sunAz; state.sunEl = p.sunEl;
  uni.uSunCol.value.setRGB(...p.sunCol);
  uni.uZenithCol.value.setRGB(...p.zenith);
  uni.uHorizonCol.value.setRGB(...p.horizon);
  uni.uGroundCol.value.setRGB(...p.ground);
  uni.uFogDensity.value = p.fog;
  state.fogBase = p.fog;
  uni.uFogHeight.value = p.fogH;
  uni.uHaze.value = p.haze;
  uni.uNight.value = p.night;
  uni.uAmbient.value.setRGB(...p.ambient);
  uni.uBounceCol.value.setRGB(...p.bounce);
  uni.uBounceH.value = p.bounceH;
  sun.color.setRGB(...p.sunCol);
  sun.intensity = p.sunInt;
  hemi.color.setRGB(...p.hemiSky);
  hemi.groundColor.setRGB(...p.hemiGround);
  hemi.intensity = p.hemiInt;
  renderer.toneMappingExposure = p.exposure;
  state.night = p.night;
  for (const b of el.skyPresets.querySelectorAll('button')) b.classList.toggle('on', b.dataset.sky === key);
  syncSun();
  syncSliders();
}

function syncSun() {
  const d = sunDirFrom(state.sunEl, state.sunAz);
  uni.uSunDir.value.copy(d);
  sun.position.copy(d).multiplyScalar(2000).add(new THREE.Vector3(0, 240, 0));
  const p = SKY_PRESETS[state.preset];
  const fade = state.preset === 'night' ? 1 : (state.sunEl >= 0 ? 1 : Math.max(0.22, 1 + state.sunEl / 14));
  sun.intensity = p.sunInt * fade;
  if (props) props.setNight(uni.uNight.value);
  renderer.shadowMap.needsUpdate = true;
}

function syncSliders() {
  $('#sAz').value = state.sunAz; $('#oAz').textContent = `${state.sunAz.toFixed(0)}°`;
  $('#sEl').value = state.sunEl; $('#oEl').textContent = `${state.sunEl.toFixed(1)}°`;
  $('#sFog').value = Math.round(state.fogBase * 10000);
  $('#oFog').textContent = (state.fogBase * 10000).toFixed(0);
  $('#sEmi').value = Math.round(uni.uEmiScale.value * 100);
  $('#oEmi').textContent = `${Math.round(uni.uEmiScale.value * 100)}%`;
  $('#sExp').value = Math.round(renderer.toneMappingExposure * 100);
  $('#oExp').textContent = renderer.toneMappingExposure.toFixed(2);
  $('#sBloom').value = Math.round(bloom.strength * 100);
  $('#oBloom').textContent = bloom.strength.toFixed(2);
  $('#sScale').value = Math.round(renderScale * 100);
  $('#oScale').textContent = `${Math.round(renderScale * 100)}%`;
  $('#sFov').value = state.baseFov;
  $('#oFov').textContent = `${state.baseFov}°`;
}

// ════════════════════════════════════════════════════════ UI 绑定
function bindUI() {
  for (const key in SKY_PRESETS) {
    const b = document.createElement('button');
    b.textContent = SKY_PRESETS[key].name;
    b.dataset.sky = key;
    b.onclick = () => applyPreset(key);
    el.skyPresets.appendChild(b);
  }
  for (const b of document.querySelectorAll('#topbar .modes button')) {
    b.onclick = () => setMode(b.dataset.mode);
  }
  $('#btnPanel').onclick = () => el.panel.classList.toggle('hidden');
  $('#btnHelp').onclick = () => el.help.classList.remove('hidden');
  $('#helpClose').onclick = () => el.help.classList.add('hidden');

  $('#sAz').oninput = (e) => { state.sunAz = +e.target.value; syncSun(); syncSliders(); };
  $('#sEl').oninput = (e) => { state.sunEl = +e.target.value; syncSun(); syncSliders(); };
  $('#sFog').oninput = (e) => { state.fogBase = +e.target.value / 10000; syncSliders(); };
  $('#sEmi').oninput = (e) => { uni.uEmiScale.value = +e.target.value / 100; syncSliders(); };
  $('#sExp').oninput = (e) => { renderer.toneMappingExposure = +e.target.value / 100; syncSliders(); };
  $('#sBloom').oninput = (e) => { bloom.strength = +e.target.value / 100; syncSliders(); };
  $('#sScale').oninput = (e) => { renderScale = +e.target.value / 100; resize(); syncSliders(); };
  $('#sFov').oninput = (e) => {
    state.baseFov = +e.target.value;
    camera.fov = state.mode === 'fps' ? Math.max(state.baseFov, 60) : state.baseFov;
    camera.updateProjectionMatrix(); syncSliders();
  };

  const tg = (id, get, set) => {
    const b = $(id);
    b.onclick = () => { set(!get()); b.classList.toggle('on', get()); };
    b.classList.toggle('on', get());
  };
  tg('#tShadow', () => state.shadows, (v) => {
    state.shadows = v; renderer.shadowMap.enabled = v;
    cityGroup.traverse((o) => { if (o.isMesh) o.castShadow = v; });
    voxMat.needsUpdate = true; renderer.shadowMap.needsUpdate = true;
  });
  tg('#tAnno', () => state.showAnno, (v) => { state.showAnno = v; });
  tg('#tProps', () => state.showProps, (v) => { state.showProps = v; props.group.visible = v; });
  tg('#tClouds', () => state.showClouds, (v) => { state.showClouds = v; clouds.visible = v; });
  tg('#tGrade', () => state.grade, (v) => { state.grade = v; gradePass.enabled = v; });
  tg('#tAA', () => state.aa, (v) => { state.aa = v; fxaa.enabled = v && MSAA === 0; });
  tg('#tSpin', () => state.spin, (v) => { state.spin = v; orbit.autoRotate = v; });

  $('#btnReseed').onclick = async () => {
    el.boot.classList.remove('gone');
    state.ready = false;
    scene.remove(cityGroup); scene.remove(props.group);
    cityGroup.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    props.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    await nextFrame();
    state.seed = (Math.random() * 1e9) | 0;
    await build(state.seed);
    fp.world = world;
    state.ready = true;
    setTimeout(() => el.boot.classList.add('gone'), 350);
  };

  canvas.addEventListener('mousedown', () => { if (state.mode === 'fps') fp.requestLock(); });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Digit1': setMode('orbit'); break;
      case 'Digit2': setMode('fps'); break;
      case 'Digit3': setMode('cine'); break;
      case 'KeyP': el.panel.classList.toggle('hidden'); break;
      case 'KeyH': el.help.classList.toggle('hidden'); break;
      case 'KeyG':
        if (state.mode === 'fps') fp.enterRide(genData.elevators, state.time);
        break;
      case 'KeyN': {
        const keys = Object.keys(SKY_PRESETS);
        applyPreset(keys[(keys.indexOf(state.preset) + 1) % keys.length]);
        break;
      }
      default: break;
    }
  });
}

// ════════════════════════════════════════════════════════ 主循环
let prevT = performance.now();
let smoothFps = 60;
let pendingGrab = null;
const cineLook = new THREE.Vector3();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - prevT) / 1000);
  prevT = now;
  state.time += dt;
  if (!state.ready) return;

  smoothFps += ((1 / Math.max(dt, 1e-4)) - smoothFps) * 0.06;

  // 云层跟随相机（图案锁在世界坐标里，所以看不出跟随）
  for (const L of clouds.userData.layers) {
    L.mesh.position.x = camera.position.x;
    L.mesh.position.z = camera.position.z;
    L.mat.uOffset.value.x += L.speed * dt;
  }
  sky.position.copy(camera.position);

  if (state.mode === 'orbit') {
    orbit.update();
  } else if (state.mode === 'fps') {
    fp.update(dt, state.time);
    const alt = fp.pos.y;
    el.hAlt.textContent = Math.round(alt);
    el.hMet.textContent = `${(alt * VOXEL_M).toFixed(0)} m　·　巨核 ${(CFG.MAST_TOP * VOXEL_M).toFixed(0)} m`;
    el.lookup.classList.toggle('hidden', !(alt < 60 && fp.pitch < 0.34));
    el.rideHint.classList.toggle('hidden', !fp.ride);
  } else {
    state.cineT += dt;
    const s = cine.sample(state.cineT);
    camera.position.set(s.pos.x, s.pos.y, s.pos.z);
    cineLook.set(s.look.x, s.look.y, s.look.z);
    camera.lookAt(cineLook);
    if (Math.abs(camera.fov - s.fov) > 0.01) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
    el.cineTitle.textContent = s.shot.title;
    el.cineText.textContent = s.shot.text;
    el.cineTitle.style.opacity = s.fade;
    el.cineText.style.opacity = s.fade;
    el.cineBar.style.width = `${((state.cineT % cine.total) / cine.total * 100).toFixed(2)}%`;
    state.cineShot = s.shot.type;
  }

  gradePass.uniforms.uBars.value += ((state.mode === 'cine' ? 0.085 : 0.0) - gradePass.uniforms.uBars.value) * Math.min(1, dt * 6);
  gradePass.uniforms.uTime.value = state.time;
  gradePass.uniforms.uVignette.value = state.mode === 'fps' ? 1.25 : 0.9;

  // 雾随模式平滑过渡
  let targetFog = FOG_MODE[state.mode] ?? 1;
  if (state.mode === 'cine' && state.cineShot === 'orbit') targetFog = 0.34;
  state.fogMode += (targetFog - state.fogMode) * Math.min(1, dt * 3.2);
  uni.uFogDensity.value = state.fogBase * state.fogMode;

  if (state.showProps) props.update(state.time, dt);
  updateAnnotations();

  composer.render();
  if (pendingGrab) { const g = pendingGrab; pendingGrab = null; g(); }

  el.fMode.textContent = `${state.mode === 'orbit' ? '沙盘' : state.mode === 'fps' ? '第一视角' : '巡航'} · ${smoothFps.toFixed(0)} fps`;
}

// ════════════════════════════════════════════════════════ 启动
(async function boot() {
  resize();
  await nextFrame();
  await build(state.seed);

  orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.075;
  orbit.minDistance = 40;
  orbit.maxDistance = 3400;
  orbit.maxPolarAngle = Math.PI * 0.499;
  orbit.autoRotateSpeed = 0.32;
  orbit.target.set(0, 340, 0);
  orbit.zoomSpeed = 0.9;
  orbit.rotateSpeed = 0.72;

  fp = new FirstPerson(camera, world, canvas);
  fp.onLockChange = (l) => el.lockHint.classList.toggle('hidden', l || state.mode !== 'fps');
  cine = createCinematic(CFG);

  bindUI();
  applyPreset('dusk');
  gotoViewpoint(genData.viewpoints[0]);
  setMode('orbit');
  resize();
  renderer.shadowMap.needsUpdate = true;

  state.ready = true;
  setTimeout(() => el.boot.classList.add('gone'), 500);
  loop();

  // 调试 / 自动化钩子
  window.__setCineTime = (t) => { state.cineT = t; };
  window.__ds = {
    state, camera, scene, renderer, uni, orbit, fp, cine, props,
    composer, bloomPass: bloom, gradePass, sky, clouds, voxMat, sun, hemi,
    world: () => world, genData: () => genData,
    cityVisible: (v) => { cityGroup.visible = v; if (props) props.group.visible = v && state.showProps; },
  };

  /**
   * 帧抓取：在同一帧 composer.render() 之后直接 readPixels，
   * 降采样成网格返回。用于无图形界面环境下核对画面构图。
   */
  window.__grab = (gw = 80, gh = 36) => new Promise((res) => {
    pendingGrab = () => {
      const gl = renderer.getContext();
      const W = renderer.domElement.width, H = renderer.domElement.height;
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const cells = [];
      let sum = 0, mn = 255, mx = 0;
      for (let gy = 0; gy < gh; gy++) {
        const row = [];
        for (let gx = 0; gx < gw; gx++) {
          const x0 = Math.floor((gx / gw) * W), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) / gw) * W));
          // readPixels 原点在左下，翻转 y
          const y1i = H - Math.floor((gy / gh) * H);
          const y0i = Math.max(0, H - Math.floor(((gy + 1) / gh) * H));
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = y0i; y < y1i; y += 2) {
            for (let x = x0; x < x1; x += 2) {
              const i = (y * W + x) * 4;
              r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
            }
          }
          if (!n) n = 1;
          r /= n; g /= n; b /= n;
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          sum += l; if (l < mn) mn = l; if (l > mx) mx = l;
          row.push([Math.round(r), Math.round(g), Math.round(b)]);
        }
        cells.push(row);
      }
      res({ gw, gh, cells, meanLum: sum / (gw * gh), minLum: mn, maxLum: mx, fps: smoothFps });
    };
  });
})();
