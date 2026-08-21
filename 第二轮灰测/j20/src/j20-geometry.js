/* ============================================================================
 * J-20 「威龙」程序化三维模型 —— 几何构建层
 * 说明：本文件刻意不使用 import/export，three.js 的符号（BufferGeometry 等）
 *       由外层作用域提供。这样既能内联进单文件 HTML（规避 file:// 的模块 CORS），
 *       也能在 node 里用 new Function 注入 three 做尺寸校验。
 *
 * 坐标系：+X = 机头方向，+Y = 上，+Z = 右翼方向，单位 = 米
 * 真机参考：全长 20.4 m，翼展 12.88 m，全高 4.45 m
 * ==========================================================================*/

const DEG = Math.PI / 180;
const HAS_DOM = (typeof document !== 'undefined');

/* 确定性伪随机：保证每次生成的贴图完全一致（可复现，也便于做画面差分验证） */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================ 通用几何工具 ============================ */

/** 把 (S 站 × R 环点) 的顶点网格连成三角面 */
function gridIndex(S, R) {
  const idx = [];
  for (let i = 0; i < S - 1; i++) {
    for (let j = 0; j < R - 1; j++) {
      const a = i * R + j, b = i * R + j + 1, c = (i + 1) * R + j + 1, d = (i + 1) * R + j;
      idx.push(a, c, b, a, d, c);
    }
  }
  return idx;
}

function finishGeometry(pos, idx, uv) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 沿 Z 镜像（同时反转绕序，保证法线朝外） */
function mirrorZ(geo) {
  const g = geo.clone();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -p.getZ(i));
  const src = g.index.array, out = new src.constructor(src.length);
  for (let i = 0; i < src.length; i += 3) { out[i] = src[i]; out[i + 1] = src[i + 2]; out[i + 2] = src[i + 1]; }
  g.index.array.set(out);
  g.computeVertexNormals();
  return g;
}

/**
 * 机身横截面：带「棱线（chine）」的超椭圆截面
 * st = { x, hw 棱线半宽, cy 棱线高度, ty 顶部, by 底部, tn 上表面方形度, bn 下表面方形度 }
 * 返回环点数组 [[y,z], ...]：顶部中线 → 右棱线(重复一次形成硬边) → 底部中线 → 左侧镜像 → 回到顶部
 */
function fuseRing(st, K) {
  const tn = st.tn || 2.6, bn = st.bn || 3.0;
  const up = [], lo = [];
  for (let i = 0; i <= K; i++) {
    const t = (i / K) * Math.PI / 2;
    up.push([st.cy + (st.ty - st.cy) * Math.pow(Math.cos(t), 2 / tn), st.hw * Math.pow(Math.sin(t), 2 / tn)]);
  }
  for (let i = 0; i <= K; i++) {
    const t = (i / K) * Math.PI / 2;
    lo.push([st.cy + (st.by - st.cy) * Math.pow(Math.sin(t), 2 / bn), st.hw * Math.pow(Math.cos(t), 2 / bn)]);
  }
  const right = up.concat(lo);                       // up[K] 与 lo[0] 同点 → 棱线硬边
  const ring = right.slice();
  for (let i = right.length - 2; i >= 1; i--) ring.push([right[i][0], -right[i][1]]);
  ring.push([right[0][0], right[0][1]]);             // 闭合（顶部脊线处留缝，正好是脊棱）
  return ring;
}

/** 机身放样 */
function buildFuselage(stations, K, capTail) {
  const rings = stations.map((st) => fuseRing(st, K));
  const R = rings[0].length, S = stations.length;
  const pos = [], uv = [];
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < R; j++) {
      pos.push(stations[i].x, rings[i][j][0], rings[i][j][1]);
      uv.push(i / (S - 1), j / (R - 1));
    }
  }
  const idx = gridIndex(S, R);
  if (capTail) {                                     // 尾部平封口
    const last = rings[S - 1], base = S * R;
    let cy = 0, cz = 0;
    for (const p of last) { cy += p[0]; cz += p[1]; }
    cy /= last.length; cz /= last.length;
    pos.push(stations[S - 1].x, cy, cz); uv.push(1, 0.5);
    for (let j = 0; j < R - 1; j++) idx.push(base, (S - 1) * R + j, (S - 1) * R + j + 1);
  }
  return finishGeometry(pos, idx, uv);
}

/* ---------------------------- 翼面（真翼型） ---------------------------- */

/** NACA 四位翼型厚度分布，u∈[0,1]，返回 0..1 的相对厚度 */
function naca(u) {
  const s = Math.max(u, 0);
  return 5 * (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s * s * s - 0.1015 * s * s * s * s);
}

/**
 * 由若干展向剖面放样出一片机翼（右侧，z>0）
 * sections = [{ z, xLE, xTE, y, thick, camber? }]
 */
function buildWingSurface(sections, M) {
  const N = sections.length;
  const pos = [], uv = [], idx = [];
  const surf = (sign) => {
    const base = pos.length / 3;
    for (let i = 0; i < N; i++) {
      const s = sections[i];
      for (let j = 0; j <= M; j++) {
        const u = j / M;
        const x = s.xLE + (s.xTE - s.xLE) * u;
        const th = naca(u) * s.thick;
        const cam = (s.camber || 0) * Math.sin(Math.PI * Math.pow(u, 0.8));
        pos.push(x, s.y + cam + sign * th * 0.5, s.z);
        uv.push(u, i / (N - 1));
      }
    }
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
      const a = base + i * (M + 1) + j, b = a + 1, c = a + (M + 1) + 1, d = a + (M + 1);
      if (sign > 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    }
  };
  surf(+1); surf(-1);
  // 翼尖封边
  const upTip = (N - 1) * (M + 1), loTip = N * (M + 1) + (N - 1) * (M + 1);
  for (let j = 0; j < M; j++) idx.push(upTip + j, upTip + j + 1, loTip + j, upTip + j + 1, loTip + j + 1, loTip + j);
  return finishGeometry(pos, idx, uv);
}

/** 绕 X 轴上反/下反（用于 V 尾、腹鳍、鸭翼下反） */
function rollGeo(geo, deg, pivotY) {
  const m = new Matrix4();
  const t1 = new Matrix4().makeTranslation(0, -(pivotY || 0), 0);
  const r = new Matrix4().makeRotationX(deg * DEG);
  const t2 = new Matrix4().makeTranslation(0, (pivotY || 0), 0);
  m.multiplyMatrices(t2, r).multiply(t1);
  geo.applyMatrix4(m);
  geo.computeVertexNormals();
  return geo;
}

/* ============================ 机身站位表 ============================ */
/* 从机头 x=+10.2 到尾端 x=-9.5，棱线(chine)贯穿全机 —— J-20 的标志性边条 */
const FUSE_STATIONS = [
  { x: 10.20, hw: 0.012, cy: 0.00, ty: 0.02, by: -0.02, tn: 2.2, bn: 2.2 },
  { x: 10.00, hw: 0.075, cy: -0.01, ty: 0.06, by: -0.08, tn: 2.2, bn: 2.4 },
  { x: 9.60, hw: 0.165, cy: -0.03, ty: 0.14, by: -0.18, tn: 2.3, bn: 2.5 },
  { x: 9.00, hw: 0.295, cy: -0.06, ty: 0.25, by: -0.30, tn: 2.4, bn: 2.7 },
  { x: 8.30, hw: 0.430, cy: -0.09, ty: 0.36, by: -0.41, tn: 2.5, bn: 2.9 },
  { x: 7.60, hw: 0.560, cy: -0.11, ty: 0.46, by: -0.50, tn: 2.6, bn: 3.0 },
  { x: 6.90, hw: 0.680, cy: -0.13, ty: 0.56, by: -0.58, tn: 2.7, bn: 3.1 },
  { x: 6.20, hw: 0.790, cy: -0.14, ty: 0.66, by: -0.65, tn: 2.8, bn: 3.2 },
  { x: 5.50, hw: 0.890, cy: -0.15, ty: 0.76, by: -0.71, tn: 2.9, bn: 3.2 },
  { x: 4.80, hw: 0.980, cy: -0.16, ty: 0.84, by: -0.76, tn: 3.0, bn: 3.3 },
  { x: 4.10, hw: 1.070, cy: -0.17, ty: 0.89, by: -0.80, tn: 3.1, bn: 3.3 },
  { x: 3.40, hw: 1.190, cy: -0.18, ty: 0.92, by: -0.84, tn: 3.2, bn: 3.4 },
  { x: 2.70, hw: 1.360, cy: -0.19, ty: 0.93, by: -0.88, tn: 3.3, bn: 3.5 },
  { x: 2.00, hw: 1.520, cy: -0.20, ty: 0.93, by: -0.92, tn: 3.4, bn: 3.6 },
  { x: 1.20, hw: 1.650, cy: -0.21, ty: 0.92, by: -0.96, tn: 3.5, bn: 3.7 },
  { x: 0.40, hw: 1.740, cy: -0.22, ty: 0.90, by: -0.99, tn: 3.5, bn: 3.8 },
  { x: -0.40, hw: 1.780, cy: -0.23, ty: 0.88, by: -1.01, tn: 3.5, bn: 3.8 },
  { x: -1.20, hw: 1.780, cy: -0.24, ty: 0.87, by: -1.01, tn: 3.5, bn: 3.8 },
  { x: -2.00, hw: 1.750, cy: -0.24, ty: 0.86, by: -1.00, tn: 3.5, bn: 3.8 },
  { x: -2.80, hw: 1.700, cy: -0.24, ty: 0.85, by: -0.99, tn: 3.4, bn: 3.7 },
  { x: -3.60, hw: 1.640, cy: -0.23, ty: 0.83, by: -0.97, tn: 3.4, bn: 3.6 },
  { x: -4.40, hw: 1.570, cy: -0.22, ty: 0.80, by: -0.94, tn: 3.3, bn: 3.5 },
  { x: -5.20, hw: 1.500, cy: -0.21, ty: 0.77, by: -0.91, tn: 3.2, bn: 3.4 },
  { x: -6.00, hw: 1.430, cy: -0.20, ty: 0.73, by: -0.87, tn: 3.1, bn: 3.3 },
  { x: -6.80, hw: 1.360, cy: -0.18, ty: 0.68, by: -0.83, tn: 3.0, bn: 3.2 },
  { x: -7.60, hw: 1.300, cy: -0.17, ty: 0.62, by: -0.78, tn: 2.9, bn: 3.1 },
  { x: -8.40, hw: 1.250, cy: -0.16, ty: 0.55, by: -0.73, tn: 2.8, bn: 3.0 },
  { x: -9.10, hw: 1.210, cy: -0.15, ty: 0.48, by: -0.68, tn: 2.7, bn: 2.9 },
  { x: -9.50, hw: 1.180, cy: -0.15, ty: 0.42, by: -0.63, tn: 2.6, bn: 2.8 },
];

/* ============================ 各部件生成 ============================ */

/** 主翼（切尖三角翼，前缘后掠 43°） */
function makeWingGeo() {
  const sec = [
    { z: 1.35, xLE: 2.75, xTE: -5.45, y: -0.28, thick: 0.30, camber: 0.02 },
    { z: 2.20, xLE: 1.95, xTE: -5.42, y: -0.26, thick: 0.26, camber: 0.02 },
    { z: 3.10, xLE: 1.11, xTE: -5.35, y: -0.24, thick: 0.22, camber: 0.02 },
    { z: 4.00, xLE: 0.27, xTE: -5.22, y: -0.22, thick: 0.18, camber: 0.015 },
    { z: 4.90, xLE: -0.57, xTE: -5.02, y: -0.20, thick: 0.14, camber: 0.01 },
    { z: 5.70, xLE: -1.32, xTE: -4.78, y: -0.19, thick: 0.11, camber: 0.01 },
    { z: 6.20, xLE: -1.79, xTE: -4.58, y: -0.18, thick: 0.09, camber: 0.005 },
    { z: 6.44, xLE: -2.02, xTE: -4.44, y: -0.18, thick: 0.07, camber: 0 },
  ];
  return buildWingSurface(sec, 22);
}

/** 鸭翼（全动，前缘后掠 43°，带 5° 下反） */
function makeCanardGeo() {
  const sec = [
    { z: 1.00, xLE: 3.95, xTE: 1.90, y: 0.34, thick: 0.13 },
    { z: 1.60, xLE: 3.39, xTE: 1.83, y: 0.34, thick: 0.11 },
    { z: 2.20, xLE: 2.83, xTE: 1.74, y: 0.34, thick: 0.09 },
    { z: 2.65, xLE: 2.41, xTE: 1.66, y: 0.34, thick: 0.07 },
    { z: 2.90, xLE: 2.18, xTE: 1.60, y: 0.34, thick: 0.05 },
  ];
  return rollGeo(buildWingSurface(sec, 16), 6, 0.34);
}

/** V 形垂尾（全动，外倾 22°） */
function makeVTailGeo() {
  const sec = [
    { z: 0.00, xLE: -4.55, xTE: -7.55, y: 0.00, thick: 0.22 },
    { z: 0.55, xLE: -4.85, xTE: -7.50, y: 0.00, thick: 0.19 },
    { z: 1.10, xLE: -5.16, xTE: -7.44, y: 0.00, thick: 0.15 },
    { z: 1.60, xLE: -5.44, xTE: -7.38, y: 0.00, thick: 0.11 },
    { z: 1.90, xLE: -5.61, xTE: -7.34, y: 0.00, thick: 0.08 },
  ];
  const g = buildWingSurface(sec, 16);
  g.applyMatrix4(new Matrix4().makeRotationX(-90 * DEG));   // 展向 +Z → +Y，立起来
  g.applyMatrix4(new Matrix4().makeRotationX(22 * DEG));    // 外倾 22°（向 +Z 倒）
  g.applyMatrix4(new Matrix4().makeTranslation(0, 0.42, 1.22));
  g.computeVertexNormals();
  return g;
}

/** 腹鳍（外倾 20°，装在尾段下侧） */
function makeVentralGeo() {
  const sec = [
    { z: 0.00, xLE: -5.10, xTE: -6.95, y: 0.00, thick: 0.14 },
    { z: 0.45, xLE: -5.35, xTE: -6.90, y: 0.00, thick: 0.11 },
    { z: 0.85, xLE: -5.58, xTE: -6.86, y: 0.00, thick: 0.07 },
    { z: 1.05, xLE: -5.70, xTE: -6.84, y: 0.00, thick: 0.05 },
  ];
  const g = buildWingSurface(sec, 12);
  g.applyMatrix4(new Matrix4().makeRotationX(90 * DEG));    // 展向 +Z → -Y，朝下
  g.applyMatrix4(new Matrix4().makeRotationX(-20 * DEG));   // 外倾 20°（向 +Z 倒）
  g.applyMatrix4(new Matrix4().makeTranslation(0, -0.62, 1.02));
  g.computeVertexNormals();
  return g;
}

/* -------------------------- DSI 进气道 -------------------------- */
/** 进气口唇缘环（D 形，带前后错位形成后掠唇口） */
const INLET_RING = [
  { y: -0.06, z: 1.20, dx: 0.34 },
  { y: -0.04, z: 1.52, dx: 0.30 },
  { y: -0.14, z: 1.74, dx: 0.20 },
  { y: -0.42, z: 1.82, dx: 0.10 },
  { y: -0.70, z: 1.78, dx: 0.00 },
  { y: -0.90, z: 1.60, dx: -0.06 },
  { y: -0.98, z: 1.34, dx: -0.10 },
  { y: -0.92, z: 1.12, dx: -0.04 },
  { y: -0.70, z: 1.02, dx: 0.06 },
  { y: -0.40, z: 1.04, dx: 0.18 },
  { y: -0.18, z: 1.10, dx: 0.28 },
];

/** 进气道外罩：由唇口向后放样，逐渐融入机身 */
function makeIntakeGeo() {
  const S = [
    { x: 3.52, s: 1.00, oz: 0.00, oy: 0.00 },
    { x: 2.90, s: 1.03, oz: -0.02, oy: -0.02 },
    { x: 2.10, s: 1.05, oz: -0.06, oy: -0.04 },
    { x: 1.20, s: 1.04, oz: -0.12, oy: -0.05 },
    { x: 0.20, s: 1.00, oz: -0.20, oy: -0.05 },
    { x: -0.90, s: 0.92, oz: -0.30, oy: -0.04 },
    { x: -1.90, s: 0.82, oz: -0.42, oy: -0.02 },
  ];
  const R = INLET_RING.length + 1;
  const pos = [], uv = [];
  for (let i = 0; i < S.length; i++) {
    for (let j = 0; j < R; j++) {
      const p = INLET_RING[j % INLET_RING.length];
      const cy = -0.50, cz = 1.42;
      pos.push(S[i].x + (i === 0 ? p.dx : 0),
        cy + (p.y - cy) * S[i].s + S[i].oy,
        cz + (p.z - cz) * S[i].s + S[i].oz);
      uv.push(i / (S.length - 1), j / (R - 1));
    }
  }
  return finishGeometry(pos, gridIndex(S.length, R), uv);
}

/** 进气道内壁（向后内收并封底，形成深邃的黑色进气口） */
function makeInletDuctGeo() {
  const S = [
    { x: 3.52, s: 0.98, oy: 0.00, oz: 0.00 },
    { x: 2.80, s: 0.86, oy: 0.02, oz: -0.10 },
    { x: 1.90, s: 0.72, oy: 0.06, oz: -0.22 },
    { x: 1.00, s: 0.58, oy: 0.10, oz: -0.34 },
  ];
  const R = INLET_RING.length + 1;
  const pos = [], uv = [];
  for (let i = 0; i < S.length; i++) for (let j = 0; j < R; j++) {
    const p = INLET_RING[j % INLET_RING.length];
    const cy = -0.50, cz = 1.42;
    pos.push(S[i].x + (i === 0 ? p.dx : 0),
      cy + (p.y - cy) * S[i].s + S[i].oy,
      cz + (p.z - cz) * S[i].s + S[i].oz);
    uv.push(i / (S.length - 1), j / (R - 1));
  }
  const idx = [];
  for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < R - 1; j++) {
    const a = i * R + j, b = a + 1, c = a + R + 1, d = a + R;
    idx.push(a, b, c, a, c, d);                       // 内壁：反向绕序
  }
  const base = pos.length / 3, last = (S.length - 1) * R;
  let cy = 0, cz = 0;
  for (const p of INLET_RING) { cy += p.y; cz += p.z; }
  cy /= INLET_RING.length; cz /= INLET_RING.length;
  pos.push(S[S.length - 1].x, -0.50 + (cy + 0.50) * 0.58 + 0.10, 1.42 + (cz - 1.42) * 0.58 - 0.34);
  uv.push(1, 0.5);
  for (let j = 0; j < R - 1; j++) idx.push(base, last + j + 1, last + j);
  return finishGeometry(pos, idx, uv);
}

/* ============================ 主装配 ============================ */

function buildJ20(THREEMAT) {
  const M = THREEMAT;                                  // 材质集合（由 app 层提供）
  const root = new Group();
  root.name = 'J-20';
  const parts = {};
  const add = (name, geo, mat, parent) => {
    const mesh = new Mesh(geo, mat);
    mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true;
    (parent || root).add(mesh);
    parts[name] = mesh;
    return mesh;
  };

  /* ---- 机身 ---- */
  add('fuselage', buildFuselage(FUSE_STATIONS, 7, true), M.skin);

  /* ---- 机翼 / 鸭翼 / 尾翼 ---- */
  const wing = makeWingGeo();
  add('wing_R', wing, M.skin); add('wing_L', mirrorZ(wing), M.skin);
  // 鸭翼做成可绕自身转轴偏转的全动面：几何平移到转轴原点，再由 pivot 定位
  const CP = [3.20, 0.34, 0];
  const canardPair = [];
  for (const s of [1, -1]) {
    const pivot = new Group();
    pivot.name = 'canard_pivot_' + (s > 0 ? 'R' : 'L');
    pivot.position.set(CP[0], CP[1], CP[2]);
    let cg = makeCanardGeo();
    if (s < 0) cg = mirrorZ(cg);
    cg.translate(-CP[0], -CP[1], -CP[2]);
    const mesh = new Mesh(cg, M.skin);
    mesh.name = 'canard_' + (s > 0 ? 'R' : 'L');
    mesh.castShadow = true; mesh.receiveShadow = true;
    pivot.add(mesh); root.add(pivot);
    parts[mesh.name] = mesh; parts[pivot.name] = pivot;
    canardPair.push(pivot);
  }
  const vt = makeVTailGeo();
  add('vtail_R', vt, M.skin); add('vtail_L', mirrorZ(vt), M.skin);
  const vf = makeVentralGeo();
  add('ventral_R', vf, M.skin); add('ventral_L', mirrorZ(vf), M.skin);

  /* ---- DSI 进气道 ---- */
  const ig = makeIntakeGeo(), dg = makeInletDuctGeo();
  add('intake_R', ig, M.skin); add('intake_L', mirrorZ(ig), M.skin);
  add('duct_R', dg, M.dark); add('duct_L', mirrorZ(dg), M.dark);
  // DSI 鼓包
  for (const s of [1, -1]) {
    const bump = new Mesh(new SphereGeometry(1, 24, 16), M.skin);
    bump.scale.set(0.62, 0.40, 0.30);
    bump.position.set(3.86, -0.44, s * 1.12);
    bump.rotation.z = -8 * DEG; bump.rotation.y = s * 10 * DEG;
    bump.castShadow = true; bump.name = 'dsi_' + (s > 0 ? 'R' : 'L');
    root.add(bump); parts[bump.name] = bump;
  }

  /* ---- 座舱盖 ---- */
  const canopySt = [
    { x: 6.42, hw: 0.10, cy: 0.62, ty: 0.66, by: 0.58, tn: 2.2, bn: 2.2 },
    { x: 6.20, hw: 0.34, cy: 0.66, ty: 0.80, by: 0.58, tn: 2.4, bn: 2.4 },
    { x: 5.90, hw: 0.50, cy: 0.70, ty: 1.02, by: 0.58, tn: 2.6, bn: 2.6 },
    { x: 5.55, hw: 0.58, cy: 0.74, ty: 1.20, by: 0.60, tn: 2.8, bn: 2.6 },
    { x: 5.10, hw: 0.62, cy: 0.76, ty: 1.29, by: 0.62, tn: 3.0, bn: 2.6 },
    { x: 4.60, hw: 0.62, cy: 0.78, ty: 1.31, by: 0.64, tn: 3.0, bn: 2.6 },
    { x: 4.10, hw: 0.59, cy: 0.80, ty: 1.27, by: 0.66, tn: 3.0, bn: 2.6 },
    { x: 3.60, hw: 0.53, cy: 0.82, ty: 1.18, by: 0.70, tn: 2.9, bn: 2.6 },
    { x: 3.10, hw: 0.44, cy: 0.84, ty: 1.06, by: 0.74, tn: 2.8, bn: 2.6 },
    { x: 2.60, hw: 0.33, cy: 0.86, ty: 0.98, by: 0.80, tn: 2.6, bn: 2.6 },
    { x: 2.10, hw: 0.20, cy: 0.88, ty: 0.93, by: 0.85, tn: 2.4, bn: 2.4 },
  ];
  const canopy = add('canopy', buildFuselage(canopySt, 6, false), M.glass);
  canopy.castShadow = false;
  // 风挡框 + 后缘框
  const frame = new Mesh(new TorusGeometry(0.55, 0.035, 8, 28, Math.PI), M.frame);
  frame.position.set(5.86, 0.72, 0); frame.rotation.y = Math.PI / 2; frame.rotation.z = -18 * DEG;
  frame.scale.set(1, 1.05, 1);
  root.add(frame); parts.canopy_frame = frame;

  /* ---- 座舱内部 ---- */
  const tub = new Mesh(new BoxGeometry(2.1, 0.5, 0.92), M.cockpit);
  tub.position.set(4.85, 0.55, 0); root.add(tub); parts.cockpit_tub = tub;
  const seat = new Group();
  const seatBack = new Mesh(new BoxGeometry(0.16, 0.72, 0.52), M.cockpit);
  seatBack.position.set(-0.28, 0.34, 0); seatBack.rotation.z = 12 * DEG;
  const seatPan = new Mesh(new BoxGeometry(0.52, 0.12, 0.5), M.cockpit);
  seatPan.position.set(0.05, 0.02, 0);
  seat.add(seatBack, seatPan); seat.position.set(4.42, 0.62, 0);
  root.add(seat); parts.seat = seat;
  const hud = new Mesh(new BoxGeometry(0.04, 0.30, 0.42), M.glass);
  hud.position.set(5.42, 0.92, 0); hud.rotation.z = -10 * DEG;
  root.add(hud); parts.hud = hud;

  /* ---- 机头 EOTS 与光电窗口 ---- */
  const eots = new Mesh(new SphereGeometry(0.34, 6, 4), M.sensor);
  eots.scale.set(1.5, 0.62, 0.92);
  eots.position.set(7.45, -0.42, 0); eots.rotation.z = -6 * DEG;
  root.add(eots); parts.eots = eots;
  const dasPos = [[8.6, 0.22, 0.30], [8.6, 0.22, -0.30], [6.6, -0.40, 0.62], [6.6, -0.40, -0.62], [5.8, 0.60, 0.72], [5.8, 0.60, -0.72]];
  dasPos.forEach((p, i) => {
    const w = new Mesh(new CircleGeometry(0.10, 6), M.sensor);
    w.position.set(p[0], p[1], p[2]);
    w.lookAt(p[0] + (p[1] > 0 ? 0.3 : 0.2), p[1] + (p[1] > 0 ? 1 : -1), p[2] * 2);
    root.add(w); parts['das_' + i] = w;
  });
  // 空速管
  const pitot = new Mesh(new CylinderGeometry(0.018, 0.008, 0.72, 8), M.dark);
  pitot.rotation.z = Math.PI / 2; pitot.position.set(10.5, 0.0, 0);
  root.add(pitot); parts.pitot = pitot;

  /* ---- 尾喷管 ---- */
  const nozzles = new Group(); nozzles.name = 'nozzles';
  for (const s of [1, -1]) {
    const outer = new Mesh(new CylinderGeometry(0.50, 0.44, 1.35, 24, 1, true), M.nozzle);
    outer.rotation.z = Math.PI / 2; outer.position.set(-9.15, -0.10, s * 0.72);
    const inner = new Mesh(new CylinderGeometry(0.40, 0.36, 1.30, 24, 1, true), M.exhaust);
    inner.rotation.z = Math.PI / 2; inner.position.set(-9.15, -0.10, s * 0.72);
    const cap = new Mesh(new CircleGeometry(0.36, 24), M.exhaust);
    cap.rotation.y = -Math.PI / 2; cap.position.set(-9.78, -0.10, s * 0.72);
    const ring = new Mesh(new TorusGeometry(0.50, 0.035, 8, 24), M.nozzle);
    ring.rotation.y = Math.PI / 2; ring.position.set(-8.50, -0.10, s * 0.72);
    // 收敛段外壳
    const shroud = new Mesh(new CylinderGeometry(0.56, 0.50, 0.9, 24, 1, true), M.skin);
    shroud.rotation.z = Math.PI / 2; shroud.position.set(-8.05, -0.10, s * 0.72);
    [outer, inner, cap, ring, shroud].forEach((m) => { m.castShadow = true; nozzles.add(m); });
  }
  root.add(nozzles); parts.nozzle_group = nozzles;

  /* ---- 加力焰（默认隐藏） ---- */
  const flames = new Group(); flames.name = 'flames'; flames.visible = false;
  for (const s of [1, -1]) {
    const core = new Mesh(new ConeGeometry(0.30, 3.2, 20, 1, true), M.flameCore);
    core.rotation.z = Math.PI / 2; core.position.set(-11.4, -0.10, s * 0.72);
    const halo = new Mesh(new ConeGeometry(0.44, 5.0, 20, 1, true), M.flameHalo);
    halo.rotation.z = Math.PI / 2; halo.position.set(-12.3, -0.10, s * 0.72);
    flames.add(core, halo);
  }
  root.add(flames); parts.flames = flames;

  /* ---- 弹舱 ---- */
  const bays = new Group(); bays.name = 'bays';
  const mainDoorGeo = new BoxGeometry(3.4, 0.05, 0.82);
  const bayCavity = new Mesh(new BoxGeometry(3.4, 0.55, 1.7), M.dark);
  bayCavity.position.set(-0.10, -0.76, 0); bays.add(bayCavity); parts.bay_cavity = bayCavity;
  const doors = [];
  for (const s of [1, -1]) {
    const hinge = new Group();
    hinge.position.set(-0.10, -1.00, s * 0.86);
    const door = new Mesh(mainDoorGeo, M.skin);
    door.position.set(0, 0, -s * 0.41);
    door.castShadow = true;
    hinge.add(door); bays.add(hinge); doors.push({ hinge, sign: s, open: -s * 78 * DEG, axis: 'x' });
    parts['bay_door_' + (s > 0 ? 'R' : 'L')] = hinge;
  }
  // 侧弹舱
  for (const s of [1, -1]) {
    const hinge = new Group();
    hinge.position.set(2.05, -0.62, s * 1.32);
    const door = new Mesh(new BoxGeometry(1.5, 0.62, 0.05), M.skin);
    door.position.set(0, -0.30, 0); door.castShadow = true;
    hinge.add(door); bays.add(hinge);
    doors.push({ hinge, sign: s, open: -s * 62 * DEG, axis: 'x' });
    parts['side_bay_' + (s > 0 ? 'R' : 'L')] = hinge;
  }
  root.add(bays); parts.bay_group = bays;

  /* ---- 导弹 ---- */
  const makeMissile = (len, rad, finSpan, finC, color) => {
    const g = new Group();
    const body = new Mesh(new CylinderGeometry(rad, rad, len, 16), color);
    body.rotation.z = Math.PI / 2; g.add(body);
    const nose = new Mesh(new ConeGeometry(rad, rad * 5, 16), color);
    nose.rotation.z = -Math.PI / 2; nose.position.x = len / 2 + rad * 2.5; g.add(nose);
    for (let i = 0; i < 4; i++) {
      const fin = new Mesh(new BoxGeometry(finC, finSpan, 0.012), color);
      fin.position.set(-len / 2 + finC * 0.6, 0, 0);
      const pivot = new Group(); pivot.rotation.x = i * Math.PI / 2;
      fin.position.y = finSpan / 2 + rad * 0.8;
      pivot.add(fin); g.add(pivot);
    }
    return g;
  };
  const weapons = new Group(); weapons.name = 'weapons'; weapons.visible = false;
  for (let i = 0; i < 4; i++) {
    const m = makeMissile(3.8, 0.10, 0.42, 0.34, M.missile);
    m.position.set(-0.1, -0.78, (i - 1.5) * 0.42);
    weapons.add(m);
  }
  for (const s of [1, -1]) {
    const m = makeMissile(2.9, 0.077, 0.34, 0.26, M.missile);
    m.position.set(2.1, -0.55, s * 1.20);
    weapons.add(m);
  }
  root.add(weapons); parts.weapons = weapons;

  /* ---- 起落架 ---- */
  const gear = new Group(); gear.name = 'gear';
  const makeWheel = (r, w) => {
    const g = new Group();
    const tire = new Mesh(new CylinderGeometry(r, r, w, 24), M.tire);
    tire.rotation.x = Math.PI / 2; tire.castShadow = true;
    const hub = new Mesh(new CylinderGeometry(r * 0.45, r * 0.45, w * 1.05, 16), M.metal);
    hub.rotation.x = Math.PI / 2;
    g.add(tire, hub);
    return g;
  };
  // 前起落架（轮胎触地面 y = -2.30）
  const nose = new Group(); nose.name = 'gear_nose';
  const nStrut = new Mesh(new CylinderGeometry(0.055, 0.065, 1.18, 12), M.metal);
  nStrut.position.y = -0.60; nStrut.castShadow = true;
  const nWheel = makeWheel(0.29, 0.16); nWheel.position.y = -1.23;
  const nFork = new Mesh(new BoxGeometry(0.10, 0.34, 0.22), M.metal);
  nFork.position.y = -1.08;
  nose.add(nStrut, nFork, nWheel); nose.position.set(5.55, -0.78, 0);
  gear.add(nose); parts.gear_nose = nose;
  // 主起落架
  for (const s of [1, -1]) {
    const mg = new Group();
    const strut = new Mesh(new CylinderGeometry(0.07, 0.08, 1.10, 12), M.metal);
    strut.position.y = -0.55; strut.castShadow = true;
    const brace = new Mesh(new CylinderGeometry(0.035, 0.035, 0.80, 8), M.metal);
    brace.position.set(0.26, -0.44, 0); brace.rotation.z = 35 * DEG;
    const wheel = makeWheel(0.38, 0.22); wheel.position.set(0, -1.06, s * 0.03);
    mg.add(strut, brace, wheel);
    mg.position.set(-0.55, -0.86, s * 1.18);
    gear.add(mg); parts['gear_main_' + (s > 0 ? 'R' : 'L')] = mg;
  }
  // 起落架舱门
  const gdoors = [];
  const nd = new Group(); nd.position.set(6.05, -0.80, 0);
  const ndm = new Mesh(new BoxGeometry(1.5, 0.04, 0.55), M.skin);
  ndm.position.x = -0.7; ndm.castShadow = true; nd.add(ndm);
  gear.add(nd); gdoors.push({ hinge: nd, open: 82 * DEG, axis: 'z' });
  for (const s of [1, -1]) {
    const d = new Group(); d.position.set(-0.55, -0.92, s * 0.92);
    const dm = new Mesh(new BoxGeometry(1.7, 0.04, 0.62), M.skin);
    dm.position.z = s * 0.31; dm.castShadow = true; d.add(dm);
    gear.add(d); gdoors.push({ hinge: d, open: s * 85 * DEG, axis: 'x' });
  }
  root.add(gear); parts.gear_group = gear;

  return { root, parts, doors, gdoors, canardPair };
}

/* ============================ 程序化贴图 ============================ */
/* 仅浏览器可用；node 校验时自动跳过 */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}

/** 蒙皮：面板分块 + 铆钉 + 锯齿口盖 + 旧化 */
function makeSkinMaps() {
  if (!HAS_DOM) return {};
  const R = makeRng(20110111);
  const W = 2048, H = 1024;
  const { c, x } = makeCanvas(W, H);
  x.fillStyle = '#7d848c'; x.fillRect(0, 0, W, H);
  // 面板色差
  for (let i = 0; i < 260; i++) {
    const w = 40 + R() * 190, h = 26 + R() * 120;
    x.fillStyle = `rgba(${R() > 0.5 ? 255 : 0},${R() > 0.5 ? 255 : 0},${R() > 0.5 ? 255 : 0},${0.012 + R() * 0.022})`;
    x.fillRect(R() * W, R() * H, w, h);
  }
  // 纵向（周向）分缝
  x.strokeStyle = 'rgba(28,34,42,0.55)'; x.lineWidth = 1.6;
  for (const u of [0.06, 0.12, 0.19, 0.26, 0.33, 0.40, 0.47, 0.55, 0.63, 0.70, 0.77, 0.84, 0.91]) {
    x.beginPath(); x.moveTo(u * W, 0); x.lineTo(u * W, H); x.stroke();
  }
  // 横向（轴向）分缝
  for (const v of [0.10, 0.22, 0.30, 0.42, 0.5, 0.58, 0.70, 0.78, 0.90]) {
    x.beginPath(); x.moveTo(0, v * H); x.lineTo(W, v * H); x.stroke();
  }
  // 锯齿状口盖（隐身机的标志）
  const saw = (x0, y0, w, h, teeth) => {
    x.beginPath();
    for (let i = 0; i <= teeth; i++) {
      const px = x0 + (w * i) / teeth, py = y0 + (i % 2 ? h * 0.10 : 0);
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    for (let i = teeth; i >= 0; i--) {
      const px = x0 + (w * i) / teeth, py = y0 + h - (i % 2 ? h * 0.10 : 0);
      x.lineTo(px, py);
    }
    x.closePath(); x.stroke();
  };
  x.lineWidth = 1.9;
  saw(0.30 * W, 0.34 * H, 190, 96, 11);
  saw(0.46 * W, 0.36 * H, 230, 110, 13);
  saw(0.60 * W, 0.30 * H, 170, 84, 9);
  saw(0.20 * W, 0.62 * H, 160, 90, 9);
  // 铆钉
  x.fillStyle = 'rgba(40,46,54,0.35)';
  for (let i = 0; i < 5200; i++) x.fillRect(R() * W, R() * H, 1.1, 1.1);
  // 旧化：油污与流痕
  for (let i = 0; i < 90; i++) {
    const gx = R() * W, gy = R() * H, len = 20 + R() * 120;
    const grd = x.createLinearGradient(gx, gy, gx + len, gy);
    grd.addColorStop(0, 'rgba(30,32,36,0.16)'); grd.addColorStop(1, 'rgba(30,32,36,0)');
    x.fillStyle = grd; x.fillRect(gx, gy, len, 2 + R() * 5);
  }
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace; map.anisotropy = 8;

  // 粗糙度：缝线处更粗糙
  const { c: c2, x: x2 } = makeCanvas(W, H);
  x2.fillStyle = '#8a8a8a'; x2.fillRect(0, 0, W, H);
  x2.drawImage(c, 0, 0);
  x2.globalCompositeOperation = 'saturation'; x2.fillStyle = '#808080'; x2.fillRect(0, 0, W, H);
  const rough = new CanvasTexture(c2); rough.anisotropy = 8;
  return { map, rough };
}

/** 八一军徽（低可视度） */
function makeInsignia(size, lowVis) {
  if (!HAS_DOM) return null;
  const { c, x } = makeCanvas(size, size);
  x.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, R = size * 0.46;
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? R * 0.42 : R;
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
    i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  }
  x.closePath();
  x.fillStyle = lowVis ? 'rgba(96,44,44,0.92)' : '#c1272d';
  x.fill();
  x.strokeStyle = lowVis ? 'rgba(150,150,150,0.35)' : 'rgba(255,235,120,0.9)';
  x.lineWidth = size * 0.02; x.stroke();
  // 「八一」
  x.fillStyle = lowVis ? 'rgba(170,150,110,0.85)' : '#ffd700';
  x.font = `bold ${size * 0.30}px "Microsoft YaHei", sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('八一', cx, cy + size * 0.02);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}

/** 机号 / 警告标记 */
function makeSerial(text, w, h, color) {
  if (!HAS_DOM) return null;
  const { c, x } = makeCanvas(w, h);
  x.clearRect(0, 0, w, h);
  x.fillStyle = color || 'rgba(58,64,72,0.95)';
  x.font = `bold ${h * 0.72}px "Consolas", monospace`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}

/** 尾喷管高温着色渐变 */
function makeNozzleMap() {
  if (!HAS_DOM) return null;
  const R = makeRng(778899);
  const { c, x } = makeCanvas(256, 256);
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0.00, '#8d8f92');
  g.addColorStop(0.35, '#6e6257');
  g.addColorStop(0.62, '#5a4136');
  g.addColorStop(0.82, '#3f2f2c');
  g.addColorStop(1.00, '#2b2422');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${20 + R() * 60},${18 + R() * 40},${16 + R() * 30},0.22)`;
    x.fillRect(R() * 256, R() * 256, 2, 1);
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}
