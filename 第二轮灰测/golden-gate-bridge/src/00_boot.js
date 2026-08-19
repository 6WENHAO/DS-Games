/* =========================================================================
   金门大桥 · 参数（全部为真实尺寸，单位：米，1 unit = 1 m）
   数据来源：Golden Gate Bridge Highway & Transportation District
   主跨 1280 · 边跨 343×2 · 塔高 227（高出桥面 152）· 桥宽 27
   主缆 Ø0.92 垂度 145 · 吊索间距 15.24(50ft) · 桁架节间 7.62(25ft)
   ========================================================================= */
const B = {
  towerX: 640,        // 主塔位置 ±640 → 主跨 1280
  sideSpan: 343,      // 边跨
  anchorX: 983,       // 锚碇 = 640+343，悬吊总长 1966
  towerTop: 227,      // 塔顶标高
  deckTower: 75,      // 塔处桥面 = 227-152
  deckMid: 67,        // 跨中桥面（净空 67m）
  deckAnchor: 70.5,   // 锚碇处桥面
  cableTop: 224,      // 主缆过鞍座标高
  cableMid: 79,       // 主缆最低点（垂度 145m）
  cableAnchor: 84,    // 主缆入锚碇标高
  cableR: 0.46,       // 主缆半径（Ø0.92）
  cableZ: 13.7,       // 双主缆间距 27.4m
  deckHalf: 13.5,     // 桥面半宽（全宽 27m）
  roadHalf: 9.55,     // 车行道半宽（6 车道）
  walkOut: 13.35,     // 人行道外沿
  truss: 7.62,        // 加劲桁架高 25ft
  panel: 7.62,        // 桁架节间 25ft
  hang: 15.24,        // 吊索间距 50ft
  legZ: 19.4,         // 塔柱中心（跨桥面外侧）
  legBX: 9.3, legBZ: 5.9,   // 塔柱根部半尺寸（18.6 × 11.8）
  legTX: 6.3, legTZ: 4.6,   // 塔柱顶部半尺寸
  shoreS: -968,       // 南岸（旧金山）水线
  shoreN: 706,        // 北岸（马林）水线
  endS: -1620,        // 南引桥端
  endN: 1560,         // 北引桥端
  arch0: -1010, arch1: -1170, // 堡垒点钢拱
};

// 运行时状态
const S = {
  hour: 18.85, fog: 0.30, traffic: 0.85,
  orbit: true, lamps: false, xray: false, ui: true,
  sun: new THREE.Vector3(), sunI: 1, night: 0, expo: 1,
  hz: new THREE.Color(), zen: new THREE.Color(), sunC: new THREE.Color(),
  t: 0, dt: 0,
};

/* ---------------- 数学 ---------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RND = mulberry(20240529);
const rr = (a, b) => a + (b - a) * RND();

function h2(x, y) { // 稳定哈希
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 5, gain = 0.5, lac = 2.03) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, y); n += a; a *= gain; x *= lac; y *= lac; x += 17.3; y -= 9.1; }
  return s / n;
}
function ridge(x, y, oct = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(vnoise(x, y) * 2 - 1)); n += a; a *= 0.5; x *= 2.07; y *= 2.07; }
  return s / n;
}

/* ---------------- 桥面 / 主缆 竖曲线 ---------------- */
function deckY(x) {
  const ax = Math.abs(x);
  if (ax <= B.towerX) {                       // 主跨：塔处 75 → 跨中 67
    const t = ax / B.towerX;
    return B.deckMid + (B.deckTower - B.deckMid) * t * t;
  }
  if (ax <= B.anchorX) {                      // 边跨：塔处最高，向锚碇缓降
    const t = (ax - B.towerX) / B.sideSpan;
    return B.deckTower - (B.deckTower - B.deckAnchor) * t * t;
  }
  // 引桥：南侧长坡降至引道，北侧缓降入马林山体
  if (x > 0) {
    const t = clamp((ax - B.anchorX) / (B.endN - B.anchorX), 0, 1);
    return lerp(B.deckAnchor, 44, t * t * (3 - 2 * t));
  }
  const t = clamp((ax - B.anchorX) / (-B.endS - B.anchorX), 0, 1);
  return lerp(B.deckAnchor, 38, t * t * (3 - 2 * t));
}
// 主缆：主跨抛物线（垂度 145），边跨延续同曲率
const SIDE_K = (B.cableTop - B.cableMid) / (B.towerX * B.towerX);      // y'' /2
const SIDE_S = (B.cableAnchor - B.cableTop - SIDE_K * B.sideSpan * B.sideSpan) / B.sideSpan;
function cableY(x) {
  const ax = Math.abs(x);
  if (ax <= B.towerX) return B.cableMid + SIDE_K * ax * ax;
  const d = Math.min(ax - B.towerX, B.sideSpan);
  return B.cableTop + SIDE_S * d + SIDE_K * d * d;
}

/* ---------------- 通用几何工具 ---------------- */
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1, false),
  cylC: new THREE.CylinderGeometry(1, 1, 1, 8, 1, true),
  sph: new THREE.SphereGeometry(1, 12, 8),
};
const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

// 实例化批次：把成千上万根杆件塞进一个 InstancedMesh
class Batch {
  constructor(geo, mat, o = {}) {
    this.geo = geo; this.mat = mat; this.list = []; this.col = o.color ? [] : null;
    this.cast = o.cast !== false; this.recv = o.recv !== false; this.name = o.name || 'batch';
  }
  m(mat4, c) { this.list.push(mat4.clone()); if (this.col) this.col.push(c || 0xffffff); return this; }
  // 轴对齐盒
  box(x, y, z, sx, sy, sz, c) {
    _m.makeScale(sx, sy, sz); _m.setPosition(x, y, z); return this.m(_m, c);
  }
  boxR(x, y, z, sx, sy, sz, ry, c) { // 绕 Y 旋转
    _q.setFromAxisAngle(UP, ry); _m.compose(_v0.set(x, y, z), _q, _s.set(sx, sy, sz)); return this.m(_m, c);
  }
  // 两点之间的杆件（unit box 沿 Y）
  strut(p0, p1, w, d, c) {
    _v1.subVectors(p1, p0); const L = _v1.length(); if (L < 1e-4) return this;
    _v1.divideScalar(L); _q.setFromUnitVectors(UP, _v1);
    _v2.addVectors(p0, p1).multiplyScalar(0.5);
    _m.compose(_v2, _q, _s.set(w, L, d)); return this.m(_m, c);
  }
  // 两点之间的圆柱（unit cyl r=1,h=1）
  rod(p0, p1, r, c) {
    _v1.subVectors(p1, p0); const L = _v1.length(); if (L < 1e-4) return this;
    _v1.divideScalar(L); _q.setFromUnitVectors(UP, _v1);
    _v2.addVectors(p0, p1).multiplyScalar(0.5);
    _m.compose(_v2, _q, _s.set(r, L, r)); return this.m(_m, c);
  }
  build(parent) {
    if (!this.list.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.list.length);
    for (let i = 0; i < this.list.length; i++) im.setMatrixAt(i, this.list[i]);
    if (this.col) { for (let i = 0; i < this.col.length; i++) im.setColorAt(i, _tc.setHex(this.col[i])); im.instanceColor.needsUpdate = true; }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = this.cast; im.receiveShadow = this.recv; im.name = this.name;
    try { im.computeBoundingSphere(); } catch (e) { im.frustumCulled = false; }
    parent.add(im); this.list.length = 0; return im;
  }
}
const _tc = new THREE.Color();

// 沿 x 扫掠的带状面（用于路面/人行道/边缘板）
function ribbon(xs, z0, z1, dy0, dy1, mat, uTile, vFlip) {
  const n = xs.length, pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = deckY(x);
    pos.push(x, y + dy0, z0, x, y + dy1, z1);
    const u = (x + 2000) / uTile;      // u 横向、v 纵向（贴图沿桥长重复）
    uv.push(0, u, 1, u);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    if (vFlip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const me = new THREE.Mesh(g, mat); me.castShadow = true; me.receiveShadow = true;
  return me;
}

/* ---------------- 程序化贴图 ---------------- */
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noiseCanvas(size, base, amp, oct) {
  const [c, g] = cv(size, size), im = g.createImageData(size, size), d = im.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(x / size * oct, y / size * oct, 4);
    const v = clamp(base + (n - 0.5) * amp, 0, 255) | 0;
    const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
// 沥青路面 + 划线（一块 = 19.1m 宽 × 48m 长）
function roadCanvas() {
  const W = 382, H = 960, [c, g] = cv(W, H);
  g.fillStyle = '#26262a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26000; i++) {  // 骨料颗粒
    const v = 26 + Math.random() * 42 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 3},${0.35 + Math.random() * 0.5})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
  }
  // 轮迹磨光带
  const lane = W / 6;
  for (let i = 0; i < 6; i++) {
    const cx = (i + 0.5) * lane;
    const gr = g.createLinearGradient(cx - 26, 0, cx + 26, 0);
    gr.addColorStop(0, 'rgba(70,70,76,0)'); gr.addColorStop(.5, 'rgba(78,78,86,.42)'); gr.addColorStop(1, 'rgba(70,70,76,0)');
    g.fillStyle = gr; g.fillRect(cx - 26, 0, 52, H);
  }
  // 车道虚线（3m 实 9m 虚 → 60px / 180px）
  g.strokeStyle = 'rgba(246,244,236,.9)'; g.lineWidth = 4;
  for (let i = 1; i < 6; i++) {
    if (i === 3) continue;
    const x = i * lane;
    g.setLineDash([60, 180]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  g.setLineDash([]);
  // 边缘实线
  g.lineWidth = 5; g.strokeStyle = 'rgba(246,244,236,.82)';
  g.beginPath(); g.moveTo(6, 0); g.lineTo(6, H); g.moveTo(W - 6, 0); g.lineTo(W - 6, H); g.stroke();
  // 中央双黄线
  g.strokeStyle = 'rgba(228,182,54,.85)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(W / 2 - 7, 0); g.lineTo(W / 2 - 7, H); g.moveTo(W / 2 + 7, 0); g.lineTo(W / 2 + 7, H); g.stroke();
  return c;
}
function concreteCanvas() {
  const c = noiseCanvas(256, 176, 46, 7), g = c.getContext('2d');
  g.strokeStyle = 'rgba(120,116,110,.5)'; g.lineWidth = 1.6;   // 分格缝
  for (let i = 0; i <= 4; i++) { const p = i * 64; g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke(); }
  return c;
}
function brickCanvas() {
  const [c, g] = cv(256, 256);
  g.fillStyle = '#6d4436'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 32; r++) for (let i = 0; i < 17; i++) {
    const off = (r % 2) * 8, x = i * 16 - off, y = r * 8;
    const v = 0.72 + Math.random() * 0.5;
    g.fillStyle = `rgb(${(126 * v) | 0},${(74 * v) | 0},${(56 * v) | 0})`;
    g.fillRect(x + 1, y + 1, 14, 6);
  }
  return c;
}
function puffCanvas() {   // 海雾团
  const N = 256, [c, g] = cv(N, N), im = g.createImageData(N, N), d = im.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x / N - .5) * 2, dy = (y / N - .5) * 2;
    const r = Math.sqrt(dx * dx + dy * dy * 2.6);
    let a = clamp(1 - r, 0, 1); a *= a;
    const n = fbm(x / N * 5.5, y / N * 5.5, 5, .55);
    a *= clamp(n * 1.75 - 0.28, 0, 1);
    const i = (y * N + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = clamp(a * 255, 0, 255) | 0;
  }
  g.putImageData(im, 0, 0); return c;
}

/* ---------------- 材质 ---------------- */
let MAT = null;
function buildMaterials() {
  const steelRough = tex(noiseCanvas(256, 150, 90, 9), 26, 26, false);
  const ORANGE = 0xc0341c;                    // International Orange
  const std = (o) => new THREE.MeshStandardMaterial(o);
  MAT = {
    orange: std({ color: ORANGE, roughness: .58, metalness: .22, roughnessMap: steelRough, envMapIntensity: .85 }),
    orangeD: std({ color: 0x8e2614, roughness: .66, metalness: .2, roughnessMap: steelRough, envMapIntensity: .6 }),
    cable: std({ color: 0xa82c17, roughness: .5, metalness: .3, envMapIntensity: 1 }),
    rope: std({ color: 0x8f3722, roughness: .45, metalness: .35, envMapIntensity: 1 }),
    concrete: std({ color: 0xa8a29a, roughness: .93, metalness: .02, map: tex(concreteCanvas(), 6, 6), envMapIntensity: .5 }),
    concreteS: std({ color: 0xb4aea4, roughness: .88, metalness: .02, map: tex(concreteCanvas(), 1, 1), envMapIntensity: .5, side: THREE.DoubleSide }),
    road: std({ color: 0xffffff, roughness: .78, metalness: .04, map: tex(roadCanvas(), 1, 1), envMapIntensity: .35 }),
    walk: std({ color: 0xb9b3a8, roughness: .9, metalness: .02, map: tex(concreteCanvas(), 1, 1), envMapIntensity: .4, side: THREE.DoubleSide }),
    steelDark: std({ color: 0x4a4a4e, roughness: .6, metalness: .5, envMapIntensity: .8 }),
    brick: std({ color: 0xffffff, roughness: .92, map: tex(brickCanvas(), 10, 4), envMapIntensity: .4 }),
    rock: std({ color: 0x7d7367, roughness: .95, metalness: 0, envMapIntensity: .4 }),
    glass: std({ color: 0x9fd0e8, roughness: .12, metalness: .1, envMapIntensity: 1.4 }),
    white: std({ color: 0xece7dd, roughness: .7 }),
    roof: std({ color: 0x7a3b2c, roughness: .8 }),
    car: std({ color: 0xffffff, roughness: .32, metalness: .5, envMapIntensity: 1.3 }),
    tire: std({ color: 0x14141a, roughness: .9 }),
    lampOn: std({ color: 0x3a3a3c, roughness: .5, metalness: .6, emissive: 0xffb459, emissiveIntensity: 0 }),
    red: std({ color: 0x551111, roughness: .5, emissive: 0xff2200, emissiveIntensity: 1 }),
    hull: std({ color: 0x2b3a4a, roughness: .55, metalness: .35 }),
    deckW: std({ color: 0xd8d2c6, roughness: .7 }),
    foliage: std({ color: 0x3f5233, roughness: .92, flatShading: true }),
    foliage2: std({ color: 0x50603a, roughness: .92, flatShading: true }),
    trunk: std({ color: 0x4a3a2c, roughness: .95 }),
    sand: std({ color: 0xc9b795, roughness: .95 }),
  };
  MAT.road.map.wrapS = THREE.ClampToEdgeWrapping;
  MAT.road.map.wrapT = THREE.RepeatWrapping;
  MAT.carC = MAT.car.clone(); MAT.carC.vertexColors = false;
}
