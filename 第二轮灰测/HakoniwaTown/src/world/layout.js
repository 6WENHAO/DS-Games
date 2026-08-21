/**
 * 场景布局与地形高度场。
 * 小镇建立在多层"台地"上（港口 1.9 → 下城 3.5 → 中央广场 6.7 → 集市 5.3 →
 * 车站 8.7 → 上城 10.6 → 农场 8.4 → 山肩 13.8 → 山顶 17.2），
 * 河谷把台地切开形成三级跌水，铁路沿海岸与山腰高架爬升。
 * 所有模块都通过 groundHeight()/baseHeight() 取地面高度，保证物件不漂浮。
 */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, noise2, curveFrom, distToPolyline } from '../lib/utils.js';

/* 展台（箱庭底座）尺寸 */
export const SLAB = 44;
export const SLAB_BOTTOM = -15;
export const SEA_LEVEL = 0;
export const SEABED = -3.6;

/** 台地：x,z 中心；hw,hd 半宽半深；r 圆角；h 台面高度；f 过渡带（越小越陡） */
export const TERRACES = [
  { name: 'island', x: 0, z: 1, hw: 30, hd: 29, r: 12, h: 1.15, f: 6.5 },
  { name: 'quay', x: 1, z: 22.5, hw: 13, hd: 6, r: 1.8, h: 1.95, f: 1.15 },
  { name: 'lowtown', x: -1, z: 12.5, hw: 16, hd: 7, r: 3.0, h: 3.5, f: 2.0 },
  { name: 'fair', x: 19, z: 19, hw: 9.5, hd: 8, r: 2.4, h: 2.7, f: 1.8 },
  { name: 'rampE', x: 20, z: 12, hw: 3.0, hd: 4.2, r: 1.4, h: 4.1, f: 1.8 },
  { name: 'plaza', x: -2, z: 0.5, hw: 15, hd: 9.5, r: 3.0, h: 6.7, f: 2.3 },
  { name: 'market', x: 17, z: 2, hw: 7, hd: 7, r: 2.6, h: 5.3, f: 1.9 },
  { name: 'station', x: 24.5, z: 6.5, hw: 5.6, hd: 8, r: 1.8, h: 8.7, f: 1.4 },
  { name: 'rampC', x: -15.6, z: 7.6, hw: 2.8, hd: 3.6, r: 1.3, h: 5.2, f: 1.6 },
  { name: 'uptown', x: -7, z: -15.4, hw: 14, hd: 9, r: 3.2, h: 10.6, f: 2.3 },
  { name: 'farm', x: 16, z: -15, hw: 10, hd: 8, r: 3.2, h: 8.4, f: 2.5 },
  { name: 'shoulder', x: -19, z: -21, hw: 8, hd: 7, r: 3.4, h: 13.8, f: 3.0 },
  { name: 'hilltop', x: -21, z: -23, hw: 5, hd: 4.5, r: 2.4, h: 17.2, f: 2.0 },
  { name: 'ridge', x: 1, z: -27, hw: 17, hd: 6, r: 4.2, h: 13.0, f: 3.2 },
  { name: 'cape', x: -27, z: 22, hw: 3.4, hd: 3.4, r: 2.2, h: 5.4, f: 2.4 },
];

/** 下挖区域（港池、河口、水潭） */
export const BASINS = [
  { name: 'harbor', x: 1, z: 32, hw: 13, hd: 7, r: 4, h: -1.9, f: 4 },
  { name: 'rivermouth', x: -13.5, z: 30, hw: 4, hd: 4, r: 3, h: -1.0, f: 3 },
  { name: 'millpond', x: -10.4, z: 15.0, hw: 3.2, hd: 3.2, r: 2.6, h: 1.85, f: 1.8 },
];

/** 河道中心线（XZ）：山肩泉眼 → 三级跌水 → 磨坊潭 → 河口 */
export const RIVER_PTS = [
  [-17.6, -20.6], [-16.4, -17.0], [-15.8, -15.0], [-15.2, -12.0], [-14.4, -9.0],
  [-13.9, -6.4], [-13.4, -3.0], [-12.6, 1.0], [-12.2, 5.0], [-11.6, 9.0],
  [-10.9, 12.0], [-10.4, 15.2], [-10.2, 19.0], [-10.9, 23.0], [-12.0, 27.0],
  [-13.6, 31.0], [-14.6, 34.5],
];
const RIVER_W = 2.4;
const RIVER_INFL = RIVER_W * 1.45;
const RIVER_DEPTH = 1.45;

function sdRoundRect(px, pz, t) {
  const qx = Math.abs(px - t.x) - (t.hw - t.r);
  const qz = Math.abs(pz - t.z) - (t.hd - t.r);
  const ax = Math.max(qx, 0), az = Math.max(qz, 0);
  return Math.min(Math.max(qx, qz), 0) + Math.hypot(ax, az) - t.r;
}

/** 未被河谷切开的"路基"高度：道路、桥面、车辆、建筑基面使用 */
export function baseHeight(x, z) {
  let h = SEABED;
  let flat = 0;
  // 山顶圆锥（先叠，后面的台地可在其上压出平台）
  const dh = Math.hypot(x + 21.5, z + 23.5);
  if (dh < 8) {
    const peak = 17.0 - dh * 0.55;
    h = lerp(h, Math.max(h, peak), smoothstep((8 - dh) / 5));
  }
  for (let i = 0; i < TERRACES.length; i++) {
    const t = TERRACES[i];
    const d = sdRoundRect(x, z, t);
    if (d > t.f) continue;
    const m = smoothstep(-d / t.f);
    if (m <= 0) continue;
    h = lerp(h, Math.max(h, t.h), m);
    flat = Math.max(flat, m);
  }
  for (let i = 0; i < BASINS.length; i++) {
    const b = BASINS[i];
    const d = sdRoundRect(x, z, b);
    if (d > b.f) continue;
    const m = smoothstep(-d / b.f);
    if (m <= 0) continue;
    h = lerp(h, Math.min(h, b.h), m);
  }
  return { h, flat };
}

/** 地面高度（含河谷切削与自然起伏） */
export function groundHeight(x, z) {
  const b = baseHeight(x, z);
  let h = b.h;
  const amp = 0.08 + 0.5 * (1 - b.flat);
  h += noise2(x * 0.55, z * 0.55) * amp;
  const r = distToPolyline(x, z, RIVER_PTS);
  if (r.dist < RIVER_INFL) {
    const k = clamp(1 - r.dist / RIVER_INFL);
    const prof = Math.sin(k * Math.PI * 0.5);
    h -= RIVER_DEPTH * prof * prof * 1.15;
  }
  return h;
}

export function riverDist(x, z) { return distToPolyline(x, z, RIVER_PTS); }

/** 坡度（0 平地 → 1 陡崖） */
export function slopeAt(x, z, e = 0.7) {
  const h = groundHeight(x, z);
  const dx = groundHeight(x + e, z) - h;
  const dz = groundHeight(x, z + e) - h;
  return Math.min(1, Math.hypot(dx, dz) / e);
}

export const isWater = (x, z) => groundHeight(x, z) < 0.02;

/* ------------------------------------------------------- 路网 */
/** 主环路：港口promenade → 游乐场 → 集市巷 → 中央广场 → 运河石桥 → 西坡 → 下城 */
export const ROAD_PTS = [
  [-14.0, 20.2], [-11.0, 22.8], [-4.0, 24.6], [5.0, 25.0], [13.0, 23.0],
  [16.5, 20.0], [18.0, 14.5], [18.8, 9.2], [16.6, 4.6], [12.4, 3.6],
  [4.0, 5.4], [-4.0, 5.6], [-9.6, 5.2], [-12.3, 5.0], [-15.9, 5.8],
  [-16.3, 9.0], [-15.5, 14.0],
];
export const ROAD_WIDTH = 3.5;

export function makeRoadCurve() {
  const pts = ROAD_PTS.map(([x, z]) => new THREE.Vector3(x, baseHeight(x, z).h, z));
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35);
}

/** 桥（跨越河谷，朝向与道路一致） */
export const BRIDGES = [
  { x: -12.3, z: 5.0, ry: -0.1, len: 7.6, w: 4.6, kind: 'stone' },
  { x: -11.0, z: 22.8, ry: -0.4, len: 7.0, w: 4.2, kind: 'wood' },
];

/** 铁路环线：沿海岸与山腰高架爬升，北侧穿岩隧道，南侧跨海长桥 */
export const RAIL_PTS = [
  [29.2, 12.5, 8.9], [29.4, 3.0, 9.4], [28.2, -7.0, 10.2], [22.6, -17.0, 11.0],
  [13.0, -24.0, 12.4], [2.0, -27.6, 13.9], [-9.0, -26.0, 14.8], [-15.6, -21.8, 16.0],
  [-24.2, -12.0, 15.0], [-27.4, 0.0, 11.0], [-25.6, 12.0, 8.0], [-20.0, 22.0, 5.6],
  [-11.0, 31.0, 4.6], [2.0, 35.6, 4.2], [17.0, 34.6, 4.6], [27.6, 27.0, 6.4],
];
export function makeRailCurve() {
  return new THREE.CatmullRomCurve3(RAIL_PTS.map(([x, z, y]) => new THREE.Vector3(x, y, z)), true, 'catmullrom', 0.4);
}
export const TUNNEL = { x: 2.0, z: -27.6, y: 13.9, ry: -1.66 };
/** 步行小径 */
export const WALK_PATHS = [
  { name: 'plaza', pts: [[-9, 2.0], [-3, 2.4], [3, 2.0], [8.5, 1.2], [12.5, 0.4]] },
  { name: 'promenade', pts: [[-8.5, 26.8], [-2, 27.2], [5, 27.4], [11.5, 26.4]] },
  { name: 'mainstreet', pts: [[-5.0, 15.9], [0.0, 15.8], [5.0, 15.8], [10.0, 15.8], [13.6, 15.6]] },
  { name: 'hillstair', pts: [[-2.5, -4.0], [-2.5, -8.0], [-6.0, -10.0], [-10.5, -12.0], [-12.5, -15.5], [-14.5, -19.0]] },
  { name: 'market', pts: [[15.1, 2.4], [15.2, -1.2], [15.5, -4.8]] },
  { name: 'uptown', pts: [[-10.5, -12.0], [-6.0, -11.5], [-1.0, -11.0], [3.0, -10.0]] },
  { name: 'farmlane', pts: [[8.6, -11.0], [13.0, -12.6], [17.6, -13.4], [21.0, -16.5]] },
];

/** 海上航线（帆船，走在铁路长桥之外） */
export const SEA_ROUTE = [
  [-34, 30], [-26, 38], [-8, 41], [10, 40], [24, 38], [33, 26], [37, 6],
  [34, -14], [24, -28], [8, -36], [-10, -36], [-26, -30], [-36, -14], [-38, 6], [-36, 20],
];
export function makeSeaRoute() {
  return curveFrom(SEA_ROUTE.map(([x, z]) => [x, 0.12, z]), true, 0.5);
}

export const onGround = (x, z, extra = 0) => groundHeight(x, z) + extra;
export const onBase = (x, z, extra = 0) => baseHeight(x, z).h + extra;
