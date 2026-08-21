// ---------------------------------------------------------------------------
// 入口：渲染 / 相机 / 交互 / 三个展示对象（塔身、斗拱详解、榫卯图解）
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MAT, setXray, setJointHighlight } from './lib/materials.js';
import { Sculptor, makeCyl } from './lib/geom.js';
import { labelTexture } from './lib/textures.js';
import { CAI, FEN, f } from './lib/cai.js';
import { buildPagoda, LAYOUT } from './pagoda/pagoda.js';
import { puzuo } from './pagoda/dougong.js';
import { buildJointBench, JOINTS } from './pagoda/joints.js';
import { initUI } from './ui/ui.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingBar = document.getElementById('loading-bar');
const params = new URLSearchParams(location.search);

/* ------------------------------- 渲染器 --------------------------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, params.get('quality') === 'low' ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = params.get('shadows') !== '0' && params.get('quality') !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.3, 1400);
camera.position.set(74, 48, 92);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 26, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 3;
controls.maxDistance = 460;
controls.maxPolarAngle = Math.PI * 0.495;

/* -------------------------------- 状态 ---------------------------------- */
const state = {
  xray: false,
  section: false,
  joints: false,
  walls: true,
  layer: 0, // 0 = 全部
  explode: 0,
  jointIndex: -1,
  fps: 0,
};

/* --------------------------- 天空 / 光照 / 地面 --------------------------- */
function buildSky() {
  const geo = new THREE.SphereGeometry(900, 32, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x7fa3c4) },
      mid: { value: new THREE.Color(0xd9d3c4) },
      bot: { value: new THREE.Color(0x8d8474) },
    },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vD;
      void main(){
        float h = vD.y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h,0.0,1.0), 0.7)) : mix(mid, bot, clamp(-h*2.4,0.0,1.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

const sun = new THREE.DirectionalLight(0xfff2dc, 2.5);
sun.position.set(90, 130, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
{
  const S = 62;
  const c = sun.shadow.camera;
  c.left = -S;
  c.right = S;
  c.top = S;
  c.bottom = -S;
  c.near = 20;
  c.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
}
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd4e8, 0x6b5a45, 0.85));
scene.add(new THREE.AmbientLight(0xffffff, 0.26));
const fill = new THREE.DirectionalLight(0xcfd8e6, 0.5);
fill.position.set(-80, 50, -60);
scene.add(fill);
scene.fog = new THREE.Fog(0xb9b3a4, 220, 900);

/* ------------------------------ 分步构建 -------------------------------- */
const steps = [];
const step = (t, fn) => steps.push({ t, fn });
async function run() {
  for (let i = 0; i < steps.length; i++) {
    loadingText.textContent = steps[i].t;
    loadingBar.style.width = `${Math.round((i / steps.length) * 100)}%`;
    await new Promise((r) => requestAnimationFrame(() => r()));
    steps[i].fn();
  }
  loadingBar.style.width = '100%';
}

let pagoda;
let info;
let bench;
const labelGroup = new THREE.Group();
const groundY = -(LAYOUT.platform.h1 + LAYOUT.platform.h2);

step('铺陈天地…', () => {
  scene.add(buildSky());
  const g = new THREE.Mesh(new THREE.CircleGeometry(420, 48), MAT.ground);
  g.rotation.x = -Math.PI / 2;
  g.position.y = groundY;
  g.receiveShadow = true;
  scene.add(g);
});

step('按材分制度立柱架梁…', () => {
  const built = buildPagoda();
  pagoda = built.group;
  info = built.info;
  scene.add(pagoda);
});

step('单朵铺作详解…', () => {
  const s = new Sculptor('铺作详解');
  s.box(MAT.stone, 4.4, 0.7, 4.4, 0, -0.7, 0, 0, 1);
  s.box(MAT.stoneDark, 4.6, 0.16, 4.6, 0, 0, 0, 0, 1);
  // 柱 + 普拍枋 + 一朵七铺作
  s.cyl(MAT.zhu, 0.27, 0.29, 1.5, 0, 0.16, 0, 16, 0, 0.7);
  s.box(MAT.fang, 3.0, f(10), f(24), 0, 1.66, 0, 0, 0.6);
  s.box(MAT.fang, 3.0, 0.42, f(18), 0, 1.24, 0, 0, 0.6); // 阑额
  s.push(0, 1.66 + f(10), 0, 0);
  const meta = puzuo(s, { jumps: ['hua', 'hua', 'ang', 'ang'], jixin: [false, true, false, true], inner: 2 });
  s.pop();
  const g = s.finalize();
  g.position.set(-34, 0, 0);
  g.name = '铺作详解';
  scene.add(g);
  specimen = { group: g, meta, base: 1.66 + f(10) };
  // 构件名牌
  const L = [
    ['栌斗', 0, 0.18, 0.42],
    ['泥道拱', -0.62, 0.42, 0.12],
    ['华拱（第一跳）', 0.0, 0.36, 0.62],
    ['交互斗', 0.34, 0.62, 0.52],
    ['瓜子拱', 0.72, 0.95, 1.02],
    ['慢拱', -0.9, 1.12, 1.02],
    ['下昂（第三跳）', 0.28, 1.32, 1.62],
    ['下昂（第四跳）', -0.3, 1.72, 2.0],
    ['令拱', 0.78, 1.96, 2.06],
    ['耍头', 0.0, 2.16, 2.2],
    ['撩檐枋', -0.85, 2.2, 2.05],
    ['散斗', 0.62, 0.6, 0.06],
    ['齐心斗', 0.0, 1.1, 0.06],
    ['华头子', 0.3, 1.06, 1.28],
    ['里跳华拱', 0.0, 0.5, -0.62],
  ];
  for (const [text, x, y, z] of L) {
    const { tex, aspect } = labelTexture(text);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    const h = 0.2;
    sp.scale.set(h * aspect, h, 1);
    sp.position.set(-34 + x, specimen.base + y, z);
    sp.userData.anchor = sp.position.clone();
    labelGroup.add(sp);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), MAT.gold);
    dot.position.copy(sp.position);
    labelGroup.add(dot);
  }
  labelGroup.visible = false;
  scene.add(labelGroup);
});

step('陈列榫卯示教件…', () => {
  bench = buildJointBench({ gap: 4.3 });
  bench.group.position.set(0, 0, 46);
  scene.add(bench.group);
  bench.update(0);
});

let specimen = null;

/* ------------------------------ 剖切平面 -------------------------------- */
const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.001);
function applySection(on) {
  renderer.clippingPlanes = on ? [clipPlane] : [];
}

/* ------------------------------ 墙体开关 -------------------------------- */
const wallMats = new Set([MAT.wall, MAT.wallIn, MAT.door]);
function applyWalls(on) {
  scene.traverse((o) => {
    if ((o.isMesh || o.isInstancedMesh) && wallMats.has(o.material)) o.visible = on;
  });
}

/* ------------------------------ 分层显示 -------------------------------- */
const LAYER_KEYS = ['platform', 'fujie', '1层', '平坐2', '2层', '平坐3', '3层', '平坐4', '4层', '平坐5', '5层', '屋顶', 'finial'];
function applyLayer(n) {
  const groups = info.groups;
  if (!n) {
    for (const k of Object.keys(groups)) groups[k].visible = true;
    for (const ch of pagoda.children) ch.visible = true;
    return;
  }
  const keep = new Set(['platform']);
  if (n === 1) ['fujie', '1层'].forEach((k) => keep.add(k));
  else if (n <= 5) [`平坐${n}`, `${n}层`].forEach((k) => keep.add(k));
  else ['屋顶', 'finial'].forEach((k) => keep.add(k));
  for (const ch of pagoda.children) {
    const tag = ch.userData?.layer || ch.name;
    ch.visible = keep.has(tag) || (ch.isInstancedMesh && false);
  }
  for (const k of Object.keys(groups)) groups[k].visible = keep.has(k) || keep.has(groups[k].userData?.layer);
}

/* ------------------------------ 相机飞行 -------------------------------- */
const tw = { on: false, t: 0, dur: 1.5, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3() };
function flyTo(pos, target, dur = 1.5) {
  tw.p0.copy(camera.position);
  tw.p1.set(...pos);
  tw.t0.copy(controls.target);
  tw.t1.set(...target);
  tw.t = 0;
  tw.dur = dur;
  tw.on = true;
}
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/* -------------------------------- 主循环 -------------------------------- */
const clock = new THREE.Clock();
let frames = 0;
let acc = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (tw.on) {
    tw.t += dt;
    const k = ease(Math.min(tw.t / tw.dur, 1));
    camera.position.lerpVectors(tw.p0, tw.p1, k);
    controls.target.lerpVectors(tw.t0, tw.t1, k);
    if (tw.t >= tw.dur) tw.on = false;
  }
  controls.update();
  // 阴影相机跟随视点
  const d = camera.position.distanceTo(controls.target);
  sun.position.set(controls.target.x + 90, controls.target.y + 130, controls.target.z + 70);
  sun.target.position.copy(controls.target);
  sun.target.updateMatrixWorld();
  // 名牌尺度随距离
  if (labelGroup.visible) {
    for (const sp of labelGroup.children) {
      if (!sp.isSprite) continue;
      const dist = camera.position.distanceTo(sp.position);
      const k = Math.max(0.5, Math.min(3.4, dist / 6));
      const a = sp.material.map.image.width / sp.material.map.image.height;
      sp.scale.set(0.2 * a * k, 0.2 * k, 1);
    }
  }
  renderer.render(scene, camera);
  frames++;
  acc += dt;
  if (acc > 0.5) {
    state.fps = Math.round(frames / acc);
    frames = 0;
    acc = 0;
    ui?.tick(state);
  }
}

/* ------------------------------ 拾取榫卯 -------------------------------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
  down = null;
  if (moved > 6 || !bench) return;
  ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
  ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObject(bench.group, true);
  if (!hits.length) return;
  let o = hits[0].object;
  while (o && o.parent !== bench.group) o = o.parent;
  const idx = bench.items.findIndex((it) => it.group === o);
  if (idx >= 0) ui.selectJoint(idx);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* -------------------------------- 启动 --------------------------------- */
let ui = null;
(async function boot() {
  try {
    await run();
    const views = [];
    views.push({ key: '0', name: '全塔鸟瞰', pos: [74, 48, 92], target: [0, 26, 0] });
    views.push({ key: '·', name: '正立面', pos: [0, 32, 122], target: [0, 30, 0] });
    views.push({ sep: true });
    info.layers.forEach((L, i) => {
      if (L.name === '塔刹') return;
      const y = L.name === '副阶' ? 4 : (L.y0 + (L.yEave || L.yTop || L.y0)) / 2;
      const r = 30 + (L.yEave || 20) * 0.16;
      views.push({ key: String(i + 1), name: L.name, pos: [r * 0.72, y + 4, r], target: [0, y, 0] });
    });
    views.push({ key: '9', name: '塔刹', pos: [16, 60, 20], target: [0, 58, 0] });
    views.push({ sep: true });
    views.push({ key: 'D', name: '斗拱详解', pos: [-30.6, 3.6, 5.2], target: [-34, 2.2, 0], labels: true, show: 'specimen' });
    views.push({ key: 'M', name: '榫卯图解', pos: [0, 7.5, 62], target: [0, 1.6, 46], show: 'bench' });

    ui = initUI({
      state,
      info,
      views,
      joints: JOINTS,
      flyTo,
      onXray: (v) => setXray(v),
      onSection: (v) => applySection(v),
      onJoints: (v) => setJointHighlight(v),
      onWalls: (v) => applyWalls(v),
      onLayer: (n) => applyLayer(n),
      onExplode: (t) => bench.update(t),
      onLabels: (v) => (labelGroup.visible = v),
      onView: (v) => {
        const always = !!state.demoAlways;
        specimen.group.visible = always || v.show === 'specimen';
        bench.group.visible = always || v.show === 'bench';
        if (!specimen.group.visible) labelGroup.visible = false;
      },
      onJointFocus: (i) => {
        const it = bench.items[i];
        flyTo([it.x + 0.2, 3.4, 46 + 5.0], [it.x, 1.7, 46], 1.2);
      },
      cai: { CAI, FEN },
    });
    loadingText.textContent = '落成';
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 800);
    // 默认只见木塔：示教件收起
    specimen.group.visible = false;
    bench.group.visible = false;
    labelGroup.visible = false;
    window.__PAGODA__ = { scene, camera, controls, renderer, info, state, specimen, bench, MAT, THREE };
    animate();
    window.__READY__ = true;
    if (params.has('view')) ui.gotoByName(params.get('view'));
  } catch (err) {
    console.error(err);
    loadingText.innerHTML = `构建失败：<br><code>${err && err.message ? err.message : err}</code>`;
  }
})();

window.addEventListener('keydown', (e) => {
  if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'x') ui?.toggle('xray');
  else if (k === 'c') ui?.toggle('section');
  else if (k === 'j') ui?.toggle('joints');
  else if (k === 'h') document.body.classList.toggle('hide-ui');
  else if (k === 'd') ui?.gotoByName('斗拱详解');
  else if (k === 'm') ui?.gotoByName('榫卯图解');
  else if (/^[0-9]$/.test(k)) ui?.gotoByKey(k);
});
