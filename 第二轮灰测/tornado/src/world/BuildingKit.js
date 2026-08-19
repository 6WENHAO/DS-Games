/**
 * BuildingKit.js — 可破坏建筑的零件库（纯数据，无网格）。
 *
 * 建筑 = 一维数组 parts，每个 part 是 box / cyl / wedge 三种单元原语的实例，
 * 引擎对每种 (shape, mat) 建一个 InstancedMesh 批量渲染；当龙卷风风压超过
 * part.strength 时该 part 脱落并转为刚体。因此这里只产出"零件清单"，不建 mesh。
 *
 * ── WEDGE 约定 ─────────────────────────────────────────────────────────
 * 单元 wedge 是一个"顶面沿 +X 塌陷"的盒子：在 XY 平面上的截面为直角三角形，
 * 直角顶点在 (-0.5,-0.5)，三顶点为 (-0.5,-0.5) / (+0.5,-0.5) / (-0.5,+0.5)，
 * 沿 Z 方向挤出。即：x=-0.5 处是一条竖直棱（直角边），y=-0.5 处是水平底，
 * 斜面从 (+0.5,-0.5) 斜升至 (-0.5,+0.5)。本文件用它做山墙端三角 / 单坡端三角。
 * 双坡屋顶本体改用"两片绕 X 轴旋转的薄盒子"，视觉更好且便于逐片剥落。
 *
 * 坐标系：建筑本地空间，Y 向上，y=0 为地面，水平方向大致以原点为中心。
 * size 一律为"全长/全高/全宽"（非半长）。rot 为 XYZ 欧拉角（弧度）。
 */

import * as THREE from 'three';
import { Rng } from '../core/Random.js';

/**
 * @typedef {object} Part
 * @property {'box'|'cyl'|'wedge'} shape   box: 原点居中的单位立方体（size = 全长）
 *                                        cyl: 单位圆柱，半径 0.5，高 1，轴 +Y
 *                                        wedge: 单位直角三角形棱柱，见文件头注释
 * @property {[number,number,number]} pos  BUILDING-LOCAL 空间中心，Y 向上，y=0 地面
 * @property {[number,number,number]} rot  XYZ 欧拉旋转（弧度）
 * @property {[number,number,number]} size 旋转前沿本地 x,y,z 的全长（非半长）
 * @property {string} mat                  下列 MAT 的 key
 * @property {number} strength             能承受的风压 (Pa)：~600=轻碎屑，1500=屋面板，
 *                                         4000=墙体，12000=混凝土地基
 * @property {boolean} [anchor]            true = 永不脱落（地基、地面板）
 * @property {number} [detail]             LOD：0=始终绘制，1=>~450m 隐藏，2=>~180m 隐藏
 */

/** 材质表：引擎会为每个 key 建一个 InstancedMesh。数值直接喂 MeshStandardMaterial。 */
export const MAT = {
  wood:     { color: 0x8a6a45, roughness: 0.85, metalness: 0.0 },
  woodPale: { color: 0xb9a887, roughness: 0.82, metalness: 0.0 },
  paint:    { color: 0xd8d3c6, roughness: 0.72, metalness: 0.0 },
  paintRed: { color: 0x8e3b2c, roughness: 0.74, metalness: 0.0 },
  plaster:  { color: 0xc9b090, roughness: 0.88, metalness: 0.0 },
  adobe:    { color: 0xb08159, roughness: 0.94, metalness: 0.0 },
  brick:    { color: 0x8d5a45, roughness: 0.9,  metalness: 0.0 },
  concrete: { color: 0x9a9a95, roughness: 0.87, metalness: 0.0 },
  roofShin: { color: 0x4a4a4e, roughness: 0.78, metalness: 0.02 },
  roofTile: { color: 0x8b4a35, roughness: 0.8,  metalness: 0.0 },
  metal:    { color: 0x9fa5aa, roughness: 0.42, metalness: 0.85 },
  metalRust:{ color: 0x7a5a48, roughness: 0.7,  metalness: 0.55 },
  glass:    { color: 0x6f8f9a, roughness: 0.18, metalness: 0.1, opacity: 0.55, transparent: true },
  dark:     { color: 0x3a3632, roughness: 0.9,  metalness: 0.0 },
};

/**
 * @typedef {object} Building
 * @property {string} kind
 * @property {string} label            中文名，用于破坏提示
 * @property {Part[]} parts
 * @property {[number,number]} footprint  近似占地 [x, z]（米），用于摆放时避免重叠
 * @property {number} height
 */

/* ───────────────────────── 基础零件构造 ───────────────────────── */

const box = (pos, size, mat, strength, extra = {}) =>
  ({ shape: 'box', pos, size, rot: [0, 0, 0], mat, strength, ...extra });

const cyl = (pos, r, h, mat, strength, extra = {}) =>
  ({ shape: 'cyl', pos, size: [r * 2, h, r * 2], rot: [0, 0, 0], mat, strength, ...extra });

const wedge = (pos, size, mat, strength, extra = {}) =>
  ({ shape: 'wedge', pos, size, rot: [0, 0, 0], mat, strength, ...extra });

/** 若调用方未传 rng，则使用确定性默认种子（避免重复 new）。 */
const _rng = (rng) => rng || new Rng(1337);

/* ───────────────────────── 通用构件 ───────────────────────── */

/**
 * 带门窗洞口的墙：把一面墙沿 X 切成若干列，再在每列内按 Y 挖去开口区间。
 * z 为墙中心深度，t 为墙厚（沿 Z）。openings: [{x0,x1,y0,y1}]（与墙同坐标）。
 * 返回若干 box 零件（实心墙体）。
 */
export function wallWithOpenings(x0, x1, y0, y1, z, t, openings, mat, strength, extra = {}) {
  const parts = [];
  const xs = [x0, x1];
  for (const o of openings) { xs.push(o.x0, o.x1); }
  xs.sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    if (b - a < 0.02) continue;
    const cx = (a + b) / 2;
    const colOps = openings
      .filter((o) => cx > o.x0 - 1e-6 && cx < o.x1 + 1e-6)
      .sort((p, q) => p.y0 - q.y0);
    let y = y0;
    for (const o of colOps) {
      if (o.y0 - y > 0.02) pushBox(a, b, y, o.y0);
      y = Math.max(y, o.y1);
    }
    if (y1 - y > 0.02) pushBox(a, b, y, y1);
  }
  function pushBox(xa, xb, ya, yb) {
    if (xb - xa < 0.02 || yb - ya < 0.02) return;
    parts.push(box([(xa + xb) / 2, (ya + yb) / 2, z], [xb - xa, yb - ya, t], mat, strength, extra));
  }
  return parts;
}

/**
 * 双坡屋顶：ridge 沿 X、跨度沿 Z。cy 为墙顶高度（屋檐下沿）。
 * 每侧坡面拆成 rows 排（自屋脊向屋檐的瓦片行），两片山墙端各用两块 wedge。
 * rise 为屋脊相对墙顶的抬升。返回屋顶零件数组。
 */
export function gableRoof(cx, cy, cz, L, S, rise, mat, strength, opts = {}) {
  const ov = opts.overhang ?? 0.4;
  const t = opts.thickness ?? 0.12;
  const rows = opts.rows ?? 4;
  const theta = Math.atan2(rise, S / 2);
  const rafter = Math.hypot(S / 2, rise);
  const slopedLen = rafter + ov;
  const stripW = slopedLen / rows;
  const parts = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < rows; i++) {
      const d = (i + 0.5) * stripW;               // 自屋脊向下的坡面距离
      const y = cy + rise - d * Math.sin(theta);
      const z = cz + side * d * Math.cos(theta);
      parts.push(box(
        [cx, y, z],
        [L + 2 * ov, t, stripW],
        mat, strength,
        { rot: [side * theta, 0, 0] },
      ));
    }
  }
  if (opts.gable !== false) {
    parts.push(...gableEnd(cx - L / 2, cy, cz, S, rise, t, mat, strength, opts.gableExtra));
    parts.push(...gableEnd(cx + L / 2, cy, cz, S, rise, t, mat, strength, opts.gableExtra));
  }
  return parts;
}

/** 山墙端三角（一块端面 = 两块 wedge，见文件头 WEDGE 约定）。cx 为端面 X 位置。 */
export function gableEnd(cx, cy, cz, S, rise, t, mat, strength, extra = {}) {
  const half = S / 2;
  const R = Math.PI / 2;
  return [
    wedge([cx, cy + rise / 2, half / 2], [half, rise, t], mat, strength, { rot: [0, -R, 0], ...extra }),
    wedge([cx, cy + rise / 2, -half / 2], [half, rise, t], mat, strength, { rot: [0, R, 0], ...extra }),
  ];
}

/**
 * 单坡屋顶：dir=1 时高墙在 z=-S/2、低墙在 z=+S/2；dir=-1 时相反。
 * Hh=高墙顶，Hl=低墙顶。两端三角各用一块 wedge（高侧为竖直棱，正好是直角三角形）。
 */
export function shedRoof(cx, cz, L, S, Hh, Hl, mat, strength, opts = {}) {
  const dir = opts.dir ?? 1;
  const ov = opts.overhang ?? 0.3;
  const t = opts.thickness ?? 0.1;
  const rows = opts.rows ?? 3;
  const rise = Hh - Hl;
  const theta = Math.atan2(rise, S);
  const slopedLen = Math.hypot(S, rise) + ov;
  const stripW = slopedLen / rows;
  const parts = [];
  for (let i = 0; i < rows; i++) {
    const d = (i + 0.5) * stripW;
    const y = Hh - d * Math.sin(theta);
    const z = cz + dir * (-S / 2 + d * Math.cos(theta));
    parts.push(box([cx, y, z], [L + 2 * ov, t, stripW], mat, strength, { rot: [dir * theta, 0, 0] }));
  }
  const endRot = dir === 1 ? -Math.PI / 2 : Math.PI / 2;
  const end = (x) => wedge([x, (Hh + Hl) / 2, cz], [S, rise, t], mat, strength, { rot: [0, endRot, 0] });
  parts.push(end(cx - L / 2), end(cx + L / 2));
  return parts;
}

/**
 * 平屋顶：主面板拆两块 + 四周女儿墙。cy = 屋顶表面（=墙顶）高度。
 */
export function flatRoof(cx, cy, cz, L, S, mat, strength, opts = {}) {
  const t = opts.thickness ?? 0.18;
  const ov = opts.overhang ?? 0.2;
  const ph = opts.parapetH ?? 0.5;
  const pt = opts.parapetT ?? 0.15;
  const parts = [];
  parts.push(box([cx - L / 4, cy - t / 2, cz], [L / 2, t, S + 2 * ov], mat, strength));
  parts.push(box([cx + L / 4, cy - t / 2, cz], [L / 2, t, S + 2 * ov], mat, strength));
  if (opts.parapet !== false) {
    parts.push(box([cx, cy + ph / 2, cz - S / 2], [L + 2 * ov, ph, pt], mat, strength, { detail: 1 }));
    parts.push(box([cx, cy + ph / 2, cz + S / 2], [L + 2 * ov, ph, pt], mat, strength, { detail: 1 }));
    parts.push(box([cx - L / 2, cy + ph / 2, cz], [pt, ph, S], mat, strength, { detail: 1 }));
    parts.push(box([cx + L / 2, cy + ph / 2, cz], [pt, ph, S], mat, strength, { detail: 1 }));
  }
  return parts;
}

/** 窗户：玻璃 + 上/下框。cx,cy,cz 为窗中心，w,h 为洞尺寸，t 为所在墙厚。 */
export function window(cx, cy, cz, w, h, t, opts = {}) {
  const parts = [];
  parts.push(box([cx, cy, cz], [w, h, 0.02], 'glass', opts.glassStr ?? 800, { detail: 2 }));
  parts.push(box([cx, cy + h / 2 - 0.05, cz], [w + 0.1, 0.1, t + 0.02], opts.trimMat ?? 'paint', 900, { detail: 1 }));
  parts.push(box([cx, cy - h / 2 + 0.05, cz], [w + 0.1, 0.1, t + 0.02], opts.trimMat ?? 'paint', 900, { detail: 1 }));
  return parts;
}

/** 门：门扇 + 两侧门框。cy = 门中心高。 */
export function door(cx, cy, cz, w, h, t, opts = {}) {
  const parts = [];
  parts.push(box([cx, cy, cz], [w, h, 0.04], opts.mat ?? 'wood', opts.str ?? 1200, { detail: 1 }));
  parts.push(box([cx - w / 2 - 0.04, cy, cz], [0.08, h, t + 0.02], opts.trim ?? 'paint', 1000, { detail: 1 }));
  parts.push(box([cx + w / 2 + 0.04, cy, cz], [0.08, h, t + 0.02], opts.trim ?? 'paint', 1000, { detail: 1 }));
  return parts;
}

/** 台阶：自 cz 向前 (向 +Z) 逐级铺 n 级。 */
export function steps(cx, cz, w, n, mat, strength, opts = {}) {
  const parts = [];
  const riseH = opts.riseH ?? 0.18;
  const tread = opts.tread ?? 0.3;
  for (let i = 0; i < n; i++) {
    parts.push(box(
      [cx, riseH * (i + 1) - riseH / 2, cz + tread * (i + 0.5)],
      [w, riseH, tread],
      mat, strength,
    ));
  }
  return parts;
}

/** 竖直爬梯：两条侧轨 + 若干横档，中心在 (x,z)，自 y0 到 y1。 */
export function ladder(x, z, y0, y1, mat, strength, opts = {}) {
  const parts = [];
  const w = opts.width ?? 0.45;
  const n = opts.rungs ?? Math.max(2, Math.floor((y1 - y0) / 0.5));
  const rail = opts.railSize ?? 0.05;
  parts.push(box([x - w / 2, (y0 + y1) / 2, z], [rail, y1 - y0, rail], mat, strength, { detail: 1 }));
  parts.push(box([x + w / 2, (y0 + y1) / 2, z], [rail, y1 - y0, rail], mat, strength, { detail: 1 }));
  for (let i = 0; i <= n; i++) {
    const y = y0 + (y1 - y0) * (i / n);
    parts.push(box([x, y, z], [w, rail, rail], mat, strength, { detail: 2 }));
  }
  return parts;
}

/** 用递减半径的短圆柱近似圆锥（引擎无 cone 原语）。y 为底，向 +Y 收窄。 */
export function coneStack(x, y, z, rBase, rTop, h, n, mat, strength, extra = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    const r1 = rBase + (rTop - rBase) * a;
    const r2 = rBase + (rTop - rBase) * b;
    parts.push(cyl([x, y + h * (a + b) / 2, z], (r1 + r2) / 2, h / n, mat, strength, extra));
  }
  return parts;
}

/** 用递减尺寸的方盒近似方锥（教堂尖塔用）。 */
export function steppedPyramid(x, y, z, base, top, h, n, mat, strength, extra = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n;
    const s1 = base + (top - base) * a;
    const s2 = base + (top - base) * b;
    const s = (s1 + s2) / 2;
    parts.push(box([x, y + h * (a + b) / 2, z], [s, h / n, s], mat, strength, extra));
  }
  return parts;
}

/** 水平细杆：连接 XZ 平面上两点，截面 w×h，长度沿 local Z。 */
export function barXZ(x1, z1, x2, z2, y, w, h, mat, strength, extra = {}) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);   // 使 local Z 对齐连接方向
  return box([(x1 + x2) / 2, y, (z1 + z2) / 2], [w, h, len], mat, strength, { rot: [0, ang, 0], ...extra });
}

/** 任意方向细杆：长度沿 local +Y 对齐方向 (dx,dy,dz)，截面 w×w。 */
export function barY(x, y, z, dx, dy, dz, w, mat, strength, extra = {}) {
  const len = Math.hypot(dx, dy, dz);
  const horiz = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.atan2(horiz, dy);
  return box([x, y, z], [w, len, w], mat, strength, { rot: [pitch, yaw, 0], ...extra });
}

/* ───────────────────────── 收尾：缩放 / 残破态 ───────────────────────── */

/** 应用 scale（整体缩放 pos/size/footprint/height），并可选打上"已残破"标记。 */
function finish(kind, label, parts, footprint, height, rng, opts = {}) {
  const s = opts.scale ?? 1;
  if (s !== 1) {
    for (const p of parts) {
      p.pos = [p.pos[0] * s, p.pos[1] * s, p.pos[2] * s];
      p.size = [p.size[0] * s, p.size[1] * s, p.size[2] * s];
    }
    footprint = [footprint[0] * s, footprint[1] * s];
    height *= s;
  }
  let building = { kind, label, parts, footprint, height };
  if (opts.broken) building = applyBroken(building, rng);
  return building;
}

/** 残破态：随机移除屋顶/轻质件，并给部分墙体/轻质件加随机倾斜。 */
function applyBroken(building, rng) {
  const parts = building.parts;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.anchor) continue;
    const drop = p.strength <= 1800 ? 0.4 : p.strength <= 4000 ? 0.16 : p.strength <= 7000 ? 0.07 : 0.0;
    if (drop > 0 && rng.bool(drop)) parts.splice(i, 1);
  }
  for (const p of parts) {
    if (p.anchor) continue;
    if (p.strength <= 4000 && rng.bool(0.25)) {
      p.rot = [
        p.rot[0] + rng.gauss() * 0.18,
        p.rot[1] + rng.gauss() * 0.18,
        p.rot[2] + rng.gauss() * 0.18,
      ];
    }
  }
  return building;
}

/* ───────────────────────── 农舍 farmhouse ───────────────────────── */

export function buildFarmhouse(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const wallMat = ['wood', 'woodPale', 'paint', 'plaster'][pal];
  const roofMat = ['roofTile', 'roofShin', 'dark', 'roofTile'][pal];
  const trimMat = ['paint', 'paint', 'woodPale', 'wood'][pal];

  const L = 11, S = 9;              // 墙体外尺寸（X 长 × Z 宽）
  const t = 0.25;                   // 木墙厚
  const wTop = 5.6;                 // 两层墙顶
  const rise = 2.0;                 // 屋脊抬升
  const backZ = -(S / 2 + 1.1);     // 后墙 -5.6
  const frontZ = S / 2 - 1.1;       // 前墙 +3.4（为前廊留出 +Z 空间）
  const parts = [];

  /* 地基：混凝土板，永不脱落 */
  parts.push(box([0, 0.1, (frontZ + backZ) / 2], [L + 0.3, 0.2, S + 2.3], 'concrete', 12000, { anchor: true }));

  /* 墙体（挖出门窗洞口） */
  const winW = 1.2, winH = 1.4;
  const winL = 2.4;                  // 门窗距中轴
  const openings = {
    front: [
      { x0: -0.5, x1: 0.5, y0: 0, y1: 2.1 },                       // 门
      { x0: -winL - winW / 2, x1: -winL + winW / 2, y0: 1.1, y1: 2.5 },
      { x0: winL - winW / 2, x1: winL + winW / 2, y0: 1.1, y1: 2.5 },
      { x0: -winL - winW / 2, x1: -winL + winW / 2, y0: 3.7, y1: 5.1 },
      { x0: winL - winW / 2, x1: winL + winW / 2, y0: 3.7, y1: 5.1 },
    ],
    back: [
      { x0: -0.5, x1: 0.5, y0: 0, y1: 2.1 },
      { x0: -winL - winW / 2, x1: -winL + winW / 2, y0: 1.1, y1: 2.5 },
      { x0: winL - winW / 2, x1: winL + winW / 2, y0: 1.1, y1: 2.5 },
    ],
  };
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, frontZ, t, openings.front, wallMat, 3500));
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, backZ, t, openings.back, wallMat, 3500));
  /* 侧墙（山墙端）：各挖一扇下层窗 */
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, -L / 2, t,
    [{ x0: -0.6, x1: 0.6, y0: 1.2, y1: 2.6 }], wallMat, 3500));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, L / 2, t,
    [{ x0: -0.6, x1: 0.6, y0: 1.2, y1: 2.6 }], wallMat, 3500));

  /* 窗（玻璃 + 框） */
  for (const [wx, wz, wy] of [
    [-winL, frontZ, 1.8], [winL, frontZ, 1.8],
    [-winL, frontZ, 4.4], [winL, frontZ, 4.4],
    [-winL, backZ, 1.8], [winL, backZ, 1.8],
    [-L / 2, 0, 1.9], [L / 2, 0, 1.9],
  ]) parts.push(...window(wx, wy, wz, winW, winH, t, { trimMat }));

  /* 门 */
  parts.push(...door(0, 1.05, frontZ, 1.0, 2.1, t, { mat: 'wood', trim: trimMat }));
  parts.push(...door(0, 1.05, backZ, 1.0, 2.1, t, { mat: 'wood', trim: trimMat }));
  parts.push(...steps(0, frontZ, 1.2, 2, 'wood', 2500));

  /* 屋顶（双坡，8 片瓦 + 4 块山墙三角） */
  parts.push(...gableRoof(0, wTop, 0, L, S, rise, roofMat, 1500, { rows: 4, thickness: 0.12 }));

  /* 前廊：地板 + 立柱 + 平顶 + 栏杆 */
  const porchZ0 = frontZ, porchD = 2.0, porchW = 7.6;
  parts.push(box([-porchW / 3, 0.18, porchZ0 + porchD / 2], [porchW / 3, 0.1, porchD], 'wood', 1200));
  parts.push(box([0, 0.18, porchZ0 + porchD / 2], [porchW / 3, 0.1, porchD], 'wood', 1200));
  parts.push(box([porchW / 3, 0.18, porchZ0 + porchD / 2], [porchW / 3, 0.1, porchD], 'wood', 1200));
  const porchRoofY = 2.9;
  for (const px of [-porchW / 2 + 0.2, porchW / 2 - 0.2]) {
    parts.push(box([px, 1.5, porchZ0 + 0.2], [0.16, 3.0, 0.16], 'wood', 900, { detail: 1 }));
    parts.push(box([px, 1.5, porchZ0 + porchD - 0.2], [0.16, 3.0, 0.16], 'wood', 900, { detail: 1 }));
  }
  parts.push(box([-porchW / 4, porchRoofY, porchZ0 + porchD / 2], [porchW / 2, 0.1, porchD + 0.4], roofMat, 1000));
  parts.push(box([porchW / 4, porchRoofY, porchZ0 + porchD / 2], [porchW / 2, 0.1, porchD + 0.4], roofMat, 1000));
  parts.push(box([0, 0.85, porchZ0 + porchD - 0.05], [porchW, 0.08, 0.08], 'wood', 700, { detail: 1 }));

  /* 烟囱：砖砌，三段 */
  for (let i = 0; i < 3; i++) {
    parts.push(box([3.2, 0.5 + i * 2.7, -1.2], [0.9, 2.7, 0.9], 'brick', 6000));
  }
  parts.push(box([3.2, 8.2, -1.2], [1.0, 0.3, 1.0], 'brick', 6000, { detail: 1 }));

  return finish('farmhouse', '农舍', parts, [L, S + 2.3], 8.4, rng, opts);
}

/* ───────────────────────── 谷仓 barn ───────────────────────── */

export function buildBarn(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const bodyMat = pal === 0 ? 'paintRed' : pal === 1 ? 'brick' : 'paintRed';
  const roofMat = pal === 2 ? 'roofShin' : 'roofTile';

  const L = 20, S = 14;             // 长 × 宽
  const t = 0.28;
  const wTop = 6.0;
  const rise = 5.0;                 // 高陡坡 → 总高约 11m
  const parts = [];

  /* 素土地基（低矮混凝土板） */
  parts.push(box([0, 0.08, 0], [L + 0.4, 0.16, S + 0.4], 'concrete', 12000, { anchor: true }));

  /* 四面木板墙（红漆），前墙开大门，山墙端开阁楼门 + 侧窗 */
  const bigDoor = { x0: -2.0, x1: 2.0, y0: 0, y1: 4.0 };
  const win = (x) => ({ x0: x - 0.7, x1: x + 0.7, y0: 1.6, y1: 2.9 });
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, S / 2, t,
    [bigDoor, win(-7), win(7)], bodyMat, 3200));
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, -S / 2, t,
    [win(-7), win(7)], bodyMat, 3200));
  const loft = { x0: -1.5, x1: 1.5, y0: 4.2, y1: 7.2 };
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, -L / 2, t, [loft], bodyMat, 3200));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, L / 2, t, [loft], bodyMat, 3200));

  /* 大门（双扇推拉门）+ 阁楼门 */
  parts.push(...door(0, 2.0, S / 2, 4.0, 4.0, t, { mat: 'wood', trim: 'paint' }));
  parts.push(...door(0, 5.7, -L / 2, 3.0, 3.0, t, { mat: 'wood', trim: 'paint' }));
  /* 侧窗 */
  for (const wx of [-7, 7]) {
    parts.push(...window(wx, 2.25, S / 2, 1.4, 1.3, t, { trimMat: 'paint' }));
    parts.push(...window(wx, 2.25, -S / 2, 1.4, 1.3, t, { trimMat: 'paint' }));
  }

  /* 屋顶（12 片瓦 + 4 山墙三角） */
  parts.push(...gableRoof(0, wTop, 0, L, S, rise, roofMat, 1500, { rows: 6, thickness: 0.14 }));

  /* 白色角柱 / 山墙饰条 */
  for (const x of [-L / 2, L / 2]) for (const z of [-S / 2, S / 2]) {
    parts.push(box([x, wTop / 2, z], [0.3, wTop, 0.3], 'paint', 900, { detail: 1 }));
  }
  parts.push(box([-L / 2, wTop + rise / 2, 0], [0.1, rise, S], 'paint', 800, { detail: 1 }));
  parts.push(box([L / 2, wTop + rise / 2, 0], [0.1, rise, S], 'paint', 800, { detail: 1 }));

  /* 侧棚（单坡，靠 -Z 侧） */
  const leanL = 10, leanD = 4, leanHh = 4.2, leanHl = 2.8;
  parts.push(box([L / 4, 0.05, -S / 2 - leanD / 2], [leanL, 0.1, leanD], 'concrete', 12000, { anchor: true }));
  parts.push(...shedRoof(L / 4, -S / 2 - leanD / 2, leanL, leanD, leanHh, leanHl, 'metal', 1100, { rows: 2, dir: -1 }));
  for (const px of [L / 4 - leanL / 2 + 0.2, L / 4 + leanL / 2 - 0.2]) {
    parts.push(box([px, leanHl / 2, -S / 2 - leanD + 0.2], [0.14, leanHl, 0.14], 'wood', 900, { detail: 1 }));
  }

  return finish('barn', '谷仓', parts, [L + leanD, S], wTop + rise, rng, opts);
}

/* ───────────────────────── 谷仓筒 silo ───────────────────────── */

export function buildSilo(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const bodyMat = pal === 1 ? 'metalRust' : 'metal';
  const r = 3.0, H = 16.0;
  const parts = [];

  /* 地基 */
  parts.push(box([0, 0.15, 0], [r * 2 + 0.6, 0.3, r * 2 + 0.6], 'concrete', 12000, { anchor: true }));

  /* 筒身：6 段叠加，逐段剥落 */
  const seg = H / 6;
  for (let i = 0; i < 6; i++) {
    parts.push(cyl([0, 0.3 + seg * (i + 0.5), 0], r, seg, bodyMat, 4200));
  }

  /* 圆锥顶：4 级递减圆柱近似 */
  parts.push(...coneStack(0, H + 0.3, 0, r, 0.4, 2.2, 4, bodyMat, 1600));
  parts.push(cyl([0, H + 2.55, 0], 0.18, 0.4, 'metal', 700, { detail: 1 }));

  /* 环箍（2 道，每道 4 段贴片，detail 2） */
  for (const hy of [6, 12]) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      parts.push(box(
        [Math.cos(a) * (r + 0.06), hy, Math.sin(a) * (r + 0.06)],
        [1.4, 0.14, 0.06],
        'metal', 4000, { detail: 2, rot: [0, Math.PI / 2 - a, 0] },
      ));
    }
  }

  /* 侧梯 */
  parts.push(...ladder(r + 0.3, 0, 0.6, H - 0.5, 'metal', 1500, { rungs: 10 }));

  return finish('silo', '谷仓筒', parts, [r * 2 + 1, r * 2 + 1], H + 2.8, rng, opts);
}

/* ───────────────────────── 水塔 waterTower ───────────────────────── */

export function buildWaterTower(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const tankMat = pal === 2 ? 'metalRust' : 'metal';
  const parts = [];

  const legR = 2.2;                 // 支腿分布半径
  const legTop = 12.6;              // 支腿顶（水箱底）
  const tankR = 2.4, tankH = 3.2, tankC = legTop + tankH / 2;

  /* 四条支腿（各两段）+ 基础垫 */
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * legR, z = Math.sin(a) * legR;
    parts.push(box([x, 0.15, z], [0.5, 0.3, 0.5], 'concrete', 12000, { anchor: true }));
    parts.push(box([x, legTop / 4, z], [0.16, legTop / 2, 0.16], 'metal', 5000));
    parts.push(box([x, legTop * 3 / 4, z], [0.16, legTop / 2, 0.16], 'metal', 5000));
  }

  /* 交叉拉杆（中间一层 X 形 + 顶部水平圈梁） */
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const c1 = [Math.cos(a) * legR, Math.sin(a) * legR];
    const c2 = [Math.cos(a + Math.PI / 2) * legR, Math.sin(a + Math.PI / 2) * legR];
    parts.push(barXZ(c1[0], c1[1], c2[0], c2[1], legTop / 2, 0.1, 0.1, 'metal', 1200, { detail: 1 }));
  }
  parts.push(box([0, legTop, 0], [legR * 2 + 0.3, 0.18, legR * 2 + 0.3], 'metal', 2500, { detail: 1 }));

  /* 水箱（两段圆柱）+ 锥顶 + 锥底 */
  parts.push(cyl([0, tankC, 0], tankR, tankH, tankMat, 4200));
  parts.push(...coneStack(0, legTop + tankH, 0, tankR, 0.5, 1.6, 3, tankMat, 1600));
  parts.push(...coneStack(0, legTop - 1.4, 0, tankR, 0.6, 1.4, 2, tankMat, 2600));

  /* 走道护栏（四片，detail 2）+ 爬梯 */
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    parts.push(box(
      [Math.cos(a) * (tankR + 0.5), legTop + tankH * 0.4, Math.sin(a) * (tankR + 0.5)],
      [1.4, 0.9, 0.04], 'metal', 700, { rot: [0, Math.PI / 2 - a, 0], detail: 2 },
    ));
  }
  parts.push(...ladder(legR + 0.4, 0, 0.6, legTop, 'metal', 1500, { rungs: 12 }));

  return finish('waterTower', '水塔', parts, [legR * 2 + 2, legR * 2 + 2], legTop + tankH + 1.8, rng, opts);
}

/* ───────────────────────── 风车 windmill ───────────────────────── */

export function buildWindmill(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const towerMat = pal === 2 ? 'metalRust' : 'metal';
  const parts = [];

  const baseW = 2.6, topW = 0.9, H = 14.0;
  /* 桁架塔：四根斜腿（分两段）+ 水平横撑 */
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const xb = Math.cos(a) * (baseW / 2), zb = Math.sin(a) * (baseW / 2);
    const xt = Math.cos(a) * (topW / 2), zt = Math.sin(a) * (topW / 2);
    for (let s = 0; s < 2; s++) {
      const t0 = s / 2, t1 = (s + 1) / 2;
      const x0 = xb + (xt - xb) * t0, z0 = zb + (zt - zb) * t0;
      const x1 = xb + (xt - xb) * t1, z1 = zb + (zt - zb) * t1;
      parts.push(barY((x0 + x1) / 2, H * (t0 + t1) / 2, (z0 + z1) / 2,
        x1 - x0, H * (t1 - t0), z1 - z0, 0.14, towerMat, 4000, { detail: 1 }));
    }
    parts.push(box([xb, 0.12, zb], [0.4, 0.24, 0.4], 'concrete', 12000, { anchor: true }));
  }
  for (let lvl = 1; lvl <= 3; lvl++) {
    const y = H * lvl / 4;
    const w = baseW + (topW - baseW) * (lvl / 4);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const c1 = [Math.cos(a) * w / 2, Math.sin(a) * w / 2];
      const c2 = [Math.cos(a + Math.PI / 2) * w / 2, Math.sin(a + Math.PI / 2) * w / 2];
      parts.push(barXZ(c1[0], c1[1], c2[0], c2[1], y, 0.08, 0.08, towerMat, 1200, { detail: 1 }));
    }
  }

  /* 塔顶平台 + 机头 */
  parts.push(box([0, H + 0.2, 0], [1.2, 0.4, 1.2], towerMat, 4000));
  parts.push(box([0.4, H + 0.7, 0], [0.7, 0.7, 0.7], 'dark', 3000, { detail: 1 }));

  /* 风轮：轮毂 + 叶片（detail 2，轻质易吹走） */
  const hubZ = 0.2;
  parts.push(box([0.5, H + 0.7, hubZ], [0.25, 0.25, 0.25], 'dark', 1200, { detail: 1 }));
  const nBlade = 12, bladeLen = 3.0;
  for (let i = 0; i < nBlade; i++) {
    const a = (i / nBlade) * Math.PI * 2;
    parts.push(box(
      [0.5 + Math.cos(a) * bladeLen / 2, H + 0.7 + Math.sin(a) * bladeLen / 2, hubZ],
      [bladeLen, 0.5, 0.05],
      towerMat, 900, { rot: [0, 0, a], detail: 2 },
    ));
  }

  /* 尾舵：尾梁 + 尾翼 */
  parts.push(box([-1.8, H + 0.7, 0], [2.4, 0.12, 0.12], towerMat, 1200, { detail: 1 }));
  parts.push(box([-3.1, H + 0.7, 0.05], [0.8, 1.4, 0.05], towerMat, 900, { rot: [0, 0, 0.3], detail: 2 }));

  return finish('windmill', '风车', parts, [6.6, 6.6], H + 2.0, rng, opts);
}

/* ───────────────────────── 土坯房 adobeHouse ───────────────────────── */

export function buildAdobeHouse(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const wallMat = pal === 3 ? 'plaster' : 'adobe';
  const parts = [];

  const L = 9, S = 8, t = 0.4, wTop = 3.0;
  const frontZ = S / 2, backZ = -S / 2;

  /* 厚墙（土坯，强度高） */
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, frontZ, t, [
    { x0: -0.55, x1: 0.55, y0: 0, y1: 2.1 },
    { x0: -3.2, x1: -2.0, y0: 1.3, y1: 2.5 },
    { x0: 2.0, x1: 3.2, y0: 1.3, y1: 2.5 },
  ], wallMat, 7000));
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, backZ, t, [
    { x0: -1.2, x1: -0.2, y0: 1.4, y1: 2.6 },
    { x0: 0.2, x1: 1.2, y0: 1.4, y1: 2.6 },
  ], wallMat, 7000));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, -L / 2, t, [
    { x0: -0.6, x1: 0.6, y0: 1.4, y1: 2.6 },
  ], wallMat, 7000));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, L / 2, t, [], wallMat, 7000));

  /* 门窗 */
  parts.push(...door(0, 1.05, frontZ, 1.1, 2.1, t, { mat: 'wood', trim: 'wood' }));
  for (const [wx, wz] of [[-2.6, frontZ], [2.6, frontZ], [-0.7, backZ], [0.7, backZ], [-L / 2, 0]]) {
    parts.push(...window(wx, 1.9, wz, 1.2, 1.2, t, { trimMat: 'wood' }));
  }

  /* 平屋顶 + 女儿墙 */
  parts.push(...flatRoof(0, wTop, 0, L, S, 'adobe', 5500));

  /* 木梁 (vigas)：沿前墙顶部外露的圆木 */
  for (let i = 0; i < 5; i++) {
    parts.push(cyl([-3.2 + i * 1.6, wTop + 0.05, frontZ + 0.35], 0.09, 0.8, 'wood', 1500, { rot: [Math.PI / 2, 0, 0], detail: 1 }));
  }

  /* 外楼梯（沿一侧上到屋顶） */
  parts.push(...steps(L / 2 - 1.2, -S / 2 + 0.4, 1.0, 5, 'adobe', 5000, { riseH: 0.5, tread: 0.6 }));

  /* 院墙（矮土坯墙，L 形） */
  parts.push(box([-L / 2 - 1.5, 0.55, frontZ - 1.0], [0.3, 1.1, 4.0], wallMat, 5000));
  parts.push(box([-L / 2 - 1.5, 0.55, backZ + 1.0], [3.4, 1.1, 0.3], wallMat, 5000));

  return finish('adobeHouse', '土坯房', parts, [L + 3, S], wTop + 0.5, rng, opts);
}

/* ───────────────────────── 沙漠店铺 desertStore ───────────────────────── */

export function buildDesertStore(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const wallMat = ['plaster', 'adobe', 'paint', 'plaster'][pal];
  const awningMat = pal === 1 ? 'paint' : 'paintRed';
  const parts = [];

  const L = 6, S = 10, t = 0.3, wTop = 3.6;
  const frontZ = S / 2, backZ = -S / 2;

  /* 主体墙 */
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, frontZ, t, [
    { x0: -0.6, x1: 0.6, y0: 0, y1: 2.2 },
    { x0: -2.4, x1: -1.2, y0: 1.0, y1: 2.6 },
    { x0: 1.2, x1: 2.4, y0: 1.0, y1: 2.6 },
  ], wallMat, 4000));
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, backZ, t, [
    { x0: -0.5, x1: 0.5, y0: 1.2, y1: 2.4 },
  ], wallMat, 4000));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, -L / 2, t, [], wallMat, 4000));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, L / 2, t, [], wallMat, 4000));

  /* 假门面 (false front)：正立面加高 + 顶部横饰 */
  parts.push(box([0, wTop + 1.5, frontZ], [L + 0.4, 3.0, t], wallMat, 3500));
  parts.push(box([0, wTop + 3.05, frontZ], [L + 0.6, 0.25, t + 0.1], 'paint', 900, { detail: 1 }));

  /* 门廊立柱 + 雨棚 */
  const porchD = 2.4, porchY = 2.9;
  for (const px of [-L / 2 + 0.3, L / 2 - 0.3]) {
    parts.push(box([px, 1.5, frontZ + porchD - 0.2], [0.18, 3.0, 0.18], 'wood', 900, { detail: 1 }));
  }
  parts.push(box([0, porchY, frontZ + porchD / 2], [L + 0.8, 0.1, porchD], awningMat, 1100, { rot: [-0.12, 0, 0] }));
  parts.push(box([0, porchY + 0.15, frontZ + porchD / 2], [L + 0.8, 0.12, 0.2], awningMat, 800, { detail: 1 }));
  parts.push(box([0, 0.05, frontZ + porchD / 2], [L + 0.8, 0.1, porchD], 'wood', 1200, { detail: 1 }));

  /* 招牌 */
  parts.push(box([0, wTop + 1.5, frontZ + t / 2 + 0.03], [L - 1.6, 1.1, 0.06], 'dark', 700, { detail: 1 }));

  /* 门窗 */
  parts.push(...door(0, 1.1, frontZ, 1.2, 2.2, t, { mat: 'wood', trim: 'wood' }));
  for (const wx of [-1.8, 1.8]) parts.push(...window(wx, 1.8, frontZ, 1.2, 1.6, t, { trimMat: 'wood' }));
  parts.push(...window(0, 1.8, backZ, 1.0, 1.2, t, { trimMat: 'wood' }));

  /* 平屋顶 */
  parts.push(...flatRoof(0, wTop, 0, L, S, 'adobe', 4500, { parapet: false }));

  return finish('desertStore', '沙漠店铺', parts, [L + 1.6, S + porchD], wTop + 3.2, rng, opts);
}

/* ───────────────────────── 教堂 church ───────────────────────── */

export function buildChurch(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const wallMat = 'paint';
  const roofMat = pal === 2 ? 'roofTile' : 'roofShin';
  const parts = [];

  const L = 12, S = 7, t = 0.3, wTop = 5.0, rise = 3.0;
  const frontZ = S / 2, backZ = -S / 2;

  /* 主厅墙（白），正面开大门，侧面三对拱窗 */
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, frontZ, t, [
    { x0: -0.9, x1: 0.9, y0: 0, y1: 3.0 },
  ], wallMat, 3800));
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, wTop, backZ, t, [
    { x0: -0.6, x1: 0.6, y0: 1.6, y1: 3.4 },
  ], wallMat, 3800));
  const sideOpen = [
    { x0: -3.0, x1: -1.9, y0: 1.5, y1: 3.3 },
    { x0: -0.55, x1: 0.55, y0: 1.5, y1: 3.3 },
    { x0: 1.9, x1: 3.0, y0: 1.5, y1: 3.3 },
  ];
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, -L / 2, t, sideOpen, wallMat, 3800));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, wTop, L / 2, t, sideOpen, wallMat, 3800));

  /* 尖塔：塔身 + 四坡尖顶 + 十字架（左前角） */
  const towerX = -L / 2 - 0.3, towerZ = frontZ + 0.6, towerH = 8.0;
  parts.push(box([towerX, towerH / 2, towerZ], [2.6, towerH, 2.6], wallMat, 5000));
  parts.push(box([towerX, towerH + 1.5, towerZ], [2.8, 0.4, 2.8], wallMat, 2000, { detail: 1 }));
  parts.push(...steppedPyramid(towerX, towerH + 1.7, towerZ, 2.6, 0.2, 3.5, 5, roofMat, 1800));
  parts.push(box([towerX, towerH + 5.4, towerZ], [0.1, 1.4, 0.1], 'dark', 700, { detail: 2 }));
  parts.push(box([towerX, towerH + 6.0, towerZ], [0.8, 0.1, 0.1], 'dark', 700, { detail: 2 }));

  /* 屋顶（双坡） */
  parts.push(...gableRoof(0, wTop, 0, L, S, rise, roofMat, 1500, { rows: 5, thickness: 0.14 }));

  /* 门窗 */
  parts.push(...door(0, 1.5, frontZ, 1.8, 3.0, t, { mat: 'wood', trim: 'paint' }));
  parts.push(...steps(0, frontZ, 2.2, 3, 'concrete', 5000));
  parts.push(...window(0, 2.5, backZ, 1.2, 1.8, t, { trimMat: 'paint', glassStr: 700 }));
  for (const wz of [-2.45, 0, 2.45]) {
    parts.push(...window(-L / 2, 2.4, wz, 1.1, 1.8, t, { trimMat: 'paint', glassStr: 700 }));
    parts.push(...window(L / 2, 2.4, wz, 1.1, 1.8, t, { trimMat: 'paint', glassStr: 700 }));
  }

  return finish('church', '教堂', parts, [L + 5, S], towerH + 6.0, rng, opts);
}

/* ───────────────────────── 加油站 gasStation ───────────────────────── */

export function buildGasStation(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const canopyMat = pal === 0 ? 'paintRed' : pal === 1 ? 'metal' : 'paint';
  const parts = [];

  const storeL = 6, storeS = 8, storeH = 3.2, storeX = 0, storeZ = -3.0;
  const canopyL = 10, canopyS = 6, canopyY = 4.5, canopyZ = 4.0;

  /* 便利店 */
  const t = 0.25;
  parts.push(box([storeX, 0.1, storeZ], [storeL + 0.3, 0.2, storeS + 0.3], 'concrete', 12000, { anchor: true }));
  parts.push(...wallWithOpenings(-storeL / 2, storeL / 2, 0, storeH, storeZ + storeS / 2, t, [
    { x0: -0.6, x1: 0.6, y0: 0, y1: 2.2 },
    { x0: -2.2, x1: -1.0, y0: 1.0, y1: 2.4 },
    { x0: 1.0, x1: 2.2, y0: 1.0, y1: 2.4 },
  ], 'paint', 3500));
  parts.push(...wallWithOpenings(-storeL / 2, storeL / 2, 0, storeH, storeZ - storeS / 2, t, [], 'paint', 3500));
  parts.push(...wallWithOpenings(storeZ - storeS / 2, storeZ + storeS / 2, 0, storeH, storeX - storeL / 2, t, [], 'paint', 3500));
  parts.push(...wallWithOpenings(storeZ - storeS / 2, storeZ + storeS / 2, 0, storeH, storeX + storeL / 2, t, [], 'paint', 3500));
  parts.push(...flatRoof(storeX, storeH, storeZ, storeL, storeS, 'concrete', 5500));
  parts.push(...door(0, 1.1, storeZ + storeS / 2, 1.2, 2.2, t, { mat: 'glass', str: 800 }));
  for (const wx of [-1.6, 1.6]) parts.push(...window(wx, 1.7, storeZ + storeS / 2, 1.2, 1.4, t, { trimMat: 'paint' }));
  parts.push(box([0, storeH + 0.3, storeZ + storeS / 2 + 0.05], [storeL, 0.7, 0.06], 'paint', 700, { detail: 1 }));

  /* 雨棚：顶板 + 檐口 + 立柱（两侧各一根） */
  for (const px of [-canopyL / 2 + 0.5, canopyL / 2 - 0.5]) {
    parts.push(box([px, 0.12, canopyZ], [0.7, 0.24, 0.7], 'concrete', 12000, { anchor: true }));
    parts.push(box([px, canopyY / 2, canopyZ], [0.22, canopyY, 0.22], 'metal', 2500));
  }
  parts.push(box([0, canopyY + 0.15, canopyZ], [canopyL + 0.6, 0.3, canopyS + 0.6], canopyMat, 1800));
  parts.push(box([0, canopyY + 0.05, canopyZ - canopyS / 2 - 0.2], [canopyL + 0.6, 0.25, 0.1], canopyMat, 800, { detail: 1 }));
  parts.push(box([0, canopyY - 0.05, canopyZ + canopyS / 2 + 0.05], [canopyL + 0.6, 0.4, 0.1], 'paint', 800, { detail: 1 }));

  /* 油泵（3 台） */
  for (let i = 0; i < 3; i++) {
    const px = -3 + i * 3;
    parts.push(box([px, 0.75, canopyZ], [0.7, 1.5, 0.5], 'metal', 900));
    parts.push(box([px, 1.7, canopyZ], [0.5, 0.35, 0.3], 'dark', 700, { detail: 1 }));
  }

  return finish('gasStation', '加油站', parts, [canopyL + 1, canopyS + storeS + 4], canopyY + 0.6, rng, opts);
}

/* ───────────────────────── 工具棚 shed ───────────────────────── */

export function buildShed(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const wallMat = ['wood', 'woodPale', 'paint', 'metal'][pal];
  const roofMat = pal === 3 ? 'metal' : 'roofShin';
  const parts = [];

  const L = 4.0, S = 3.0;
  const Hh = 2.8, Hl = 2.2;         // 单坡：高墙 2.8 → 低墙 2.2
  const t = 0.12;

  /* 四面薄墙（最脆弱） */
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, Hh, -S / 2, t, [], wallMat, 2200));
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, Hl, S / 2, t, [
    { x0: -0.5, x1: 0.5, y0: 0, y1: 1.9 },
  ], wallMat, 2200));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, Hh, -L / 2, t, [], wallMat, 2200));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0, Hl, L / 2, t, [], wallMat, 2200));

  /* 门 + 屋顶 */
  parts.push(...door(0, 0.95, S / 2, 1.0, 1.9, t, { mat: 'wood', str: 900 }));
  parts.push(...shedRoof(0, 0, L, S, Hh, Hl, roofMat, 1000, { rows: 2 }));

  return finish('shed', '工具棚', parts, [L, S], Hh, rng, opts);
}

/* ───────────────────────── 拖车房 trailer ───────────────────────── */

export function buildTrailer(rng, opts = {}) {
  rng = _rng(rng);
  const pal = opts.palette ?? rng.int(0, 3);
  const bodyMat = pal === 0 ? 'metal' : pal === 1 ? 'paint' : 'metal';
  const parts = [];

  const L = 10, S = 3.0, H = 2.6, t = 0.08;

  /* 底部裙板 + 两端封头 */
  parts.push(box([0, 0.4, 0], [L, 0.8, S], 'dark', 2500));
  /* 铁皮箱体：四壁（薄、极轻） */
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, H, S / 2, t, [
    { x0: -0.6, x1: 0.6, y0: 0.5, y1: 2.0 },
    { x0: -3.4, x1: -2.2, y0: 1.0, y1: 2.0 },
    { x0: 2.2, x1: 3.4, y0: 1.0, y1: 2.0 },
  ], bodyMat, 1600));
  parts.push(...wallWithOpenings(-L / 2, L / 2, 0, H, -S / 2, t, [
    { x0: -3.0, x1: -1.8, y0: 1.0, y1: 2.0 },
  ], bodyMat, 1600));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0.5, H, -L / 2, t, [], bodyMat, 1600));
  parts.push(...wallWithOpenings(-S / 2, S / 2, 0.5, H, L / 2, t, [], bodyMat, 1600));

  /* 平顶（两块薄板） */
  parts.push(box([-L / 4, H, 0], [L / 2, 0.08, S + 0.2], bodyMat, 900));
  parts.push(box([L / 4, H, 0], [L / 2, 0.08, S + 0.2], bodyMat, 900));

  /* 门 + 台阶 */
  parts.push(...door(0, 1.25, S / 2, 1.2, 1.5, t, { mat: 'metal', str: 800 }));
  parts.push(...steps(0, S / 2 + 0.3, 1.0, 2, 'metal', 700, { riseH: 0.25, tread: 0.3 }));

  /* 窗 */
  for (const wx of [-2.8, 2.8]) parts.push(...window(wx, 1.5, S / 2, 1.2, 1.0, t, { trimMat: 'metal' }));

  /* 空调外机（极易被吹走） */
  parts.push(box([-L / 2 + 0.7, 1.2, -S / 2 - 0.4], [0.7, 0.7, 0.6], 'metal', 500, { detail: 1 }));

  return finish('trailer', '拖车房', parts, [L, S + 1.2], H, rng, opts);
}

/* ───────────────────────── 栅栏 fenceRun ───────────────────────── */

export function buildFenceRun(rng, opts = {}) {
  rng = _rng(rng);
  const length = opts.length ?? 10;
  const pal = opts.palette ?? rng.int(0, 3);
  const mat = pal === 3 ? 'metal' : 'wood';
  const parts = [];

  const postGap = 2.5;
  const nPosts = Math.max(2, Math.round(length / postGap) + 1);
  const span = length / (nPosts - 1);
  const railH = [0.6, 1.1];

  for (let i = 0; i < nPosts; i++) {
    const x = -length / 2 + i * span;
    parts.push(box([x, 0.55, 0], [0.12, 1.1, 0.12], mat, 2500));
    if (i < nPosts - 1) {
      for (const hy of railH) {
        parts.push(box([x + span / 2, hy, 0], [span, 0.1, 0.06], mat, 900, { detail: 1 }));
      }
    }
  }

  return finish('fenceRun', '栅栏', parts, [length, 0.3], 1.1, rng, opts);
}

/* ───────────────────────── 电线杆 powerPole ───────────────────────── */

export function buildPowerPole(rng, opts = {}) {
  rng = _rng(rng);
  const parts = [];
  const H = 9.0;

  /* 底座锚固 + 杆身（两段）+ 横担 + 绝缘子 */
  parts.push(cyl([0, 0.3, 0], 0.22, 0.6, 'wood', 12000, { anchor: true }));
  parts.push(cyl([0, 3.0, 0], 0.2, 4.8, 'wood', 8000));
  parts.push(cyl([0, 6.6, 0], 0.16, 2.4, 'wood', 8000));
  parts.push(box([0, H - 0.3, 0], [2.6, 0.14, 0.14], 'wood', 4000, { detail: 1 }));
  for (const ix of [-1.1, 0, 1.1]) {
    parts.push(cyl([ix, H - 0.42, 0], 0.06, 0.22, 'dark', 700, { detail: 2 }));
  }

  return finish('powerPole', '电线杆', parts, [0.4, 0.4], H, rng, opts);
}

/* ───────────────────────── 谷物提升塔 grainElevator ───────────────────────── */

export function buildGrainElevator(rng, opts = {}) {
  rng = _rng(rng);
  const parts = [];

  const bins = 4, binR = 2.4, H = 28.0, gap = 0.3;
  const totalW = bins * binR * 2 + (bins - 1) * gap;

  /* 地基地板 */
  parts.push(box([0, 0.2, 0], [totalW + 2, 0.4, binR * 2 + 2], 'concrete', 12000, { anchor: true }));

  /* 混凝土筒群：每筒 4 段（地标级强度） */
  for (let b = 0; b < bins; b++) {
    const x = -totalW / 2 + binR + b * (binR * 2 + gap);
    for (let i = 0; i < 4; i++) {
      parts.push(cyl([x, 0.4 + (H / 4) * (i + 0.5), 0], binR, H / 4, 'concrete', 12000));
    }
    /* 顶部檐口 */
    parts.push(cyl([x, H + 0.2, 0], binR + 0.15, 0.4, 'concrete', 12000, { detail: 1 }));
  }

  /* 顶部机房 (headhouse) */
  const hhL = totalW, hhS = 5, hhH = 3.4, hhY = H + 2.0;
  parts.push(box([0, hhY, 0], [hhL, hhH, hhS], 'metal', 5000));
  parts.push(...shedRoof(0, 0, hhL, hhS, hhY + hhH, hhY + hhH - 1.2, 'metalRust', 1800, { rows: 2 }));
  parts.push(box([0, hhY + hhH / 2, hhS / 2 + 0.05], [hhL - 1, 0.8, 0.06], 'paint', 800, { detail: 1 }));

  /* 提升管道（斜管 + 落料口） */
  parts.push(box([-totalW / 2 - 0.5, H * 0.6, binR + 0.3], [0.5, H * 0.7, 0.5], 'metal', 3000, { rot: [0, 0, 0.35] }));
  parts.push(box([0, 1.5, binR + 0.6], [totalW, 0.5, 0.5], 'metal', 3000, { detail: 1 }));

  return finish('grainElevator', '谷物提升塔', parts, [totalW + 2, binR * 2 + 3], hhY + hhH + 1.4, rng, opts);
}

/* ───────────────────────── 随机挑选 ───────────────────────── */

/** 随机挑一个适合该场景的建筑（biome: 'plain' | 'desert'）。 */
export function randomBuilding(rng, biome, opts = {}) {
  rng = _rng(rng);
  const plain = [
    ['farmhouse', buildFarmhouse, 1.0],
    ['barn', buildBarn, 0.9],
    ['silo', buildSilo, 0.6],
    ['waterTower', buildWaterTower, 0.25],
    ['windmill', buildWindmill, 0.25],
    ['shed', buildShed, 0.5],
    ['trailer', buildTrailer, 0.4],
    ['grainElevator', buildGrainElevator, 0.2],
    ['powerPole', buildPowerPole, 0.5],
    ['fenceRun', buildFenceRun, 0.4],
  ];
  const desert = [
    ['adobeHouse', buildAdobeHouse, 1.0],
    ['desertStore', buildDesertStore, 0.8],
    ['church', buildChurch, 0.35],
    ['gasStation', buildGasStation, 0.5],
    ['shed', buildShed, 0.5],
    ['trailer', buildTrailer, 0.4],
    ['windmill', buildWindmill, 0.25],
    ['powerPole', buildPowerPole, 0.5],
    ['fenceRun', buildFenceRun, 0.4],
  ];
  const list = biome === 'desert' ? desert : plain;
  const total = list.reduce((s, e) => s + e[2], 0);
  let r = rng.next() * total;
  for (const [name, fn, w] of list) {
    r -= w;
    if (r <= 0) return fn(rng, { ...opts, length: opts.length ?? rng.int(6, 18) });
  }
  return buildFarmhouse(rng, opts);
}
