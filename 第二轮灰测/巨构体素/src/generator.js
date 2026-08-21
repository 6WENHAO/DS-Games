/**
 * 巨构生成器 —— MEGASTRUCTURE GENERATOR
 *
 * “巨构”的核心思想被拆成七个可被看见的命题，逐一在体素里落实：
 *   1. 单一巨物：巨核 + 巨柱塔 + 巨跨 + 环梁 构成一个连续的、不可分割的构筑物
 *   2. 结构即城市：巨型骨架本身承担居住，插件舱以模块无限重复挂在框架上
 *   3. 尺度暴力：1180 体素高的巨核压在 40 体素高的日常街区之上，人只有 3 体素
 *   4. 人造天空：天盖把天空替换成建筑，只留下有节奏的光缝
 *   5. 层化社会：地面 / +46 / +92 / 天盖 / 巨跨，垂直分层
 *   6. 穿透：巨构的柱子直接穿过日常城市，日常城市只能让位
 *   7. 无限：顶端消失在云与雾里，底端消失在深渊里
 */

import { M } from './palette.js';
import { Brush } from './brush.js';
import { VoxelWorld } from './world.js';

export const CFG = {
  HALF: 248,          // 街区半径（切比雪夫）
  SLAB_TOP: -1,       // 地面最后一层实体
  SLAB_BOT: -26,
  PLINTH_BOT: -190,   // 沙盘基座底
  CORE_HW: 48,        // 巨核半宽
  CORE_TOP: 1180,
  CROWN_TOP: 1276,
  MAST_TOP: 1436,
  PLAZA_R: 88,        // 巨核广场（切比雪夫半径）
  RING_R0: 96,        // 环形大道
  RING_R1: 120,
  AVENUE_HW: 14,      // 十字大道半宽
  OFFSET_AVE: 62,     // 偏轴大道中心距
  CANOPY_Y: 132,      // 天盖底面
  CANOPY_T: 20,
  CANOPY_R: 216,
  DECK2: 46,
  DECK3: 92,
  TOWER_R: 176,       // 巨柱塔中心距
  TOWER_HW: 40,
  MAST_R: 176,        // 角部塔架
  SPAN_Y: [196, 404, 620, 848],
  RINGBEAM_Y: [196, 620],
  PLATFORM_Y: [168, 344, 520, 696, 872, 1048],
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));

export function createGenerator(seed = 861204) {
  const world = new VoxelWorld();
  const B = new Brush(world);
  const rnd = mulberry32(seed);
  const data = {
    annotations: [], elevators: [], droneLanes: [], pedPaths: [], carPaths: [],
    blinkers: [], billboards: [], searchlights: [], lightShafts: [], viewpoints: [],
    spawn: { pos: [-238, 3, 0], yaw: -Math.PI / 2 },
    stats: {},
  };

  const C = CFG;
  const H = C.HALF;
  const SZ = H * 2 + 1;
  const streetMask = new Uint8Array(SZ * SZ);      // 1=街道 2=广场 3=人行道 4=占用
  const mi = (x, z) => (x + H) + (z + H) * SZ;

  // ————————————————————————————————————————————————————————————
  // 街道 / 场地规划
  // ————————————————————————————————————————————————————————————
  function isAvenue(x, z) {
    if (Math.abs(x) <= C.AVENUE_HW || Math.abs(z) <= C.AVENUE_HW) return true;
    // 偏轴主街：巨柱塔正好压在中轴上，所以另开四条偏 62 体素的大道，
    // 让人可以斜看巨核 —— 这是全场最好的“进城”视角。
    if (Math.abs(Math.abs(z) - C.OFFSET_AVE) <= 11) return true;
    if (Math.abs(Math.abs(x) - C.OFFSET_AVE) <= 11) return true;
    return false;
  }
  function isRing(x, z) {
    const c = cheb(x, z);
    return c >= C.RING_R0 && c <= C.RING_R1;
  }
  // 支路栅格必须与 buildDistrict 的 40 单元栅格对齐（248 mod 40 === 8）
  const mod40 = (v) => ((v % 40) + 40) % 40;
  function isGridStreet(x, z) {
    return mod40(x + 8) < 8 || mod40(z + 8) < 8;
  }
  function classify(x, z) {
    const c = cheb(x, z);
    if (c <= C.PLAZA_R) return 2;                 // 广场
    if (isRing(x, z) || isAvenue(x, z)) return 1; // 主干道
    if (c > H - 10) return 1;                     // 外环路
    if (isGridStreet(x, z)) return 1;             // 支路
    return 0;                                     // 街区
  }

  function planStreets() {
    for (let z = -H; z <= H; z++) {
      for (let x = -H; x <= H; x++) streetMask[mi(x, z)] = classify(x, z);
    }
  }

  // ————————————————————————————————————————————————————————————
  // 1. 大地 / 基座 / 深渊之下的岩层
  // ————————————————————————————————————————————————————————————
  function buildDatum() {
    B.fill(-H, C.SLAB_BOT, -H, H, C.SLAB_TOP, H, M.CONC_4);
    B.fill(-H, C.SLAB_TOP - 3, -H, H, C.SLAB_TOP, H, M.CONC_3);
    // 基座斜面（沙盘的“模型底座”）
    for (let i = 0; i < 3; i++) {
      const inset = 6 + i * 10;
      const y1 = C.SLAB_BOT - 1 - i * 14;
      B.fill(-H + inset, y1 - 13, -H + inset, H - inset, y1, H - inset, i === 0 ? M.CONC_5 : M.VOID_ROCK);
    }
    B.fill(-H + 26, C.PLINTH_BOT, -H + 26, H - 26, C.SLAB_BOT - 44, H - 26, M.VOID_ROCK);
    // 基座竖向凹槽（模型底座的肌理）
    for (let t = -H + 26; t <= H - 26; t += 7) {
      B.fill(t, C.PLINTH_BOT + 4, -H + 25, t + 1, C.SLAB_BOT - 48, -H + 25, M.IRON_BLACK);
      B.fill(t, C.PLINTH_BOT + 4, H - 25, t + 1, C.SLAB_BOT - 48, H - 25, M.IRON_BLACK);
      B.fill(-H + 25, C.PLINTH_BOT + 4, t, -H + 25, C.SLAB_BOT - 48, t + 1, M.IRON_BLACK);
      B.fill(H - 25, C.PLINTH_BOT + 4, t, H - 25, C.SLAB_BOT - 48, t + 1, M.IRON_BLACK);
    }
    // 底座发光边线：强化“沙盘”的物性
    B.fill(-H + 26, C.PLINTH_BOT, -H + 26, H - 26, C.PLINTH_BOT + 1, H - 26, M.STRIP_COOL);
  }

  // ————————————————————————————————————————————————————————————
  // 2. 街面 / 广场铺装
  // ————————————————————————————————————————————————————————————
  function paveGround() {
    const y = C.SLAB_TOP;
    for (let z = -H; z <= H; z++) {
      for (let x = -H; x <= H; x++) {
        const k = streetMask[mi(x, z)];
        if (k === 1) {
          let m = ((x + z) & 63) === 0 ? M.ASPHALT_2 : M.ASPHALT;
          if (noise2(x * 0.07, z * 0.07, 9) > 0.74) m = M.ASPHALT_2;
          world.setC(x, y, z, m);
        } else if (k === 2) {
          const c = cheb(x, z);
          let m = M.CONC_2;
          if (((c / 8) | 0) % 2 === 0) m = M.CONC_1;
          if (c % 24 === 0) m = M.CONC_5;
          world.setC(x, y, z, m);
        }
      }
    }
    // 主干道中线 + 人行道压边
    for (let x = -H; x <= H; x++) {
      if (Math.abs(x) > C.PLAZA_R) {
        if ((((x % 12) + 12) % 12) < 6) { world.setC(x, y, 0, M.ROAD_LINE); }
        world.setC(x, y, C.AVENUE_HW, M.CONC_1);
        world.setC(x, y, -C.AVENUE_HW, M.CONC_1);
      }
    }
    for (let z = -H; z <= H; z++) {
      if (Math.abs(z) > C.PLAZA_R) {
        if ((((z % 12) + 12) % 12) < 6) { world.setC(0, y, z, M.ROAD_LINE); }
        world.setC(C.AVENUE_HW, y, z, M.CONC_1);
        world.setC(-C.AVENUE_HW, y, z, M.CONC_1);
      }
    }
    // 广场：向巨核汇聚的辐射光带 + 同心环
    for (let a = 0; a < 48; a++) {
      const th = (a / 48) * Math.PI * 2;
      const dx = Math.cos(th), dz = Math.sin(th);
      for (let r = 54; r <= C.PLAZA_R; r += 1) {
        const x = Math.round(dx * r), z = Math.round(dz * r);
        if (cheb(x, z) > C.PLAZA_R) continue;
        world.setC(x, y, z, (a % 4 === 0) ? M.STRIP_COOL : M.CONC_5);
      }
    }
    for (const r of [62, 74, 86]) B.ring(0, 0, r - 1, r, y, y, M.STRIP_COOL);
    // 巨核脚下的巨型排风格栅
    for (const [gx, gz] of [[0, 66], [0, -66], [66, 0], [-66, 0]]) {
      const ax = gx === 0 ? 22 : 8, az = gz === 0 ? 22 : 8;
      B.fill(gx - ax, y - 2, gz - az, gx + ax, y, gz + az, M.IRON_BLACK);
      for (let i = -ax; i <= ax; i += 3) B.fill(gx + i, y, gz - az, gx + i, y, gz + az, M.STEEL_M);
    }
  }

  // ————————————————————————————————————————————————————————————
  // 3. 立面：所有建筑共用的“开窗器”
  // ————————————————————————————————————————————————————————————
  /**
   * axis: 0 => 常量 x 面（切向为 z）；2 => 常量 z 面（切向为 x）
   * sign: +1 / -1 面朝向
   */
  function facade(axis, sign, faceC, t0, t1, y0, y1, st, rng) {
    const put = (d0, d1, ta, tb, ya, yb, m) => {
      const a = faceC + sign * d0, b = faceC + sign * d1;
      if (axis === 0) B.fill(a, ya, ta, b, yb, tb, m);
      else B.fill(ta, ya, a, tb, yb, b, m);
    };
    const winMats = st.winMats;
    const litP = st.lit;
    const stepT = st.winW + st.pierW;
    const stepY = st.winH + st.spanY;
    // 竖向壁柱
    if (st.pilaster) {
      for (let t = t0; t <= t1; t += st.pilasterStep) {
        put(0, st.pilasterD, t, Math.min(t1, t + st.pilasterW - 1), y0, y1, st.matTrim);
      }
    }
    // 窗网格
    const tStart = t0 + st.marginT;
    for (let y = y0 + st.marginY; y + st.winH - 1 <= y1 - st.topMargin; y += stepY) {
      // 每 N 层一条挑檐/腰线
      for (let t = tStart; t + st.winW - 1 <= t1 - st.marginT; t += stepT) {
        if (st.pilaster) {
          const rel = ((t - t0) % st.pilasterStep);
          if (rel < st.pilasterW) continue;
        }
        const r = rng();
        let m = M.WIN_DEAD;
        if (r < litP) m = winMats[(rng() * winMats.length) | 0];
        else if (r < litP + 0.12) m = M.WIN_WARM_DIM;
        else m = st.matGlass;
        put(0, st.recess, t, t + st.winW - 1, y, y + st.winH - 1, m);
        if (st.sill) put(0, -1, t - 1, t + st.winW, y - 1, y - 1, st.matTrim);
      }
    }
    // 腰线
    if (st.beltStep > 0) {
      for (let y = y0 + st.beltStep; y < y1 - 2; y += st.beltStep) {
        put(0, st.beltD, t0, t1, y, y + st.beltH - 1, st.matBelt);
      }
    }
    // 顶部檐口
    if (st.cornice) put(0, 2, t0 - 1, t1 + 1, y1 - 1, y1, st.matTrim);
  }

  const STYLES = {
    // 密集住宅（九龙感）
    dense: () => ({
      winW: 2, winH: 3, pierW: 2, spanY: 2, recess: -1, marginT: 2, marginY: 2, topMargin: 2,
      pilaster: false, pilasterStep: 0, pilasterW: 0, pilasterD: 0,
      matTrim: M.CONC_STAIN, matGlass: M.GLASS_D, matBelt: M.CONC_5, beltStep: 0, beltH: 1, beltD: 1,
      sill: true, cornice: true, lit: 0.5,
      winMats: [M.WIN_WARM, M.WIN_WARM, M.WIN_WARM_DIM, M.WIN_COOL, M.WIN_PALE],
    }),
    // 办公横向长窗带
    office: () => ({
      winW: 8, winH: 2, pierW: 2, spanY: 3, recess: -1, marginT: 2, marginY: 3, topMargin: 3,
      pilaster: true, pilasterStep: 20, pilasterW: 2, pilasterD: 1,
      matTrim: M.CONC_2, matGlass: M.GLASS_B, matBelt: M.CONC_1, beltStep: 0, beltH: 1, beltD: 1,
      sill: false, cornice: true, lit: 0.4,
      winMats: [M.WIN_COOL, M.WIN_PALE, M.WIN_COOL],
    }),
    // 混凝土小窗塔
    brutal: () => ({
      winW: 1, winH: 2, pierW: 3, spanY: 3, recess: -2, marginT: 3, marginY: 3, topMargin: 3,
      pilaster: true, pilasterStep: 12, pilasterW: 3, pilasterD: 2,
      matTrim: M.CONC_4, matGlass: M.GLASS_D, matBelt: M.CONC_5, beltStep: 18, beltH: 2, beltD: 2,
      sill: false, cornice: true, lit: 0.35,
      winMats: [M.WIN_WARM, M.WIN_WARM_DIM, M.WIN_PALE],
    }),
    // 玻璃幕墙
    glass: () => ({
      winW: 4, winH: 4, pierW: 1, spanY: 1, recess: 0, marginT: 1, marginY: 2, topMargin: 2,
      pilaster: true, pilasterStep: 25, pilasterW: 1, pilasterD: 1,
      matTrim: M.ALUM, matGlass: M.GLASS_T, matBelt: M.STEEL_M, beltStep: 0, beltH: 1, beltD: 1,
      sill: false, cornice: false, lit: 0.3,
      winMats: [M.WIN_COOL, M.WIN_PALE, M.WIN_WARM_DIM],
    }),
  };

  function facadeAll(x0, y0, z0, x1, y1, z1, st, rng) {
    facade(0, +1, x1, z0, z1, y0, y1, st, rng);
    facade(0, -1, x0, z0, z1, y0, y1, st, rng);
    facade(2, +1, z1, x0, x1, y0, y1, st, rng);
    facade(2, -1, z0, x0, x1, y0, y1, st, rng);
  }

  // ————————————————————————————————————————————————————————————
  // 4. 日常城市：分层街区（地面 / +46 / +92）
  // ————————————————————————————————————————————————————————————
  function roofClutter(x0, z0, x1, z1, y, rng) {
    const n = 2 + ((rng() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const w = 2 + ((rng() * 5) | 0), d = 2 + ((rng() * 5) | 0), h = 1 + ((rng() * 4) | 0);
      const px = x0 + 1 + ((rng() * Math.max(1, x1 - x0 - w - 1)) | 0);
      const pz = z0 + 1 + ((rng() * Math.max(1, z1 - z0 - d - 1)) | 0);
      const kind = rng();
      if (kind < 0.35) {
        B.fill(px, y, pz, px + w, y + h, pz + d, M.STEEL_M);
        B.fill(px, y + h, pz, px + w, y + h, pz + d, M.STEEL_L);
      } else if (kind < 0.55) {
        B.cyl(px + 2, pz + 2, 2, y, y + 2 + h, M.RUST);
        B.cyl(px + 2, pz + 2, 2, y + 3 + h, y + 3 + h, M.RUST_D);
      } else if (kind < 0.7) {
        B.fill(px, y, pz, px + 3, y + 4, pz + 3, M.CONC_2);   // 楼梯间
        B.fill(px, y + 5, pz, px + 3, y + 5, pz + 3, M.CONC_5);
      } else if (kind < 0.85) {
        B.col(px, y, pz, y + 6 + ((rng() * 10) | 0), M.STEEL_D);  // 天线
        world.setC(px, y + 7 + ((rng() * 10) | 0), pz, M.NEON_RED);
      } else {
        // 水塔支架
        B.fill(px, y, pz, px, y + 3, pz, M.STEEL_D);
        B.fill(px + 3, y, pz, px + 3, y + 3, pz, M.STEEL_D);
        B.fill(px, y, pz + 3, px, y + 3, pz + 3, M.STEEL_D);
        B.fill(px + 3, y, pz + 3, px + 3, y + 3, pz + 3, M.STEEL_D);
        B.fill(px - 1, y + 4, pz - 1, px + 4, y + 7, pz + 4, M.RUST);
      }
    }
    // 屋顶发光标识
    if (rng() < 0.28) {
      const neon = [M.NEON_CYAN, M.NEON_MAG, M.NEON_AMB, M.NEON_GRN][(rng() * 4) | 0];
      const horiz = rng() < 0.5;
      if (horiz) {
        B.fill(x0 + 2, y + 1, z0 + 1, x1 - 2, y + 5, z0 + 1, M.STEEL_D);
        for (let t = x0 + 3; t <= x1 - 3; t += 3) B.fill(t, y + 2, z0, t + 1, y + 4, z0, neon);
      } else {
        B.fill(x0 + 1, y + 1, z0 + 2, x0 + 1, y + 12, z0 + 3, M.STEEL_D);
        for (let t = y + 2; t <= y + 11; t += 3) B.fill(x0, t, z0 + 2, x0, t + 1, z0 + 3, neon);
      }
    }
  }

  function streetFront(x0, z0, x1, z1, y, rng) {
    // 一层：门洞、雨棚、招牌
    const sides = [[0, -1, z0], [0, 1, z1], [2, -1, x0], [2, 1, x1]];
    for (const [ax, sg, cc] of sides) {
      const t0 = ax === 0 ? x0 : z0, t1 = ax === 0 ? x1 : z1;
      for (let t = t0 + 2; t <= t1 - 4; t += 6) {
        if (rng() < 0.45) continue;
        // 招牌
        const neon = [M.NEON_CYAN, M.NEON_MAG, M.NEON_AMB, M.NEON_GRN, M.NEON_RED][(rng() * 5) | 0];
        const hgt = 3 + ((rng() * 6) | 0);
        const out = 2 + ((rng() * 3) | 0);
        const yb = y + 3 + ((rng() * 8) | 0);
        for (let d = 1; d <= out; d++) {
          const c = ax === 0 ? cc + sg * d : cc + sg * d;
          if (ax === 0) B.fill(t, yb, c, t + 2, yb + hgt, c, d === out ? neon : M.STEEL_D);
          else B.fill(c, yb, t, c, yb + hgt, t + 2, d === out ? neon : M.STEEL_D);
        }
        // 雨棚
        if (rng() < 0.5) {
          for (let d = 1; d <= 2; d++) {
            const c = cc + sg * d;
            if (ax === 0) B.fill(t - 1, y + 4, c, t + 3, y + 4, c, M.PAINT_TEAL);
            else B.fill(c, y + 4, t - 1, c, y + 4, t + 3, M.PAINT_TEAL);
          }
        }
        // 门洞发光
        if (ax === 0) B.fill(t, y + 1, cc, t + 2, y + 3, cc, M.LAMP_SODIUM);
        else B.fill(cc, y + 1, t, cc, y + 3, t + 2, M.LAMP_SODIUM);
      }
    }
  }

  function buildBlock(x0, z0, x1, z1, yBase, maxH, rng) {
    if (x1 - x0 < 5 || z1 - z0 < 5) return yBase;
    const styleKeys = ['dense', 'dense', 'brutal', 'office', 'glass'];
    const st = STYLES[styleKeys[(rng() * styleKeys.length) | 0]]();
    st.lit *= 0.7 + rng() * 0.75;
    const body = [M.CONC_1, M.CONC_2, M.CONC_3, M.CONC_WARM, M.CONC_STAIN][(rng() * 5) | 0];
    let cx0 = x0, cz0 = z0, cx1 = x1, cz1 = z1, y = yBase;
    const tiers = 1 + (rng() < 0.6 ? 1 : 0) + (rng() < 0.3 ? 1 : 0);
    const total = Math.max(10, Math.round(maxH * (0.45 + rng() * 0.55)));
    for (let t = 0; t < tiers; t++) {
      const remain = total - (y - yBase);
      if (remain < 8) break;
      const th = t === tiers - 1 ? remain : Math.max(8, Math.round(remain * (0.45 + rng() * 0.3)));
      B.fill(cx0, y, cz0, cx1, y + th, cz1, body);
      facadeAll(cx0, y + 1, cz0, cx1, y + th - 1, cz1, st, rng);
      // 挑檐
      B.fill(cx0 - 1, y + th, cz0 - 1, cx1 + 1, y + th, cz1 + 1, M.CONC_5);
      if (rng() < 0.4) B.fill(cx0 - 1, y + th - 1, cz0 - 1, cx1 + 1, y + th - 1, cz1 + 1, M.CONC_4);
      y += th + 1;
      const ins = 2 + ((rng() * 4) | 0);
      if (rng() < 0.7) cx0 += ins; if (rng() < 0.7) cx1 -= ins;
      if (rng() < 0.7) cz0 += ins; if (rng() < 0.7) cz1 -= ins;
      if (cx1 - cx0 < 6 || cz1 - cz0 < 6) break;
    }
    roofClutter(cx0, cz0, cx1, cz1, y, rng);
    streetFront(x0, z0, x1, z1, yBase, rng);
    return y;
  }

  function buildDistrict() {
    const step = 40;
    for (let gz = -H; gz < H; gz += step) {
      for (let gx = -H; gx < H; gx += step) {
        const bx0 = gx + 8, bz0 = gz + 8, bx1 = gx + step - 1, bz1 = gz + step - 1;
        if (bx1 > H - 10 || bz1 > H - 10) continue;
        // 街区必须完全落在“非街道”区域
        let ok = true;
        for (let z = bz0; z <= bz1 && ok; z += 2) {
          for (let x = bx0; x <= bx1 && ok; x += 2) {
            if (streetMask[mi(x, z)] !== 0) ok = false;
          }
        }
        if (!ok) continue;
        const cc = cheb((bx0 + bx1) / 2, (bz0 + bz1) / 2);
        const rng = mulberry32((gx * 73856093) ^ (gz * 19349663) ^ seed);
        const inCanopy = cc <= C.CANOPY_R;
        // 用噪声决定“分层策略”，保证相邻单元连成整片巨型基座
        const strat = noise2(gx * 0.022, gz * 0.022, 31);
        const cap = inCanopy ? 112 : 150;
        if (strat > 0.62) {
          // 两级人工地面：+46 / +92
          B.fill(bx0 - 3, 0, bz0 - 3, bx1 + 3, C.DECK2 - 1, bz1 + 3, M.CONC_3);
          facadeAll(bx0 - 3, 2, bz0 - 3, bx1 + 3, C.DECK2 - 3, bz1 + 3, STYLES.brutal(), rng);
          B.fill(bx0 - 4, C.DECK2 - 2, bz0 - 4, bx1 + 4, C.DECK2 - 1, bz1 + 4, M.DECK_PANEL);
          deckEdge(bx0 - 4, bz0 - 4, bx1 + 4, bz1 + 4, C.DECK2);
          streetFront(bx0 - 3, bz0 - 3, bx1 + 3, bz1 + 3, 0, rng);
          if (strat > 0.76) {
            B.fill(bx0 + 2, C.DECK2, bz0 + 2, bx1 - 2, C.DECK3 - 1, bz1 - 2, M.CONC_2);
            facadeAll(bx0 + 2, C.DECK2 + 2, bz0 + 2, bx1 - 2, C.DECK3 - 3, bz1 - 2, STYLES.dense(), rng);
            B.fill(bx0 + 1, C.DECK3 - 2, bz0 + 1, bx1 - 1, C.DECK3 - 1, bz1 - 1, M.DECK_PANEL);
            deckEdge(bx0 + 1, bz0 + 1, bx1 - 1, bz1 - 1, C.DECK3);
            // 第三层小屋
            const q = 2 + ((rng() * 2) | 0);
            for (let i = 0; i < q; i++) {
              const w = 8 + ((rng() * 10) | 0), d = 8 + ((rng() * 10) | 0);
              const px = bx0 + 3 + ((rng() * Math.max(1, bx1 - bx0 - w - 6)) | 0);
              const pz = bz0 + 3 + ((rng() * Math.max(1, bz1 - bz0 - d - 6)) | 0);
              buildBlock(px, pz, px + w, pz + d, C.DECK3, cap - C.DECK3, rng);
            }
          } else {
            const q = 2 + ((rng() * 3) | 0);
            for (let i = 0; i < q; i++) {
              const w = 9 + ((rng() * 12) | 0), d = 9 + ((rng() * 12) | 0);
              const px = bx0 + 1 + ((rng() * Math.max(1, bx1 - bx0 - w - 2)) | 0);
              const pz = bz0 + 1 + ((rng() * Math.max(1, bz1 - bz0 - d - 2)) | 0);
              buildBlock(px, pz, px + w, pz + d, C.DECK2, cap - C.DECK2, rng);
            }
          }
        } else if (strat > 0.36) {
          // 一级人工地面
          B.fill(bx0 - 2, 0, bz0 - 2, bx1 + 2, C.DECK2 - 1, bz1 + 2, M.CONC_4);
          facadeAll(bx0 - 2, 2, bz0 - 2, bx1 + 2, C.DECK2 - 3, bz1 + 2, STYLES.office(), rng);
          B.fill(bx0 - 3, C.DECK2 - 2, bz0 - 3, bx1 + 3, C.DECK2 - 1, bz1 + 3, M.DECK_PANEL);
          deckEdge(bx0 - 3, bz0 - 3, bx1 + 3, bz1 + 3, C.DECK2);
          streetFront(bx0 - 2, bz0 - 2, bx1 + 2, bz1 + 2, 0, rng);
          const q = 1 + ((rng() * 3) | 0);
          for (let i = 0; i < q; i++) {
            const w = 10 + ((rng() * 16) | 0), d = 10 + ((rng() * 16) | 0);
            const px = bx0 + ((rng() * Math.max(1, bx1 - bx0 - w)) | 0);
            const pz = bz0 + ((rng() * Math.max(1, bz1 - bz0 - d)) | 0);
            buildBlock(px, pz, px + w, pz + d, C.DECK2, cap - C.DECK2, rng);
          }
        } else {
          // 从地面直接长起来的密集塔群
          const q = 1 + ((rng() * 3) | 0);
          if (q === 1) buildBlock(bx0, bz0, bx1, bz1, 0, cap, rng);
          else {
            for (let i = 0; i < q; i++) {
              const w = 12 + ((rng() * 14) | 0), d = 12 + ((rng() * 14) | 0);
              const px = bx0 + ((rng() * Math.max(1, bx1 - bx0 - w)) | 0);
              const pz = bz0 + ((rng() * Math.max(1, bz1 - bz0 - d)) | 0);
              buildBlock(px, pz, px + w, pz + d, 0, cap, rng);
            }
          }
        }
      }
    }
  }

  function deckEdge(x0, z0, x1, z1, y) {
    // 平台边缘：栏杆 + 灯带
    B.fill(x0, y, z0, x1, y, z1, M.CONC_2);
    for (let t = x0; t <= x1; t += 3) {
      world.setC(t, y + 1, z0, M.STEEL_D); world.setC(t, y + 2, z0, M.STEEL_D);
      world.setC(t, y + 1, z1, M.STEEL_D); world.setC(t, y + 2, z1, M.STEEL_D);
    }
    for (let t = z0; t <= z1; t += 3) {
      world.setC(x0, y + 1, t, M.STEEL_D); world.setC(x0, y + 2, t, M.STEEL_D);
      world.setC(x1, y + 1, t, M.STEEL_D); world.setC(x1, y + 2, t, M.STEEL_D);
    }
    B.fill(x0, y + 3, z0, x1, y + 3, z0, M.STEEL_L);
    B.fill(x0, y + 3, z1, x1, y + 3, z1, M.STEEL_L);
    B.fill(x0, y + 3, z0, x0, y + 3, z1, M.STEEL_L);
    B.fill(x1, y + 3, z0, x1, y + 3, z1, M.STEEL_L);
    B.fill(x0, y - 1, z0, x1, y - 1, z0, M.STRIP_COOL);
    B.fill(x0, y - 1, z1, x1, y - 1, z1, M.STRIP_COOL);
    B.fill(x0, y - 1, z0, x0, y - 1, z1, M.STRIP_COOL);
    B.fill(x1, y - 1, z0, x1, y - 1, z1, M.STRIP_COOL);
  }

  // 跨越峡谷的空中连桥（分层社会的“毛细血管”）
  function buildSkybridges() {
    const levels = [C.DECK2, C.DECK3];
    for (const y of levels) {
      for (let t = -H + 40; t <= H - 40; t += 40) {
        if (cheb(t, 0) <= C.RING_R1 + 8) continue;
        // 横跨 z 向大道（沿 z 走）
        B.fill(t, y, -C.AVENUE_HW - 6, t + 5, y + 1, C.AVENUE_HW + 6, M.CONC_3);
        B.fill(t, y + 2, -C.AVENUE_HW - 6, t, y + 5, C.AVENUE_HW + 6, M.STEEL_M);
        B.fill(t + 5, y + 2, -C.AVENUE_HW - 6, t + 5, y + 5, C.AVENUE_HW + 6, M.STEEL_M);
        B.fill(t, y + 6, -C.AVENUE_HW - 6, t + 5, y + 6, C.AVENUE_HW + 6, M.STEEL_D);
        for (let k = -C.AVENUE_HW - 5; k <= C.AVENUE_HW + 5; k += 5) {
          B.fill(t + 1, y + 5, k, t + 4, y + 5, k, M.STRIP_W);
        }
        // 横跨 x 向大道（沿 x 走）
        B.fill(-C.AVENUE_HW - 6, y, t, C.AVENUE_HW + 6, y + 1, t + 5, M.CONC_3);
        B.fill(-C.AVENUE_HW - 6, y + 2, t, C.AVENUE_HW + 6, y + 5, t, M.STEEL_M);
        B.fill(-C.AVENUE_HW - 6, y + 2, t + 5, C.AVENUE_HW + 6, y + 5, t + 5, M.STEEL_M);
        B.fill(-C.AVENUE_HW - 6, y + 6, t, C.AVENUE_HW + 6, y + 6, t + 5, M.STEEL_D);
        for (let k = -C.AVENUE_HW - 5; k <= C.AVENUE_HW + 5; k += 5) {
          B.fill(k, y + 5, t + 1, k, y + 5, t + 4, M.STRIP_W);
        }
      }
    }
  }

  // 街道家具：路灯、管道、电线杆
  function streetFurniture() {
    for (let x = -H + 20; x <= H - 20; x += 22) {
      for (const z of [-C.AVENUE_HW + 2, C.AVENUE_HW - 2]) {
        if (cheb(x, z) <= C.PLAZA_R + 4) continue;
        B.col(x, 0, z, 9, M.STEEL_D);
        B.fill(x, 10, z, x, 10, z + (z > 0 ? -3 : 3), M.STEEL_D);
        world.setC(x, 9, z + (z > 0 ? -3 : 3), M.LAMP_SODIUM);
      }
    }
    for (let z = -H + 20; z <= H - 20; z += 22) {
      for (const x of [-C.AVENUE_HW + 2, C.AVENUE_HW - 2]) {
        if (cheb(x, z) <= C.PLAZA_R + 4) continue;
        B.col(x, 0, z, 9, M.STEEL_D);
        B.fill(x + (x > 0 ? -3 : 3), 10, z, x, 10, z, M.STEEL_D);
        world.setC(x + (x > 0 ? -3 : 3), 9, z, M.LAMP_SODIUM);
      }
    }
    // 广场巨型灯柱
    for (const [px, pz] of [[76, 76], [-76, 76], [76, -76], [-76, -76]]) {
      B.colR(px, pz, 2, 0, 40, M.CONC_4);
      B.colR(px, pz, 3, 40, 43, M.STEEL_D);
      B.fill(px - 3, 44, pz - 3, px + 3, 46, pz + 3, M.STRIP_W);
      data.blinkers.push({ pos: [px, 48, pz], color: 0xffdca8, size: 2.2, rate: 0 });
    }
  }

  // ————————————————————————————————————————————————————————————
  // 5. 插件舱：巨构“无限重复的居住模块”
  // ————————————————————————————————————————————————————————————
  const POD_SHELL = [M.CONC_1, M.CONC_2, M.PAINT_WHITE, M.CONC_WARM, M.PAINT_ORANGE, M.PAINT_TEAL, M.RUST];
  function capsule(axis, sign, faceC, t, y, rng, big = false) {
    const wT = big ? 15 : 10;      // 切向宽
    const hY = big ? 11 : 8;       // 高
    const dep = big ? 16 : 12;     // 外伸
    const shell = POD_SHELL[(rng() * POD_SHELL.length) | 0];
    const put = (d0, d1, ta, tb, ya, yb, m) => {
      const a = faceC + sign * d0, b = faceC + sign * d1;
      if (axis === 0) B.fill(a, ya, ta, b, yb, tb, m);
      else B.fill(ta, ya, a, tb, yb, b, m);
    };
    put(0, dep, t, t + wT - 1, y, y + hY - 1, shell);
    // 边缘暗色缝
    put(0, dep, t, t, y, y + hY - 1, M.STEEL_D);
    put(0, dep, t + wT - 1, t + wT - 1, y, y + hY - 1, M.STEEL_D);
    put(0, dep, t, t + wT - 1, y, y, M.STEEL_D);
    put(0, dep, t, t + wT - 1, y + hY - 1, y + hY - 1, M.STEEL_D);
    // 舱窗（圆窗感：中间挖大、四角留边）
    const ww = big ? 7 : 4, wh = big ? 6 : 4;
    const wt = t + ((wT - ww) >> 1), wy = y + ((hY - wh) >> 1);
    const lit = rng();
    const wm = lit < 0.42 ? M.WIN_WARM : lit < 0.55 ? M.WIN_COOL : lit < 0.63 ? M.WIN_PALE : M.WIN_DEAD;
    put(dep, dep, wt - 1, wt + ww, wy - 1, wy + wh, M.STEEL_D);
    put(dep, dep, wt, wt + ww - 1, wy, wy + wh - 1, wm);
    put(dep + 1, dep + 1, wt, wt + ww - 1, wy + 1, wy + wh - 2, wm);
    put(dep + 1, dep + 1, wt + 1, wt + ww - 2, wy, wy + wh - 1, wm);
    // 舱顶设备 + 排气
    if (rng() < 0.55) put(dep - 4, dep - 2, t + 2, t + 4, y + hY, y + hY + 1, M.STEEL_M);
    if (rng() < 0.4) put(dep - 3, dep - 3, t + wT - 4, t + wT - 3, y + hY, y + hY + 3, M.RUST_D);
    // 侧面小灯
    if (rng() < 0.5) put(dep, dep, t + 1, t + 1, y + 1, y + 1, M.NEON_AMB);
    // 支撑托架
    put(0, dep, t + 1, t + 2, y - 1, y - 1, M.STEEL_D);
    put(0, dep, t + wT - 3, t + wT - 2, y - 1, y - 1, M.STEEL_D);
  }

  function capsuleField(axis, sign, faceC, t0, t1, y0, y1, density, rng) {
    const stepT = 14, stepY = 12;
    for (let y = y0; y + 10 <= y1; y += stepY) {
      for (let t = t0; t + 13 <= t1; t += stepT) {
        if (rng() > density) continue;
        capsule(axis, sign, faceC, t + 1, y + 1, rng, rng() < 0.12);
      }
    }
  }

  // ————————————————————————————————————————————————————————————
  // 6. 巨核 THE CORE
  // ————————————————————————————————————————————————————————————
  function coreProfileHW(y) {
    if (y > 1120) return 24;
    if (y > 990) return 32;
    if (y > 830) return 40;
    return C.CORE_HW;
  }

  const CORE_SEGS = [[CFG.PLINTH_BOT, 830, 48], [831, 990, 40], [991, 1120, 32], [1121, CFG.CORE_TOP, 24]];

  function buildCore() {
    const hw = C.CORE_HW;
    B.fill(-hw, C.PLINTH_BOT, -hw, hw, C.CORE_TOP, hw, M.CONC_3);
    // 收分
    for (const [yy, h] of [[831, 40], [991, 32], [1121, 24]]) {
      B.clear(-hw, yy, -hw, hw, C.CORE_TOP, hw);
      B.fill(-h, yy, -h, h, C.CORE_TOP, h, M.CONC_3);
    }
    // 每 40 体素一个“巨层”，是巨构的基本节拍
    for (let y = 0; y <= C.CORE_TOP - 10; y += 40) {
      const h = coreProfileHW(y);
      B.fill(-h - 4, y, -h - 4, h + 4, y + 4, h + 4, M.CONC_5);
      B.fill(-h - 5, y + 1, -h - 5, h + 5, y + 2, h + 5, M.CONC_4);
      B.fill(-h - 5, y + 3, -h - 5, h + 5, y + 3, h + 5, M.STRIP_COOL);
      // 巨层编号色块
      if ((y / 40) % 4 === 0) {
        for (const [ax, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
          const put = (ta, tb, ya, yb, m) => {
            const c = sg * (h + 5);
            if (ax === 0) B.fill(c, ya, ta, c, yb, tb, m);
            else B.fill(ta, ya, c, tb, yb, c, m);
          };
          put(-10, 10, y + 6, y + 16, M.PAINT_YEL);
          put(-6, -3, y + 8, y + 14, M.IRON_BLACK);
          put(2, 6, y + 8, y + 14, M.IRON_BLACK);
        }
      }
    }
    // 竖向巨肋 + 幕墙
    for (const [ax, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
      for (const [ya0, yb, h] of CORE_SEGS) {
        const ya = Math.max(ya0, 0);
        const face = sg * h;
        const t0 = -h + 14, t1 = h - 14;
        // 巨肋
        for (let t = t0; t <= t1; t += 32) {
          const put = (d0, d1, ta, tb, m) => {
            const a = face + sg * d0, b = face + sg * d1;
            if (ax === 0) B.fill(a, ya, ta, b, yb, tb, m);
            else B.fill(ta, ya, a, tb, yb, b, m);
          };
          put(1, 6, t, t + 5, M.CONC_2);
          put(7, 7, t + 1, t + 4, M.CONC_5);
        }
        // 次肋
        for (let t = t0; t <= t1; t += 8) {
          const put = (d0, d1, ta, tb, m) => {
            const a = face + sg * d0, b = face + sg * d1;
            if (ax === 0) B.fill(a, ya, ta, b, yb, tb, m);
            else B.fill(ta, ya, a, tb, yb, b, m);
          };
          put(1, 2, t, t + 1, M.CONC_2);
        }
        // 窗
        const rng = mulberry32(seed ^ (ax * 7919) ^ (sg * 104729) ^ (ya * 31));
        for (let y = ya + 6; y <= yb - 8; y += 6) {
          if (((y % 40) < 6)) continue;         // 让开巨层带
          for (let t = t0 + 2; t <= t1 - 4; t += 8) {
            if (((t - t0) % 32) < 6) continue;  // 让开巨肋
            const r = rng();
            const m = r < 0.30 ? M.WIN_WARM : r < 0.40 ? M.WIN_COOL : r < 0.46 ? M.WIN_PALE : r < 0.56 ? M.WIN_WARM_DIM : r < 0.74 ? M.GLASS_D : M.WIN_DEAD;
            const put = (d0, d1, ta, tb, yaa, ybb, mm) => {
              const a = face + sg * d0, b = face + sg * d1;
              if (ax === 0) B.fill(a, yaa, ta, b, ybb, tb, mm);
              else B.fill(ta, yaa, a, tb, ybb, b, mm);
            };
            put(0, -1, t, t + 4, y, y + 3, m);
          }
        }
      }
    }
    // 45° 切角：让 1400 体素高的体量拥有一个可辨识的剪影
    for (const [ya, yb, h] of CORE_SEGS) {
      const hOut = h + 6, cut = 20;
      for (let i = 0; i < cut; i++) {
        const a = hOut - i, b = hOut - (cut - 1 - i);
        B.clear(a, ya, b, hOut, yb, hOut);
        B.clear(-hOut, ya, b, -a, yb, hOut);
        B.clear(a, ya, -hOut, hOut, yb, -b);
        B.clear(-hOut, ya, -hOut, -a, yb, -b);
      }
      // 切角面上的斜向结构缝
      for (let y = Math.max(ya, 0); y < yb; y += 40) {
        for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          B.lineBar(sx * (h - 12), y, sz * h, sx * h, y, sz * (h - 12), M.CONC_5, 1);
          B.lineBar(sx * (h - 12), y + 3, sz * h, sx * h, y + 3, sz * (h - 12), M.STRIP_COOL, 1);
        }
      }
    }
    // 巨核基座：巨型拱门 —— 人从这里进入巨构
    for (const [ax, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
      const face = sg * (C.CORE_HW + 6);
      const put = (d0, d1, ta, tb, ya, yb, m) => {
        const a = face - sg * d0, b = face - sg * d1;
        if (ax === 0) B.fill(a, ya, ta, b, yb, tb, m);
        else B.fill(ta, ya, a, tb, yb, b, m);
      };
      put(0, 26, -16, 16, 0, 56, 0);
      put(0, 26, -18, -17, 0, 58, M.CONC_5);
      put(0, 26, 17, 18, 0, 58, M.CONC_5);
      put(0, 26, -18, 18, 57, 58, M.CONC_5);
      put(0, 1, -16, 16, 55, 56, M.STRIP_W);
      // 门洞里的红色警示
      put(24, 25, -16, 16, 1, 2, M.NEON_RED);
    }
    // 巨核巨型标识：一整面楼高的发光符号
    for (const [ax, sg] of [[0, 1], [2, -1]]) {
      const face = sg * (C.CORE_HW + 8);
      const put = (ta, tb, ya, yb, m) => {
        if (ax === 0) B.fill(face, ya, ta, face, yb, tb, m);
        else B.fill(ta, ya, face, tb, yb, face, m);
      };
      const y = 268;
      put(-26, 26, y - 4, y + 66, M.IRON_BLACK);
      // 一个抽象的“巨”字骨架
      put(-18, 18, y + 56, y + 60, M.NEON_CYAN);
      put(-18, 18, y + 36, y + 40, M.NEON_CYAN);
      put(-18, 18, y + 16, y + 20, M.NEON_CYAN);
      put(-2, 2, y + 16, y + 60, M.NEON_CYAN);
      put(-22, 22, y + 2, y + 6, M.NEON_CYAN);
      data.billboards.push({ pos: [ax === 0 ? face + sg : 0, y + 30, ax === 0 ? 0 : face + sg], axis: ax, sign: sg });
    }
  }

  /**
   * 独立升降塔 —— 新陈代谢派的“服务塔”。
   * 4 座格构桅杆立在巨核四角的广场上，轿厢在外侧轨道上升降：
   * 这是全场最直观的尺度参照 —— 一个 10 体素的轿厢，要爬 1150 体素。
   */
  function buildLiftTowers() {
    const R = 84, top = 1150;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const cx = sx * R, cz = sz * R;
      B.edgeBars(cx - 7, C.PLINTH_BOT, cz - 7, cx + 7, top, cz + 7, M.CONC_4, 4);
      B.colR(cx, cz, 3, C.PLINTH_BOT, top, M.CONC_5);
      for (let y = 0; y < top - 8; y += 24) {
        B.fill(cx - 7, y, cz - 7, cx + 7, y + 1, cz + 7, M.STEEL_D);
        B.crossBrace(2, cz - 7, cx - 4, cx + 4, y + 2, y + 22, M.STEEL_D, 2, 1);
        B.crossBrace(2, cz + 7, cx - 4, cx + 4, y + 2, y + 22, M.STEEL_D, 2, 1);
        B.crossBrace(0, cx - 7, cz - 4, cz + 4, y + 2, y + 22, M.STEEL_D, 2, 1);
        B.crossBrace(0, cx + 7, cz - 4, cz + 4, y + 2, y + 22, M.STEEL_D, 2, 1);
        if (y % 96 === 0) {
          B.fill(cx - 9, y, cz - 9, cx + 9, y + 2, cz + 9, M.CONC_5);
          B.fill(cx - 9, y + 3, cz - 9, cx + 9, y + 3, cz + 9, M.STRIP_COOL);
        }
      }
      // 朝向巨核一侧的导轨（轿厢在这条轨道上）
      const railX = cx - sx * 8;
      B.fill(railX, 0, cz - 5, railX, top, cz - 5, M.STEEL_L);
      B.fill(railX, 0, cz + 5, railX, top, cz + 5, M.STEEL_L);
      B.fill(cx - 8, top, cz - 8, cx + 8, top + 6, cz + 8, M.STEEL_M);
      B.stripe(cx - 8, top + 4, cz - 8, cx + 8, top + 6, cz - 8, M.PAINT_YEL, M.IRON_BLACK, 4, 0);
      B.colR(cx, cz, 1, top + 6, top + 46, M.STEEL_D);
      data.blinkers.push({ pos: [cx, top + 48, cz], color: 0xff2f26, size: 2.2, rate: 0.75 });
      data.elevators.push({
        x: cx - sx * 15, z: cz, y0: 4, y1: top - 20,
        phase: rnd(), speed: 24 + rnd() * 26,
      });
      // 与各层环廊之间的连桥
      for (const py of C.PLATFORM_Y) {
        const ph = coreProfileHW(py);
        const pr = ph + 30 - C.PLATFORM_Y.indexOf(py) * 2;
        if (Math.abs(cz) > pr) {
          B.fill(cx - 3, py + 4, sz > 0 ? pr : -R, cx + 3, py + 6, sz > 0 ? R : -pr, M.CONC_2);
          B.fill(cx - 4, py + 7, sz > 0 ? pr : -R, cx - 4, py + 9, sz > 0 ? R : -pr, M.STEEL_D);
          B.fill(cx + 4, py + 7, sz > 0 ? pr : -R, cx + 4, py + 9, sz > 0 ? R : -pr, M.STEEL_D);
        }
      }
    }
    data.annotations.push({ pos: [84, 320, 84], title: '升降塔', desc: '轿厢 10 体素，行程 1150 体素 —— 这就是巨构的尺度' });
  }

  // 巨核环廊：伸出 30 体素的环形平台，下挂插件舱
  function buildPlatforms() {
    for (let i = 0; i < C.PLATFORM_Y.length; i++) {
      const y = C.PLATFORM_Y[i];
      const h = coreProfileHW(y);
      const out = 30 - i * 2;
      const R = h + out;
      B.fill(-R, y, -R, R, y + 6, R, M.CONC_2);
      B.clear(-h - 1, y, -h - 1, h + 1, y + 6, h + 1);
      B.fill(-R, y + 6, -R, R, y + 6, R, M.DECK_PANEL);
      B.fill(-R, y - 1, -R, R, y - 1, R, M.STRIP_COOL);
      B.clear(-h - 1, y - 1, -h - 1, h + 1, y - 1, h + 1);
      // 斜撑（从核心面撑住平台外缘）
      for (const [ax, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
        for (let t = -h + 6; t <= h - 6; t += 10) {
          if (ax === 0) B.lineBar(sg * h, y - 18, t, sg * R, y - 1, t, M.STEEL_D, 2);
          else B.lineBar(t, y - 18, sg * h, t, y - 1, sg * R, M.STEEL_D, 2);
        }
      }
      // 栏杆
      for (let t = -R; t <= R; t += 4) {
        world.setC(t, y + 7, -R, M.STEEL_D); world.setC(t, y + 8, -R, M.STEEL_D);
        world.setC(t, y + 7, R, M.STEEL_D); world.setC(t, y + 8, R, M.STEEL_D);
        world.setC(-R, y + 7, t, M.STEEL_D); world.setC(-R, y + 8, t, M.STEEL_D);
        world.setC(R, y + 7, t, M.STEEL_D); world.setC(R, y + 8, t, M.STEEL_D);
      }
      B.fill(-R, y + 9, -R, R, y + 9, -R, M.STEEL_L);
      B.fill(-R, y + 9, R, R, y + 9, R, M.STEEL_L);
      B.fill(-R, y + 9, -R, -R, y + 9, R, M.STEEL_L);
      B.fill(R, y + 9, -R, R, y + 9, R, M.STEEL_L);
      // 平台下方悬挂插件舱
      const rng = mulberry32(seed ^ (y * 7717));
      for (const [ax, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
        capsuleField(ax, sg, sg * (R - 1), -R + 8, R - 8, y - 30, y - 12, 0.62, rng);
      }
      // 顶部小型构筑物
      for (const [ax, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
        for (let t = -R + 10; t < R - 18; t += 26) {
          const w = 8 + ((rng() * 8) | 0), hh = 6 + ((rng() * 10) | 0);
          if (ax === 0) B.fill(sg * (R - 12), y + 7, t, sg * (R - 12) + sg * 9, y + 7 + hh, t + w, M.CONC_1);
          else B.fill(t, y + 7, sg * (R - 12), t + w, y + 7 + hh, sg * (R - 12) + sg * 9, M.CONC_1);
        }
      }
      data.annotations.push(i === 2 ? { pos: [R + 6, y + 10, 0], title: '环廊', desc: '巨核每 176 体素挑出一圈公共层' } : null);
      data.blinkers.push({ pos: [R, y + 10, R], color: 0xff2f26, size: 1.6, rate: 1.1 });
      data.blinkers.push({ pos: [-R, y + 10, -R], color: 0xff2f26, size: 1.6, rate: 1.1 });
    }
    data.annotations = data.annotations.filter(Boolean);
  }

  // 飞扶壁：把巨核的力传到地面，同时成为可居住的巨墙
  function buildButtresses() {
    for (const [ax, sg] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
      const steps = [[0, 200, 118], [200, 340, 104], [340, 470, 88], [470, 580, 72], [580, 670, 60]];
      for (const [ya, yb, reach] of steps) {
        const inner = C.CORE_HW - 2;
        const yStart = ya === 0 ? C.PLINTH_BOT : ya;
        if (ax === 0) B.fill(sg * inner, yStart, -26, sg * reach, yb, 26, M.CONC_3);
        else B.fill(-26, yStart, sg * inner, 26, yb, sg * reach, M.CONC_3);
      }
      // 扶壁外侧：X 撑 + 插件舱
      const rng = mulberry32(seed ^ (ax * 3301) ^ (sg * 8191));
      for (const [ya, yb, reach] of [[10, 190, 116], [206, 330, 102], [346, 460, 86], [476, 570, 70]]) {
        if (ax === 0) {
          B.crossBrace(2, 27, sg * (C.CORE_HW + 4), sg * (reach - 2), ya, yb, M.STEEL_D, 3, 3);
          B.crossBrace(2, -27, sg * (C.CORE_HW + 4), sg * (reach - 2), ya, yb, M.STEEL_D, 3, 3);
          capsuleField(2, 1, 27, sg > 0 ? C.CORE_HW + 8 : -reach + 6, sg > 0 ? reach - 6 : -C.CORE_HW - 8, ya + 4, yb - 8, 0.55, rng);
          capsuleField(2, -1, -27, sg > 0 ? C.CORE_HW + 8 : -reach + 6, sg > 0 ? reach - 6 : -C.CORE_HW - 8, ya + 4, yb - 8, 0.55, rng);
        } else {
          B.crossBrace(0, 27, sg * (C.CORE_HW + 4), sg * (reach - 2), ya, yb, M.STEEL_D, 3, 3);
          B.crossBrace(0, -27, sg * (C.CORE_HW + 4), sg * (reach - 2), ya, yb, M.STEEL_D, 3, 3);
          capsuleField(0, 1, 27, sg > 0 ? C.CORE_HW + 8 : -reach + 6, sg > 0 ? reach - 6 : -C.CORE_HW - 8, ya + 4, yb - 8, 0.55, rng);
          capsuleField(0, -1, -27, sg > 0 ? C.CORE_HW + 8 : -reach + 6, sg > 0 ? reach - 6 : -C.CORE_HW - 8, ya + 4, yb - 8, 0.55, rng);
        }
      }
      // 扶壁顶面：警示条纹 + 灯带
      for (const [yb, reach] of [[200, 118], [340, 104], [470, 88], [580, 72], [670, 60]]) {
        if (ax === 0) {
          B.stripe(sg * (C.CORE_HW + 2), yb, -26, sg * reach, yb, 26, M.PAINT_YEL, M.IRON_BLACK, 6, 0);
          B.fill(sg * reach, yb + 1, -26, sg * reach, yb + 1, 26, M.STRIP_W);
        } else {
          B.stripe(-26, yb, sg * (C.CORE_HW + 2), 26, yb, sg * reach, M.PAINT_YEL, M.IRON_BLACK, 6, 2);
          B.fill(-26, yb + 1, sg * reach, 26, yb + 1, sg * reach, M.STRIP_W);
        }
      }
    }
  }

  // 顶冠：机械层 + 桅杆，插入云层之上
  function buildCrown() {
    const hw = 24;
    B.fill(-hw - 6, C.CORE_TOP, -hw - 6, hw + 6, C.CORE_TOP + 5, hw + 6, M.CONC_5);
    B.fill(-hw, C.CORE_TOP + 6, -hw, hw, C.CROWN_TOP, hw, M.STEEL_M);
    for (let y = C.CORE_TOP + 8; y < C.CROWN_TOP; y += 6) {
      B.fill(-hw - 1, y, -hw - 1, hw + 1, y + 1, hw + 1, M.STEEL_D);
    }
    B.stripe(-hw - 1, C.CROWN_TOP - 10, -hw - 1, hw + 1, C.CROWN_TOP - 6, hw + 1, M.PAINT_YEL, M.IRON_BLACK, 5, 0);
    B.fill(-hw, C.CROWN_TOP, -hw, hw, C.CROWN_TOP + 1, hw, M.STEEL_L);
    // 雷达穹顶
    B.cyl(0, 0, 12, C.CROWN_TOP + 2, C.CROWN_TOP + 10, M.PAINT_WHITE);
    B.cyl(0, 0, 8, C.CROWN_TOP + 11, C.CROWN_TOP + 15, M.PAINT_WHITE);
    B.cyl(0, 0, 4, C.CROWN_TOP + 16, C.CROWN_TOP + 18, M.ALUM);
    // 四根桅杆
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const px = sx * 17, pz = sz * 17;
      B.colR(px, pz, 1, C.CROWN_TOP, C.MAST_TOP, M.STEEL_D);
      for (let y = C.CROWN_TOP + 20; y < C.MAST_TOP; y += 40) {
        B.fill(px - 3, y, pz - 3, px + 3, y + 1, pz + 3, M.STEEL_D);
        data.blinkers.push({ pos: [px, y + 3, pz], color: 0xff2f26, size: 2.6, rate: 0.7 });
      }
      data.blinkers.push({ pos: [px, C.MAST_TOP + 3, pz], color: 0xff2f26, size: 3.4, rate: 0.5 });
    }
    // 探照灯
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      data.searchlights.push({ pos: [sx * 20, C.CORE_TOP + 8, sz * 20], dir: [sx, -0.35, sz] });
    }
    data.annotations.push({ pos: [0, C.CROWN_TOP + 24, 0], title: '顶冠', desc: '1436 体素高处，人类尺度已经彻底消失' });
  }

  // ————————————————————————————————————————————————————————————
  // 7. 巨柱塔：结构即城市（插件城市）
  // ————————————————————————————————————————————————————————————
  function buildTower(cx, cz, top, tag) {
    const hw = C.TOWER_HW;
    const x0 = cx - hw, x1 = cx + hw, z0 = cz - hw, z1 = cz + hw;
    // 角柱
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      B.colR(cx + sx * (hw - 7), cz + sz * (hw - 7), 7, C.PLINTH_BOT, top, M.CONC_4);
      B.colR(cx + sx * (hw - 7), cz + sz * (hw - 7), 5, C.PLINTH_BOT, top, M.CONC_3);
    }
    // 中心竖井
    B.colR(cx, cz, 11, C.PLINTH_BOT, top + 24, M.CONC_5);
    B.colR(cx, cz, 9, C.PLINTH_BOT, top + 24, M.CONC_4);
    // 巨型横梁层
    const bay = 68;
    for (let y = 0; y <= top - 12; y += bay) {
      B.edgeBars(x0, y, z0, x1, y + 9, z1, M.CONC_2, 6);
      B.fill(x0, y, z0, x1, y + 1, z1, M.CONC_4);
      B.fill(x0 - 2, y + 2, z0 - 2, x1 + 2, y + 5, z1 + 2, M.CONC_3);
      B.fill(x0 - 2, y + 6, z0 - 2, x1 + 2, y + 6, z1 + 2, M.STRIP_COOL);
      B.stripe(x0 - 2, y + 7, z0 - 3, x1 + 2, y + 9, z0 - 3, M.PAINT_YEL, M.IRON_BLACK, 6, 0);
      B.stripe(x0 - 2, y + 7, z1 + 3, x1 + 2, y + 9, z1 + 3, M.PAINT_YEL, M.IRON_BLACK, 6, 0);
      // 连接中心井的楼板
      B.fill(cx - 11, y + 2, z0 + 6, cx + 11, y + 4, z1 - 6, M.CONC_4);
      B.fill(x0 + 6, y + 2, cz - 11, x1 - 6, y + 4, cz + 11, M.CONC_4);
    }
    // 框架斜撑 + 插件舱
    const rng = mulberry32(seed ^ (cx * 6151) ^ (cz * 3571));
    for (let y = 10; y + bay <= top; y += bay) {
      const ya = y, yb = y + bay - 12;
      B.crossBrace(2, z0 + 1, x0 + 8, x1 - 8, ya, yb, M.STEEL_D, 3, 2);
      B.crossBrace(2, z1 - 1, x0 + 8, x1 - 8, ya, yb, M.STEEL_D, 3, 2);
      B.crossBrace(0, x0 + 1, z0 + 8, z1 - 8, ya, yb, M.STEEL_D, 3, 2);
      B.crossBrace(0, x1 - 1, z0 + 8, z1 - 8, ya, yb, M.STEEL_D, 3, 2);
      const dens = 0.72 - (y / top) * 0.25;
      capsuleField(0, +1, x1, z0 + 10, z1 - 10, ya + 2, yb - 2, dens, rng);
      capsuleField(0, -1, x0, z0 + 10, z1 - 10, ya + 2, yb - 2, dens, rng);
      capsuleField(2, +1, z1, x0 + 10, x1 - 10, ya + 2, yb - 2, dens, rng);
      capsuleField(2, -1, z0, x0 + 10, x1 - 10, ya + 2, yb - 2, dens, rng);
    }
    // 塔顶：设备层 + 塔吊（“永远未完成”）
    B.fill(x0 + 4, top, z0 + 4, x1 - 4, top + 14, z1 - 4, M.STEEL_M);
    B.fill(x0 + 2, top + 14, z0 + 2, x1 - 2, top + 16, z1 - 2, M.STEEL_D);
    B.stripe(x0 + 2, top + 15, z0 + 2, x1 - 2, top + 16, z0 + 2, M.PAINT_YEL, M.IRON_BLACK, 5, 0);
    B.colR(cx, cz, 2, top + 16, top + 74, M.PAINT_ORANGE);
    B.fill(cx - 34, top + 66, cz - 1, cx + 52, top + 69, cz + 1, M.PAINT_ORANGE);
    B.fill(cx + 50, top + 40, cz - 1, cx + 52, top + 66, cz + 1, M.STEEL_D);
    B.lineBar(cx, top + 74, cz, cx + 50, top + 69, cz, M.STEEL_D, 1);
    B.lineBar(cx, top + 74, cz, cx - 32, top + 69, cz, M.STEEL_D, 1);
    data.blinkers.push({ pos: [cx, top + 78, cz], color: 0xff2f26, size: 3.0, rate: 0.6 });
    data.blinkers.push({ pos: [cx + 52, top + 71, cz], color: 0xff2f26, size: 2.2, rate: 0.9 });
    // 塔基巨门：主轴大道从塔身穿过
    if (cz === 0) {
      B.clear(x0 - 3, 0, -C.AVENUE_HW - 1, x1 + 3, 62, C.AVENUE_HW + 1);
      B.fill(x0 - 3, 0, -C.AVENUE_HW - 3, x1 + 3, 66, -C.AVENUE_HW - 1, M.CONC_5);
      B.fill(x0 - 3, 0, C.AVENUE_HW + 1, x1 + 3, 66, C.AVENUE_HW + 3, M.CONC_5);
      B.fill(x0 - 3, 63, -C.AVENUE_HW - 1, x1 + 3, 66, C.AVENUE_HW + 1, M.CONC_5);
      B.fill(x0 - 4, 60, -C.AVENUE_HW - 1, x0 - 4, 62, C.AVENUE_HW + 1, M.STRIP_W);
      B.fill(x1 + 4, 60, -C.AVENUE_HW - 1, x1 + 4, 62, C.AVENUE_HW + 1, M.STRIP_W);
      for (let t = -C.AVENUE_HW; t <= C.AVENUE_HW; t += 6) {
        B.fill(x0 - 2, 61, t, x1 + 2, 61, t, M.LAMP_SODIUM);
      }
    } else {
      B.clear(-C.AVENUE_HW - 1, 0, z0 - 3, C.AVENUE_HW + 1, 62, z1 + 3);
      B.fill(-C.AVENUE_HW - 3, 0, z0 - 3, -C.AVENUE_HW - 1, 66, z1 + 3, M.CONC_5);
      B.fill(C.AVENUE_HW + 1, 0, z0 - 3, C.AVENUE_HW + 3, 66, z1 + 3, M.CONC_5);
      B.fill(-C.AVENUE_HW - 1, 63, z0 - 3, C.AVENUE_HW + 1, 66, z1 + 3, M.CONC_5);
      for (let t = -C.AVENUE_HW; t <= C.AVENUE_HW; t += 6) {
        B.fill(t, 61, z0 - 2, t, 61, z1 + 2, M.LAMP_SODIUM);
      }
    }
    if (tag) data.annotations.push({ pos: [cx, top * 0.55, cz + hw + 20], title: tag.t, desc: tag.d });
  }

  function buildTowers() {
    buildTower(C.TOWER_R, 0, 900, { t: '巨柱塔 · 东', d: '框架承重，插件舱按模块无限重复地挂上去' });
    buildTower(-C.TOWER_R, 0, 812, null);
    buildTower(0, C.TOWER_R, 868, null);
    buildTower(0, -C.TOWER_R, 756, null);
    // 角部塔架（把四塔连成闭合巨框）
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const cx = sx * C.MAST_R, cz = sz * C.MAST_R, top = 560;
      B.edgeBars(cx - 20, C.PLINTH_BOT, cz - 20, cx + 20, top, cz + 20, M.CONC_4, 7);
      for (let y = 0; y < top - 20; y += 60) {
        B.fill(cx - 20, y, cz - 20, cx + 20, y + 4, cz + 20, M.CONC_3);
        B.fill(cx - 22, y + 5, cz - 22, cx + 22, y + 5, cz + 22, M.STRIP_COOL);
        B.crossBrace(2, cz - 20, cx - 14, cx + 14, y + 6, y + 56, M.STEEL_D, 3, 1);
        B.crossBrace(2, cz + 20, cx - 14, cx + 14, y + 6, y + 56, M.STEEL_D, 3, 1);
        B.crossBrace(0, cx - 20, cz - 14, cz + 14, y + 6, y + 56, M.STEEL_D, 3, 1);
        B.crossBrace(0, cx + 20, cz - 14, cz + 14, y + 6, y + 56, M.STEEL_D, 3, 1);
      }
      B.fill(cx - 14, top, cz - 14, cx + 14, top + 10, cz + 14, M.STEEL_M);
      B.colR(cx, cz, 1, top + 10, top + 60, M.STEEL_D);
      data.blinkers.push({ pos: [cx, top + 62, cz], color: 0xff2f26, size: 2.4, rate: 0.8 });
      const rng = mulberry32(seed ^ (cx * 131) ^ (cz * 977));
      for (let y = 8; y < top - 60; y += 60) {
        capsuleField(0, +1, cx + 20, cz - 14, cz + 14, y, y + 44, 0.5, rng);
        capsuleField(0, -1, cx - 20, cz - 14, cz + 14, y, y + 44, 0.5, rng);
      }
    }
  }

  // ————————————————————————————————————————————————————————————
  // 8. 巨跨 / 环梁：把一切缝成一个连续巨物
  // ————————————————————————————————————————————————————————————
  function spanSegment(axis, a0, a1, c, y, halfW, halfH, withCity, rng) {
    // axis 0：沿 x 走；axis 2：沿 z 走
    // 先为巨跨开出净空：它会直接穿透飞扶壁与巨层带，形成“隧道口”
    if (axis === 0) B.clear(a0, y - 3, c - halfW - 4, a1, y + halfH + (withCity ? 58 : 26), c + halfW + 4);
    else B.clear(c - halfW - 4, y - 3, a0, c + halfW + 4, y + halfH + (withCity ? 58 : 26), a1);
    if (axis === 0) {
      B.fill(a0, y, c - halfW, a1, y + halfH, c + halfW, M.CONC_3);
      B.fill(a0, y, c - halfW, a1, y + 2, c + halfW, M.CONC_5);
      B.fill(a0, y + halfH, c - halfW - 2, a1, y + halfH, c + halfW + 2, M.DECK_PANEL);
      // 侧桁架
      B.crossBrace(2, c - halfW - 1, a0 + 4, a1 - 4, y + 3, y + halfH - 1, M.STEEL_D, 3, Math.max(2, Math.round((a1 - a0) / 34)));
      B.crossBrace(2, c + halfW + 1, a0 + 4, a1 - 4, y + 3, y + halfH - 1, M.STEEL_D, 3, Math.max(2, Math.round((a1 - a0) / 34)));
      B.fill(a0, y + halfH - 1, c - halfW - 1, a1, y + halfH, c - halfW - 1, M.STEEL_L);
      B.fill(a0, y + halfH - 1, c + halfW + 1, a1, y + halfH, c + halfW + 1, M.STEEL_L);
      B.fill(a0, y + 2, c - halfW - 1, a1, y + 2, c - halfW - 1, M.STRIP_COOL);
      B.fill(a0, y + 2, c + halfW + 1, a1, y + 2, c + halfW + 1, M.STRIP_COOL);
      // 底面管道
      for (let t = c - halfW + 3; t < c + halfW - 2; t += 7) {
        B.fill(a0, y - 2, t, a1, y - 1, t + 1, t % 3 === 0 ? M.RUST : M.STEEL_M);
      }
      // 甲板上的小城市
      if (withCity) {
        for (let a = a0 + 6; a < a1 - 14; a += 22) {
          const w = 8 + ((rng() * 10) | 0);
          buildBlock(a, c - halfW + 2, a + w, c - 6, y + halfH + 1, 26 + ((rng() * 22) | 0), rng);
          if (rng() < 0.7) buildBlock(a, c + 6, a + w, c + halfW - 2, y + halfH + 1, 22 + ((rng() * 24) | 0), rng);
        }
        for (let a = a0; a <= a1; a += 8) {
          B.col(a, y + halfH + 1, c - halfW + 1, y + halfH + 7, M.STEEL_D);
          B.col(a, y + halfH + 1, c + halfW - 1, y + halfH + 7, M.STEEL_D);
          world.setC(a, y + halfH + 8, c - halfW + 1, M.LAMP_SODIUM);
          world.setC(a, y + halfH + 8, c + halfW - 1, M.LAMP_SODIUM);
        }
      }
      for (let a = a0 + 8; a <= a1 - 8; a += 24) {
        B.fill(a, y + halfH + 1, c - halfW - 2, a + 1, y + halfH + 5, c - halfW - 2, M.STEEL_D);
        B.fill(a, y + halfH + 1, c + halfW + 2, a + 1, y + halfH + 5, c + halfW + 2, M.STEEL_D);
      }
    } else {
      B.fill(c - halfW, y, a0, c + halfW, y + halfH, a1, M.CONC_3);
      B.fill(c - halfW, y, a0, c + halfW, y + 2, a1, M.CONC_5);
      B.fill(c - halfW - 2, y + halfH, a0, c + halfW + 2, y + halfH, a1, M.DECK_PANEL);
      B.crossBrace(0, c - halfW - 1, a0 + 4, a1 - 4, y + 3, y + halfH - 1, M.STEEL_D, 3, Math.max(2, Math.round((a1 - a0) / 34)));
      B.crossBrace(0, c + halfW + 1, a0 + 4, a1 - 4, y + 3, y + halfH - 1, M.STEEL_D, 3, Math.max(2, Math.round((a1 - a0) / 34)));
      B.fill(c - halfW - 1, y + halfH - 1, a0, c - halfW - 1, y + halfH, a1, M.STEEL_L);
      B.fill(c + halfW + 1, y + halfH - 1, a0, c + halfW + 1, y + halfH, a1, M.STEEL_L);
      B.fill(c - halfW - 1, y + 2, a0, c - halfW - 1, y + 2, a1, M.STRIP_COOL);
      B.fill(c + halfW + 1, y + 2, a0, c + halfW + 1, y + 2, a1, M.STRIP_COOL);
      for (let t = c - halfW + 3; t < c + halfW - 2; t += 7) {
        B.fill(t, y - 2, a0, t + 1, y - 1, a1, t % 3 === 0 ? M.RUST : M.STEEL_M);
      }
      if (withCity) {
        for (let a = a0 + 6; a < a1 - 14; a += 22) {
          const w = 8 + ((rng() * 10) | 0);
          buildBlock(c - halfW + 2, a, c - 6, a + w, y + halfH + 1, 26 + ((rng() * 22) | 0), rng);
          if (rng() < 0.7) buildBlock(c + 6, a, c + halfW - 2, a + w, y + halfH + 1, 22 + ((rng() * 24) | 0), rng);
        }
        for (let a = a0; a <= a1; a += 8) {
          B.col(c - halfW + 1, y + halfH + 1, a, y + halfH + 7, M.STEEL_D);
          B.col(c + halfW - 1, y + halfH + 1, a, y + halfH + 7, M.STEEL_D);
          world.setC(c - halfW + 1, y + halfH + 8, a, M.LAMP_SODIUM);
          world.setC(c + halfW - 1, y + halfH + 8, a, M.LAMP_SODIUM);
        }
      }
      for (let a = a0 + 8; a <= a1 - 8; a += 24) {
        B.fill(c - halfW - 2, y + halfH + 1, a, c - halfW - 2, y + halfH + 5, a + 1, M.STEEL_D);
        B.fill(c + halfW + 2, y + halfH + 1, a, c + halfW + 2, y + halfH + 5, a + 1, M.STEEL_D);
      }
    }
  }

  function buildSpans() {
    const rng = mulberry32(seed ^ 0x5f3a);
    for (let i = 0; i < C.SPAN_Y.length; i++) {
      const y = C.SPAN_Y[i];
      const hw = 16 - i * 2, hh = 22 - i * 3;
      const withCity = i < 2;
      const coreEdge = coreProfileHW(y) + 2;
      spanSegment(0, coreEdge, C.TOWER_R - C.TOWER_HW + 6, 0, y, hw, hh, withCity, rng);
      spanSegment(0, -(C.TOWER_R - C.TOWER_HW + 6), -coreEdge, 0, y, hw, hh, withCity, rng);
      spanSegment(2, coreEdge, C.TOWER_R - C.TOWER_HW + 6, 0, y, hw, hh, withCity, rng);
      spanSegment(2, -(C.TOWER_R - C.TOWER_HW + 6), -coreEdge, 0, y, hw, hh, withCity, rng);
      data.droneLanes.push({ axis: i % 2, y: y - 14, span: H, count: 14, speed: 22 + i * 5 });
    }
    // 环梁：塔 → 角塔 → 塔，闭合巨框
    for (const y of C.RINGBEAM_Y) {
      const hw = 12, hh = 16;
      for (const s of [1, -1]) {
        spanSegment(2, C.TOWER_HW + 4, C.MAST_R - 14, s * C.TOWER_R, y, hw, hh, false, rng);
        spanSegment(2, -(C.MAST_R - 14), -(C.TOWER_HW + 4), s * C.TOWER_R, y, hw, hh, false, rng);
        spanSegment(0, C.TOWER_HW + 4, C.MAST_R - 14, s * C.TOWER_R, y, hw, hh, false, rng);
        spanSegment(0, -(C.MAST_R - 14), -(C.TOWER_HW + 4), s * C.TOWER_R, y, hw, hh, false, rng);
      }
    }
    // 越出沙盘边界的两根超长巨跨 —— 暗示巨构没有边界
    spanSegment(0, C.TOWER_R + C.TOWER_HW - 6, H, 0, 300, 14, 18, false, rng);
    spanSegment(0, -H, -(C.TOWER_R + C.TOWER_HW - 6), 0, 300, 14, 18, false, rng);
    spanSegment(2, C.TOWER_R + C.TOWER_HW - 6, H, 0, 300, 14, 18, false, rng);
    spanSegment(2, -H, -(C.TOWER_R + C.TOWER_HW - 6), 0, 300, 14, 18, false, rng);

    data.annotations.push({ pos: [90, C.SPAN_Y[0] + 30, 0], title: '巨跨', desc: '桥不是桥：它厚到可以在上面盖一座城' });
  }

  // ————————————————————————————————————————————————————————————
  // 9. 天盖：人造天空
  // ————————————————————————————————————————————————————————————
  function canopyOpen(x, z) {
    const c = cheb(x, z);
    if (c < C.PLAZA_R || c > C.CANOPY_R) return true;
    // 深渊上方留出开天窗口
    if (x > 138 && z < -138) return true;
    // 主轴大道上方的节奏性光缝
    if (Math.abs(z) <= C.AVENUE_HW + 4 && mod40(x + 8) < 11) return true;
    if (Math.abs(x) <= C.AVENUE_HW + 4 && mod40(z + 8) < 11) return true;
    // 偏轴大道上方的光缝（否则“进城”那条峡谷会全黑）
    if (Math.abs(Math.abs(z) - C.OFFSET_AVE) <= 13 && mod40(x + 8) < 13) return true;
    if (Math.abs(Math.abs(x) - C.OFFSET_AVE) <= 13 && mod40(z + 8) < 13) return true;
    // 圆形光井
    for (const [ox, oz] of [[140, 140], [-140, 140], [-140, -140], [0, 150], [150, 0], [-150, 0], [0, -150]]) {
      const dx = x - ox, dz = z - oz;
      if (dx * dx + dz * dz < 26 * 26) return true;
    }
    return false;
  }
  const LIGHT_WELLS = [[140, 140], [-140, 140], [-140, -140], [0, 150], [150, 0], [-150, 0], [0, -150]];

  function buildCanopy() {
    const y0 = C.CANOPY_Y, y1 = C.CANOPY_Y + C.CANOPY_T - 1;
    // 主体板：逐行 run-length 填充
    for (let z = -C.CANOPY_R; z <= C.CANOPY_R; z++) {
      let run = -9999;
      for (let x = -C.CANOPY_R; x <= C.CANOPY_R + 1; x++) {
        const solid = x <= C.CANOPY_R && !canopyOpen(x, z);
        if (solid && run < -9000) run = x;
        if (!solid && run > -9000) {
          B.fill(run, y0, z, x - 1, y1, z, M.CONC_4);
          run = -9999;
        }
      }
    }
    // 底面藻井（每 16 一格的梁 + 灯带）
    for (let z = -C.CANOPY_R; z <= C.CANOPY_R; z++) {
      for (let x = -C.CANOPY_R; x <= C.CANOPY_R; x++) {
        if (canopyOpen(x, z)) continue;
        const gx = ((x % 16) + 16) % 16, gz = ((z % 16) + 16) % 16;
        if (gx < 2 || gz < 2) { world.setC(x, y0 - 1, z, M.CONC_2); world.setC(x, y0 - 2, z, M.CONC_3); }
        else if (gx === 8 && gz > 3 && gz < 13) world.setC(x, y0, z, M.STRIP_W);
        else if (gz === 8 && gx > 3 && gx < 13) world.setC(x, y0, z, M.STRIP_W);
        else if (gx > 4 && gx < 12 && gz > 4 && gz < 12) world.setC(x, y0, z, M.CONC_5);
      }
    }
    // 顶面：设备、巨型排风机、检修道
    const rng = mulberry32(seed ^ 0xcafe);
    for (let z = -C.CANOPY_R + 12; z < C.CANOPY_R - 12; z += 28) {
      for (let x = -C.CANOPY_R + 12; x < C.CANOPY_R - 12; x += 28) {
        if (canopyOpen(x, z) || canopyOpen(x + 12, z + 12)) continue;
        const k = rng();
        if (k < 0.4) {
          B.fill(x, y1 + 1, z, x + 11, y1 + 6, z + 11, M.STEEL_M);
          B.cyl(x + 6, z + 6, 4, y1 + 7, y1 + 9, M.STEEL_D);
          B.cyl(x + 6, z + 6, 3, y1 + 10, y1 + 10, M.IRON_BLACK);
        } else if (k < 0.6) {
          B.fill(x + 2, y1 + 1, z + 2, x + 9, y1 + 3, z + 9, M.CONC_2);
          B.fill(x + 3, y1 + 4, z + 3, x + 8, y1 + 4, z + 8, M.STEEL_L);
        } else if (k < 0.7) {
          B.colR(x + 5, z + 5, 1, y1 + 1, y1 + 22, M.STEEL_D);
          data.blinkers.push({ pos: [x + 5, y1 + 24, z + 5], color: 0xff2f26, size: 1.4, rate: 1.3 });
        }
      }
    }
    // 光井的边缘环 + 光柱
    for (const [ox, oz] of LIGHT_WELLS) {
      B.ring(ox, oz, 26, 28, y0 - 1, y1 + 3, M.CONC_2);
      B.ring(ox, oz, 25, 25, y0 - 2, y0 - 2, M.STRIP_W);
      data.lightShafts.push({ pos: [ox, 0, oz], r: 25, top: y0 });
    }
    // 巨柱列：两圈方形柱廊，穿过日常城市直达天盖
    for (const R of [140, 196]) {
      const lo = R === 140 ? -112 : -168;
      for (let t = lo; t <= -lo; t += 56) {
        for (const [x, z] of [[R, t], [-R, t], [t, R], [t, -R]]) {
          if (isAvenue(x, z) || isAvenue(x + 8, z + 8) || isAvenue(x - 8, z - 8)
            || isAvenue(x + 8, z - 8) || isAvenue(x - 8, z + 8)) continue;
          if (Math.abs(Math.abs(x) - C.TOWER_R) < 48 && Math.abs(z) < 48) continue;
          if (Math.abs(Math.abs(z) - C.TOWER_R) < 48 && Math.abs(x) < 48) continue;
          if (canopyOpen(x, z)) continue;
          B.colR(x, z, 6, C.PLINTH_BOT, y0 + 3, M.CONC_4);
          B.colR(x, z, 5, C.PLINTH_BOT, y0 + 3, M.CONC_3);
          // 柱头
          for (let i = 0; i < 5; i++) B.colR(x, z, 6 + i, y0 - 5 + i, y0 - 5 + i, M.CONC_2);
          // 柱脚警示环
          B.stripe(x - 7, 0, z - 7, x + 7, 5, z + 7, M.PAINT_YEL, M.IRON_BLACK, 4, 0);
          B.colR(x, z, 7, 6, 7, M.CONC_5);
          // 柱身竖槽 + 分节
          for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
            B.fill(x + dx, 8, z + dz, x + dx, y0 - 8, z + dz, M.CONC_5);
          }
          for (let y = 20; y < y0 - 10; y += 26) {
            B.colR(x, z, 7, y, y + 1, M.CONC_5);
            world.setC(x + 7, y + 3, z, M.NEON_AMB);
          }
        }
      }
    }
    data.annotations.push({ pos: [0, C.CANOPY_Y + 26, -190], title: '天盖', desc: '天空被建筑取代，只留下有节奏的光缝' });
  }

  // ————————————————————————————————————————————————————————————
  // 10. 深渊：巨构向下的另一半
  // ————————————————————————————————————————————————————————————
  function buildAbyss() {
    const x0 = 150, x1 = 240, z0 = -240, z1 = -150;
    // 井口周边清出观景平台（这一角的天盖也是敞开的）
    B.clear(136, 0, -248, 248, 128, -136);
    B.fill(136, C.SLAB_TOP - 2, -248, 248, C.SLAB_TOP, -136, M.CONC_3);
    for (let t = 136; t <= 248; t += 8) {
      B.fill(t, C.SLAB_TOP, -248, t, C.SLAB_TOP, -136, M.CONC_5);
      B.fill(136, C.SLAB_TOP, -248 + (t - 136), 248, C.SLAB_TOP, -248 + (t - 136), M.CONC_5);
    }
    B.clear(x0, C.PLINTH_BOT + 2, z0, x1, C.SLAB_TOP, z1);
    // 井壁分层
    for (let y = C.PLINTH_BOT + 2; y <= C.SLAB_TOP; y += 22) {
      B.fill(x0 - 3, y, z0 - 3, x1 + 3, y + 2, z1 + 3, M.CONC_5);
      B.clear(x0, y, z0, x1, y + 2, z1);
      B.fill(x0, y + 1, z0, x0, y + 1, z1, M.STRIP_COOL);
      B.fill(x1, y + 1, z0, x1, y + 1, z1, M.STRIP_COOL);
    }
    // 井中的巨柱与桁架
    for (const [px, pz] of [[x0 + 24, z0 + 24], [x1 - 24, z0 + 24], [x0 + 24, z1 - 24], [x1 - 24, z1 - 24], [(x0 + x1) >> 1, (z0 + z1) >> 1]]) {
      B.colR(px, pz, 7, C.PLINTH_BOT, 0, M.CONC_4);
      B.colR(px, pz, 5, C.PLINTH_BOT, 0, M.CONC_3);
      for (let y = C.PLINTH_BOT + 10; y < 0; y += 30) {
        B.colR(px, pz, 9, y, y + 2, M.CONC_5);
        world.setC(px + 9, y + 4, pz, M.NEON_RED);
      }
    }
    for (let y = C.PLINTH_BOT + 20; y < -20; y += 44) {
      B.crossBrace(2, z0 + 24, x0 + 24, x1 - 24, y, y + 40, M.STEEL_D, 3, 2);
      B.crossBrace(0, x0 + 24, z0 + 24, z1 - 24, y, y + 40, M.STEEL_D, 3, 2);
      B.fill(x0 + 24, y, z0 + 24, x1 - 24, y + 1, z1 - 24, M.STEEL_M);
      B.clear(x0 + 30, y, z0 + 30, x1 - 30, y + 1, z1 - 30);
    }
    // 井口栏杆 + 龙门吊
    for (let x = x0 - 2; x <= x1 + 2; x += 3) {
      B.fill(x, 1, z0 - 2, x, 3, z0 - 2, M.STEEL_D);
      B.fill(x, 1, z1 + 2, x, 3, z1 + 2, M.STEEL_D);
    }
    for (let z = z0 - 2; z <= z1 + 2; z += 3) {
      B.fill(x0 - 2, 1, z, x0 - 2, 3, z, M.STEEL_D);
      B.fill(x1 + 2, 1, z, x1 + 2, 3, z, M.STEEL_D);
    }
    B.fill(x0 - 2, 4, z0 - 2, x1 + 2, 4, z0 - 2, M.PAINT_YEL);
    B.fill(x0 - 2, 4, z1 + 2, x1 + 2, 4, z1 + 2, M.PAINT_YEL);
    B.fill(x0 - 2, 4, z0 - 2, x0 - 2, 4, z1 + 2, M.PAINT_YEL);
    B.fill(x1 + 2, 4, z0 - 2, x1 + 2, 4, z1 + 2, M.PAINT_YEL);
    B.fill(x0 - 6, 0, z0 + 30, x0 - 4, 40, z0 + 34, M.PAINT_ORANGE);
    B.fill(x1 + 4, 0, z0 + 30, x1 + 6, 40, z0 + 34, M.PAINT_ORANGE);
    B.fill(x0 - 6, 40, z0 + 30, x1 + 6, 43, z0 + 34, M.PAINT_ORANGE);
    B.fill((x0 + x1) >> 1, 20, z0 + 31, ((x0 + x1) >> 1) + 4, 39, z0 + 33, M.STEEL_D);
    data.annotations.push({ pos: [x0 - 10, 12, (z0 + z1) / 2], title: '深渊', desc: '巨构向下还有一半：190 体素深的结构与管道' });
  }

  // ————————————————————————————————————————————————————————————
  // 11. 道具锚点 / 视点
  // ————————————————————————————————————————————————————————————
  function buildAnchors() {
    // 行人路径（尺度参照物：人只有 3 体素高）
    for (let i = 0; i < 26; i++) {
      const along = rnd() < 0.5;
      const t = -H + 30 + rnd() * (2 * H - 60);
      const off = (rnd() * 2 - 1) * (C.AVENUE_HW - 4);
      if (along) data.pedPaths.push({ axis: 0, c: off, a0: -H + 20, a1: H - 20, y: 0, t });
      else data.pedPaths.push({ axis: 2, c: off, a0: -H + 20, a1: H - 20, y: 0, t });
    }
    for (let i = 0; i < 10; i++) {
      const r = 60 + rnd() * 26, a = rnd() * Math.PI * 2;
      data.pedPaths.push({ axis: rnd() < 0.5 ? 0 : 2, c: Math.round(Math.sin(a) * r), a0: -C.PLAZA_R, a1: C.PLAZA_R, y: 0, t: 0 });
    }
    // 车流
    for (const c of [-9, -4, 4, 9]) {
      data.carPaths.push({ axis: 0, c, y: 0, dir: c < 0 ? 1 : -1, count: 9 });
      data.carPaths.push({ axis: 2, c, y: 0, dir: c < 0 ? -1 : 1, count: 9 });
    }
    for (const c of [-C.DECK2]) void c;
    // 空中航线
    for (const y of [70, 150, 230, 330, 470, 700, 960]) {
      data.droneLanes.push({ axis: 0, y, span: H, count: 10, speed: 16 + rnd() * 26 });
      data.droneLanes.push({ axis: 2, y, span: H, count: 10, speed: 16 + rnd() * 26 });
    }
    const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
    data.viewpoints = [
      { id: 'orbit', name: '沙盘全景', mode: 'orbit', target: [0, 833, 0], dist: 2050, phi: 1.00, theta: 3.75, fov: 40 },
      { id: 'orbit-low', name: '逆光剪影', mode: 'orbit', target: [0, 700, 0], dist: 1750, phi: 1.52, theta: 0.72, fov: 48 },
      { id: 'approach', name: '① 进城 · 偏轴大道', mode: 'fps', pos: [-236, 3, -C.OFFSET_AVE], yaw: -Math.PI / 2 - 0.2, pitch: 0.24 },
      { id: 'gate', name: '② 巨门 · 穿过塔基', mode: 'fps', pos: [-240, 3, 2], yaw: -Math.PI / 2, pitch: 0.38 },
      { id: 'plaza', name: '③ 巨核广场', mode: 'fps', pos: [-70, 3, 70], yaw: yawTo(-70, 70, 0, 0), pitch: 0.56 },
      { id: 'canopy', name: '④ 天盖之下', mode: 'fps', pos: [68, 3, 150], yaw: 0, pitch: 0.30 },
      { id: 'abyss', name: '⑤ 深渊边缘', mode: 'fps', pos: [142, 3, -196], yaw: -Math.PI / 2, pitch: -0.45 },
      { id: 'span', name: '⑥ 巨跨甲板', mode: 'fps', pos: [64, 221, 0], yaw: -Math.PI / 2, pitch: 0.10 },
      { id: 'crown', name: '⑦ 云上环廊', mode: 'fps', pos: [-40, 1076, -40], yaw: yawTo(-40, -40, 0, 0), pitch: 0.20 },
    ];
    data.spawn = { pos: [-236, 3, -C.OFFSET_AVE], yaw: -Math.PI / 2 - 0.2 };
    data.annotations.push({ pos: [-236, 46, -C.OFFSET_AVE], title: '偏轴大道', desc: '22 体素宽、112 体素高的峡谷，尽头是巨核' });
    data.annotations.push({ pos: [0, 30, 0], title: '巨核', desc: '一个构筑物，而不是一群建筑：1436 体素，贯穿云层' });
    data.annotations.push({ pos: [-C.TOWER_R, 70, 0], title: '巨门', desc: '巨柱塔的塔基被掏空成城门，日常交通从结构中穿过' });
  }

  // ————————————————————————————————————————————————————————————
  // 步骤表
  // ————————————————————————————————————————————————————————————
  const steps = [
    ['规划街道与场地', () => { planStreets(); }],
    ['浇筑大地与沙盘基座', () => { buildDatum(); }],
    ['铺装街面与巨核广场', () => { paveGround(); }],
    ['生长日常城市（分层街区）', () => { buildDistrict(); }],
    ['架设空中连桥与街道家具', () => { buildSkybridges(); streetFurniture(); }],
    ['竖起巨核', () => { buildCore(); }],
    ['挑出环廊与飞扶壁', () => { buildPlatforms(); buildButtresses(); }],
    ['建造巨柱塔与插件舱', () => { buildTowers(); }],
    ['横跨巨跨与环梁', () => { buildSpans(); }],
    ['覆盖天盖（人造天空）', () => { buildCanopy(); }],
    ['立起升降塔', () => { buildLiftTowers(); }],
    ['开凿深渊', () => { buildAbyss(); }],
    ['安装顶冠与桅杆', () => { buildCrown(); }],
    ['标定视点与动态锚点', () => { buildAnchors(); }],
    ['统计体素', () => {
      const solid = world.computeFullness();
      data.stats = {
        solid,
        chunks: world.chunks.size,
        memoryMB: world.memoryMB(),
        bbox: [world.min.slice(), world.max.slice()],
      };
    }],
  ];

  return { world, data, steps, CFG: C };
}
