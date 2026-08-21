/**
 * 几何工具库 —— 为坦克建模提供"可控多边形"级别的原语。
 *
 * 设计要点：
 *  - loft()  : 按"俯视轮廓 + 高度"逐层放样，用于炮塔这类楔形/斜面壳体。
 *  - extrudeZY(): 侧视轮廓沿 X 挤出，用于车体（首上倾斜甲板等本质是侧视特征）。
 *  - fixOrientation(): 用有符号体积判定法线朝向，彻底消除手写多边形的绕序错误。
 *  - mergeAll(): 把大量重复细节（螺栓/履带板/百叶）合并成单一 geometry，
 *                既保证渲染性能，又保证 GLTF 导出后在其它软件里是干净网格。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DEG = Math.PI / 180;

/** 确定性伪随机（mulberry32），保证每次生成的迷彩/风化一致 */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 只保留标准属性，保证 mergeGeometries / 导出不炸 */
export function clean(geo) {
  for (const key of Object.keys(geo.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') geo.deleteAttribute(key);
  }
  if (!geo.attributes.uv) {
    const n = geo.attributes.position.count;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}

/** 用有符号体积判断整体法线朝向，必要时翻转绕序（闭合网格适用） */
export function fixOrientation(geo) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const count = idx ? idx.count : pos.count;
  let vol = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < count; i += 3) {
    const i0 = idx ? idx.getX(i) : i;
    const i1 = idx ? idx.getX(i + 1) : i + 1;
    const i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    vol += a.dot(b.clone().cross(c));
  }
  if (vol < 0) {
    if (idx) {
      const arr = idx.array;
      for (let i = 0; i < arr.length; i += 3) {
        const t = arr[i + 1];
        arr[i + 1] = arr[i + 2];
        arr[i + 2] = t;
      }
      idx.needsUpdate = true;
    } else {
      const p = pos.array;
      const nm = geo.attributes.normal ? geo.attributes.normal.array : null;
      const uv = geo.attributes.uv ? geo.attributes.uv.array : null;
      const swap = (arr, i, j, stride) => {
        for (let k = 0; k < stride; k++) {
          const t = arr[i * stride + k];
          arr[i * stride + k] = arr[j * stride + k];
          arr[j * stride + k] = t;
        }
      };
      for (let i = 0; i < pos.count; i += 3) {
        swap(p, i + 1, i + 2, 3);
        if (nm) swap(nm, i + 1, i + 2, 3);
        if (uv) swap(uv, i + 1, i + 2, 2);
      }
    }
    geo.computeVertexNormals();
  }
  return geo;
}

/**
 * 分层放样。
 * @param {{y:number, pts:number[][]}[]} sections 每层：高度 y + 俯视轮廓点 [[x,z],...]（各层点数必须相同）
 * @param {object} opt capBottom/capTop 是否封盖；uvScale 贴图密度
 */
export function loft(sectionsIn, opt = {}) {
  const { capBottom = true, capTop = true, uvScale = 0.45 } = opt;
  // 绕序归一化：Earcut 会强制封盖的输出绕序，因此侧面必须与之对齐 ——
  // 统一把轮廓转成 (x,z) 平面内有符号面积为正（数学意义 CCW）后再放样。
  let area = 0;
  const p0 = sectionsIn[0].pts;
  for (let i = 0; i < p0.length; i++) {
    const a = p0[i];
    const b = p0[(i + 1) % p0.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sections = area < 0 ? sectionsIn.map((s) => ({ y: s.y, pts: s.pts.slice().reverse() })) : sectionsIn;
  const N = sections[0].pts.length;
  const L = sections.length;
  const position = [];
  const uv = [];
  const index = [];

  // 侧面：逐层环带
  const perim = [0];
  for (let j = 1; j <= N; j++) {
    const p0 = sections[0].pts[(j - 1) % N];
    const p1 = sections[0].pts[j % N];
    perim.push(perim[j - 1] + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
  }
  for (let i = 0; i < L; i++) {
    const s = sections[i];
    if (s.pts.length !== N) throw new Error('loft: 各层轮廓点数必须一致');
    for (let j = 0; j < N; j++) {
      position.push(s.pts[j][0], s.y, s.pts[j][1]);
      uv.push(perim[j] * uvScale, s.y * uvScale);
    }
    // 环缝合处需要重复首点保证 UV 连续
    position.push(s.pts[0][0], s.y, s.pts[0][1]);
    uv.push(perim[N] * uvScale, s.y * uvScale);
  }
  const ring = N + 1;
  for (let i = 0; i < L - 1; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * ring + j;
      const b = i * ring + j + 1;
      const c = (i + 1) * ring + j + 1;
      const d = (i + 1) * ring + j;
      index.push(a, b, c, a, c, d);
    }
  }

  // 封盖
  const addCap = (sec, flip) => {
    const contour = sec.pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const base = position.length / 3;
    for (const p of contour) {
      position.push(p.x, sec.y, p.y);
      uv.push(p.x * uvScale, p.y * uvScale);
    }
    for (const t of tris) {
      if (flip) index.push(base + t[0], base + t[2], base + t[1]);
      else index.push(base + t[0], base + t[1], base + t[2]);
    }
  };
  if (capBottom) addCap(sections[0], true);
  if (capTop) addCap(sections[L - 1], false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return fixOrientation(geo);
}

/** 剔除零面积三角面（LatheGeometry 极点、退化挤出会产生） */
export function dropDegenerate(geo, eps = 1e-10) {
  const src = geo.index ? geo : geo;
  const pos = src.attributes.position;
  const idx = src.index;
  if (!idx) return geo;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const keep = [];
  for (let i = 0; i < idx.count; i += 3) {
    const i0 = idx.getX(i);
    const i1 = idx.getX(i + 1);
    const i2 = idx.getX(i + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > eps) keep.push(i0, i1, i2);
  }
  geo.setIndex(keep);
  return geo;
}

/** 线段相交（用于多边形自交检测） */
function segCross(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}

/** 判断闭合多边形是否为简单多边形（无自交）。自交会导致 Earcut 少输出三角面 → 破面。 */
export function isSimplePolygon(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (i === j) continue;
      const a1 = pts[i];
      const a2 = pts[(i + 1) % n];
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // 相邻边共享端点
      if (segCross(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/**
 * 侧视轮廓（Z-Y 平面）沿 X 挤出。
 * @param {number[][]} profile [[z,y],...] 闭合多边形（不必重复首点）
 * @param {number} width 总宽度（沿 X 居中）
 */
export function extrudeZY(profile, width, opt = {}) {
  const { bevel = 0, uvScale = 0.45, name = '' } = opt;
  if (!isSimplePolygon(profile)) {
    console.warn(`[geom] extrudeZY 轮廓自交${name ? ' (' + name + ')' : ''}，封盖会破面：`, profile);
  }
  const shape = new THREE.Shape(profile.map((p) => new THREE.Vector2(p[0], p[1])));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 2,
  });
  // shape 的 (u,v) 落在 (z,y)，挤出方向为 +Z → 绕 Y 转 -90° 后挤出方向变为 -X
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  clean(geo);
  projectUV(geo, uvScale);
  return fixOrientation(geo);
}

/** 倒角长方体（segments=1 即工业味的切角） */
export function chamfer(w, h, d, r = 0.02, seg = 1) {
  const rr = Math.max(0.001, Math.min(r, Math.min(w, h, d) / 2.05));
  const geo = new RoundedBoxGeometry(w, h, d, seg, rr);
  return clean(geo);
}

/** 普通盒体 */
export function box(w, h, d) {
  return clean(new THREE.BoxGeometry(w, h, d));
}

/**
 * 三平面盒式 UV 投影：按顶点法线的主轴选择投影平面，
 * 让同一张平铺迷彩贴到任意形体上都不会被拉伸。
 */
export function projectUV(geo, scale = 0.45, offset = [0, 0]) {
  const pos = geo.attributes.position;
  let nor = geo.attributes.normal;
  if (!nor) {
    geo.computeVertexNormals();
    nor = geo.attributes.normal;
  }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u;
    let v;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nx >= nz) {
      u = z;
      v = y;
    } else {
      u = x;
      v = y;
    }
    uv[i * 2] = u * scale + offset[0];
    uv[i * 2 + 1] = v * scale + offset[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** 变换一个 geometry（用于合并前摆位） */
export function T(geo, { pos, rot, scale, rotOrder } = {}) {
  if (scale) geo.scale(scale[0], scale[1], scale[2]);
  if (rot) {
    const e = new THREE.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0, rotOrder || 'XYZ');
    geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
  }
  if (pos) geo.translate(pos[0], pos[1], pos[2]);
  return geo;
}

/** 合并：统一成 non-indexed 再合并，规避属性不匹配 */
export function mergeAll(list) {
  const geos = list.filter(Boolean).map((g) => clean(g.index ? g.toNonIndexed() : g));
  if (!geos.length) return null;
  if (geos.length === 1) return geos[0];
  const merged = mergeGeometries(geos, false);
  if (!merged) throw new Error('mergeAll 失败：属性不兼容');
  return merged;
}

/** 圆柱（默认轴向 Y；axis 可为 'x'|'y'|'z'） */
export function cyl(rTop, rBot, h, seg = 20, axis = 'y', open = false) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  return clean(geo);
}

/** 管（空心圆柱，双层壁），用于炮口/进气口等有壁厚的开口 */
export function pipe(rOuter, rInner, h, seg = 20, axis = 'y') {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rInner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: seg });
  geo.translate(0, 0, -h / 2);
  if (axis === 'y') geo.rotateX(-Math.PI / 2);
  else if (axis === 'x') geo.rotateY(Math.PI / 2);
  clean(geo);
  return geo;
}

/** 沿直线排布的螺栓阵列 */
export function boltRow(from, to, count, r = 0.018, h = 0.014, axis = 'y') {
  const list = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const p = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
    list.push(T(cyl(r, r * 1.1, h, 6, axis), { pos: p }));
  }
  return mergeAll(list);
}

/** 环形螺栓阵列 */
export function boltRing(radius, count, r = 0.016, h = 0.012, y = 0) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    list.push(T(cyl(r, r, h, 6, 'y'), { pos: [Math.cos(a) * radius, y, Math.sin(a) * radius] }));
  }
  return mergeAll(list);
}

/** 百叶窗/散热格栅：一排倾斜薄板 */
export function louvers(w, h, d, count, tilt = 35 * DEG) {
  const list = [];
  const step = h / count;
  for (let i = 0; i < count; i++) {
    const g = box(w, step * 0.72, d);
    list.push(T(g, { rot: [tilt, 0, 0], pos: [0, -h / 2 + step * (i + 0.5), 0] }));
  }
  return mergeAll(list);
}

/** 网格栅栏（细杆编织），用于尾栏筐、进气防护网 */
export function meshGrid(w, h, spacing = 0.09, r = 0.008) {
  const list = [];
  const nx = Math.max(2, Math.round(w / spacing));
  const ny = Math.max(2, Math.round(h / spacing));
  for (let i = 0; i <= nx; i++) {
    const x = -w / 2 + (w * i) / nx;
    list.push(T(cyl(r, r, h, 5, 'y'), { pos: [x, 0, 0] }));
  }
  for (let j = 0; j <= ny; j++) {
    const y = -h / 2 + (h * j) / ny;
    list.push(T(cyl(r, r, w, 5, 'x'), { pos: [0, y, 0] }));
  }
  return mergeAll(list);
}

/** 由折线生成管状体（拖车钢缆、油管、线束） */
export function tubeFrom(points, r = 0.02, tubular = 48, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return clean(new THREE.TubeGeometry(curve, tubular, r, radial, false));
}

/** 车轮式旋转体：给定 [半径, y] 剖面，绕 Y 旋成后再倒向 X 轴（负重轮/主动轮）
 *  剖面端点半径 <=1mm 时夹到 0，让 LatheGeometry 在轴心自动收成封闭扇面。 */
export function latheX(profile, seg = 24) {
  const pts = profile.map((p, i) => {
    const isEnd = i === 0 || i === profile.length - 1;
    return new THREE.Vector2(isEnd && p[0] <= 0.001 ? 0 : Math.max(1e-4, p[0]), p[1]);
  });
  const geo = new THREE.LatheGeometry(pts, seg);
  geo.rotateZ(Math.PI / 2);
  clean(geo);
  dropDegenerate(geo);
  return geo;
}

/** 把若干 geometry 装进一个 Mesh 并打上 pid 标签 */
export function meshOf(geo, material, pid, name) {
  const m = new THREE.Mesh(geo, material);
  m.userData.pid = pid;
  m.name = name || pid;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 世界空间包围盒 */
export function worldBox(objects) {
  const b = new THREE.Box3();
  let has = false;
  for (const o of objects) {
    o.updateWorldMatrix(true, false);
    const bb = new THREE.Box3().setFromObject(o, true);
    if (bb.isEmpty()) continue;
    has ? b.union(bb) : b.copy(bb);
    has = true;
  }
  return has ? b : null;
}

/** 楔形斜面块：用于反应装甲、附加装甲模块（前窄后宽的梯形棱柱） */
export function wedge(len, hFront, hBack, width) {
  return extrudeZY(
    [
      [-len / 2, 0],
      [len / 2, 0],
      [len / 2, hFront],
      [-len / 2, hBack],
    ],
    width,
  );
}

/** 沿一条 2D 折线（XZ 平面）等距摆放同一个 geometry 工厂的实例 */
export function distributeAlong(path, count, factory) {
  const list = [];
  const total = [];
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    total.push(len);
  }
  for (let k = 0; k < count; k++) {
    const target = (len * (k + 0.5)) / count;
    let seg = 0;
    while (seg < total.length - 1 && total[seg] < target) seg++;
    const prev = seg === 0 ? 0 : total[seg - 1];
    const t = (target - prev) / Math.max(1e-6, total[seg] - prev);
    const a = path[seg];
    const b = path[seg + 1];
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const g = factory(k, x, z, ang);
    if (g) list.push(g);
  }
  return mergeAll(list);
}
