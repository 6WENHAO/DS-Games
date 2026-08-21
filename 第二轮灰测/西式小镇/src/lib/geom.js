// ---------------------------------------------------------------------------
// 几何工厂 + Sculptor（雕刻器）
//
// 约定：所有基本体的局部原点都在 **底面中心**（球体和圆环除外，它们在几何中心），
// 这样叠楼层、放屋顶时坐标非常直观。
// 所有工厂都手工生成 position / normal / uv 三个属性（非索引），
// UV 按"世界尺寸 / tile"换算，保证贴图密度一致、不会被拉伸。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function build(positions, normals, uvs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return g;
}

/** 把一个四边形（p00 -> +U -> +V）压入三角形列表 */
function quad(P, N, U, p00, u, v, n, tile, uOff = 0, vOff = 0) {
  const p10 = [p00[0] + u[0], p00[1] + u[1], p00[2] + u[2]];
  const p11 = [p00[0] + u[0] + v[0], p00[1] + u[1] + v[1], p00[2] + u[2] + v[2]];
  const p01 = [p00[0] + v[0], p00[1] + v[1], p00[2] + v[2]];
  const lu = Math.hypot(u[0], u[1], u[2]) / tile;
  const lv = Math.hypot(v[0], v[1], v[2]) / tile;
  const tri = (a, b, c, ta, tb, tc) => {
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    N.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    U.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]);
  };
  const t00 = [uOff, vOff];
  const t10 = [uOff + lu, vOff];
  const t11 = [uOff + lu, vOff + lv];
  const t01 = [uOff, vOff + lv];
  tri(p00, p10, p11, t00, t10, t11);
  tri(p00, p11, p01, t00, t11, t01);
}

function tri3(P, N, U, a, b, c, uva, uvb, uvc) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  U.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
}

/* ------------------------------- 长方体 --------------------------------- */
export function makeBox(w, h, d, tile = 2, skipBottom = true) {
  const P = [];
  const N = [];
  const U = [];
  const hw = w / 2;
  const hd = d / 2;
  quad(P, N, U, [-hw, 0, hd], [w, 0, 0], [0, h, 0], [0, 0, 1], tile); // 前 +Z
  quad(P, N, U, [hw, 0, -hd], [-w, 0, 0], [0, h, 0], [0, 0, -1], tile); // 后 -Z
  quad(P, N, U, [hw, 0, hd], [0, 0, -d], [0, h, 0], [1, 0, 0], tile); // 右 +X
  quad(P, N, U, [-hw, 0, -hd], [0, 0, d], [0, h, 0], [-1, 0, 0], tile); // 左 -X
  quad(P, N, U, [-hw, h, hd], [w, 0, 0], [0, 0, -d], [0, 1, 0], tile); // 顶 +Y
  if (!skipBottom) quad(P, N, U, [-hw, 0, -hd], [w, 0, 0], [0, 0, d], [0, -1, 0], tile);
  return build(P, N, U);
}

/* --------------------------- 竖直四边形（贴片） -------------------------- */
export function makeQuad(w, h, tile = 2, doubleSided = false) {
  const P = [];
  const N = [];
  const U = [];
  quad(P, N, U, [-w / 2, 0, 0], [w, 0, 0], [0, h, 0], [0, 0, 1], tile);
  if (doubleSided) quad(P, N, U, [w / 2, 0, 0], [-w, 0, 0], [0, h, 0], [0, 0, -1], tile);
  return build(P, N, U);
}

/* --------------------------- 水平面（地面片） ---------------------------- */
export function makeFlat(w, d, tile = 2) {
  const P = [];
  const N = [];
  const U = [];
  quad(P, N, U, [-w / 2, 0, d / 2], [w, 0, 0], [0, 0, -d], [0, 1, 0], tile);
  return build(P, N, U);
}

/* ---------------------- 双坡屋顶（山墙沿 ±X 方向） ----------------------
 * parts: 'all' | 'slopes'（只要斜面）| 'ends'（只要两端三角）
 * 分开生成是为了让山墙面用墙体材质、斜面用瓦片材质。
 */
export function makeGable(w, d, h, tile = 2, ridgeLen = null, parts = 'all') {
  const P = [];
  const N = [];
  const U = [];
  const hw = w / 2;
  const hd = d / 2;
  const rl = ridgeLen === null ? w : ridgeLen;
  const rh = rl / 2;
  const A = [-hw, 0, -hd];
  const B = [hw, 0, -hd];
  const C = [hw, 0, hd];
  const D = [-hw, 0, hd];
  const E = [-rh, h, 0];
  const F = [rh, h, 0];
  const slope = Math.hypot(hd, h) / tile;
  const wt = w / tile;
  if (parts !== 'ends') {
    // +Z 坡面
    tri3(P, N, U, D, C, F, [0, 0], [wt, 0], [wt * ((rh + hw) / w), slope]);
    tri3(P, N, U, D, F, E, [0, 0], [wt * ((rh + hw) / w), slope], [wt * ((hw - rh) / w), slope]);
    // -Z 坡面
    tri3(P, N, U, B, A, E, [0, 0], [wt, 0], [wt * ((rh + hw) / w), slope]);
    tri3(P, N, U, B, E, F, [0, 0], [wt * ((rh + hw) / w), slope], [wt * ((hw - rh) / w), slope]);
  }
  if (parts !== 'slopes') {
    const eh = rl >= w - 1e-6 ? h / tile : Math.hypot((w - rl) / 2, h) / tile;
    tri3(P, N, U, A, D, E, [0, 0], [d / tile, 0], [d / tile / 2, eh]);
    tri3(P, N, U, C, B, F, [0, 0], [d / tile, 0], [d / tile / 2, eh]);
  }
  return build(P, N, U);
}

/** 四坡屋顶：山墙方向被削掉 */
export function makeHip(w, d, h, tile = 2, ridgeRatio = 0.45, parts = 'all') {
  return makeGable(w, d, h, tile, Math.max(0.001, w * ridgeRatio), parts);
}

/* ------------------------------ 金字塔屋顶 ------------------------------ */
export function makePyramid(w, d, h, tile = 2) {
  const P = [];
  const N = [];
  const U = [];
  const hw = w / 2;
  const hd = d / 2;
  const A = [-hw, 0, -hd];
  const B = [hw, 0, -hd];
  const C = [hw, 0, hd];
  const D = [-hw, 0, hd];
  const T = [0, h, 0];
  const sw = Math.hypot(hd, h) / tile;
  const sd = Math.hypot(hw, h) / tile;
  tri3(P, N, U, D, C, T, [0, 0], [w / tile, 0], [w / tile / 2, sw]);
  tri3(P, N, U, B, A, T, [0, 0], [w / tile, 0], [w / tile / 2, sw]);
  tri3(P, N, U, C, B, T, [0, 0], [d / tile, 0], [d / tile / 2, sd]);
  tri3(P, N, U, A, D, T, [0, 0], [d / tile, 0], [d / tile / 2, sd]);
  return build(P, N, U);
}

/* ------------------------------- 圆柱 / 锥 ------------------------------ */
export function makeCyl(rTop, rBot, h, seg = 16, tile = 2, caps = true) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, !caps);
  g.translate(0, h / 2, 0);
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (Math.PI * (rTop + rBot)) / tile, h / tile);
  ng.deleteAttribute('color');
  return ng;
}

export function makeCone(r, h, seg = 16, tile = 2) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, false);
  g.translate(0, h / 2, 0);
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (2 * Math.PI * r) / tile, h / tile);
  return ng;
}

export function makeBall(r, seg = 12, tile = 2) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2));
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (2 * Math.PI * r) / tile, (Math.PI * r) / tile);
  return ng;
}

export function makeTorus(r, tube, seg = 16, tubeSeg = 8, tile = 2) {
  const g = new THREE.TorusGeometry(r, tube, tubeSeg, seg);
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (2 * Math.PI * r) / tile, (2 * Math.PI * tube) / tile);
  return ng;
}

/** 圆盘（水平），用于喷泉水面等 */
export function makeDisc(r, seg = 24, tile = 2) {
  const g = new THREE.CircleGeometry(r, seg);
  g.rotateX(-Math.PI / 2);
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (2 * r) / tile, (2 * r) / tile);
  return ng;
}

/** 台阶：n 级，整体宽 w、总高 h、总进深 d，原点在底面中心 */
export function makeStairs(w, h, d, steps = 3, tile = 2) {
  const parts = [];
  for (let i = 0; i < steps; i++) {
    const sh = (h / steps) * (i + 1);
    const sd = d - (d / steps) * i;
    const g = makeBox(w, sh, sd, tile);
    g.translate(0, 0, (d - sd) / -2);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** 拱形墙（正面朝 ±Z，中间挖一个圆拱洞），用于石桥、城门、拱廊 */
export function makeArchWall(w, h, d, archW, archH, seg = 10, tile = 2) {
  const parts = [];
  const r0 = archW / 2;
  const cy = Math.max(0.001, archH - r0); // 起拱线高度
  const side = (w - archW) / 2;
  if (side > 0.01) {
    const l = makeBox(side, h, d, tile);
    l.translate(-(archW / 2 + side / 2), 0, 0);
    const r = makeBox(side, h, d, tile);
    r.translate(archW / 2 + side / 2, 0, 0);
    parts.push(l, r);
  }
  const n = Math.max(5, seg);
  // 拱肩填充（拱背到墙顶之间的部分，用竖直薄块拼出来）
  const step = (2 * r0) / n;
  for (let i = 0; i < n; i++) {
    const xm = -r0 + step * (i + 0.5);
    const yArc = cy + Math.sqrt(Math.max(0, r0 * r0 - xm * xm));
    const bh = h - yArc;
    if (bh > 0.04) {
      const b = makeBox(step + 0.03, bh, d, tile);
      b.translate(xm, yArc, 0);
      parts.push(b);
    }
  }
  // 拱洞两侧、起拱线以下的墙体（如果拱高小于洞宽的一半）
  // 拱券石（voussoir）
  for (let i = 0; i < n; i++) {
    const am = (Math.PI * (i + 0.5)) / n;
    const px = -Math.cos(am) * r0;
    const py = cy + Math.sin(am) * r0;
    const bw = (Math.PI * r0) / n + 0.06;
    const b = makeBox(bw, 0.36, d + 0.16, tile);
    b.translate(0, -0.18, 0);
    b.rotateZ(Math.PI / 2 - am);
    b.translate(px, py, 0);
    parts.push(b);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** 沿折线生成带状路面（水平），uv 沿路径方向连续 */
export function makeRibbon(points, width, tile = 4, y = 0) {
  const P = [];
  const N = [];
  const U = [];
  let dist = 0;
  const n = [0, 1, 0];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    let dx = x1 - x0;
    let dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    dx /= len;
    dz /= len;
    // 法向（水平）
    let px = -dz;
    let pz = dx;
    // 端点做一点重叠避免接缝
    const ext = i === 0 ? 0 : width * 0.5;
    const ext2 = i === points.length - 2 ? 0 : width * 0.5;
    const ax = x0 - dx * ext;
    const az = z0 - dz * ext;
    const bx = x1 + dx * ext2;
    const bz = z1 + dz * ext2;
    const hw = width / 2;
    const a0 = [ax + px * hw, y, az + pz * hw];
    const a1 = [ax - px * hw, y, az - pz * hw];
    const b0 = [bx + px * hw, y, bz + pz * hw];
    const b1 = [bx - px * hw, y, bz - pz * hw];
    const v0 = dist / tile;
    const v1 = (dist + len) / tile;
    const uw = width / tile;
    // 两个三角形，法线朝上
    tri3(P, N, U, a1, a0, b0, [0, v0], [uw, v0], [uw, v1]);
    tri3(P, N, U, a1, b0, b1, [0, v0], [uw, v1], [0, v1]);
    dist += len;
  }
  const g = build(P, N, U);
  // 强制法线朝上（防止折线自交时翻面）
  const na = g.getAttribute('normal');
  for (let i = 0; i < na.count; i++) na.setXYZ(i, 0, 1, 0);
  na.needsUpdate = true;
  return g;
}

export function scaleUV(geo, su, sv) {  const uv = geo.getAttribute('uv');
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}

/** 把多个几何体合并成一个（用于实例化的复合体） */
export function mergeMany(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  return mergeGeometries(list, false);
}

/* -------------------------------------------------------------------------- */
/*                                 Sculptor                                   */
/* -------------------------------------------------------------------------- */

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

/**
 * Sculptor 收集静态几何，按材质合并成极少量 Mesh（大幅降低 draw call），
 * 同时维护一个变换矩阵栈，方便"在局部坐标里建房子，再整体摆到街边"。
 */
export class Sculptor {
  constructor(name = 'part') {
    this.name = name;
    this.buckets = new Map(); // material -> geometry[]
    this.stack = [new THREE.Matrix4()];
    this.dynamic = new THREE.Group(); // 需要动画的物件（不合并）
    this.dynamic.name = name + ':dynamic';
    this.anchors = { smoke: [], glow: [], bird: [] };
    this.updates = []; // 每帧动画回调 (dt, t) => void
    this.pieces = 0;
  }

  /** 注册每帧动画回调 */
  onUpdate(fn) {
    this.updates.push(fn);
    return fn;
  }

  get matrix() {
    return this.stack[this.stack.length - 1];
  }

  /** 压入一个"平移 + 绕Y旋转 + 等比缩放"的局部坐标系 */
  push(x = 0, y = 0, z = 0, ry = 0, scale = 1) {
    _e.set(0, ry, 0);
    _q.setFromEuler(_e);
    const local = new THREE.Matrix4().compose(
      _v.set(x, y, z),
      _q,
      _s.set(scale, scale, scale)
    );
    this.stack.push(this.matrix.clone().multiply(local));
    return this;
  }

  pop() {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }

  /** 把几何体按当前坐标系写入（geo 会被克隆，调用方可复用） */
  add(geo, mat, local = null) {
    if (!geo) return this;
    let g = geo.clone();
    if (g.index) g = g.toNonIndexed();
    if (g.getAttribute('color')) g.deleteAttribute('color');
    const m = local ? this.matrix.clone().multiply(local) : this.matrix;
    g.applyMatrix4(m);
    let list = this.buckets.get(mat);
    if (!list) {
      list = [];
      this.buckets.set(mat, list);
    }
    list.push(g);
    this.pieces++;
    return this;
  }

  _local(x, y, z, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(1, 1, 1));
  }

  /* --- 便捷图元（位置均为"底面中心"，除 ball/torus） --- */
  box(mat, w, h, d, x = 0, y = 0, z = 0, ry = 0, tile = 2) {
    return this.add(makeBox(w, h, d, tile), mat, this._local(x, y, z, ry));
  }
  boxR(mat, w, h, d, x, y, z, rx, ry, rz, tile = 2) {
    return this.add(makeBox(w, h, d, tile), mat, this._local(x, y, z, ry, rx, rz));
  }
  flat(mat, w, d, x = 0, y = 0, z = 0, ry = 0, tile = 4) {
    return this.add(makeFlat(w, d, tile), mat, this._local(x, y, z, ry));
  }
  panel(mat, w, h, x = 0, y = 0, z = 0, ry = 0, tile = 2, both = false) {
    return this.add(makeQuad(w, h, tile, both), mat, this._local(x, y, z, ry));
  }
  gable(mat, w, d, h, x = 0, y = 0, z = 0, ry = 0, tile = 2, parts = 'all') {
    return this.add(makeGable(w, d, h, tile, null, parts), mat, this._local(x, y, z, ry));
  }
  hip(mat, w, d, h, x = 0, y = 0, z = 0, ry = 0, ratio = 0.45, tile = 2, parts = 'all') {
    return this.add(makeHip(w, d, h, tile, ratio, parts), mat, this._local(x, y, z, ry));
  }
  pyramid(mat, w, d, h, x = 0, y = 0, z = 0, ry = 0, tile = 2) {
    return this.add(makePyramid(w, d, h, tile), mat, this._local(x, y, z, ry));
  }
  cyl(mat, rTop, rBot, h, x = 0, y = 0, z = 0, seg = 14, ry = 0, tile = 2) {
    return this.add(makeCyl(rTop, rBot, h, seg, tile), mat, this._local(x, y, z, ry));
  }
  cylR(mat, rTop, rBot, h, x, y, z, rx, ry, rz, seg = 12, tile = 2) {
    return this.add(makeCyl(rTop, rBot, h, seg, tile), mat, this._local(x, y, z, ry, rx, rz));
  }
  /** 中心对齐的横梁/圆棒：axis = 'x' | 'y' | 'z'，中心位于 (x,y,z) */
  bar(mat, r, len, x, y, z, axis = 'y', seg = 10, tile = 2) {
    const rx = axis === 'z' ? Math.PI / 2 : 0;
    const rz = axis === 'x' ? Math.PI / 2 : 0;
    const local = this._local(x, y, z, 0, rx, rz).multiply(
      new THREE.Matrix4().makeTranslation(0, -len / 2, 0)
    );
    return this.add(makeCyl(r, r, len, seg, tile), mat, local);
  }
  /** 中心对齐的方梁：可任意旋转，几何中心位于 (x,y,z) */
  boxC(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, tile = 2) {
    const local = this._local(x, y, z, ry, rx, rz).multiply(
      new THREE.Matrix4().makeTranslation(0, -h / 2, 0)
    );
    return this.add(makeBox(w, h, d, tile), mat, local);
  }
  cone(mat, r, h, x = 0, y = 0, z = 0, seg = 14, ry = 0, tile = 2) {
    return this.add(makeCone(r, h, seg, tile), mat, this._local(x, y, z, ry));
  }
  ball(mat, r, x = 0, y = 0, z = 0, seg = 12, tile = 2) {
    return this.add(makeBall(r, seg, tile), mat, this._local(x, y, z));
  }
  torus(mat, r, tube, x, y, z, rx = 0, ry = 0, rz = 0, seg = 16, tile = 2) {
    return this.add(makeTorus(r, tube, seg, 8, tile), mat, this._local(x, y, z, ry, rx, rz));
  }
  disc(mat, r, x = 0, y = 0, z = 0, seg = 20, tile = 2) {
    return this.add(makeDisc(r, seg, tile), mat, this._local(x, y, z));
  }
  stairs(mat, w, h, d, x = 0, y = 0, z = 0, ry = 0, steps = 3, tile = 2) {
    return this.add(makeStairs(w, h, d, steps, tile), mat, this._local(x, y, z, ry));
  }
  arch(mat, w, h, d, aw, ah, x = 0, y = 0, z = 0, ry = 0, seg = 9, tile = 2) {
    return this.add(makeArchWall(w, h, d, aw, ah, seg, tile), mat, this._local(x, y, z, ry));
  }
  ribbon(mat, pts, width, y = 0, tile = 4) {
    return this.add(makeRibbon(pts, width, tile, y), mat);
  }

  /** 当前坐标系下的点 → 世界坐标 */
  world(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.matrix);
  }

  /** 把需要动画的 Object3D 按当前坐标系摆好并登记 */
  attach(obj, x = 0, y = 0, z = 0, ry = 0) {
    const m = this.matrix.clone().multiply(this._local(x, y, z, ry));
    m.decompose(obj.position, obj.quaternion, obj.scale);
    this.dynamic.add(obj);
    return obj;
  }

  /** 登记烟囱/灯光等锚点（世界坐标） */
  anchor(kind, x, y, z, data = {}) {
    const p = this.world(x, y, z);
    (this.anchors[kind] || (this.anchors[kind] = [])).push({ ...data, pos: p });
    return p;
  }

  /** 合并所有静态几何 → Group */
  finalize() {
    const group = new THREE.Group();
    group.name = this.name;
    for (const [mat, geos] of this.buckets) {
      let merged;
      if (geos.length === 1) merged = geos[0];
      else {
        merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
      }
      if (!merged) {
        console.warn('[Sculptor] merge failed for material', mat.name);
        continue;
      }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${this.name}:${mat.name || 'mat'}`;
      const sh = mat.userData?.shadow ?? 'both';
      mesh.castShadow = sh === 'both' || sh === 'cast';
      mesh.receiveShadow = sh === 'both' || sh === 'receive';
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.buckets.clear();
    if (this.dynamic.children.length) group.add(this.dynamic);
    return group;
  }
}

/** 实例化网格：transforms 为 Matrix4 数组 */
export function instanced(geo, mat, transforms, castShadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, transforms.length);
  transforms.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = castShadow;
  im.receiveShadow = true;
  im.frustumCulled = true;
  return im;
}

export function trs(x, y, z, ry = 0, s = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  const sc = typeof s === 'number' ? _s.set(s, s, s) : _s.set(s.x, s.y, s.z);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, sc);
}
