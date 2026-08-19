// Vegetation: instanced grass, flowers, trees, bushes with GPU wind sway,
// player trample, distance streaming and a unique Windrise great tree.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { height, slopeAt, moistureAt, surfaceAt, regionAt, WORLD } from './heightfield.js';
import { hash2, GLSL_NOISE } from '../core/noise.js';
import { makeRNG, clamp, lerp, smoothstep, TAU } from '../core/utils.js';
import { makeToonRamp } from '../core/textures.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();

function cellRNG(gx, gz, salt) {
  const seed = (hash2(gx * 73856093 + salt * 19349663, gz * 83492791 + salt * 39916801) * 4294967296) >>> 0;
  return makeRNG(seed);
}
function cellKey(gx, gz) { return gx + ',' + gz; }

// ---------------------------------------------------------------- materials

let _toonRamp = null;
function toonRamp() {
  if (!_toonRamp) _toonRamp = makeToonRamp([0.0, 0.5, 0.72, 1.0], [0.42, 0.68, 0.9, 1.0]);
  return _toonRamp;
}

/** With DoubleSide, three flips the normal on backfaces, so half of every up-normal
 *  billboard ends up lit from below (renders black). Pin the shading normal to +Y. */
function forceUpNormal(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\n        normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);');
  };
  return mat;
}

function makeGrassMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.uniforms = {
    uTime: { value: 0 }, uWindAmp: { value: 0.16 },
    uFadeNear: { value: 88 }, uFadeFar: { value: 112 },
    uPlayerPos: { value: new THREE.Vector3() }, uPlayerRadius: { value: 1.2 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_NOISE + '\n        uniform float uTime; uniform float uWindAmp; uniform float uFadeNear; uniform float uFadeFar; uniform vec3 uPlayerPos; uniform float uPlayerRadius;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n        #ifdef USE_INSTANCING\n        {\n          vec3 _ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n          float _h = clamp(position.y, 0.0, 1.0);\n          vec2 _wp = _ipos.xz * 0.14;\n          float _w = gnoise(_wp + vec2(uTime * 0.16, uTime * 0.11)) * 2.0 - 1.0;\n          _w += sin(_ipos.x * 0.35 + uTime * 1.2) * 0.55;\n          _w += cos(_ipos.z * 0.42 + uTime * 0.85) * 0.45;\n          vec2 _bend = vec2(_w, _w * 0.6 + (gnoise(_wp * 1.4 - vec2(uTime * 0.09)) * 2.0 - 1.0)) * uWindAmp;\n          vec2 _dp = _ipos.xz - uPlayerPos.xz;\n          float _d = length(_dp);\n          float _tramp = smoothstep(uPlayerRadius, 0.0, _d);\n          vec2 _dir = _d > 1e-4 ? _dp / _d : vec2(0.0);\n          _bend += _dir * _tramp * 0.9;\n          transformed.x += _bend.x * _h * _h;\n          transformed.z += _bend.y * _h * _h;\n          float _camd = distance(_ipos.xz, cameraPosition.xz);\n          float _fade = smoothstep(uFadeFar, uFadeNear, _camd);\n          transformed.xz *= _fade;\n        }\n        #endif');
  };
  forceUpNormal(mat);
  mat.customProgramCacheKey = () => 'veg-grass-lambert-v2';
  return mat;
}

function makeFlowerMaterial(unlit) {
  const mat = unlit
    ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.uniforms = { uTime: { value: 0 }, uWindAmp: { value: 0.07 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_NOISE + '\n        uniform float uTime; uniform float uWindAmp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n        #ifdef USE_INSTANCING\n        {\n          vec3 _ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n          float _h = clamp(position.y, 0.0, 1.4);\n          float _w = sin(_ipos.x * 0.3 + uTime * 0.9) * 0.5;\n          _w += (gnoise(_ipos.xz * 0.2 + vec2(uTime * 0.12, uTime * 0.08)) * 2.0 - 1.0);\n          transformed.x += _w * uWindAmp * _h * _h;\n          transformed.z += (_w * 0.6) * uWindAmp * _h * _h;\n        }\n        #endif');
  };
  if (!unlit) forceUpNormal(mat);
  mat.customProgramCacheKey = () => 'veg-flower-' + (unlit ? 'basic' : 'lambert') + '-v2';
  return mat;
}

function makeLampgrassMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.uniforms = { uTime: { value: 0 }, uWindAmp: { value: 0.05 }, uGlow: { value: 0.32 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_NOISE + '\n        attribute float aGlow;\n        varying float vGlow;\n        uniform float uTime; uniform float uWindAmp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n        vGlow = aGlow;\n        #ifdef USE_INSTANCING\n        {\n          vec3 _ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n          float _h = clamp(position.y, 0.0, 1.4);\n          float _w = sin(_ipos.x * 0.3 + uTime * 0.9) * 0.4;\n          transformed.x += _w * uWindAmp * _h * _h;\n          transformed.z += (_w * 0.6) * uWindAmp * _h * _h;\n        }\n        #endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n        varying float vGlow;\n        uniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n        totalEmissiveRadiance += vGlow * vec3(0.35, 1.0, 0.7) * uGlow;');
  };
  forceUpNormal(mat);
  mat.customProgramCacheKey = () => 'veg-lampgrass-lambert-v2';
  return mat;
}

function makeTreeToonMaterial() {
  const mat = new THREE.MeshToonMaterial({ gradientMap: toonRamp(), vertexColors: true, side: THREE.FrontSide });
  mat.userData.uniforms = { uWindTime: { value: 0 }, uWindAmp: { value: 0.10 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n  attribute float aCanopy;\n  uniform float uWindTime;\n  uniform float uWindAmp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  #ifdef USE_INSTANCING\n    vec3 _tip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);\n    float _ph = fract(sin(dot(_tip.xz, vec2(12.9898, 78.233))) * 43758.5453);\n    float _sw = aCanopy * uWindAmp;\n    float _h = position.y * 0.25 + 0.5;\n    transformed.x += sin(uWindTime * 1.1 + _ph * 6.283) * _sw * _h;\n    transformed.z += cos(uWindTime * 0.9 + _ph * 6.283) * _sw * _h;\n  #endif');
  };
  mat.customProgramCacheKey = () => 'veg-tree-toon-v1';
  return mat;
}

// ---------------------------------------------------------------- geometry

function compound(parts) {
  // parts: [{ geo, color, jitter, glow|sway, x,y,z, rx,ry,rz, sx,sy,sz, seed }]
  const geos = parts.map((p) => {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const sw = new Float32Array(n);
    const base = new THREE.Color(p.color);
    const jit = p.jitter ?? 0.03;
    for (let i = 0; i < n; i++) {
      const j = (hash2(i, p.seed ?? 7) * 2 - 1) * jit;
      col[i * 3] = clamp(base.r + j, 0, 1);
      col[i * 3 + 1] = clamp(base.g + j, 0, 1);
      col[i * 3 + 2] = clamp(base.b + j, 0, 1);
      sw[i] = p.sway ?? p.glow ?? 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aCanopy', new THREE.BufferAttribute(sw, 1));
    _p.set(p.x || 0, p.y || 0, p.z || 0);
    _e.set(p.rx || 0, p.ry || 0, p.rz || 0);
    _s.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
    g.applyMatrix4(_m4.compose(_p, _q.setFromEuler(_e), _s));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  merged.computeBoundingSphere();
  return merged;
}

function lumpy(geo, amt) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    const d = hash2(i, 99);
    _v.multiplyScalar(1 + (d * 2 - 1) * amt);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function bendTrunk(geo, amt, ang) {
  const pos = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const h = (maxY - minY) || 1;
  const dx = Math.cos(ang), dz = Math.sin(ang);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), t = clamp((y - minY) / h, 0, 1);
    const off = Math.sin(t * Math.PI * 0.8) * amt;
    pos.setX(i, pos.getX(i) + dx * off);
    pos.setZ(i, pos.getZ(i) + dz * off);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeGrassClusterGeometry(blades = 4) {
  const pos = [], col = [], nrm = [];
  const root = new THREE.Color(0x50663a), tip = new THREE.Color(0x8cb066);
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * TAU + 0.4;
    const fx = Math.cos(a), fz = Math.sin(a);
    const px = -Math.sin(a), pz = Math.cos(a);
    const halfW = 0.13, tipW = 0.02, h = 1.0, lean = 0.16;
    const bx0 = px * halfW, bz0 = pz * halfW;
    const tx = fx * lean * h, tz = fz * lean * h;
    const rv = 0.92 + (b % 3) * 0.055;
    const r0 = new THREE.Color(root.r * rv, root.g * rv, root.b * rv);
    const t0c = new THREE.Color(tip.r * rv, tip.g * rv, tip.b * rv);
    const bl = [bx0, 0, bz0], br = [-bx0, 0, -bz0];
    const tl = [tx + px * tipW, h, tz + pz * tipW], tr = [tx - px * tipW, h, tz - pz * tipW];
    // two triangles, non-indexed
    const push = (v, c) => { pos.push(v[0], v[1], v[2]); col.push(c.r, c.g, c.b); nrm.push(0, 1, 0); };
    push(bl, r0); push(br, r0); push(tl, t0c);
    push(br, r0); push(tr, t0c); push(tl, t0c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}

function flowerCompound(kind) {
  const stem = (h) => new THREE.CylinderGeometry(0.02, 0.03, h, 5, 1).translate(0, h / 2, 0);
  if (kind === 'cescilia' || kind === 'aster') {
    const petalCol = kind === 'cescilia' ? 0xf4f6ff : 0x8f7bff;
    const centerCol = 0xffd75a;
    const petals = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      petals.push({ geo: new THREE.PlaneGeometry(0.16, 0.36, 1, 1), color: petalCol, jitter: 0.02, x: Math.cos(a) * 0.12, y: 0.95, z: Math.sin(a) * 0.12, rz: -Math.PI / 2, ry: -a, seed: i + 31 });
    }
    return compound([
      { geo: stem(0.9), color: 0x3f7d38, jitter: 0.04 },
      { geo: new THREE.SphereGeometry(0.08, 6, 4), color: centerCol, y: 0.95, seed: 5 },
      ...petals,
    ]);
  }
  if (kind === 'dandelion') {
    const puff = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, b = (i % 3) * 0.9 - 0.9;
      puff.push({ geo: new THREE.PlaneGeometry(0.03, 0.3, 1, 1), color: 0xffffff, jitter: 0.05, x: Math.cos(a) * 0.14 * Math.cos(b), y: 1.0 + Math.sin(b) * 0.14, z: Math.sin(a) * 0.14 * Math.cos(b), rz: -Math.PI / 2 + b, ry: -a, seed: i + 51 });
    }
    return compound([
      { geo: stem(0.9), color: 0x4a8a3c, jitter: 0.04 },
      { geo: new THREE.SphereGeometry(0.07, 6, 4), color: 0xf5ead0, y: 1.0, seed: 9 },
      ...puff,
    ]);
  }
  if (kind === 'lampgrass') {
    return compound([
      { geo: stem(0.8), color: 0x2f5d33, jitter: 0.04 },
      { geo: new THREE.IcosahedronGeometry(0.12, 0), color: 0x67f0b0, jitter: 0.05, y: 0.92, glow: 1, seed: 13 },
      { geo: new THREE.IcosahedronGeometry(0.06, 0), color: 0xd6fff0, jitter: 0.03, y: 0.92, glow: 1, seed: 17 },
    ]);
  }
  // berry bush
  const berries = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.5, r = 0.22 + (i % 3) * 0.05;
    berries.push({ geo: new THREE.OctahedronGeometry(0.06, 0), color: 0xd63a4a, y: 0.28 + (i % 2) * 0.08, x: Math.cos(a) * r, z: Math.sin(a) * r, seed: i + 71 });
  }
  return compound([
    { geo: lumpy(new THREE.IcosahedronGeometry(0.34, 0), 0.25), color: 0x4d8f3a, jitter: 0.05, y: 0.3, sx: 1.0, sy: 0.8, sz: 1.0 },
    ...berries,
  ]);
}

function makeFlowerGeo(kind) {
  const g = flowerCompound(kind);
  // rename aCanopy -> aGlow for the flower shader
  const sw = g.getAttribute('aCanopy');
  const glow = new THREE.BufferAttribute(sw.array.slice(), 1);
  g.setAttribute('aGlow', glow);
  g.deleteAttribute('aCanopy');
  return g;
}

function makeTreeGeo(kind) {
  const trunkCol = 0x7a5230, barkCol = 0x6b5a45, pineCol = 0x2f6b3a;
  const oakCol = 0x5fae4f, oakCol2 = 0x6fbf5a, palmTrunk = 0xa98a5a, palmLeaf = 0x5fa84a;
  if (kind === 'oak') {
    const trunk = bendTrunk(new THREE.CylinderGeometry(0.18, 0.44, 3.0, 6, 3).translate(0, 1.5, 0), 0.35, 0.4);
    const blobs = [
      { geo: lumpy(new THREE.IcosahedronGeometry(1.15, 0), 0.3), color: oakCol, x: 0.2, y: 3.0, z: 0.1, seed: 21 },
      { geo: lumpy(new THREE.IcosahedronGeometry(0.95, 0), 0.3), color: oakCol2, x: -0.7, y: 3.5, z: 0.2, seed: 27 },
      { geo: lumpy(new THREE.IcosahedronGeometry(0.85, 0), 0.3), color: oakCol, x: 0.7, y: 3.6, z: -0.2, seed: 33 },
      { geo: lumpy(new THREE.IcosahedronGeometry(0.7, 0), 0.3), color: oakCol2, x: 0.0, y: 4.3, z: 0.0, seed: 39 },
    ].map((b) => ({ ...b, sway: 1 }));
    return compound([{ geo: trunk, color: trunkCol, jitter: 0.05 }, ...blobs]);
  }
  if (kind === 'pine') {
    const trunk = new THREE.CylinderGeometry(0.14, 0.3, 1.6, 6, 3).translate(0, 0.8, 0);
    const cones = [
      { geo: new THREE.ConeGeometry(1.35, 1.9, 7, 1), color: pineCol, y: 1.6, sway: 1, seed: 41 },
      { geo: new THREE.ConeGeometry(1.05, 1.7, 7, 1), color: 0x377f42, y: 2.5, sway: 1, seed: 47 },
      { geo: new THREE.ConeGeometry(0.7, 1.5, 7, 1), color: 0x3f8c4b, y: 3.4, sway: 1, seed: 53 },
    ];
    return compound([{ geo: trunk, color: trunkCol, jitter: 0.04 }, ...cones]);
  }
  if (kind === 'dead') {
    const trunk = bendTrunk(new THREE.CylinderGeometry(0.1, 0.32, 3.4, 5, 4).translate(0, 1.7, 0), 0.8, 1.2);
    const branches = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.3, up = 1.6 + i * 0.5;
      branches.push({ geo: new THREE.CylinderGeometry(0.035, 0.09, 1.1, 4, 1).translate(0, 0.55, 0), color: barkCol, jitter: 0.05, x: Math.cos(a) * 0.18, y: up, z: Math.sin(a) * 0.18, rz: 0.9 + Math.cos(a) * 0.4, rx: Math.sin(a) * 0.5, sway: 0.5, seed: i + 61 });
    }
    return compound([{ geo: trunk, color: barkCol, jitter: 0.05 }, ...branches]);
  }
  // palm
  const trunk = bendTrunk(new THREE.CylinderGeometry(0.15, 0.26, 4.4, 6, 5).translate(0, 2.2, 0), 0.55, 0.2);
  const fronds = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    fronds.push({ geo: new THREE.PlaneGeometry(0.4, 1.7, 1, 3), color: palmLeaf, jitter: 0.05, x: Math.cos(a) * 0.1, y: 4.5, z: Math.sin(a) * 0.1, rz: -1.15, ry: -a, sway: 1, seed: i + 81 });
  }
  return compound([
    { geo: trunk, color: palmTrunk, jitter: 0.05 },
    { geo: new THREE.SphereGeometry(0.22, 6, 5), color: palmLeaf, y: 4.5 },
    ...fronds,
  ]);
}

function makeCrossPlaneGeometry() {
  const a = new THREE.PlaneGeometry(1, 1, 1, 1);
  const b = new THREE.PlaneGeometry(1, 1, 1, 1);
  b.rotateY(Math.PI / 2);
  return mergeGeometries([a, b], false);
}

// ---------------------------------------------------------------- textures

const _billCache = new Map();
function billboardTexture(kind) {
  if (_billCache.has(kind)) return _billCache.get(kind);
  const size = 256, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const rng = makeRNG(kind === 'conifer' ? 7 : kind === 'palm' ? 13 : 3);
  const trunk = kind === 'palm' ? '#a98a5a' : kind === 'conifer' ? '#6b5238' : '#6b5238';
  const leaf = kind === 'palm' ? '#5fa84a' : kind === 'conifer' ? '#2f6b3a' : '#4f9c44';
  const cx = size / 2;
  // trunk
  g.fillStyle = trunk;
  g.fillRect(cx - 8, size * 0.42, 16, size * 0.5);
  if (kind === 'palm') {
    g.save(); g.translate(cx, size * 0.42);
    for (let i = 0; i < 7; i++) {
      g.save(); g.rotate((i / 7) * Math.PI * 2);
      g.fillStyle = leaf;
      g.beginPath();
      g.moveTo(0, 0); g.quadraticCurveTo(size * 0.18, -size * 0.14, size * 0.3, -size * 0.05);
      g.quadraticCurveTo(size * 0.16, size * 0.0, 0, 0);
      g.fill(); g.restore();
    }
    g.restore();
  } else if (kind === 'conifer') {
    for (let i = 0; i < 4; i++) {
      const y = size * (0.44 - i * 0.1), w = size * (0.34 - i * 0.07), h = size * 0.17;
      g.fillStyle = leaf;
      g.beginPath(); g.moveTo(cx, y - h); g.lineTo(cx - w, y); g.lineTo(cx + w, y); g.closePath(); g.fill();
    }
  } else {
    const blobs = [[0, size * 0.3, size * 0.30], [-size * 0.12, size * 0.22, size * 0.2], [size * 0.12, size * 0.22, size * 0.2], [0, size * 0.15, size * 0.16]];
    g.fillStyle = leaf;
    for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(cx + bx, by, r, 0, 6.2832); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  _billCache.set(kind, t);
  return t;
}

// ---------------------------------------------------------------- slot pool

class InstanceStore {
  constructor(mesh, capacity) {
    this.mesh = mesh; this.capacity = capacity;
    this.byKey = new Map(); this.keys = new Array(capacity).fill(null);
    this.count = 0; this.dirty = false;
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, ZERO);
    mesh.count = 0;
  }
  alloc(key) { const i = this.count; if (i >= this.capacity) return -1; this.byKey.set(key, i); this.keys[i] = key; this.count++; return i; }
  set(key, x, y, z, rotY, sx, sy, sz, color) {
    const i = this.byKey.get(key); if (i == null) return false;
    _p.set(x, y, z); _e.set(0, rotY, 0); _s.set(sx, sy ?? sx, sz ?? sx);
    this.mesh.setMatrixAt(i, _m4.compose(_p, _q.setFromEuler(_e), _s));
    if (color) this.mesh.setColorAt(i, color);
    this.dirty = true;
    return true;
  }
  hide(key) { const i = this.byKey.get(key); if (i == null) return; this.mesh.setMatrixAt(i, ZERO); this.dirty = true; }
  release(key) {
    const i = this.byKey.get(key); if (i == null) return;
    this.byKey.delete(key);
    const last = this.count - 1;
    if (i !== last) {
      const moved = this.keys[last];
      this.keys[i] = moved; this.byKey.set(moved, i);
      const m = new THREE.Matrix4(); this.mesh.getMatrixAt(last, m); this.mesh.setMatrixAt(i, m);
      if (this.mesh.instanceColor) { const c = new THREE.Color(); this.mesh.getColorAt(last, c); this.mesh.setColorAt(i, c); }
    }
    this.keys[last] = null;
    this.mesh.setMatrixAt(last, ZERO);
    this.count = last;
    this.dirty = true;
  }
  flush() { if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.mesh.count = this.count; this.dirty = false; } }
}

// ---------------------------------------------------------------- class

const FLOWER_KINDS = ['cescilia', 'aster', 'dandelion', 'lampgrass', 'berry'];
const TREE_KINDS = ['oak', 'pine', 'dead', 'palm'];
const BILL_KINDS = ['broad', 'conifer', 'palm'];

export class Vegetation {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.density = clamp(ctx.quality.grassDensity ?? 0.7, 0.1, 1.2);
    this.group = new THREE.Group(); this.group.name = 'vegetation'; this.scene.add(this.group);

    this.grassMat = makeGrassMaterial();
    this.flowerMat = makeFlowerMaterial(false);
    this.lampgrassMat = makeLampgrassMaterial();
    this.treeMat = makeTreeToonMaterial();

    // grass
    this.grassCapacity = Math.max(3000, Math.round(18000 * this.density));
    this.grass = new THREE.InstancedMesh(makeGrassClusterGeometry(3), this.grassMat, this.grassCapacity);
    this.grass.setColorAt(0, new THREE.Color(1, 1, 1));
    this.grass.frustumCulled = false; this.grass.castShadow = false; this.grass.receiveShadow = true;
    this.grass.name = 'grass';
    this.group.add(this.grass);
    this.grassStore = new InstanceStore(this.grass, this.grassCapacity);

    // flowers
    this.flowerMeshes = {}; this.flowerStores = {};
    for (const k of FLOWER_KINDS) {
      const mesh = new THREE.InstancedMesh(makeFlowerGeo(k), k === 'lampgrass' ? this.lampgrassMat : this.flowerMat, 1000);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'flower-' + k;
      this.group.add(mesh);
      this.flowerMeshes[k] = mesh; this.flowerStores[k] = new InstanceStore(mesh, 2000);
    }

    // full trees
    this.treeMeshes = {}; this.treeStores = {};
    for (const k of TREE_KINDS) {
      const mesh = new THREE.InstancedMesh(makeTreeGeo(k), this.treeMat, 600);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'tree-' + k;
      this.group.add(mesh);
      this.treeMeshes[k] = mesh; this.treeStores[k] = new InstanceStore(mesh, 600);
    }

    // billboard LOD trees
    this.billMeshes = {}; this.billStores = {};
    for (const k of BILL_KINDS) {
      const mat = new THREE.MeshBasicMaterial({ map: billboardTexture(k), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.InstancedMesh(makeCrossPlaneGeometry(), mat, 600);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      mesh.frustumCulled = false; mesh.name = 'tree-lod-' + k;
      this.group.add(mesh);
      this.billMeshes[k] = mesh; this.billStores[k] = new InstanceStore(mesh, 600);
    }

    this.grassCells = new Map(); this.flowerCells = new Map(); this.treeCells = new Map();
    this._gpc = { x: 1e9, z: 1e9 }; this._fpc = { x: 1e9, z: 1e9 }; this._tpc = { x: 1e9, z: 1e9 };
    this._player = new THREE.Vector3();
    this._windTime = 0;
    this.collisionKeys = new Set();
    this.fixed = new THREE.Group(); this.fixed.name = 'veg-fixed'; this.group.add(this.fixed);
    ctx.tasks.push(() => this._buildWindrise(), 2);
    ctx.tasks.push(() => this._buildVillageTrees(), 3);
  }

  _windAmp() { return 0.16; }

  _grassTint(m, jitter = 0) {
    // dry -> warm yellow-green, wet -> cool blue-green; near-white so it only shifts hue.
    // per-instance jitter breaks up the "uniform spikes" look.
    const c = new THREE.Color();
    c.setHSL(0.30 - m * 0.10 + (jitter - 0.5) * 0.045, 0.12 + jitter * 0.07, 0.72 - m * 0.05 + (jitter - 0.5) * 0.22);
    return c;
  }

  update(dt, playerPos) {
    const p = playerPos || this.ctx.camera.position;
    this._player.set(p.x, 0, p.z);
    this._windTime += dt;
    const u = this.grassMat.userData.uniforms;
    u.uTime.value = this._windTime; u.uWindAmp.value = this._windAmp();
    u.uPlayerPos.value.set(p.x, 0, p.z);
    this.flowerMat.userData.uniforms.uTime.value = this._windTime;
    this.lampgrassMat.userData.uniforms.uTime.value = this._windTime;
    this.treeMat.userData.uniforms.uWindTime.value = this._windTime;

    this._streamGrass(p);
    this._streamFlowers(p);
    this._streamTrees(p);
    this._updateWindrise(dt);
    this.grassStore.flush();
    for (const k of FLOWER_KINDS) this.flowerStores[k].flush();
    for (const k of TREE_KINDS) this.treeStores[k].flush();
    for (const k of BILL_KINDS) this.billStores[k].flush();
  }

  _batch(cells, genFn) {
    const BATCH = 9;
    for (let i = 0; i < cells.length; i += BATCH) {
      const group = cells.slice(i, i + BATCH);
      const pri = group[0][3];
      this.ctx.tasks.push(() => { for (const c of group) genFn(c); }, pri);
    }
  }

  _streamGrass(p) {
    const cs = 32, radius = 70;
    const cx = Math.floor(p.x / cs), cz = Math.floor(p.z / cs);
    if (cx === this._gpc.x && cz === this._gpc.z) return;
    this._gpc.x = cx; this._gpc.z = cz;
    const rings = Math.ceil(radius / cs);
    const need = new Set(); const newCells = [];
    for (let j = -rings; j <= rings; j++) for (let i = -rings; i <= rings; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) > rings) continue;
      const gx = cx + i, gz = cz + j, key = cellKey(gx, gz);
      need.add(key);
      if (!this.grassCells.has(key)) { this.grassCells.set(key, { grass: [] }); newCells.push([gx, gz, key, Math.max(Math.abs(i), Math.abs(j))]); }
    }
    this._batch(newCells, (c) => this._genGrassCell(c[0], c[1], c[2]));
    for (const [key, rec] of this.grassCells) if (!need.has(key)) { for (const k of rec.grass) this.grassStore.release(k); this.grassCells.delete(key); }
  }

  _genGrassCell(gx, gz, key) {
    const rec = this.grassCells.get(key); if (!rec) return;
    const rng = cellRNG(gx, gz, 101);
    const cs = 32;
    const target = Math.round(cs * cs * 0.46 * this.density);
    const maxA = Math.max(12, Math.round(target * 2.4));
    let placed = 0;
    for (let a = 0; a < maxA && placed < target; a++) {
      const x = (gx + rng()) * cs, z = (gz + rng()) * cs;
      if (Math.abs(x) > WORLD.landRadius || Math.abs(z) > WORLD.landRadius) continue;
      const h = height(x, z);
      if (h < 0.6) continue;
      if (slopeAt(x, z) > 0.45) continue;
      if (surfaceAt(x, z) !== 'grass') continue;
      const j = rng();
      const clump = j < 0.09 ? 0.50 + rng() * 0.14 : (0.19 + rng() * 0.17);
      const rot = rng() * TAU;
      const ikey = 'g' + key + ':' + placed;
      if (this.grassStore.alloc(ikey) < 0) break;
      // non-uniform: wider clumps get a little more spread, thin ones stay short
      this.grassStore.set(ikey, x, h, z, rot, clump * (0.85 + j * 0.4), clump, clump * (0.85 + (1 - j) * 0.4), this._grassTint(moistureAt(x, z), j));
      rec.grass.push(ikey);
      placed++;
    }
    this.grassStore.flush();
  }

  _streamFlowers(p) {
    const cs = 24, radius = 80;
    const cx = Math.floor(p.x / cs), cz = Math.floor(p.z / cs);
    if (cx === this._fpc.x && cz === this._fpc.z) return;
    this._fpc.x = cx; this._fpc.z = cz;
    const rings = Math.ceil(radius / cs);
    const need = new Set(); const newCells = [];
    for (let j = -rings; j <= rings; j++) for (let i = -rings; i <= rings; i++) {
      const gx = cx + i, gz = cz + j, key = cellKey(gx, gz);
      need.add(key);
      if (!this.flowerCells.has(key)) { this.flowerCells.set(key, { list: [], interact: [] }); newCells.push([gx, gz, key, Math.max(Math.abs(i), Math.abs(j))]); }
    }
    this._batch(newCells, (c) => this._genFlowerCell(c[0], c[1], c[2]));
    for (const [key, rec] of this.flowerCells) if (!need.has(key)) { for (const k of rec.list) this._releaseFlower(k); for (const h of rec.interact) h?.remove?.(); this.flowerCells.delete(key); }
  }

  _releaseFlower(k) { this.flowerStores[k.kind]?.release(k.key); }

  _pickFlower(x, z, rng) {
    const reg = regionAt(x, z); const m = moistureAt(x, z); const r = rng();
    if (reg?.id === 'lake' || m > 0.62) { if (r < 0.45) return 'lampgrass'; if (r < 0.72) return 'cescilia'; return 'dandelion'; }
    if (reg?.id === 'windrise' || reg?.id === 'cider') { if (r < 0.34) return 'aster'; if (r < 0.6) return 'dandelion'; if (r < 0.86) return 'cescilia'; return 'berry'; }
    if (reg?.id === 'stormbearer') { if (r < 0.4) return 'berry'; if (r < 0.72) return 'dandelion'; return 'cescilia'; }
    if (m < 0.28) { if (r < 0.5) return 'berry'; return 'dandelion'; }
    if (r < 0.4) return 'dandelion'; if (r < 0.7) return 'cescilia'; if (r < 0.9) return 'aster'; return 'lampgrass';
  }

  _genFlowerCell(gx, gz, key) {
    const rec = this.flowerCells.get(key); if (!rec) return;
    const rng = cellRNG(gx, gz, 202);
    const cs = 24;
    const target = Math.round(cs * cs * 0.06);
    const maxA = Math.max(8, Math.round(target * 2.5));
    let placed = 0;
    for (let a = 0; a < maxA && placed < target; a++) {
      const x = (gx + rng()) * cs, z = (gz + rng()) * cs;
      if (Math.abs(x) > WORLD.landRadius || Math.abs(z) > WORLD.landRadius) continue;
      const h = height(x, z);
      if (h < 0.6) continue;
      if (slopeAt(x, z) > 0.45) continue;
      const surf = surfaceAt(x, z);
      if (surf !== 'grass') continue;
      const kind = this._pickFlower(x, z, rng);
      const s = (kind === 'berry' ? 0.6 : 0.55) + rng() * 0.5;
      const rot = rng() * TAU;
      const ikey = 'f' + key + ':' + placed;
      if (this.flowerStores[kind].alloc(ikey) < 0) continue;
      this.flowerStores[kind].set(ikey, x, h, z, rot, s, s, s);
      rec.list.push({ kind, key: ikey });
      placed++;
      if (rng() < 0.05 && this.ctx.interact && kind !== 'berry') {
        const hx = this._makeFlowerInteract(x, h, z, kind, ikey);
        if (hx) rec.interact.push(hx);
      }
    }
    for (const k of FLOWER_KINDS) this.flowerStores[k].flush();
  }

  _makeFlowerInteract(x, y, z, kind, ikey) {
    const names = { cescilia: '塞西莉亚花', aster: '风车菊', dandelion: '蒲公英', lampgrass: '小灯草' };
    const handle = this.ctx.interact?.register({
      pos: new THREE.Vector3(x, y, z), radius: 1.6, label: '采集', icon: 'pickup', priority: 0,
      once: true,
      onInteract: (c) => {
        this.flowerStores[kind]?.hide(ikey);
        c.ui?.toast?.('采集了 ' + (names[kind] || '花草'), { icon: 'pickup' });
        c.events?.emit('interact:used', { handle });
      },
    });
    return handle;
  }

  _streamTrees(p) {
    const cs = 64, radius = 150, near = 90;
    const cx = Math.floor(p.x / cs), cz = Math.floor(p.z / cs);
    if (cx === this._tpc.x && cz === this._tpc.z) return;
    this._tpc.x = cx; this._tpc.z = cz;
    const rings = Math.ceil(radius / cs);
    const need = new Set(); const newCells = [];
    for (let j = -rings; j <= rings; j++) for (let i = -rings; i <= rings; i++) {
      const gx = cx + i, gz = cz + j, key = cellKey(gx, gz);
      need.add(key);
      if (!this.treeCells.has(key)) { this.treeCells.set(key, { list: [] }); newCells.push([gx, gz, key, Math.max(Math.abs(i), Math.abs(j))]); }
    }
    this._batch(newCells, (c) => this._genTreeCell(c[0], c[1], c[2]));
    for (const [key, rec] of this.treeCells) if (!need.has(key)) { for (const k of rec.list) this._releaseTree(k); this.treeCells.delete(key); }
  }

  _releaseTree(k) { (k.bill ? this.billStores[k.bill] : this.treeStores[k.kind])?.release(k.key); }

  _treeDensity(x, z) {
    const h = height(x, z);
    if (h < 0.8) return 0;
    if (slopeAt(x, z) > 0.5) return 0;
    if (Math.hypot(x, z) < WORLD.villageRadius + 16) return 0;
    const reg = regionAt(x, z), surf = surfaceAt(x, z);
    if (reg?.id === 'dragonspine') return slopeAt(x, z) < 0.4 ? 0.35 : 0;
    if (reg?.id === 'beach') return 0.14;
    if (reg?.id === 'stonegate' || reg?.id === 'ruins') return 0.12;
    if (reg?.id === 'stormbearer') return 1.35;
    if (reg?.id === 'windrise') return 0.7;
    if (surf === 'rock' || surf === 'snow') return 0;
    if (surf === 'sand') return 0.14;
    return 0.28 + moistureAt(x, z) * 0.7;
  }

  _pickTreeKind(x, z, rng) {
    const reg = regionAt(x, z), surf = surfaceAt(x, z), h = height(x, z), m = moistureAt(x, z);
    if (reg?.id === 'dragonspine' || surf === 'snow') return rng() < 0.7 ? 'pine' : 'dead';
    if (reg?.id === 'beach' || surf === 'sand') return rng() < 0.85 ? 'palm' : 'dead';
    if (reg?.id === 'stonegate' || reg?.id === 'ruins') return rng() < 0.5 ? 'dead' : 'pine';
    const r = rng();
    if (h > 95) return r < 0.8 ? 'pine' : 'dead';
    if (m < 0.3) return r < 0.3 ? 'dead' : (r < 0.7 ? 'pine' : 'oak');
    return r < 0.62 ? 'oak' : (r < 0.9 ? 'pine' : 'dead');
  }

  _genTreeCell(gx, gz, key) {
    const rec = this.treeCells.get(key); if (!rec) return;
    const rng = cellRNG(gx, gz, 303);
    const cs = 64;
    const cx = (gx + 0.5) * cs, cz = (gz + 0.5) * cs;
    const dens = this._treeDensity(cx, cz);
    if (dens <= 0) return;
    const target = Math.round(dens * 4.5);
    const placed = [];
    const maxA = Math.max(10, Math.round(target * 4));
    for (let a = 0; a < maxA && placed.length < target; a++) {
      const x = (gx + rng()) * cs, z = (gz + rng()) * cs;
      if (Math.abs(x) > WORLD.landRadius || Math.abs(z) > WORLD.landRadius) continue;
      if (this._treeDensity(x, z) <= 0) continue;
      let ok = true;
      for (const q of placed) if (Math.hypot(q.x - x, q.z - z) < 6) { ok = false; break; }
      if (!ok) continue;
      const h = height(x, z);
      const kind = this._pickTreeKind(x, z, rng);
      const d = Math.hypot(x - this._player.x, z - this._player.z);
      const ikey = 't' + key + ':' + placed.length;
      if (d < 90) {
        const scale = kind === 'oak' ? 2.6 + rng() * 2.6 : kind === 'pine' ? 2.8 + rng() * 2.8 : kind === 'dead' ? 1.6 + rng() * 1.4 : 2.2 + rng() * 2.0;
        if (this.treeStores[kind].alloc(ikey) < 0) continue;
        this.treeStores[kind].set(ikey, x, h, z, rng() * TAU, scale, scale, scale);
        rec.list.push({ kind, key: ikey });
        this._registerTreeCollision(x, z, h, kind);
      } else {
        const bill = kind === 'oak' ? 'broad' : kind === 'palm' ? 'palm' : 'conifer';
        const scale = (kind === 'oak' ? 7 : kind === 'pine' ? 9 : kind === 'palm' ? 8 : 6) + rng() * 3;
        const col = kind === 'dead' ? new THREE.Color(0x8a7358) : new THREE.Color(1, 1, 1);
        if (this.billStores[bill].alloc(ikey) < 0) continue;
        this.billStores[bill].set(ikey, x, h, z, rng() * TAU, scale, scale, scale, col);
        rec.list.push({ bill, key: ikey });
      }
      placed.push({ x, z });
    }
    for (const k of TREE_KINDS) this.treeStores[k].flush();
    for (const k of BILL_KINDS) this.billStores[k].flush();
  }

  _registerTreeCollision(x, z, y, kind) {
    const ck = 'tree_' + Math.round(x) + '_' + Math.round(z);
    if (this.collisionKeys.has(ck)) return;
    this.collisionKeys.add(ck);
    const r = kind === 'oak' ? 0.5 : kind === 'pine' ? 0.45 : kind === 'palm' ? 0.4 : 0.35;
    this.ctx.collision?.addCylinder(x, z, r, y, y + 3.5);
  }

  // ---- fixed landmarks ---------------------------------------------------

  _buildWindrise() {
    const x = -230, z = 210, baseY = height(x, z);
    const g = new THREE.Group(); g.position.set(x, baseY, z); g.name = 'windrise-tree';
    const trunkParts = [];
    const segs = 4, segH = 6.5;
    for (let i = 0; i < segs; i++) {
      const r0 = 2.2 - i * 0.4, r1 = 2.2 - (i + 1) * 0.4;
      const seg = bendTrunk(new THREE.CylinderGeometry(r1, r0, segH, 8, 3).translate(0, segH / 2, 0), 0.6 + i * 0.4, 0.2 + i * 0.15);
      trunkParts.push({ geo: seg, color: 0x7a5230, jitter: 0.04, y: i * segH });
    }
    const canopy = new THREE.Group(); canopy.position.y = segs * segH - 1;
    const blobs = [];
    const blobDefs = [[0, 3, 0, 10], [-7, 9, 3, 8], [7, 7, -2, 8], [0, 12, 6, 7], [6, 13, 4, 6.5], [-6, 13, -3, 6.5], [0, 17, 0, 6.5]];
    for (let i = 0; i < blobDefs.length; i++) {
      const [bx, by, bz, r] = blobDefs[i];
      const blob = lumpy(new THREE.IcosahedronGeometry(r, 1), 0.32);
      blob.translate(bx, by, bz);
      blobs.push({ geo: blob, color: i % 2 ? 0x5fae4f : 0x6fbf5a, jitter: 0.05 });
    }
    // hanging vines
    const vines = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.4, vr = 5 + (i % 3) * 2, len = 11 + (i % 4) * 3;
      vines.push({ geo: new THREE.CylinderGeometry(0.08, 0.12, len, 4, 2).translate(0, -len / 2, 0), color: 0x4d9c46, jitter: 0.05, x: Math.cos(a) * vr, y: 11 - (i % 2) * 2, z: Math.sin(a) * vr, sway: 1 });
    }
    const trunkGeo = compound(trunkParts);
    const canopyGeo = compound([...blobs, ...vines]);
    const trunkMesh = new THREE.Mesh(trunkGeo, this.treeMat);
    trunkMesh.castShadow = true; trunkMesh.receiveShadow = true;
    const canopyMesh = new THREE.Mesh(canopyGeo, this.treeMat);
    canopyMesh.castShadow = true; canopyMesh.receiveShadow = true;
    g.add(trunkMesh, canopyMesh);
    this.fixed.add(g);
    this._windriseCanopy = canopyMesh;
    this._windriseBase = baseY;
    this.ctx.collision?.addCylinder(x, z, 2.5, baseY, baseY + 16);
  }

  _buildVillageTrees() {
    const spots = [[16, -14], [-12, -18], [22, 8], [-22, 10], [14, 32], [-6, -28], [40, 14], [-40, -12]];
    spots.forEach(([x, z], i) => {
      const h = height(x, z);
      const kind = i % 2 ? 'oak' : 'pine';
      const ikey = 'decor:' + i;
      const s = kind === 'oak' ? 2.2 + i * 0.1 : 2.4 + i * 0.1;
      if (this.treeStores[kind].alloc(ikey) < 0) return;
      this.treeStores[kind].set(ikey, x, h, z, i * 0.9, s, s, s);
    });
    for (const k of TREE_KINDS) this.treeStores[k].flush();
  }

  _updateWindrise(dt) {
    if (!this._windriseCanopy) return;
    const t = this._windTime;
    this._windriseCanopy.rotation.z = Math.sin(t * 0.5) * 0.015;
    this._windriseCanopy.rotation.x = Math.cos(t * 0.42) * 0.01;
  }

  dispose() {
    for (const m of [this.grass, ...Object.values(this.flowerMeshes), ...Object.values(this.treeMeshes), ...Object.values(this.billMeshes)]) {
      this.scene.remove(m); m.geometry.dispose(); m.material.dispose();
    }
    this.scene.remove(this.group);
    this.grassMat.dispose(); this.flowerMat.dispose(); this.lampgrassMat.dispose();
  }
}