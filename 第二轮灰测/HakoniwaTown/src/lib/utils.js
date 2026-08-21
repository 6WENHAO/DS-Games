/**
 * 通用工具：数学、随机、材质缓存、几何体工厂、合批器
 * 所有模块共用，不依赖 DOM，可在 Node 下做无头自检。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ----------------------------------------------------------- 数学 */
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const smoothBand = (a, b, v) => smoothstep(invLerp(a, b, v));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const pingPong = (t, len = 1) => { const m = ((t % (len * 2)) + len * 2) % (len * 2); return m > len ? len * 2 - m : m; };

/* ----------------------------------------------------------- 随机 */
export class RNG {
  constructor(seed = 20240917) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1 - 1e-9)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  jitter(amount = 1) { return (this.next() * 2 - 1) * amount; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
}

/** 平滑值噪声（确定性、无需贴图），用于地形起伏与风的扰动 */
export function noise2(x, z) {
  return (
    0.5 * Math.sin(x * 0.19 + z * 0.13 + 0.7) +
    0.3 * Math.sin(x * 0.41 - z * 0.37 + 2.1) +
    0.14 * Math.sin((x + z) * 0.77 + 4.4) +
    0.06 * Math.sin(x * 1.51 - z * 1.13 + 1.2)
  );
}

/* ----------------------------------------------------------- 颜色/材质 */
const matStore = new Map();
/** 夜间需要点亮的材质集合 */
export const nightMats = [];

/**
 * 共享标准材质（按参数缓存，降低 draw call 与显存占用）
 */
export function mat(color, o = {}) {
  const key = `${color}|${o.rough ?? 0.8}|${o.metal ?? 0}|${o.flat ? 1 : 0}|${o.opacity ?? 1}|${o.side ?? 0}|${o.emissive ?? ''}|${o.emissiveIntensity ?? 0}|${o.depthWrite === false ? 'n' : 'y'}`;
  let m = matStore.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: o.rough ?? 0.8,
      metalness: o.metal ?? 0,
      flatShading: !!o.flat,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      depthWrite: o.depthWrite !== false,
    });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 1; }
    if (o.vertexColors) m.vertexColors = true;
    matStore.set(key, m);
  }
  return m;
}

/**
 * 会在入夜时亮起的材质（窗户 / 灯笼 / 招牌）
 * @param {string} dayColor 白天基色
 * @param {string} glow 夜晚自发光色
 */
export function glowMat(dayColor, glow, nightIntensity = 1.7, o = {}) {
  const key = `glow|${dayColor}|${glow}|${nightIntensity}|${o.rough ?? 0.25}|${o.opacity ?? 1}`;
  let m = matStore.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(dayColor),
      roughness: o.rough ?? 0.25,
      metalness: o.metal ?? 0.05,
      emissive: new THREE.Color(glow),
      emissiveIntensity: 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
    });
    matStore.set(key, m);
    nightMats.push({ m, day: o.dayIntensity ?? 0, night: nightIntensity, dayColor: new THREE.Color(dayColor), nightColor: new THREE.Color(o.nightBase ?? dayColor) });
  }
  return m;
}

/** 由昼夜系统调用：0=白天 1=深夜 */
export function setNightFactor(f) {
  for (const e of nightMats) {
    e.m.emissiveIntensity = lerp(e.day, e.night, f);
    e.m.color.copy(e.dayColor).lerp(e.nightColor, f);
  }
}

export function tint(hex, amount, rng) {
  const c = new THREE.Color(hex);
  const h = {}; c.getHSL(h);
  c.setHSL(
    (h.h + rng.jitter(amount * 0.05) + 1) % 1,
    clamp(h.s + rng.jitter(amount * 0.12), 0, 1),
    clamp(h.l + rng.jitter(amount * 0.09), 0.05, 0.97)
  );
  return '#' + c.getHexString();
}

/* ----------------------------------------------------------- 几何体工厂 */

/** 圆角矩形轮廓 */
export function roundedRectShape(w, d, r) {
  r = Math.min(r, Math.min(w, d) / 2 - 1e-4);
  const s = new THREE.Shape();
  const x = w / 2 - r, y = d / 2 - r;
  s.moveTo(-x - r, -y);
  s.lineTo(-x - r, y);
  s.quadraticCurveTo(-x - r, y + r, -x, y + r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x + r, y + r, x + r, y);
  s.lineTo(x + r, -y);
  s.quadraticCurveTo(x + r, -y - r, x, -y - r);
  s.lineTo(-x, -y - r);
  s.quadraticCurveTo(-x - r, -y - r, -x - r, -y);
  return s;
}

/** 带倒角圆角的立方体：底面在 y=0，中心在 XZ 原点 */
export function roundedBox(w, h, d, r = 0.12, bevel = 0.03) {
  const shape = roundedRectShape(w, d, r);
  const depth = Math.max(0.001, h - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

export function box(w, h, d) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }
export function cyl(rt, rb, h, seg = 12, open = false) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); g.translate(0, h / 2, 0); return g; }
export function cone(r, h, seg = 12) { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; }
export function sphere(r, w = 14, h = 10, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) { return new THREE.SphereGeometry(r, w, h, ps, pl, ts, tl); }
export function slab(w, h, d, r = 0.05) { return roundedBox(w, h, d, r, 0.02); }

/** 人字（双坡）屋顶：屋脊沿 X 轴，底面在 y=0，几何中心在原点 */
export function gableRoof(w, d, h, overhang = 0.3) {
  const dd = d + overhang * 2;
  const len = w + overhang * 2;
  const s = new THREE.Shape();
  s.moveTo(-dd / 2, 0); s.lineTo(dd / 2, 0); s.lineTo(0, h); s.lineTo(-dd / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(-len / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

/** 折线（谷仓/孟莎）屋顶 */
export function gambrelRoof(w, d, h, overhang = 0.25) {
  const dd = d + overhang * 2;
  const len = w + overhang * 2;
  const s = new THREE.Shape();
  s.moveTo(-dd / 2, 0);
  s.lineTo(-dd * 0.31, h * 0.58);
  s.lineTo(0, h);
  s.lineTo(dd * 0.31, h * 0.58);
  s.lineTo(dd / 2, 0);
  s.lineTo(-dd / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(-len / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

/** 四坡（庇檐）屋顶：屋脊沿 X 轴 */
export function hipRoof(w, d, h, ridgeFrac = 0.42, overhang = 0.3) {
  const W = w / 2 + overhang, D = d / 2 + overhang, R = (w / 2) * ridgeFrac;
  const v = [
    -W, 0, -D, W, 0, -D, W, 0, D, -W, 0, D, // 0..3 底
    -R, h, 0, R, h, 0,                      // 4,5 脊
  ];
  const idx = [
    0, 4, 5, 0, 5, 1,   // -Z 坡
    2, 5, 4, 2, 4, 3,   // +Z 坡
    3, 4, 0,            // -X 端
    1, 5, 2,            // +X 端
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** 金字塔/尖锥屋顶（矩形底） */
export function pyramidRoof(w, d, h, overhang = 0.3) {
  const W = w / 2 + overhang, D = d / 2 + overhang;
  const v = [-W, 0, -D, W, 0, -D, W, 0, D, -W, 0, D, 0, h, 0];
  const idx = [0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** 由二维轮廓旋转成型（洋葱顶、花瓶、水塔等） */
export function lathe(points, seg = 18) {
  const pts = points.map((p) => new THREE.Vector2(Math.max(1e-4, p[0]), p[1]));
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

/** 台阶（合并成单一几何体） */
export function stairs(width, run, rise, steps) {
  const list = [];
  const sr = run / steps, sh = rise / steps;
  for (let i = 0; i < steps; i++) {
    const g = box(width, sh * (i + 1), sr);
    g.translate(0, 0, -run / 2 + sr * (i + 0.5));
    list.push(g.toNonIndexed());
  }
  return mergeGeometries(list, false);
}

/** 栏杆：沿 X 轴，长度 len */
export function railing(len, h = 0.55, spacing = 0.7, thickness = 0.06) {
  const list = [];
  const n = Math.max(2, Math.round(len / spacing));
  for (let i = 0; i <= n; i++) {
    const g = box(thickness, h, thickness);
    g.translate(-len / 2 + (len * i) / n, 0, 0);
    list.push(g.toNonIndexed());
  }
  const top = box(len, thickness * 1.3, thickness * 1.8); top.translate(0, h, 0); list.push(top.toNonIndexed());
  const mid = box(len, thickness * 0.8, thickness * 1.1); mid.translate(0, h * 0.52, 0); list.push(mid.toNonIndexed());
  return mergeGeometries(list, false);
}

/** 拱形墙段（高架桥/城门）：正面朝 ±Z，厚度沿 Z */
export function archWall(w, h, thickness, archW, archH) {
  const s = roundedRectShape(w, h, 0.02);
  const hole = new THREE.Path();
  const hw = archW / 2, foot = archH - hw;
  hole.moveTo(-hw, -h / 2 - 0.01);
  hole.lineTo(-hw, -h / 2 + foot);
  hole.absarc(0, -h / 2 + foot, hw, Math.PI, 0, true);
  hole.lineTo(hw, -h / 2 - 0.01);
  hole.lineTo(-hw, -h / 2 - 0.01);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, h / 2, -thickness / 2);
  g.computeVertexNormals();
  return g;
}

/** 沿曲线生成贴合地形的带状面（道路 / 河流 / 站台） */
export function ribbon(curve, width, o = {}) {
  const seg = o.segments ?? 220;
  const heightFn = o.heightFn ?? (() => 0);
  const yOff = o.yOffset ?? 0.06;
  const widthFn = typeof width === 'function' ? width : () => width;
  const pos = [], uv = [], idx = [], extra = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  let dist = 0; const prev = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    curve.getPointAt(Math.min(0.999999, u), p);
    curve.getTangentAt(Math.min(0.999999, u), t);
    const nx = t.z, nz = -t.x;
    const nl = Math.hypot(nx, nz) || 1;
    const w = widthFn(u) / 2;
    const off = o.offset ?? 0;
    if (i > 0) dist += p.distanceTo(prev);
    prev.copy(p);
    for (const s of [-1, 1]) {
      const x = p.x + (nx / nl) * (w * s + off);
      const z = p.z + (nz / nl) * (w * s + off);
      const y = (o.useCurveY ? p.y : heightFn(x, z)) + yOff;
      pos.push(x, y, z);
      uv.push(dist * (o.uvScale ?? 0.25), s < 0 ? 0 : 1);
      if (o.extraAttr) extra.push(o.extraAttr(u, s));
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, dd = a + 3;
    idx.push(a, c, b, b, c, dd);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (o.extraAttr) g.setAttribute(o.extraName ?? 'aFlow', new THREE.Float32BufferAttribute(extra, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function curveFrom(points, closed = false, tension = 0.5) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1] ?? 0, p[2] ?? p[1])), closed, 'catmullrom', tension);
}

/** XZ 平面折线到点的距离（返回距离与投影参数） */
export function distToPolyline(x, z, pts) {
  let best = Infinity, bestT = 0, acc = 0, total = 0, bpx = 0, bpz = 0;
  for (let i = 0; i < pts.length - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const dx = bx - ax, dz = bz - az;
    const segLen = Math.hypot(dx, dz) || 1e-6;
    let t = ((x - ax) * dx + (z - az) * dz) / (segLen * segLen);
    t = clamp(t, 0, 1);
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bestT = (acc + segLen * t) / total; bpx = px; bpz = pz; }
    acc += segLen;
  }
  return { dist: best, t: bestT, px: bpx, pz: bpz };
}

/* ----------------------------------------------------------- 合批器 */
/**
 * 统一属性集合，保证 mergeGeometries 不会因属性不一致而失败。
 */
function normalizeGeo(g) {
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'aSway') g.deleteAttribute(k);
  }
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.aSway) g.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}

/**
 * 把大量小几何体按材质合并成单个 Mesh，显著减少 draw call。
 */
export class Batch {
  constructor(name = 'batch') { this.name = name; this.map = new Map(); this.mats = new Map(); this.count = 0; }
  add(geo, material, tr = {}) {
    const g = normalizeGeo(geo.index ? geo.toNonIndexed() : geo.clone());
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tr.rx || 0, tr.ry || 0, tr.rz || 0));
    m.compose(
      new THREE.Vector3(tr.x || 0, tr.y || 0, tr.z || 0), q,
      new THREE.Vector3(tr.sx ?? tr.s ?? 1, tr.sy ?? tr.s ?? 1, tr.sz ?? tr.s ?? 1)
    );
    g.applyMatrix4(m);
    const key = material.uuid;
    if (!this.map.has(key)) { this.map.set(key, []); this.mats.set(key, material); }
    this.map.get(key).push(g);
    this.count++;
    return this;
  }
  /**
   * 把一整个 Group（例如一栋房子）按世界矩阵烘进合批；
   * 名字里带 "keep" 的子物体会被跳过（留给动画）。
   */
  addObject(obj, tr = {}) {
    obj.position.set(tr.x ?? obj.position.x, tr.y ?? obj.position.y, tr.z ?? obj.position.z);
    if (tr.ry !== undefined) obj.rotation.y = tr.ry;
    if (tr.s !== undefined) obj.scale.setScalar(tr.s);
    obj.updateMatrixWorld(true);
    const skipped = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      let p = o, keep = false;
      while (p) { if (p.userData && p.userData.keep) { keep = true; break; } p = p.parent; }
      if (keep) return;
      const g = normalizeGeo(o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      g.applyMatrix4(o.matrixWorld);
      const key = o.material.uuid;
      if (!this.map.has(key)) { this.map.set(key, []); this.mats.set(key, o.material); }
      this.map.get(key).push(g);
      this.count++;
    });
    // 需要保留动画的分支原样返回，由调用者加入场景
    obj.traverse((o) => { if (o.userData && o.userData.keep) skipped.push(o); });
    return skipped;
  }
  build(parent, o = {}) {    const out = [];
    for (const [key, list] of this.map) {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.mats.get(key));
      mesh.castShadow = o.cast ?? true;
      mesh.receiveShadow = o.receive ?? true;
      mesh.name = `${this.name}-${out.length}`;
      if (o.renderOrder) mesh.renderOrder = o.renderOrder;
      parent.add(mesh);
      out.push(mesh);
    }
    this.map.clear(); this.mats.clear();
    return out;
  }
}

/** 快捷 Mesh */
export function mesh(geo, material, tr = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(tr.x || 0, tr.y || 0, tr.z || 0);
  m.rotation.set(tr.rx || 0, tr.ry || 0, tr.rz || 0);
  const s = tr.s ?? 1;
  m.scale.set(tr.sx ?? s, tr.sy ?? s, tr.sz ?? s);
  m.castShadow = tr.cast ?? true;
  m.receiveShadow = tr.receive ?? true;
  return m;
}

export function group(name, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.name = name; g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}

export { mergeGeometries };
