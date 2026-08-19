/**
 * Ships.js — 海景船只道具库。
 *
 * 程序化生成低-中模船体网格（无贴图、无外部资源），并为每艘船提供匹配的
 * 多点浮力物理配置（FloatingBody）。所有船遵循统一的局部坐标约定：
 *   +Z 为船头（前进方向）、+X 为右舷、+Y 向上，y=0 为设计水线。
 *
 * 船体由一系列沿 Z 轴分布的横剖面站（station）拼合而成，每个剖面是 XY 平面内
 * 的一圈 2D 点：龙骨 → 右舷舭部 → 右舷舷侧 → 右舷舷缘 → (甲板/内舱) → 左舷舷缘
 * → 左舷舷侧 → 左舷舭部 → 龙骨。相邻剖面缝合成三角网格，首尾用扇形封盖，从而得到
 * 尖艏、宽舯、方艉、带舭部与龙骨的真正"船形"。水线彩带与防污底漆通过顶点色实现。
 */
import * as THREE from 'three';

/**
 * @typedef {object} BoatSpec
 * @property {THREE.Group} group      视觉网格（局部坐标，y=0 为水线，+Z 为船头）
 * @property {object} body            直接传给 new FloatingBody(...) 的配置（不含 pos/quat）
 * @property {THREE.Vector3[]} debrisPoints  解体时生成碎片的局部位置
 * @property {string} label           中文名
 * @property {number} lodDistance     超过该距离可切换到低模（米）
 */

/* ============================================================ */
/* 通用工具                                                      */
/* ============================================================ */

/** 若调用方未传入 rng，回退到 Math.random（仅作兜底，正常流程总会传入 Rng）。 */
const FALLBACK_RNG = {
  next: () => Math.random(),
  range: (a, b) => a + (b - a) * Math.random(),
  int: (a, b) => Math.floor(a + (b - a + 1) * Math.random()),
  pick: (a) => a[Math.floor(Math.random() * a.length)],
  bool: (p = 0.5) => Math.random() < p,
  sign: () => (Math.random() < 0.5 ? -1 : 1),
};
const rngOf = (rng) => (rng && typeof rng.next === 'function' ? rng : FALLBACK_RNG);

/** 创建标准材质（MeshStandardMaterial）。 */
function std(color, { rough = 0.78, metal = 0.06, side = THREE.FrontSide, flat = false, vc = false } = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: metal, side, flatShading: flat, vertexColors: vc,
  });
}

/** 把网格加入组并统一设置阴影与名字。 */
function put(group, geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** 快捷盒子。 */
function box(group, w, h, d, mat, name, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** 快捷圆柱（轴向 Y）。 */
function cyl(group, rTop, rBot, h, mat, name, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** 两点之间的细圆柱线（缆绳、栏杆、桨等）。 */
function line3d(group, a, b, r, mat, name, seg = 4) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 1e-4) return null;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** 轮胎护舷（Torus，环面轴向 X，挂于舷侧）。 */
function tire(group, x, y, z, mat, name, r = 0.32, tube = 0.11) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 12), mat);
  m.rotation.y = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** 控制点多边形线性采样（曲线轮廓）。 */
function curve(cp, t) {
  if (!cp || !cp.length) return 1;
  if (t <= cp[0][0]) return cp[0][1];
  for (let i = 1; i < cp.length; i++) {
    if (t <= cp[i][0]) {
      const [t0, v0] = cp[i - 1];
      const [t1, v1] = cp[i];
      const k = (t - t0) / (t1 - t0 || 1e-6);
      return v0 + (v1 - v0) * k;
    }
  }
  return cp[cp.length - 1][1];
}

/** 半宽水线轮廓：船尾较宽、中部最宽、船首收尖。 */
const WATERLINE = [
  [0.00, 0.70], [0.22, 0.90], [0.48, 1.00], [0.70, 0.93],
  [0.86, 0.68], [0.95, 0.34], [1.00, 0.04],
];
/** 吃水轮廓：舯部最深、船首明显变浅。 */
const DRAFT_LINE = [
  [0.00, 0.90], [0.42, 1.00], [0.78, 0.82], [1.00, 0.52],
];
/** 甲板舷弧（干舷比例）：船首船尾略翘、中部略低。 */
const SHEER_LINE = [
  [0.00, 1.06], [0.38, 0.82], [1.00, 1.22],
];

/* ============================================================ */
/* 船体几何                                                      */
/* ============================================================ */

/**
 * 生成横剖面站（stations）。每个站为 { z, pts }，pts 是 XY 平面内一圈 2D 点。
 * @param {object} o
 * @param {number} o.length     船长（Z 向，米）
 * @param {number} o.beam       最大船宽（X 向，米）
 * @param {number} o.draft      最大吃水（米）
 * @param {number} o.freeboard  干舷（水线到甲板/舷缘高度，米）
 * @param {number} [o.chine]    舭部半宽占舷侧半宽比例
 * @param {number} [o.n]        站数
 * @param {boolean} [o.open]    是否敞口（无甲板，如小艇）
 * @param {Array<[number,number]>} [o.wl] 水线轮廓控制点
 * @param {Array<[number,number]>} [o.dr] 吃水轮廓控制点
 * @param {Array<[number,number]>} [o.sh] 舷弧轮廓控制点
 */
function hullStations(o) {
  const { length, beam, draft, freeboard } = o;
  const chine = o.chine ?? 0.6;
  const n = o.n ?? 9;
  const wl = o.wl || WATERLINE;
  const dr = o.dr || DRAFT_LINE;
  const sh = o.sh || SHEER_LINE;
  const open = !!o.open;
  const stations = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const z = (t - 0.5) * length;
    const bh = beam * 0.5 * curve(wl, t);
    const bk = bh * chine;
    const dy = draft * curve(dr, t);
    const fy = freeboard * curve(sh, t);
    const th = bh * 0.2; // 敞口艇的舷侧板厚（内缩量）
    if (open) {
      /* 敞口艇：外底 → 舷侧 → 舷缘 → 内舷 → 舱底 → 内舷 → 舷缘 → 舷侧 → 外底 */
      stations.push({
        z,
        pts: [
          [0, -dy],            // 龙骨(外底)
          [bk, -dy * 0.5],     // 舭部(星)
          [bh, fy * 0.35],     // 舷侧(星)
          [bh, fy],            // 舷缘(星)
          [bh - th, fy * 0.55],// 内舷(星)
          [0, -dy * 0.45],     // 舱底(内)
          [-bh + th, fy * 0.55],// 内舷(左)
          [-bh, fy],           // 舷缘(左)
          [-bh, fy * 0.35],    // 舷侧(左)
          [-bk, -dy * 0.5],    // 舭部(左)
        ],
      });
    } else {
      /* 有甲板：外底 → 舷侧 → 舷缘 → (甲板) → 舷缘 → 舷侧 → 外底 */
      stations.push({
        z,
        pts: [
          [0, -dy],            // 龙骨
          [bk, -dy * 0.5],     // 舭部(星)
          [bh, fy * 0.35],     // 舷侧(星)
          [bh, fy],            // 舷缘(星)
          [-bh, fy],           // 舷缘(左)
          [-bh, fy * 0.35],    // 舷侧(左)
          [-bk, -dy * 0.5],    // 舭部(左)
        ],
      });
    }
  }
  return stations;
}

/** 端面扇形封盖。s===0 为船尾（外法线 -Z），需反转绕序。 */
function capFan(pos, idx, s, m) {
  let cx = 0, cy = 0, cz = 0;
  for (let j = 0; j < m; j++) {
    const k = (s * m + j) * 3;
    cx += pos[k]; cy += pos[k + 1]; cz += pos[k + 2];
  }
  cx /= m; cy /= m; cz /= m;
  const c = pos.length / 3;
  pos.push(cx, cy, cz);
  const flip = s === 0;
  for (let j = 0; j < m; j++) {
    const a = s * m + j;
    const b = s * m + ((j + 1) % m);
    if (flip) idx.push(b, a, c);
    else idx.push(a, b, c);
  }
}

/**
 * 由横剖面站缝合成船体三角网格（可复用辅助函数）。
 * @param {Array<{z:number, pts:Array<[number,number]>}>} stations
 * @param {object} [opts]
 * @param {(x:number,y:number,z:number,c:THREE.Color)=>void} [opts.color] 顶点着色回调
 * @returns {THREE.BufferGeometry}
 */
export function hullGeometry(stations, opts = {}) {
  const n = stations.length;
  const m = stations[0].pts.length;
  const pos = [];
  for (let i = 0; i < n; i++) {
    const { z, pts } = stations[i];
    for (let j = 0; j < m; j++) pos.push(pts[j][0], pts[j][1], z);
  }
  const idx = [];
  /* 相邻站之间的四边面（沿船长方向）。 */
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      const a = i * m + j, b = i * m + j2;
      const c = (i + 1) * m + j, d = (i + 1) * m + j2;
      idx.push(a, b, c, b, d, c);
    }
  }
  /* 首尾封盖。 */
  capFan(pos, idx, 0, m);
  capFan(pos, idx, n - 1, m);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.computeVertexNormals();

  if (typeof opts.color === 'function') {
    const vcount = pos.length / 3;
    const colors = new Float32Array(pos.length);
    const c = new THREE.Color();
    for (let i = 0; i < vcount; i++) {
      opts.color(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return geo;
}

/** 甲板表面（带轻微梁拱，铺在舷缘之上）。 */
function deckGeometry(stations, camber = 0.05, lift = 0.03) {
  const n = stations.length;
  const pos = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const { z, pts } = stations[i];
    const xr = pts[3][0], yr = pts[3][1] + lift;
    const xl = pts[4][0], yl = pts[4][1] + lift;
    const yc = (yr + yl) * 0.5 + camber;
    pos.push(xr, yr, z, 0, yc, z, xl, yl, z);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
    idx.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.computeVertexNormals();
  return geo;
}

/** 三角帆：按重心坐标细分一个三角形，并沿法线方向鼓出中腹。 */
function triangleSail(a, b, c, { div = 6, belly = 0.4 } = {}) {
  const e1 = new THREE.Vector3().subVectors(b, a);
  const e2 = new THREE.Vector3().subVectors(c, a);
  const nrm = new THREE.Vector3().crossVectors(e1, e2).normalize();
  const pos = [];
  const idx = [];
  const vert = [];
  let k = 0;
  for (let i = 0; i <= div; i++) {
    vert[i] = [];
    for (let j = 0; j <= div - i; j++) {
      const u = i / div, v = j / div, w = 1 - u - v;
      const p = new THREE.Vector3()
        .addScaledVector(a, w)
        .addScaledVector(b, u)
        .addScaledVector(c, v);
      /* 边缘为 0、中心最大的平滑鼓肚。 */
      const f = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * Math.sin(Math.PI * w);
      p.addScaledVector(nrm, f * belly);
      pos.push(p.x, p.y, p.z);
      vert[i][j] = k++;
    }
  }
  for (let i = 0; i < div; i++) {
    for (let j = 0; j < div - i; j++) {
      idx.push(vert[i][j], vert[i + 1][j], vert[i][j + 1]);
      if (j < div - i - 1) idx.push(vert[i + 1][j], vert[i + 1][j + 1], vert[i][j + 1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.computeVertexNormals();
  return geo;
}

/** 水线彩带 + 防污底漆的顶点着色（按 y 分带）。 */
function hullColorFn(pal) {
  return (x, y, z, out) => {
    if (y < -0.06) out.setHex(pal.anti);   // 防污漆（水线以下）
    else if (y < 0.16) out.setHex(pal.stripe); // 水线彩带
    else out.setHex(pal.hull);             // 干舷/船体色
  };
}

/**
 * 按船体轮廓撒浮力采样点：左右舷各若干站 + 龙骨线若干站。
 * @returns {THREE.Vector3[]}
 */
function buoyPoints(o) {
  const pts = [];
  const nSide = o.nSide ?? 4;
  const wl = o.wl || WATERLINE;
  const dr = o.dr || DRAFT_LINE;
  for (let i = 0; i < nSide; i++) {
    const t = 0.12 + 0.78 * (i / Math.max(1, nSide - 1));
    const z = (t - 0.5) * o.length;
    const bh = o.beam * 0.5 * curve(wl, t);
    const dy = o.draft * curve(dr, t);
    const x = bh * (o.sideFrac ?? 0.7);
    const y = -dy * (o.sideLift ?? 0.8);
    pts.push(new THREE.Vector3(x, y, z), new THREE.Vector3(-x, y, z));
  }
  const nKeel = o.nKeel ?? 3;
  for (let i = 0; i < nKeel; i++) {
    const t = 0.18 + 0.64 * (i / Math.max(1, nKeel - 1));
    const z = (t - 0.5) * o.length;
    const dy = o.draft * curve(dr, t);
    pts.push(new THREE.Vector3(0, -dy * (o.keelFrac ?? 1.0), z));
  }
  return pts;
}

/** 组装 BoatSpec 并套用 scale（视觉组缩放 + 物理量同步缩放）。 */
function finalize(group, body, debrisPoints, label, lodDistance, scale) {
  if (scale != null && scale !== 1) {
    group.scale.setScalar(scale);
    body.size.multiplyScalar(scale);
    for (const p of body.points) p.multiplyScalar(scale);
    body.sailCenter.multiplyScalar(scale);
    body.sailArea *= scale * scale;
    body.mass *= scale * scale * scale;
    if (body.pointRadius) body.pointRadius *= scale;
    lodDistance *= scale;
  }
  return { group, body, debrisPoints, label, lodDistance };
}

/* ============================================================ */
/* 调色板                                                        */
/* ============================================================ */

/** 船体配色：hull 干舷、stripe 水线彩带、anti 防污底漆。 */
const HULL_PALETTES = [
  { hull: 0xf4f6f8, stripe: 0xb3272d, anti: 0x6e1618 },
  { hull: 0x2f5f8f, stripe: 0xf0b429, anti: 0x5a1414 },
  { hull: 0xd03838, stripe: 0xf4f6f8, anti: 0x33140f },
  { hull: 0x24424f, stripe: 0xe0e4e8, anti: 0x47110f },
];

function paletteFor(rng, opts) {
  const i = opts.palette != null ? opts.palette : rng.int(0, HULL_PALETTES.length - 1);
  return HULL_PALETTES[((i % HULL_PALETTES.length) + HULL_PALETTES.length) % HULL_PALETTES.length];
}

/* ============================================================ */
/* 单桅帆船 ~11 m                                                */
/* ============================================================ */

export function buildSailboat(rng, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;
  const sailsUp = opts.sailsUp !== false;
  const pal = paletteFor(rng, opts);

  const length = 11, beam = 3.4, draft = 1.7, freeboard = 1.1;
  const hs = { length, beam, draft, freeboard, n: 10, chine: 0.55 };
  const stations = hullStations(hs);
  const deckY = freeboard;

  const group = new THREE.Group();
  group.name = 'sailboat';

  /* 船体 + 甲板 */
  put(group, hullGeometry(stations, { color: hullColorFn(pal) }),
    std(0xffffff, { rough: 0.6, metal: 0.12, vc: true }), 'hull');
  put(group, deckGeometry(stations, 0.06), std(0x9c7a4a, { rough: 0.85, metal: 0.0 }), 'deck');

  /* 舵舱(驾驶舱顶) + 舱口 */
  box(group, beam * 0.62, 0.9, 2.4, std(0xdfe3e7, { rough: 0.7 }), 'coachroof', 0, deckY + 0.45, -2.6);
  box(group, beam * 0.62, 0.12, 1.1, std(0x2a2f36, { rough: 0.5, metal: 0.2 }), 'hatch', 0, deckY + 0.95, -1.2);

  /* 龙骨鳍（深龙骨，帮助自扶正） */
  box(group, 0.22, 1.0, 2.4, std(0x3a3f46, { rough: 0.6, metal: 0.4 }), 'finKeel', 0, -draft - 0.35, 0.2);
  /* 舵 */
  box(group, 0.06, 0.85, 0.42, std(0x3a3f46, { rough: 0.6, metal: 0.4 }), 'rudder', 0, -0.42, -length / 2 + 0.25);

  /* 桅杆与帆 */
  const mastZ = 0.5;
  const mastTop = deckY + 12.4;
  const mastMat = std(0xd8dce0, { rough: 0.5, metal: 0.45 });
  cyl(group, 0.06, 0.11, mastTop - deckY, mastMat, 'mast', 0, (deckY + mastTop) / 2, mastZ, 6);

  const boomY = deckY + 0.55;
  const boomZ = -length / 2 + 0.8;
  box(group, 0.07, 0.07, mastZ - boomZ + 0.4, mastMat, 'boom', 0, boomY, (mastZ + boomZ) / 2);

  const sailMat = std(0xe9e4d6, { rough: 0.92, metal: 0.0, side: THREE.DoubleSide });
  const offX = 0.07; // 帆相对中心线略偏，避免与桅杆穿插
  if (sailsUp) {
    /* 主帆：桅底 → 桅顶 → 帆尾 */
    const main = triangleSail(
      new THREE.Vector3(offX, deckY + 0.5, mastZ + 0.1),
      new THREE.Vector3(offX, mastTop - 0.2, mastZ + 0.1),
      new THREE.Vector3(offX, boomY + 0.1, boomZ),
      { div: 7, belly: 0.5 });
    put(group, main, sailMat, 'mainSail');
    /* 船首三角帆：桅顶 → 船首 → 前甲板 */
    const jib = triangleSail(
      new THREE.Vector3(offX, mastTop - 0.2, mastZ + 0.1),
      new THREE.Vector3(offX, deckY * 1.2, length / 2 - 0.5),
      new THREE.Vector3(offX, deckY + 0.15, mastZ - 0.7),
      { div: 5, belly: 0.32 });
    put(group, jib, sailMat, 'jibSail');
  } else {
    /* 收帆：捆在帆桁上的帆卷 */
    box(group, 0.22, 0.22, mastZ - boomZ + 0.4, std(0xcfc9ba, { rough: 0.95 }), 'furledSail', 0, boomY, (mastZ + boomZ) / 2);
  }

  /* 缆绳：前支索、后支索、左右侧支索 */
  const wire = std(0x9aa0a6, { rough: 0.4, metal: 0.7 });
  line3d(group, new THREE.Vector3(0, mastTop - 0.3, mastZ), new THREE.Vector3(0, deckY * 1.2, length / 2 - 0.5), 0.012, wire, 'forestay');
  line3d(group, new THREE.Vector3(0, mastTop - 0.3, mastZ), new THREE.Vector3(0, deckY, -length / 2 + 0.6), 0.012, wire, 'backstay');
  line3d(group, new THREE.Vector3(0, mastTop - 1.0, mastZ), new THREE.Vector3(beam * 0.42, deckY + 0.1, mastZ - 0.4), 0.010, wire, 'shroudR');
  line3d(group, new THREE.Vector3(0, mastTop - 1.0, mastZ), new THREE.Vector3(-beam * 0.42, deckY + 0.1, mastZ - 0.4), 0.010, wire, 'shroudL');

  const body = {
    size: new THREE.Vector3(beam / 2, 7.2, length / 2),
    mass: 4500,
    points: buoyPoints({ ...hs, nSide: 4, nKeel: 4, sideFrac: 0.7, sideLift: 0.75, keelFrac: 1.25 }),
    pointRadius: draft * 0.62,
    sailArea: sailsUp ? 55 : 10,
    sailCenter: new THREE.Vector3(0, sailsUp ? 6.5 : 3.2, 0.3),
    cdWater: 1.1,
    selfDrive: 0,
    heading: 0,
    name: 'sailboat',
  };
  return finalize(group, body, [
    new THREE.Vector3(0, mastTop, mastZ),
    new THREE.Vector3(0, deckY, length / 2),
    new THREE.Vector3(0, deckY, -length / 2),
    new THREE.Vector3(0, deckY + 0.4, -2.6),
    new THREE.Vector3(beam * 0.3, deckY, 0),
    new THREE.Vector3(-beam * 0.3, deckY, 0),
  ], '单桅帆船', 350, scale);
}

/* ============================================================ */
/* 拖网渔船 ~18 m                                                */
/* ============================================================ */

export function buildFishingBoat(rng, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;
  const pal = paletteFor(rng, opts);

  const length = 18, beam = 5.2, draft = 2.0, freeboard = 1.6;
  const hs = { length, beam, draft, freeboard, n: 11, chine: 0.6 };
  const stations = hullStations(hs);
  const deckY = freeboard;

  const group = new THREE.Group();
  group.name = 'fishingBoat';

  put(group, hullGeometry(stations, { color: hullColorFn(pal) }),
    std(0xffffff, { rough: 0.62, metal: 0.1, vc: true }), 'hull');
  put(group, deckGeometry(stations, 0.05), std(0x8a6b47, { rough: 0.88 }), 'deck');

  /* 驾驶室（上构） */
  const wm = std(0xdfe3e7, { rough: 0.7 });
  const win = std(0x1b2733, { rough: 0.3, metal: 0.5 });
  box(group, beam * 0.6, 2.4, 3.6, wm, 'wheelhouse', 0, deckY + 1.2, -2.8);
  box(group, beam * 0.6, 0.5, 3.6, wm, 'wheelhouseRoof', 0, deckY + 2.65, -2.8);
  /* 前窗 */
  box(group, beam * 0.56, 0.7, 0.08, win, 'windows', 0, deckY + 2.1, -1.05);

  /* 桅杆 + 吊臂 */
  const steel = std(0x9aa0a6, { rough: 0.45, metal: 0.6 });
  const mastY = deckY + 6.0;
  cyl(group, 0.08, 0.14, mastY - deckY, steel, 'mast', 0, (deckY + mastY) / 2, 2.0, 6);
  const armEnd = new THREE.Vector3(0, deckY + 4.6, -7.4);
  line3d(group, new THREE.Vector3(0, mastY - 0.4, 2.0), armEnd, 0.07, steel, 'craneBoom', 6);
  line3d(group, new THREE.Vector3(0, mastY - 0.4, 2.0), new THREE.Vector3(0, deckY + 0.4, -0.2), 0.014, steel, 'craneStay');

  /* 渔网卷筒（横置圆柱 + 端盘） */
  const drumMat = std(0x2a2f36, { rough: 0.55, metal: 0.3 });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 10), drumMat);
  drum.rotation.x = Math.PI / 2;
  drum.position.set(0, deckY + 0.55, -7.6);
  drum.castShadow = drum.receiveShadow = true;
  drum.name = 'netDrum';
  group.add(drum);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 10), std(0x7d4b2a, { rough: 0.95 }));
  net.rotation.x = Math.PI / 2;
  net.position.set(0, deckY + 0.55, -7.6);
  net.castShadow = net.receiveShadow = true;
  net.name = 'net';
  group.add(net);

  /* 舷侧轮胎护舷 */
  const tireMat = std(0x16181c, { rough: 0.9 });
  for (const z of [-4.5, -1.5, 1.5, 4.5]) {
    tire(group, beam / 2 + 0.12, deckY - 0.15, z, tireMat, 'fenderR');
    tire(group, -beam / 2 - 0.12, deckY - 0.15, z, tireMat, 'fenderL');
  }

  /* 甲板货舱盖 + 龙门架 */
  box(group, beam * 0.7, 0.35, 2.8, std(0x6e5647, { rough: 0.85, metal: 0.2 }), 'hatchCover', 0, deckY + 0.18, 3.2);

  const body = {
    size: new THREE.Vector3(beam / 2, 4.0, length / 2),
    mass: 26000,
    points: buoyPoints({ ...hs, nSide: 4, nKeel: 4, sideFrac: 0.72, sideLift: 0.72, keelFrac: 0.95 }),
    pointRadius: draft * 0.6,
    sailArea: 55,
    sailCenter: new THREE.Vector3(0, 3.6, -1.5),
    cdWater: 1.1,
    selfDrive: 1.5,
    heading: 0,
    name: 'fishingBoat',
  };
  return finalize(group, body, [
    new THREE.Vector3(0, mastY, 2.0),
    new THREE.Vector3(0, deckY + 2.4, -2.8),
    new THREE.Vector3(0, deckY + 0.5, -7.6),
    new THREE.Vector3(0, deckY, length / 2),
    new THREE.Vector3(0, deckY, -length / 2),
    new THREE.Vector3(beam * 0.4, deckY, 3.2),
  ], '拖网渔船', 450, scale);
}

/* ============================================================ */
/* 小型货轮 ~85 m                                                */
/* ============================================================ */

export function buildCargoShip(rng, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;
  const rust = { hull: 0x6e5647, stripe: 0x9c2f2a, anti: 0x3c1410 };

  const length = 85, beam = 13, draft = 4.5, freeboard = 5.0;
  const hs = { length, beam, draft, freeboard, n: 12, chine: 0.7 };
  const stations = hullStations(hs);
  const deckY = freeboard;

  const group = new THREE.Group();
  group.name = 'cargoShip';

  put(group, hullGeometry(stations, { color: hullColorFn(rust) }),
    std(0x8a8078, { rough: 0.9, metal: 0.16, vc: true }), 'hull');
  put(group, deckGeometry(stations, 0.04, 0.05), std(0x5b4a3a, { rough: 0.9, metal: 0.1 }), 'deck');

  const rustMat = std(0x6e5647, { rough: 0.9, metal: 0.16 });
  const steel = std(0x9aa0a6, { rough: 0.45, metal: 0.6 });
  const dark = std(0x1b2733, { rough: 0.3, metal: 0.5 });

  /* 艏楼 */
  box(group, beam * 0.7, 4.0, 8.0, rustMat, 'forecastle', 0, deckY + 2.0, length / 2 - 6);
  /* 艏楼锚链筒小顶 */
  box(group, beam * 0.5, 1.2, 3.0, rustMat, 'forecastleTop', 0, deckY + 4.6, length / 2 - 6);

  /* 艉部上层建筑（桥楼 + 烟囱） */
  const aftZ = -length / 2 + 11;
  box(group, beam * 0.8, 6.0, 12.0, rustMat, 'superstructure', 0, deckY + 3.0, aftZ);
  box(group, beam * 0.7, 4.0, 8.0, rustMat, 'bridge', 0, deckY + 7.5, aftZ + 1);
  box(group, beam * 0.6, 0.8, 7.0, dark, 'bridgeWindows', 0, deckY + 8.6, aftZ + 1.5);
  /* 烟囱 */
  cyl(group, 1.3, 1.7, 3.6, std(0x8c3a2a, { rough: 0.7, metal: 0.2 }), 'funnel', 0, deckY + 11.6, aftZ - 2, 8);
  cyl(group, 1.25, 1.25, 0.4, dark, 'funnelTop', 0, deckY + 13.4, aftZ - 2, 8);
  /* 桅杆 */
  cyl(group, 0.1, 0.16, 6.5, steel, 'mast', 0, deckY + 11.0, aftZ + 3, 6);
  box(group, 2.4, 0.1, 0.1, steel, 'mastYard', 0, deckY + 13.8, aftZ + 3);

  /* 货舱盖（主甲板上的一排低矮舱口围板） */
  for (let i = 0; i < 5; i++) {
    box(group, beam * 0.66, 0.5, 7.0, rustMat, 'hatchCover', 0, deckY + 0.25, -14 + i * 12);
  }

  /* 集装箱堆 */
  const containers = opts.containers ?? 10;
  const contGeo = new THREE.BoxGeometry(2.44, 2.6, 6.1);
  const contMats = [
    std(0x2f7a4f, { rough: 0.7, metal: 0.25, flat: true }),
    std(0xb3422f, { rough: 0.7, metal: 0.25, flat: true }),
    std(0x3a6ea5, { rough: 0.7, metal: 0.25, flat: true }),
    std(0x9a8a4a, { rough: 0.7, metal: 0.25, flat: true }),
  ];
  for (let i = 0; i < containers; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const tier = Math.floor(i / 8);
    const x = (col - 0.5) * 2.9;
    const z = -8 + row * 6.4 - tier * 0.6;
    const y = deckY + 1.4 + tier * 2.7;
    const m = new THREE.Mesh(contGeo, contMats[i % contMats.length]);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    m.name = 'container';
    group.add(m);
  }

  const body = {
    size: new THREE.Vector3(beam / 2, 9.5, length / 2),
    mass: 3.2e6,
    points: buoyPoints({ ...hs, nSide: 5, nKeel: 4, sideFrac: 0.68, sideLift: 0.7, keelFrac: 0.95 }),
    pointRadius: draft * 0.6,
    sailArea: 900,
    sailCenter: new THREE.Vector3(0, 9.0, -10),
    cdWater: 1.2,
    selfDrive: 3.0,
    heading: 0,
    name: 'cargoShip',
  };
  return finalize(group, body, [
    new THREE.Vector3(0, deckY + 13.5, aftZ),
    new THREE.Vector3(0, deckY + 2, length / 2 - 6),
    new THREE.Vector3(0, deckY, length / 2),
    new THREE.Vector3(0, deckY, -length / 2),
    new THREE.Vector3(beam * 0.4, deckY + 2.6, 2),
    new THREE.Vector3(-beam * 0.4, deckY + 2.6, 2),
    new THREE.Vector3(beam * 0.3, deckY, 20),
  ], '小型货轮', 900, scale);
}

/* ============================================================ */
/* 拖船 ~22 m                                                    */
/* ============================================================ */

export function buildTugboat(rng, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;
  const pal = paletteFor(rng, opts);

  const length = 22, beam = 7.0, draft = 2.6, freeboard = 1.8;
  const hs = { length, beam, draft, freeboard, n: 11, chine: 0.62 };
  const stations = hullStations(hs);
  const deckY = freeboard;

  const group = new THREE.Group();
  group.name = 'tugboat';

  put(group, hullGeometry(stations, { color: hullColorFn(pal) }),
    std(0xffffff, { rough: 0.62, metal: 0.1, vc: true }), 'hull');
  put(group, deckGeometry(stations, 0.05), std(0x8a6b47, { rough: 0.88 }), 'deck');

  /* 高驾驶室 */
  const wm = std(0xdfe3e7, { rough: 0.7 });
  const win = std(0x1b2733, { rough: 0.3, metal: 0.5 });
  box(group, beam * 0.56, 3.2, 4.0, wm, 'wheelhouse', 0, deckY + 1.6, 0.5);
  box(group, beam * 0.6, 0.5, 4.2, wm, 'wheelhouseRoof', 0, deckY + 3.45, 0.5);
  box(group, beam * 0.52, 0.9, 0.1, win, 'wheelhouseWindows', 0, deckY + 3.0, 2.45);

  /* 粗烟囱 */
  cyl(group, 0.85, 1.05, 2.6, std(0x8c3a2a, { rough: 0.7, metal: 0.2 }), 'funnel', 0, deckY + 5.0, -0.6, 8);
  cyl(group, 0.85, 0.85, 0.3, std(0x1b2733, { rough: 0.3, metal: 0.5 }), 'funnelTop', 0, deckY + 6.35, -0.6, 8);

  /* 桅杆 + 拖缆柱 */
  const steel = std(0x9aa0a6, { rough: 0.45, metal: 0.6 });
  cyl(group, 0.07, 0.11, 3.6, steel, 'mast', 0, deckY + 6.6, 1.6, 6);
  box(group, 1.4, 0.08, 0.08, steel, 'mastYard', 0, deckY + 8.2, 1.6);
  /* 艉部拖缆架（拱形简化为一横杆） */
  box(group, beam * 0.6, 0.12, 0.12, steel, 'towingArch', 0, deckY + 2.4, -length / 2 + 1.2);

  /* 轮胎护舷（拖船更密集） */
  const tireMat = std(0x16181c, { rough: 0.9 });
  for (const z of [-6, -3, 0, 3, 6]) {
    tire(group, beam / 2 + 0.12, deckY - 0.15, z, tireMat, 'fenderR');
    tire(group, -beam / 2 - 0.12, deckY - 0.15, z, tireMat, 'fenderL');
  }

  const body = {
    size: new THREE.Vector3(beam / 2, 6.0, length / 2),
    mass: 220000,
    points: buoyPoints({ ...hs, nSide: 4, nKeel: 4, sideFrac: 0.72, sideLift: 0.7, keelFrac: 0.95 }),
    pointRadius: draft * 0.6,
    sailArea: 90,
    sailCenter: new THREE.Vector3(0, 5.0, -0.5),
    cdWater: 1.1,
    selfDrive: 2.5,
    heading: 0,
    name: 'tugboat',
  };
  return finalize(group, body, [
    new THREE.Vector3(0, deckY + 8.0, 1.6),
    new THREE.Vector3(0, deckY + 3.2, 0.5),
    new THREE.Vector3(0, deckY, length / 2),
    new THREE.Vector3(0, deckY, -length / 2),
    new THREE.Vector3(beam * 0.4, deckY + 0.5, 2),
  ], '拖船', 450, scale);
}

/* ============================================================ */
/* 游艇 ~16 m                                                    */
/* ============================================================ */

export function buildYacht(rng, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;
  const pal = paletteFor(rng, opts);

  const length = 16, beam = 4.6, draft = 1.3, freeboard = 1.4;
  const hs = { length, beam, draft, freeboard, n: 11, chine: 0.5 };
  const stations = hullStations(hs);
  const deckY = freeboard;

  const group = new THREE.Group();
  group.name = 'yacht';

  put(group, hullGeometry(stations, { color: hullColorFn(pal) }),
    std(0xffffff, { rough: 0.55, metal: 0.12, vc: true }), 'hull');
  put(group, deckGeometry(stations, 0.05), std(0xb99768, { rough: 0.8 }), 'deck');

  /* 流线型上层建筑：主舱 + 前窗斜面 */
  const wm = std(0xf4f6f8, { rough: 0.6 });
  const win = std(0x1b2733, { rough: 0.3, metal: 0.5 });
  box(group, beam * 0.6, 1.6, 5.5, wm, 'cabin', 0, deckY + 0.8, -2.0);
  /* 前窗斜板（旋转的薄盒） */
  const wind = box(group, beam * 0.6, 1.3, 0.1, win, 'windshield', 0, deckY + 1.5, 0.9);
  wind.rotation.x = -0.5;

  /* 遮阳篷（艉部甲板上的弧形顶） */
  const canopy = box(group, beam * 0.7, 0.08, 2.6, std(0xe8e4d8, { rough: 0.9, side: THREE.DoubleSide }), 'canopy', 0, deckY + 1.7, -6.4);
  canopy.rotation.x = 0.06;
  const postMat = std(0xd8dce0, { rough: 0.4, metal: 0.5 });
  cyl(group, 0.03, 0.03, 1.7, postMat, 'canopyPost', beam * 0.3, deckY + 0.85, -6.4, 5);
  cyl(group, 0.03, 0.03, 1.7, postMat, 'canopyPost', -beam * 0.3, deckY + 0.85, -6.4, 5);

  /* 栏杆（舷侧两条 + 立柱） */
  const rail = std(0xd8dce0, { rough: 0.4, metal: 0.6 });
  const railY = deckY + 0.7;
  const posts = [-6.5, -4.5, -2.5, 2.5, 4.5, 6.0];
  for (const z of posts) {
    cyl(group, 0.02, 0.02, 0.7, rail, 'railPost', beam * 0.5, railY - 0.35, z, 5);
    cyl(group, 0.02, 0.02, 0.7, rail, 'railPost', -beam * 0.5, railY - 0.35, z, 5);
  }
  line3d(group, new THREE.Vector3(beam * 0.5, railY, posts[0]), new THREE.Vector3(beam * 0.5, railY, posts[posts.length - 1]), 0.02, rail, 'railR');
  line3d(group, new THREE.Vector3(-beam * 0.5, railY, posts[0]), new THREE.Vector3(-beam * 0.5, railY, posts[posts.length - 1]), 0.02, rail, 'railL');

  /* 雷达桅 */
  const steel = std(0x9aa0a6, { rough: 0.45, metal: 0.6 });
  cyl(group, 0.05, 0.09, 2.2, steel, 'radarMast', 0, deckY + 2.6, -4.0, 6);
  box(group, 0.4, 0.1, 0.16, steel, 'radarDome', 0, deckY + 3.7, -4.0);

  const body = {
    size: new THREE.Vector3(beam / 2, 3.8, length / 2),
    mass: 20000,
    points: buoyPoints({ ...hs, nSide: 4, nKeel: 4, sideFrac: 0.7, sideLift: 0.75, keelFrac: 1.1 }),
    pointRadius: draft * 0.6,
    sailArea: 45,
    sailCenter: new THREE.Vector3(0, 3.2, -2.0),
    cdWater: 1.1,
    selfDrive: 4.0,
    heading: 0,
    name: 'yacht',
  };
  return finalize(group, body, [
    new THREE.Vector3(0, deckY + 3.6, -4.0),
    new THREE.Vector3(0, deckY + 1.6, -2.0),
    new THREE.Vector3(0, deckY, length / 2),
    new THREE.Vector3(0, deckY, -length / 2),
    new THREE.Vector3(beam * 0.4, deckY + 0.5, 1),
  ], '游艇', 400, scale);
}

/* ============================================================ */
/* 小艇 ~4 m（最容易被卷起）                                     */
/* ============================================================ */

export function buildRowboat(rng, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;

  const length = 4, beam = 1.5, draft = 0.35, freeboard = 0.45;
  const hs = { length, beam, draft, freeboard, n: 9, chine: 0.55, open: true };
  const stations = hullStations(hs);

  const group = new THREE.Group();
  group.name = 'rowboat';

  /* 木质敞口艇：整船木色 */
  const wood = std(0x9c7a4a, { rough: 0.85, metal: 0.0 });
  put(group, hullGeometry(stations), wood, 'hull');

  /* 座板（横档） */
  const seat = std(0xb99768, { rough: 0.85 });
  for (const z of [-1.1, 0.0, 1.1]) {
    box(group, beam * 0.86, 0.05, 0.28, seat, 'thwart', 0, freeboard * 0.55, z);
  }

  /* 桨 */
  const oar = std(0xc8a06a, { rough: 0.85 });
  const oarShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), oar);
  oarShaft.rotation.z = Math.PI / 2;
  oarShaft.position.set(beam * 0.75, freeboard * 0.7, 0);
  oarShaft.castShadow = oarShaft.receiveShadow = true;
  oarShaft.name = 'oarR';
  group.add(oarShaft);
  box(group, 0.5, 0.04, 0.12, oar, 'oarBladeR', beam * 1.9, freeboard * 0.7, 0);
  const oarShaft2 = oarShaft.clone();
  oarShaft2.position.x = -beam * 0.75;
  oarShaft2.name = 'oarL';
  group.add(oarShaft2);
  box(group, 0.5, 0.04, 0.12, oar, 'oarBladeL', -beam * 1.9, freeboard * 0.7, 0);

  const body = {
    size: new THREE.Vector3(beam / 2, 0.6, length / 2),
    mass: 120,
    points: buoyPoints({ ...hs, nSide: 3, nKeel: 2, sideFrac: 0.75, sideLift: 0.8, keelFrac: 0.9 }),
    pointRadius: draft * 0.6,
    sailArea: 3,
    sailCenter: new THREE.Vector3(0, 0.6, 0),
    cdWater: 1.3,
    selfDrive: 0,
    heading: 0,
    name: 'rowboat',
  };
  return finalize(group, body, [
    new THREE.Vector3(0, freeboard * 0.6, 0),
    new THREE.Vector3(0, freeboard, length / 2),
    new THREE.Vector3(0, freeboard, -length / 2),
    new THREE.Vector3(beam * 0.4, freeboard * 0.5, 0),
  ], '小艇', 120, scale);
}

/* ============================================================ */
/* 航标浮标                                                      */
/* ============================================================ */

export function buildBuoy(rng, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;
  /* 红/绿两种航标配色 */
  const buoys = [
    { body: 0xc73a2f, band: 0xf4f6f8, anti: 0x3c1410 },
    { body: 0x2e7d46, band: 0xf4f6f8, anti: 0x0f2c16 },
  ];
  const pal = buoys[((opts.palette != null ? opts.palette : rng.int(0, 1)) % 2 + 2) % 2];

  const group = new THREE.Group();
  group.name = 'buoy';

  /* 浮筒主体（Lathe 旋转体） */
  const floatProfile = [
    new THREE.Vector2(0.02, -1.5),
    new THREE.Vector2(0.30, -1.3),
    new THREE.Vector2(0.55, -0.9),
    new THREE.Vector2(0.55, 0.5),
    new THREE.Vector2(0.34, 0.9),
    new THREE.Vector2(0.06, 1.15),
  ];
  put(group, new THREE.LatheGeometry(floatProfile, 12), std(pal.body, { rough: 0.6, metal: 0.1 }), 'floatBody');
  /* 顶部封板 */
  cyl(group, 0.06, 0.34, 0.1, std(pal.body, { rough: 0.6 }), 'floatTop', 0, 1.1, 0, 10);

  /* 反光带 */
  cyl(group, 0.575, 0.575, 0.14, std(pal.band, { rough: 0.4, metal: 0.2 }), 'reflectiveBand', 0, 0.15, 0, 12);

  /* 桅杆 + 灯 */
  const mast = std(0x2a2f36, { rough: 0.5, metal: 0.4 });
  cyl(group, 0.05, 0.07, 1.5, mast, 'mast', 0, 1.95, 0, 6);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffe27a, emissive: 0xff5a30, emissiveIntensity: 1.4, roughness: 0.4,
  });
  box(group, 0.16, 0.22, 0.16, lightMat, 'light', 0, 2.75, 0);
  /* 顶标（两个交叉圆盘，简化为小球） */
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), std(0xc73a2f, { rough: 0.6 }));
  top.position.set(0, 3.0, 0);
  top.castShadow = top.receiveShadow = true;
  top.name = 'topmark';
  group.add(top);

  const body = {
    size: new THREE.Vector3(0.6, 1.6, 0.6),
    mass: 300,
    points: (() => {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.42, -0.75, Math.sin(a) * 0.42));
      }
      pts.push(new THREE.Vector3(0, -1.2, 0));
      return pts;
    })(),
    pointRadius: 0.45,
    sailArea: 2.5,
    sailCenter: new THREE.Vector3(0, 1.9, 0),
    cdWater: 1.3,
    selfDrive: 0,
    heading: 0,
    name: 'buoy',
  };
  return finalize(group, body, [
    new THREE.Vector3(0, 2.75, 0),
    new THREE.Vector3(0, 0.6, 0),
    new THREE.Vector3(0, -0.9, 0),
  ], '航标浮标', 180, scale);
}

/* ============================================================ */
/* 分发器与远景 LOD                                              */
/* ============================================================ */

export const BOAT_KINDS = ['sailboat', 'fishing', 'cargo', 'tug', 'yacht', 'rowboat', 'buoy'];

const BUILDERS = {
  sailboat: buildSailboat,
  fishing: buildFishingBoat,
  cargo: buildCargoShip,
  tug: buildTugboat,
  yacht: buildYacht,
  rowboat: buildRowboat,
  buoy: buildBuoy,
};

/** 分发器：按种类构建完整船只（网格 + 物理配置）。 */
export function buildBoat(rng, kind, opts = {}) {
  const b = BUILDERS[kind];
  if (!b) throw new Error('未知船只种类：' + kind);
  return b(rng, opts);
}

/** 远景 LOD：同一条船的极简剪影（一个低站数船体 + 一个上构盒）。返回 THREE.Group。 */
export function buildBoatLod(rng, kind, opts = {}) {
  rng = rngOf(rng);
  const scale = opts.scale ?? 1;
  const pal = paletteFor(rng, opts);

  /* 各船种的低模尺寸近似值（船长/宽/干舷/吃水）。 */
  const DIM = {
    sailboat: [11, 3.4, 1.1, 1.7],
    fishing: [18, 5.2, 1.6, 2.0],
    cargo: [85, 13, 5.0, 4.5],
    tug: [22, 7.0, 1.8, 2.6],
    yacht: [16, 4.6, 1.4, 1.3],
    rowboat: [4, 1.5, 0.45, 0.35],
    buoy: [1.6, 1.6, 1.2, 1.2],
  };
  const [length, beam, freeboard, draft] = DIM[kind] || DIM.sailboat;

  const group = new THREE.Group();
  group.name = 'boatLod:' + kind;

  const stations = hullStations({ length, beam, draft, freeboard, n: 5, chine: 0.6 });
  put(group, hullGeometry(stations), std(pal.hull, { rough: 0.7 }), 'lodHull');

  if (kind !== 'buoy' && kind !== 'rowboat') {
    /* 上构剪影盒 */
    const supH = kind === 'cargo' ? 9 : kind === 'tug' ? 4 : 2.2;
    const supZ = kind === 'cargo' ? -length / 4 : kind === 'fishing' ? -2.5 : -1.5;
    box(group, beam * 0.6, supH, length * 0.28, std(pal.hull, { rough: 0.7 }),
      'lodSuperstructure', 0, freeboard + supH / 2, supZ);
  } else if (kind === 'buoy') {
    cyl(group, 0.55, 0.55, 2.4, std(pal.hull, { rough: 0.7 }), 'lodFloat', 0, 0, 0, 8);
  }

  if (scale != null && scale !== 1) group.scale.setScalar(scale);
  return group;
}
