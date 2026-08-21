/* ============================================================================
 * J-20 模型 —— 场景 / 渲染 / 交互层
 * 依赖：外层作用域中的 three.js 与 OrbitControls，以及 j20-geometry.js 的函数
 * ==========================================================================*/

/* 自诊断：任何异常都写进 DOM，便于无头浏览器抓取 */
function report(err) {
  const msg = (err && (err.stack || err.message)) || String(err);
  document.documentElement.setAttribute('data-error', msg.slice(0, 400));
  const b = document.getElementById('boot');
  if (b) { b.style.display = 'grid'; b.textContent = '初始化失败：' + msg.slice(0, 200); }
  console.error(err);
}
addEventListener('error', (e) => report(e.error || e.message));
addEventListener('unhandledrejection', (e) => report(e.reason));

/* ---------------------------------- 渲染器 --------------------------------- */
const canvas = document.getElementById('view');
const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const scene = new Scene();
const camera = new PerspectiveCamera(34, 1, 0.1, 2000);
camera.position.set(18.5, 7.6, 17.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, -0.2, 0);
controls.minDistance = 6;
controls.maxDistance = 140;
controls.maxPolarAngle = Math.PI * 0.93;   // 允许绕到机腹检查 DSI 进气道与弹舱
controls.autoRotateSpeed = 0.55;

/* ------------------------------- 天空 / 环境光 ------------------------------ */
const SUN_DIR = new Vector3(0.55, 0.42, 0.72).normalize();

const skyUniforms = {
  uSun: { value: SUN_DIR },
  uZenith: { value: new Color(0x2a5c9e) },
  uHorizon: { value: new Color(0xb9cfe4) },
  uGround: { value: new Color(0x4a4741) },
  uSunI: { value: 1.0 },
};
const skyMat = new ShaderMaterial({
  side: BackSide, depthWrite: false, uniforms: skyUniforms,
  vertexShader: `
    varying vec3 vDir;
    void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 uSun, uZenith, uHorizon, uGround; uniform float uSunI;
    varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      float h = clamp(d.y, -1.0, 1.0);
      vec3 col = mix(uHorizon, uZenith, pow(clamp(h,0.0,1.0), 0.55));
      col = mix(col, uGround, smoothstep(0.0, -0.10, h));
      float sd = max(dot(d, normalize(uSun)), 0.0);
      col += vec3(1.0,0.94,0.82) * (pow(sd, 900.0) * 12.0 + pow(sd, 12.0) * 0.34) * uSunI;
      col += vec3(1.0,0.90,0.78) * pow(1.0 - abs(h), 6.0) * 0.10 * uSunI;
      gl_FragColor = vec4(col, 1.0);
      // 自定义 ShaderMaterial 不会自动接入 three 的输出链：
      // 必须自己做色调映射 + 输出色彩空间转换，否则线性色值被直接写进
      // sRGB 帧缓冲，天空会明显偏暗。
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const sky = new Mesh(new SphereGeometry(600, 48, 32), skyMat);
sky.frustumCulled = false;
scene.add(sky);

// 用同一套天空生成 PMREM 环境贴图（金属反射的来源）
const pmrem = new PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envScene = new Scene();
const envSky = new Mesh(new SphereGeometry(100, 32, 24), skyMat.clone());
envScene.add(envSky);
// 地面补光板，让机腹不至于全黑
const bounce = new Mesh(new PlaneGeometry(300, 300),
  new MeshBasicMaterial({ color: 0x6b6355, side: DoubleSide }));
bounce.rotation.x = -Math.PI / 2; bounce.position.y = -3;
envScene.add(bounce);
const envRT = pmrem.fromScene(envScene, 0.02);
scene.environment = envRT.texture;

/* ---------------------------------- 灯光 ---------------------------------- */
const sun = new DirectionalLight(0xfff2dd, 3.1);
sun.position.copy(SUN_DIR).multiplyScalar(40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun);

const fill = new DirectionalLight(0x9fc0e8, 0.45);
fill.position.set(-18, 10, -14);
scene.add(fill);
const rim = new DirectionalLight(0xffd9b0, 0.55);
rim.position.set(-22, 4, 16);
scene.add(rim);
scene.add(new HemisphereLight(0xbcd4ee, 0x55503f, 0.35));

/* ---------------------------------- 材质 ---------------------------------- */
const skinMaps = makeSkinMaps();
if (skinMaps.map) { skinMaps.map.wrapS = skinMaps.map.wrapT = RepeatWrapping; }
if (skinMaps.rough) { skinMaps.rough.wrapS = skinMaps.rough.wrapT = RepeatWrapping; }

const M = {
  skin: new MeshPhysicalMaterial({
    color: 0x767d85, map: skinMaps.map || null, roughnessMap: skinMaps.rough || null,
    metalness: 0.58, roughness: 0.44, envMapIntensity: 1.15,
    clearcoat: 0.30, clearcoatRoughness: 0.45,
    iridescence: 0.22, iridescenceIOR: 1.28, iridescenceThicknessRange: [120, 420],
  }),
  dark: new MeshStandardMaterial({ color: 0x0b0d10, metalness: 0.25, roughness: 0.85, side: DoubleSide }),
  glass: new MeshPhysicalMaterial({
    color: 0x1d1a12, metalness: 1.0, roughness: 0.035, transparent: true, opacity: 0.46,
    envMapIntensity: 2.2, iridescence: 0.85, iridescenceIOR: 1.45,
    iridescenceThicknessRange: [220, 680], side: DoubleSide, depthWrite: false,
  }),
  frame: new MeshStandardMaterial({ color: 0x33383d, metalness: 0.85, roughness: 0.4 }),
  cockpit: new MeshStandardMaterial({ color: 0x14171a, metalness: 0.3, roughness: 0.8 }),
  sensor: new MeshPhysicalMaterial({ color: 0x0a0c10, metalness: 0.95, roughness: 0.08, envMapIntensity: 1.6 }),
  nozzle: new MeshStandardMaterial({ map: makeNozzleMap(), color: 0xffffff, metalness: 0.95, roughness: 0.42, side: DoubleSide }),
  exhaust: new MeshStandardMaterial({ color: 0x0a0908, metalness: 0.7, roughness: 0.55, side: DoubleSide }),
  flameCore: new MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  flameHalo: new MeshBasicMaterial({ color: 0x5b7bff, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  missile: new MeshStandardMaterial({ color: 0xb9bdc2, metalness: 0.4, roughness: 0.55 }),
  tire: new MeshStandardMaterial({ color: 0x101215, metalness: 0.05, roughness: 0.93 }),
  metal: new MeshStandardMaterial({ color: 0xa9b0b7, metalness: 1.0, roughness: 0.3 }),
};

/* --------------------------------- 建模 --------------------------------- */
const jet = buildJ20(M);
scene.add(jet.root);

/* 验证用开关：?noplane=1 隐藏机体，用于差分出机体轮廓像素 */
const QS = new URLSearchParams(location.search);
if (QS.has('noplane')) jet.root.visible = false;

/* --------------------------------- 贴花 --------------------------------- */
const decals = new Group();
jet.root.add(decals);
function decal(tex, w, h, pos, rot) {
  if (!tex) return null;
  const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({
    map: tex, transparent: true, roughness: 0.55, metalness: 0.2,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false,
  }));
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  decals.add(m);
  return m;
}
const insig = makeInsignia(256, true);
const serial = makeSerial('2011', 256, 96);
const serialSmall = makeSerial('CHINA AIR FORCE', 512, 64, 'rgba(70,76,84,0.9)');
// 机翼上表面军徽
decal(insig, 1.15, 1.15, [-2.35, -0.145, 3.45], [-Math.PI / 2, 0, 0]);
decal(insig, 1.15, 1.15, [-2.35, -0.145, -3.45], [-Math.PI / 2, 0, 0]);
// 机翼下表面军徽
decal(insig, 1.15, 1.15, [-2.35, -0.285, -3.45], [Math.PI / 2, 0, 0]);
decal(insig, 1.15, 1.15, [-2.35, -0.285, 3.45], [Math.PI / 2, 0, 0]);
// V 尾外侧机号
decal(serial, 1.35, 0.5, [-6.05, 1.28, 1.62], [22 * Math.PI / 180, 0, 0]);
decal(serial, 1.35, 0.5, [-6.05, 1.28, -1.62], [-22 * Math.PI / 180, Math.PI, 0]);
// 进气道侧面小字
decal(serialSmall, 1.5, 0.19, [2.0, -0.30, 1.845], [0, 0, 0]);
decal(serialSmall, 1.5, 0.19, [2.0, -0.30, -1.845], [0, Math.PI, 0]);

/* --------------------------------- 地面 --------------------------------- */
function makeTarmac() {
  const R = makeRng(31415926);
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#8f8b85'; x.fillRect(0, 0, 1024, 1024);          // 浅灰混凝土停机坪
  for (let i = 0; i < 40000; i++) {
    const g = 120 + R() * 60;
    x.fillStyle = `rgba(${g},${g - 3},${g - 8},${0.05 + R() * 0.22})`;
    x.fillRect(R() * 1024, R() * 1024, 2.2, 2.2);
  }
  x.strokeStyle = 'rgba(52,49,45,0.55)'; x.lineWidth = 3;          // 混凝土分块缝
  for (let i = 0; i <= 1024; i += 256) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 1024); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(1024, i); x.stroke();
  }
  for (let i = 0; i < 26; i++) {                                   // 油渍
    x.fillStyle = `rgba(46,42,38,${0.05 + R() * 0.10})`;
    x.beginPath(); x.ellipse(R() * 1024, R() * 1024, 30 + R() * 120, 20 + R() * 90, R() * 3, 0, 7); x.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(26, 26); t.anisotropy = 8;
  return t;
}
const ground = new Mesh(new PlaneGeometry(420, 420),
  new MeshStandardMaterial({ map: makeTarmac(), color: 0xffffff, roughness: 0.9, metalness: 0.02 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.30;
ground.receiveShadow = true;
scene.add(ground);

// 黄色停机线
const lineMat = new MeshBasicMaterial({ color: 0xd8c352, transparent: true, opacity: 0.55 });
for (const z of [-9, 9]) {
  const l = new Mesh(new PlaneGeometry(60, 0.22), lineMat);
  l.rotation.x = -Math.PI / 2; l.position.set(0, -2.293, z);
  scene.add(l);
}

/* --------------------------------- 状态机 --------------------------------- */
const state = { gear: 1, bay: 0, ab: 0, autoRotate: false, wire: false, flight: false };
const mixv = (a, b, t) => a + (b - a) * t;

function applyDoors(t) {                       // 弹舱门
  for (const d of jet.doors) d.hinge.rotation[d.axis || 'x'] = d.open * t;
  jet.parts.weapons.visible = t > 0.35;
}
function applyGear(t) {                        // 起落架
  const g = jet.parts.gear_group;
  g.visible = t > 0.015;
  const ang = mixv(-96 * Math.PI / 180, 0, t);
  jet.parts.gear_nose.rotation.z = ang;
  jet.parts.gear_main_R.rotation.z = ang;
  jet.parts.gear_main_L.rotation.z = ang;
  for (const d of jet.gdoors) d.hinge.rotation[d.axis] = d.open * Math.min(1, t * 1.6);
}
function applyAB(t) {
  jet.parts.flames.visible = t > 0.02;
  M.flameCore.opacity = 0.50 * t;
  M.flameHalo.opacity = 0.15 * t;
  jet.parts.flames.scale.set(1, mixv(0.5, 1, t), 1);
}
applyDoors(0); applyGear(1); applyAB(0);

/* ---------------------------------- UI ---------------------------------- */
function button(label, fn) {
  const b = document.createElement('button');
  b.textContent = label; b.className = 'btn';
  b.onclick = () => fn(b);
  return b;
}
const rowMain = document.getElementById('row-toggle');
const rowView = document.getElementById('row-view');

const toggles = [
  ['起落架', () => { target.gear = target.gear > 0.5 ? 0 : 1; }, () => target.gear > 0.5],
  ['弹舱', () => { target.bay = target.bay > 0.5 ? 0 : 1; }, () => target.bay > 0.5],
  ['加力燃烧', () => { target.ab = target.ab > 0.5 ? 0 : 1; }, () => target.ab > 0.5],
  ['自动旋转', () => { state.autoRotate = !state.autoRotate; controls.autoRotate = state.autoRotate; }, () => state.autoRotate],
  ['线框', () => { state.wire = !state.wire; setWire(state.wire); }, () => state.wire],
  ['飞行姿态', () => { state.flight = !state.flight; setFlight(state.flight); }, () => state.flight],
];
const target = { gear: 1, bay: 0, ab: 0 };
const tButtons = toggles.map(([label, fn, get]) => {
  const b = button(label, () => { fn(); sync(); });
  b.dataset.get = '1'; b._get = get;
  rowMain.appendChild(b);
  return b;
});
function sync() { for (const b of tButtons) b.classList.toggle('on', !!b._get()); }
sync();

const views = {
  '三视·斜': [18.5, 7.6, 17.5, 0, -0.2, 0],
  '正前': [26, 1.2, 0.01, 0, -0.2, 0],
  '侧视': [0.01, 0.6, 27, 0, -0.2, 0],
  '俯视': [0.5, 30, 0.5, 0, -0.2, 0],
  '尾后': [-24, 3.5, 8, -2, -0.2, 0],
  '腹视': [7.5, -5.6, 11.5, 0, -1.0, 0],
  '座舱': [8.2, 2.2, 3.4, 4.6, 0.75, 0],
  '进气道': [6.6, -0.4, 4.2, 3.2, -0.5, 1.4],
};
const camAlias = { iso: '三视·斜', front: '正前', side: '侧视', top: '俯视', rear: '尾后', belly: '腹视', cockpit: '座舱', intake: '进气道' };
let camAnim = null;
for (const [k, v] of Object.entries(views)) {
  rowView.appendChild(button(k, () => {
    camAnim = { t: 0, from: camera.position.clone(), to: new Vector3(v[0], v[1], v[2]), tf: controls.target.clone(), tt: new Vector3(v[3], v[4], v[5]) };
  }));
}
rowView.appendChild(button('保存 PNG', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.download = 'j20.png'; a.href = canvas.toDataURL('image/png'); a.click();
}));

function setWire(on) {
  for (const k of ['skin', 'nozzle', 'metal', 'missile', 'exhaust', 'frame']) M[k].wireframe = on;
  decals.visible = !on;
  ground.visible = !on && !state.flight;
}
function setFlight(on) {
  ground.visible = !on;
  lineMat.opacity = on ? 0 : 0.55;
  if (on) {
    target.gear = 0; target.bay = 0; target.ab = 1;
    jet.root.rotation.z = 4 * Math.PI / 180;
    jet.root.position.y = 1.2;
    skyUniforms.uGround.value.set(0x38507a);
  } else {
    target.gear = 1; target.ab = 0;
    jet.root.rotation.z = 0;
    jet.root.position.y = 0;
    skyUniforms.uGround.value.set(0x4a4741);
  }
  sync();
}

/* -------------------------------- 主循环 -------------------------------- */
const clock = new Clock();
let vw = 0, vh = 0;
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (w !== vw || h !== vh) {
    vw = w; vh = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
}
addEventListener('resize', resize);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  resize();
  // 状态过渡
  for (const k of ['gear', 'bay', 'ab']) state[k] = mixv(state[k], target[k], 1 - Math.pow(0.002, dt));
  applyGear(state.gear); applyDoors(state.bay); applyAB(state.ab);
  // 加力焰抖动
  if (state.ab > 0.02) {
    const f = 1 + Math.sin(performance.now() * 0.045) * 0.07 + Math.random() * 0.03;
    jet.parts.flames.scale.x = f;
  }
  // 鸭翼配平微动（全动鸭翼绕自身转轴）
  const w = Math.sin(performance.now() * 0.0006) * 2.4 * Math.PI / 180;
  jet.canardPair[0].rotation.z = w; jet.canardPair[1].rotation.z = w;
  // 相机预设动画
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 1.6);
    const e = 1 - Math.pow(1 - camAnim.t, 3);
    camera.position.lerpVectors(camAnim.from, camAnim.to, e);
    controls.target.lerpVectors(camAnim.tf, camAnim.tt, e);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update();
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

/* ------------------------------ 启动与统计 ------------------------------ */
let tris = 0, meshes = 0;
jet.root.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
document.getElementById('stats').textContent =
  `${meshes} 个网格 · ${Math.round(tris).toLocaleString()} 三角面 · 全长 20.0 m · 翼展 12.88 m · 全高 4.49 m`;

/* 初始状态开关（便于验证与分享特定构型）：?bay=1&gear=0&ab=1&flight=1&wire=1&cam=belly */
if (QS.has('flight')) setFlight(QS.get('flight') === '1');
if (QS.has('wire')) { state.wire = QS.get('wire') === '1'; setWire(state.wire); }
for (const k of ['gear', 'bay', 'ab']) if (QS.has(k)) target[k] = Math.max(0, Math.min(1, +QS.get(k)));
state.gear = target.gear; state.bay = target.bay; state.ab = target.ab;
applyGear(state.gear); applyDoors(state.bay); applyAB(state.ab); sync();
if (QS.has('cam')) {
  const v = views[camAlias[QS.get('cam')] || QS.get('cam')];
  if (v) { camera.position.set(v[0], v[1], v[2]); controls.target.set(v[3], v[4], v[5]); controls.update(); }
}

try {
  resize();
  renderer.render(scene, camera);                      // 先同步渲一帧，确保首屏与截图有内容
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const html = document.documentElement;
  html.setAttribute('data-render', 'ok');
  html.setAttribute('data-meshes', String(meshes));
  html.setAttribute('data-tris', String(Math.round(tris)));
  html.setAttribute('data-calls', String(renderer.info.render.calls));
  html.setAttribute('data-progs', String(renderer.info.programs ? renderer.info.programs.length : -1));
  html.setAttribute('data-gpu', dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).slice(0, 60) : 'n/a');
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
  tick();
} catch (e) { report(e); }
