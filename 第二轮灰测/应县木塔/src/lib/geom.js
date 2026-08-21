// ---------------------------------------------------------------------------
// 几何工具箱
//
// 约定
//   · 单位 = 米；全塔按《营造法式》材分制度放样（见 cai.js）
//   · 基本体局部原点在「底面中心」（球/环在几何中心）
//   · 构件断面用 makeProfile（侧样轮廓沿厚度方向挤出）生成，
//     这样拱的卷杀、昂嘴、耍头、卯口都能如实做出来
//   · Sculptor 维护变换栈 + 按材质合并，几万个构件也只有几百个 draw call
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ========================================================================== */
/*                                基本体                                      */
/* ========================================================================== */

function build(P, N, U) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return g;
}

function quad(P, N, U, p00, u, v, n, tile) {
  const p10 = [p00[0] + u[0], p00[1] + u[1], p00[2] + u[2]];
  const p11 = [p00[0] + u[0] + v[0], p00[1] + u[1] + v[1], p00[2] + u[2] + v[2]];
  const p01 = [p00[0] + v[0], p00[1] + v[1], p00[2] + v[2]];
  const lu = Math.hypot(u[0], u[1], u[2]) / tile;
  const lv = Math.hypot(v[0], v[1], v[2]) / tile;
  const push = (a, b, c, ta, tb, tc) => {
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    N.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    U.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]);
  };
  push(p00, p10, p11, [0, 0], [lu, 0], [lu, lv]);
  push(p00, p11, p01, [0, 0], [lu, lv], [0, lv]);
}

function tri(P, N, U, a, b, c, ta, tb, tc) {
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
  U.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]);
}

/** 长方体：原点底面中心 */
export function makeBox(w, h, d, tile = 0.5, withBottom = true) {
  const P = [];
  const N = [];
  const U = [];
  const hw = w / 2;
  const hd = d / 2;
  quad(P, N, U, [-hw, 0, hd], [w, 0, 0], [0, h, 0], [0, 0, 1], tile);
  quad(P, N, U, [hw, 0, -hd], [-w, 0, 0], [0, h, 0], [0, 0, -1], tile);
  quad(P, N, U, [hw, 0, hd], [0, 0, -d], [0, h, 0], [1, 0, 0], tile);
  quad(P, N, U, [-hw, 0, -hd], [0, 0, d], [0, h, 0], [-1, 0, 0], tile);
  quad(P, N, U, [-hw, h, hd], [w, 0, 0], [0, 0, -d], [0, 1, 0], tile);
  if (withBottom) quad(P, N, U, [-hw, 0, -hd], [w, 0, 0], [0, 0, d], [0, -1, 0], tile);
  return build(P, N, U);
}

/** 棱台（四棱锥台）：上下截面可不同，原点底面中心。斗欹、柱收分、覆钵都用它 */
export function makeFrustum(wb, db, wt, dt, h, tile = 0.4) {
  const P = [];
  const N = [];
  const U = [];
  const b = [
    [-wb / 2, 0, db / 2],
    [wb / 2, 0, db / 2],
    [wb / 2, 0, -db / 2],
    [-wb / 2, 0, -db / 2],
  ];
  const t = [
    [-wt / 2, h, dt / 2],
    [wt / 2, h, dt / 2],
    [wt / 2, h, -dt / 2],
    [-wt / 2, h, -dt / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const su = Math.hypot(b[j][0] - b[i][0], b[j][2] - b[i][2]) / tile;
    const sv = Math.hypot(t[i][0] - b[i][0], h, t[i][2] - b[i][2]) / tile;
    tri(P, N, U, b[i], b[j], t[j], [0, 0], [su, 0], [su, sv]);
    tri(P, N, U, b[i], t[j], t[i], [0, 0], [su, sv], [0, sv]);
  }
  quad(P, N, U, [-wt / 2, h, dt / 2], [wt, 0, 0], [0, 0, -dt], [0, 1, 0], tile);
  quad(P, N, U, [-wb / 2, 0, -db / 2], [wb, 0, 0], [0, 0, db], [0, -1, 0], tile);
  return build(P, N, U);
}

/**
 * 侧样轮廓挤出：pts 为 [x,y] 数组（构件的侧立面），沿 Z 方向挤出 width。
 * 拱的卷杀、昂嘴、耍头、栱眼、卯口全靠它。
 */
export function makeProfile(pts, width, tile = 0.4) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geo.translate(0, 0, -width / 2);
  scaleUV(geo, 1 / tile, 1 / tile);
  return geo;
}

export function makeCyl(rt, rb, h, seg = 12, tile = 0.5, caps = true) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !caps);
  g.translate(0, h / 2, 0);
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (Math.PI * (rt + rb)) / tile, h / tile);
  return ng;
}

export function makeCone(r, h, seg = 12, tile = 0.5) {
  const g = new THREE.ConeGeometry(r, h, seg, 1, false);
  g.translate(0, h / 2, 0);
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (2 * Math.PI * r) / tile, h / tile);
  return ng;
}

export function makeBall(r, seg = 12, tile = 0.5) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg >> 1));
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (2 * Math.PI * r) / tile, (Math.PI * r) / tile);
  return ng;
}

export function makeTorus(r, tube, seg = 16, tubeSeg = 6, tile = 0.4) {
  const g = new THREE.TorusGeometry(r, tube, tubeSeg, seg);
  const ng = g.toNonIndexed();
  g.dispose();
  scaleUV(ng, (2 * Math.PI * r) / tile, (2 * Math.PI * tube) / tile);
  return ng;
}

/** 半圆柱（筒瓦瓦垄）：轴沿 Z，平底在 y=0，圆弧朝上 */
export function makeHalfCyl(r, len, seg = 6, tile = 0.4) {
  const P = [];
  const N = [];
  const U = [];
  const hl = len / 2;
  for (let i = 0; i < seg; i++) {
    const a0 = (Math.PI * i) / seg;
    const a1 = (Math.PI * (i + 1)) / seg;
    const p0 = [r * Math.cos(a0), r * Math.sin(a0)];
    const p1 = [r * Math.cos(a1), r * Math.sin(a1)];
    const v0 = [p0[0], p0[1], -hl];
    const v1 = [p1[0], p1[1], -hl];
    const v2 = [p1[0], p1[1], hl];
    const v3 = [p0[0], p0[1], hl];
    const su = (Math.PI * r) / seg / tile;
    const sv = len / tile;
    tri(P, N, U, v0, v1, v2, [0, 0], [su, 0], [su, sv]);
    tri(P, N, U, v0, v2, v3, [0, 0], [su, sv], [0, sv]);
    // 两端封口
    tri(P, N, U, [0, 0, -hl], v1, v0, [0, 0], [su, 0], [su, sv]);
    tri(P, N, U, [0, 0, hl], v3, v2, [0, 0], [su, 0], [su, sv]);
  }
  return build(P, N, U);
}

/** 任意四边形板（望板、屋面、墙板）：给四个角点 */
export function makeQuadPanel(p0, p1, p2, p3, tile = 0.6, twoSided = false) {
  const P = [];
  const N = [];
  const U = [];
  const su = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) / tile;
  const sv = Math.hypot(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]) / tile;
  tri(P, N, U, p0, p1, p2, [0, 0], [su, 0], [su, sv]);
  tri(P, N, U, p0, p2, p3, [0, 0], [su, sv], [0, sv]);
  if (twoSided) {
    tri(P, N, U, p0, p2, p1, [0, 0], [su, sv], [su, 0]);
    tri(P, N, U, p0, p3, p2, [0, 0], [0, sv], [su, sv]);
  }
  return build(P, N, U);
}

export function scaleUV(geo, su, sv) {
  const uv = geo.getAttribute('uv');
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}

export function mergeMany(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  return mergeGeometries(list, false);
}

/* ========================================================================== */
/*                              八角形放样                                    */
/* ========================================================================== */

/** 正八边形：apo = 边心距（面到中心），返回每个面的外法线角度 */
export const OCT_N = 8;
export const octFaceAngle = (i) => (i * Math.PI * 2) / OCT_N;
export const octCorner = (apo) => apo / Math.cos(Math.PI / OCT_N);
export const octFaceWidth = (apo) => 2 * apo * Math.tan(Math.PI / OCT_N);

/** 角柱位置（j = 0..7，位于两面之间的转角） */
export function octCornerPos(apo, j) {
  const rc = octCorner(apo);
  const a = Math.PI / OCT_N + (j * Math.PI * 2) / OCT_N;
  return { x: Math.sin(a) * rc, z: Math.cos(a) * rc, a };
}

/**
 * 一圈柱位：8 个角柱 + 每面 perFace 根平柱（沿弦均分）
 * 返回 [{x, z, a, corner, face, bay}]，a = 该柱的朝外角度
 */
export function octRing(apo, perFace = 2) {
  const out = [];
  for (let f = 0; f < OCT_N; f++) {
    const c0 = octCornerPos(apo, f - 1);
    const c1 = octCornerPos(apo, f);
    // 角柱（每面记一次，避免重复）
    out.push({ x: c1.x, z: c1.z, a: c1.a, corner: true, face: f });
    for (let k = 1; k <= perFace; k++) {
      const t = k / (perFace + 1);
      out.push({
        x: c0.x + (c1.x - c0.x) * t,
        z: c0.z + (c1.z - c0.z) * t,
        a: octFaceAngle(f),
        corner: false,
        face: f,
        bay: k,
      });
    }
  }
  return out;
}

/** 一圈开间中点（补间铺作位置）：每面 perFace+1 个 */
export function octBays(apo, perFace = 2) {
  const out = [];
  for (let f = 0; f < OCT_N; f++) {
    const c0 = octCornerPos(apo, f - 1);
    const c1 = octCornerPos(apo, f);
    const n = perFace + 1;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push({
        x: c0.x + (c1.x - c0.x) * t,
        z: c0.z + (c1.z - c0.z) * t,
        a: octFaceAngle(f),
        face: f,
        bay: k,
      });
    }
  }
  return out;
}

/* ========================================================================== */
/*                                Sculptor                                    */
/* ========================================================================== */

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

export class Sculptor {
  constructor(name = 'part') {
    this.name = name;
    this.buckets = new Map();
    this.stack = [new THREE.Matrix4()];
    this.dynamic = new THREE.Group();
    this.dynamic.name = name + ':dyn';
    this.updates = [];
    this.labels = [];
    this.pieces = 0;
  }

  get matrix() {
    return this.stack[this.stack.length - 1];
  }

  /** 平移 + 绕 Y 旋转（+可选绕 X / Z）+ 等比缩放 */
  push(x = 0, y = 0, z = 0, ry = 0, scale = 1, rx = 0, rz = 0) {
    _e.set(rx, ry, rz);
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

  /* ---- 图元（位置为底面中心） ---- */
  box(mat, w, h, d, x = 0, y = 0, z = 0, ry = 0, tile = 0.5) {
    return this.add(makeBox(w, h, d, tile), mat, this._local(x, y, z, ry));
  }
  boxR(mat, w, h, d, x, y, z, rx, ry, rz, tile = 0.5) {
    return this.add(makeBox(w, h, d, tile), mat, this._local(x, y, z, ry, rx, rz));
  }
  /** 中心对齐的方料（梁、椽、斜撑用） */
  boxC(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, tile = 0.5) {
    const local = this._local(x, y, z, ry, rx, rz).multiply(
      new THREE.Matrix4().makeTranslation(0, -h / 2, 0)
    );
    return this.add(makeBox(w, h, d, tile), mat, local);
  }
  frustum(mat, wb, db, wt, dt, h, x = 0, y = 0, z = 0, ry = 0, tile = 0.4) {
    return this.add(makeFrustum(wb, db, wt, dt, h, tile), mat, this._local(x, y, z, ry));
  }
  /** 侧样轮廓构件：轮廓在 XY 面，厚度沿 Z */
  profile(mat, pts, width, x = 0, y = 0, z = 0, ry = 0, tile = 0.4) {
    return this.add(makeProfile(pts, width, tile), mat, this._local(x, y, z, ry));
  }
  profileR(mat, pts, width, x, y, z, rx, ry, rz, tile = 0.4) {
    return this.add(makeProfile(pts, width, tile), mat, this._local(x, y, z, ry, rx, rz));
  }
  cyl(mat, rt, rb, h, x = 0, y = 0, z = 0, seg = 12, ry = 0, tile = 0.5) {
    return this.add(makeCyl(rt, rb, h, seg, tile), mat, this._local(x, y, z, ry));
  }
  /** 中心对齐的圆料：axis = 'x' | 'y' | 'z' */
  bar(mat, r, len, x, y, z, axis = 'y', seg = 10, tile = 0.5) {
    const rx = axis === 'z' ? Math.PI / 2 : 0;
    const rz = axis === 'x' ? Math.PI / 2 : 0;
    const local = this._local(x, y, z, 0, rx, rz).multiply(
      new THREE.Matrix4().makeTranslation(0, -len / 2, 0)
    );
    return this.add(makeCyl(r, r, len, seg, tile), mat, local);
  }
  cone(mat, r, h, x = 0, y = 0, z = 0, seg = 12, ry = 0, tile = 0.5) {
    return this.add(makeCone(r, h, seg, tile), mat, this._local(x, y, z, ry));
  }
  ball(mat, r, x = 0, y = 0, z = 0, seg = 12, tile = 0.5) {
    return this.add(makeBall(r, seg, tile), mat, this._local(x, y, z));
  }
  torus(mat, r, tube, x, y, z, rx = 0, ry = 0, rz = 0, seg = 16, tile = 0.4) {
    return this.add(makeTorus(r, tube, seg, 6, tile), mat, this._local(x, y, z, ry, rx, rz));
  }
  halfCyl(mat, r, len, x, y, z, ry = 0, rx = 0, seg = 6, tile = 0.4) {
    return this.add(makeHalfCyl(r, len, seg, tile), mat, this._local(x, y, z, ry, rx));
  }
  panel(mat, p0, p1, p2, p3, tile = 0.6, two = false) {
    return this.add(makeQuadPanel(p0, p1, p2, p3, tile, two), mat);
  }

  world(x, y, z) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.matrix);
  }

  attach(obj, x = 0, y = 0, z = 0, ry = 0) {
    const m = this.matrix.clone().multiply(this._local(x, y, z, ry));
    m.decompose(obj.position, obj.quaternion, obj.scale);
    this.dynamic.add(obj);
    return obj;
  }

  onUpdate(fn) {
    this.updates.push(fn);
    return fn;
  }

  /** 登记一个构件名标注（世界坐标） */
  label(text, x, y, z, o = {}) {
    this.labels.push({ text, pos: this.world(x, y, z), ...o });
    return this;
  }

  /** 只按材质合并、返回几何（不生成 Mesh）——供实例化复用 */
  bake() {
    const out = [];
    for (const [mat, geos] of this.buckets) {
      let merged;
      if (geos.length === 1) merged = geos[0];
      else {
        merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
      }
      if (!merged) {
        console.warn('[Sculptor.bake] 合并失败:', mat.name);
        continue;
      }
      merged.computeBoundingSphere();
      out.push({ mat, geo: merged });
    }
    this.buckets.clear();
    return out;
  }

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
        console.warn('[Sculptor] 合并失败:', mat.name);
        continue;
      }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${this.name}:${mat.name || 'mat'}`;
      const sh = mat.userData?.shadow ?? 'both';
      mesh.castShadow = sh === 'both' || sh === 'cast';
      mesh.receiveShadow = sh === 'both' || sh === 'receive';
      group.add(mesh);
    }
    this.buckets.clear();
    if (this.dynamic.children.length) group.add(this.dynamic);
    return group;
  }
}

export function instanced(geo, mat, mats4, castShadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, mats4.length);
  mats4.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = castShadow;
  im.receiveShadow = true;
  return im;
}

/**
 * 实例库：同一种铺作（斗拱）在全塔重复几十上百次，
 * 只建一次几何，其余用 InstancedMesh 摆放 —— 内存与 draw call 都省。
 */
export class InstanceBank {
  constructor(name = 'bank') {
    this.name = name;
    this.defs = new Map();
  }
  /** 定义一个变体（若已存在则直接返回），fn(sculptor) 在原点建模 */
  define(key, fn) {
    let def = this.defs.get(key);
    if (def) return def;
    const s = new Sculptor(key);
    const meta = fn(s) || {};
    def = { key, parts: s.bake(), mats: [], pieces: s.pieces, meta, labels: s.labels };
    this.defs.set(key, def);
    return def;
  }
  place(key, matrix4) {
    const def = this.defs.get(key);
    if (!def) throw new Error('未定义的实例变体: ' + key);
    def.mats.push(matrix4);
    return def;
  }
  get(key) {
    return this.defs.get(key);
  }
  /** 生成 InstancedMesh。target 可以是 Group，或 (key)=>Group 的分组函数 */
  build(target) {
    let meshes = 0;
    let instances = 0;
    let pieces = 0;
    for (const def of this.defs.values()) {
      if (!def.mats.length) continue;
      instances += def.mats.length;
      pieces += def.pieces * def.mats.length;
      const group = typeof target === 'function' ? target(def.key) : target;
      for (const p of def.parts) {
        const im = new THREE.InstancedMesh(p.geo, p.mat, def.mats.length);
        def.mats.forEach((m, i) => im.setMatrixAt(i, m));
        im.instanceMatrix.needsUpdate = true;
        const sh = p.mat.userData?.shadow ?? 'both';
        im.castShadow = sh === 'both' || sh === 'cast';
        im.receiveShadow = sh === 'both' || sh === 'receive';
        im.name = `${def.key}:${p.mat.name || 'mat'}`;
        group.add(im);
        meshes++;
      }
    }
    return { meshes, instances, pieces };
  }
}

export function trs(x, y, z, ry = 0, s = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(s, s, s));
}
