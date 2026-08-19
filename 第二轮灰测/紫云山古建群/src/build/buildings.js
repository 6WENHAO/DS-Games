import { M } from '../voxel/palette.js';
import { buildRoof, buildSkirtRoof, buildOctRoof, octSlab, octRing, inOct } from './roof.js';
import {
  platform, hallBody, dougong, stairsZ, stairsX, railingSegment,
  doorPanel, windowPanel, plaque, lanternRow, hangLantern, spread
} from './parts.js';

/* =========================================================
 * ① 大雄宝殿 —— 重檐歇山顶，三重台基 + 月台，全场最大体量
 * ========================================================= */
export function buildMainHall(world, { cx = 0, cz = 104 } = {}) {
  const PH = 5;                                    // 台基高
  platform(world, { cx, cz, halfX: 30, halfZ: 23, y0: 0, height: PH });

  // ---- 月台（前）----
  const tz = cz - 27;                              // 月台中心 z
  platform(world, { cx, cz: tz, halfX: 22, halfZ: 4, y0: 0, height: PH - 1, waist: false });
  railingSegment(world, { axis: 'x', fixed: tz - 4, a0: cx - 22, a1: cx + 22, y: PH - 1, skip: [cx - 8, cx + 8] });
  railingSegment(world, { axis: 'z', fixed: cx - 22, a0: tz - 4, a1: tz + 3, y: PH - 1 });
  railingSegment(world, { axis: 'z', fixed: cx + 22, a0: tz - 4, a1: tz + 3, y: PH - 1 });

  // ---- 踏道：庭院 → 月台 ----
  stairsZ(world, { cx, zStart: tz - 5, yTop: PH - 1, width: 17, steps: 4, dir: -1 });
  // 月台 → 台基（一步之差）
  world.slab(cx - 4, cz - 23, cx + 4, cz - 23, PH - 1, M.MARBLE_DARK);

  // ---- 首层殿身 ----
  const t1 = hallBody(world, {
    cx, cz, halfX: 22, halfZ: 15, y0: PH, height: 14, colStep: 5,
    front: '-z', doorHalf: 4, doorHeight: 9
  });
  const d1 = dougong(world, { cx, cz, halfX: 22, halfZ: 15, y: t1 + 1, colStep: 5 });

  // ---- 下檐（重檐之腰檐）----
  buildSkirtRoof(world, { cx, cz, y: d1, halfX: 28, halfZ: 21, layers: 5, tiles: 'gold', upturn: 4 });
  const deck = d1 + 4;
  world.box(cx - 24, deck, cz - 17, cx + 24, deck, cz + 17, M.TILE_GOLD);

  // 檐下宫灯
  lanternRow(world, { axis: 'x', fixed: cz - 20, a0: cx - 18, a1: cx + 18, y: d1 - 2, step: 9, len: 2 });

  // ---- 二层殿身 ----
  const t2 = hallBody(world, {
    cx, cz, halfX: 18, halfZ: 12, y0: deck + 1, height: 8, colStep: 6,
    front: '-z', doorHalf: 3, doorHeight: 5, plaqueOn: true
  });
  const d2 = dougong(world, { cx, cz, halfX: 18, halfZ: 12, y: t2 + 1, colStep: 6 });

  // ---- 上檐：歇山顶 ----
  const r = buildRoof(world, {
    cx, cz, y: d2, halfX: 24, halfZ: 17, layers: 15,
    ridgeAxis: 'x', hipInset: 9, tiles: 'gold', upturn: 4, curve: 1.75
  });
  return { name: '大雄宝殿', cx, cz, top: r.top };
}

/* =========================================================
 * ② 东西配殿 —— 歇山顶，正脊沿 z，门朝中轴
 * ========================================================= */
export function buildSideHall(world, { cx, cz = 74, side = -1 } = {}) {
  const PH = 3;
  platform(world, { cx, cz, halfX: 13, halfZ: 22, y0: 0, height: PH });

  const front = side < 0 ? '+x' : '-x';            // 朝院内
  const t = hallBody(world, {
    cx, cz, halfX: 10, halfZ: 19, y0: PH, height: 12, colStep: 5,
    front, doorHalf: 3, doorHeight: 8
  });
  const d = dougong(world, { cx, cz, halfX: 10, halfZ: 19, y: t + 1, colStep: 5 });

  buildRoof(world, {
    cx, cz, y: d, halfX: 14, halfZ: 22, layers: 12,
    ridgeAxis: 'z', hipInset: 8, tiles: 'green', upturn: 3, curve: 1.7
  });

  // 踏道朝内
  const xEdge = cx - side * 13;
  stairsX(world, { cz, xStart: xEdge - side * 1, yTop: PH, width: 11, steps: 3, dir: -side });

  // 檐下灯笼
  lanternRow(world, {
    axis: 'z', fixed: cx - side * 12, a0: cz - 14, a1: cz + 14, y: d - 2, step: 9, len: 2
  });
  return { name: side < 0 ? '西配殿' : '东配殿', cx, cz };
}

/* =========================================================
 * ③ 山门 —— 庑殿顶，三门洞
 * ========================================================= */
export function buildGate(world, { cx = 0, cz = 14 } = {}) {
  const PH = 2;
  platform(world, { cx, cz, halfX: 19, halfZ: 11, y0: 0, height: PH, waist: false });

  const t = hallBody(world, {
    cx, cz, halfX: 16, halfZ: 8, y0: PH, height: 9, colStep: 4,
    front: '-z', doorHalf: 3, doorHeight: 7
  });

  const wz0 = cz - 7, wz1 = cz + 7;

  // 中央门洞打通（可望见庭院与主殿）
  world.clearBox(cx - 3, PH, wz0, cx + 3, PH + 7, wz1);
  for (const z of [wz0, wz1]) {
    world.box(cx - 4, PH, z, cx - 4, PH + 8, z, M.WOOD_DARK);
    world.box(cx + 4, PH, z, cx + 4, PH + 8, z, M.WOOD_DARK);
    world.box(cx - 4, PH + 8, z, cx + 4, PH + 8, z, M.WOOD_DARK);
  }
  world.box(cx - 3, PH - 1, wz0 - 1, cx + 3, PH - 1, wz1 + 1, M.MARBLE);  // 门道地面

  // 两侧掖门（朱漆板门）
  for (const s of [-1, 1]) {
    const a0 = cx + s * 8, a1 = cx + s * 12;
    world.clearBox(Math.min(a0, a1), PH, wz0, Math.max(a0, a1), PH + 6, wz0);
    doorPanel(world, {
      axis: 'x', fixed: wz0, a0: Math.min(a0, a1), a1: Math.max(a0, a1),
      yFrom: PH, yTo: PH + 6
    });
  }

  const d = dougong(world, { cx, cz, halfX: 16, halfZ: 8, y: t + 1, colStep: 4 });
  buildRoof(world, {
    cx, cz, y: d, halfX: 21, halfZ: 13, layers: 11,
    ridgeAxis: 'x', hipInset: null, tiles: 'grey', upturn: 3, curve: 1.7
  });

  // 檐下灯笼 + 前踏道
  lanternRow(world, { axis: 'x', fixed: cz - 12, a0: cx - 12, a1: cx + 12, y: d - 2, step: 8, len: 2 });
  stairsZ(world, { cx, zStart: cz - 12, yTop: PH, width: 15, steps: 2, dir: -1 });
  stairsZ(world, { cx, zStart: cz + 12, yTop: PH, width: 15, steps: 2, dir: 1, royal: null });
  return { name: '山门', cx, cz };
}

/* =========================================================
 * ④ 钟楼 / 鼓楼 —— 两层重檐攒尖顶
 * ========================================================= */
export function buildTower(world, { cx, cz = 40, side = -1, kind = 'bell' } = {}) {
  const PH = 3;
  platform(world, { cx, cz, halfX: 11, halfZ: 11, y0: 0, height: PH });

  const front = side < 0 ? '+x' : '-x';
  const t1 = hallBody(world, {
    cx, cz, halfX: 8, halfZ: 8, y0: PH, height: 9, colStep: 4,
    front, doorHalf: 2, doorHeight: 6, plaqueOn: false
  });
  const d1 = dougong(world, { cx, cz, halfX: 8, halfZ: 8, y: t1 + 1, colStep: 4 });
  buildSkirtRoof(world, { cx, cz, y: d1, halfX: 12, halfZ: 12, layers: 4, tiles: 'green', upturn: 3 });

  // 二层平坐（露台）
  const deck = d1 + 4;
  world.box(cx - 9, deck, cz - 9, cx + 9, deck, cz + 9, M.WOOD);
  for (const s of [-1, 1]) {
    railingSegment(world, { axis: 'x', fixed: cz + s * 9, a0: cx - 9, a1: cx + 9, y: deck + 1 });
    railingSegment(world, { axis: 'z', fixed: cx + s * 9, a0: cz - 9, a1: cz + 9, y: deck + 1 });
  }

  // 二层敞轩
  const t2 = hallBody(world, {
    cx, cz, halfX: 7, halfZ: 7, y0: deck + 1, height: 7, colStep: 3,
    openPavilion: true, floor: M.WOOD
  });
  // 楣子（柱间挂落）
  world.ring(cx - 7, cz - 7, cx + 7, cz + 7, t2 - 1, M.WALL_RED, 1);
  world.ring(cx - 7, cz - 7, cx + 7, cz + 7, deck + 1, M.WOOD_DARK, 1);

  // 钟 / 鼓
  const by = t2 - 2;
  if (kind === 'bell') {
    world.box(cx - 1, by - 4, cz - 1, cx + 1, by - 1, cz + 1, M.BRONZE);
    world.box(cx - 2, by - 4, cz - 2, cx + 2, by - 4, cz + 2, M.BRONZE);
    world.box(cx, by, cz, cx, by, cz, M.WOOD_DARK);
  } else {
    world.box(cx - 2, by - 4, cz - 1, cx + 2, by - 2, cz + 1, M.WALL_RED);
    world.box(cx - 2, by - 3, cz - 2, cx + 2, by - 3, cz + 2, M.WALL_RED);
    world.box(cx - 2, by - 5, cz - 1, cx + 2, by - 5, cz + 1, M.BRONZE);
    world.box(cx - 2, by - 1, cz - 1, cx + 2, by - 1, cz + 1, M.BRONZE);
    world.box(cx - 3, by - 5, cz, cx - 3, by - 1, cz, M.WOOD_DARK);
    world.box(cx + 3, by - 5, cz, cx + 3, by - 1, cz, M.WOOD_DARK);
  }

  const d2 = dougong(world, { cx, cz, halfX: 7, halfZ: 7, y: t2 + 1, colStep: 3 });
  const r = buildRoof(world, {
    cx, cz, y: d2, halfX: 10, halfZ: 10, layers: 11,
    ridgeAxis: 'x', hipInset: null, tiles: 'green',
    ridge: false, upturn: 3, spire: 5, curve: 1.6
  });

  // 四角挂灯
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) hangLantern(world, cx + sx * 8, d1 - 2, cz + sz * 8, 2);
  stairsX(world, { cz, xStart: cx - side * 11, yTop: PH, width: 7, steps: 3, dir: -side });
  return { name: kind === 'bell' ? '钟楼' : '鼓楼', cx, cz, top: r.top };
}

/* =========================================================
 * ⑤ 七级浮屠 —— 八角密檐宝塔
 * ========================================================= */
export function buildPagoda(world, { cx = 0, cz = 142 } = {}) {
  // 八角须弥座
  for (let h = 0; h < 4; h++) {
    octSlab(world, cx, cz, h, h === 3 ? 14 : 15 - h, h === 3 ? M.MARBLE : M.STONE);
  }
  for (let d = -14; d <= 14; d++) {
    if (inOct(d, 14, 14)) world.set(cx + d, 3, cz + 14, M.MARBLE_DARK);
    if (inOct(d, -14, 14)) world.set(cx + d, 3, cz - 14, M.MARBLE_DARK);
  }
  stairsZ(world, { cx, zStart: cz - 15, yTop: 4, width: 9, steps: 4, dir: -1 });

  const radii = [11, 10, 9, 8, 7, 6, 5];
  let y = 4;
  radii.forEach((r, i) => {
    const h = 4;
    // 塔身
    octRing(world, cx, cz, y, y + h - 1, r, i % 2 === 0 ? M.WALL_RED : M.WALL_RED_DARK, 1);
    octSlab(world, cx, cz, y - 1, r - 1, M.WOOD_DARK);          // 楼板
    // 平座木栏
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        if (inOct(dx, dz, r) && !inOct(dx, dz, r - 1) && (dx + dz) % 2 === 0)
          world.set(cx + dx, y + h - 1, cz + dz, M.WOOD);

        // 四面壶门 / 券窗
    if (i === 0) {
      doorPanel(world, { axis: 'x', fixed: cz - r, a0: cx - 2, a1: cx + 2, yFrom: y, yTo: y + 3 });
    } else {
      windowPanel(world, { axis: 'x', fixed: cz - r, a0: cx - 1, a1: cx + 1, yFrom: y + 1, yTo: y + 3 });
      windowPanel(world, { axis: 'x', fixed: cz + r, a0: cx - 1, a1: cx + 1, yFrom: y + 1, yTo: y + 3 });
    }
    windowPanel(world, { axis: 'z', fixed: cx - r, a0: cz - 1, a1: cz + 1, yFrom: y + 1, yTo: y + 3 });
    windowPanel(world, { axis: 'z', fixed: cx + r, a0: cz - 1, a1: cz + 1, yFrom: y + 1, yTo: y + 3 });

    // 腰檐
    buildOctRoof(world, {
      cx, cz, y: y + h, r: r + 3, layers: 3,
      tiles: i % 2 === 0 ? 'gold' : 'grey', upturn: 2
    });
    // 檐角风铃
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const d = Math.round((r + 3) * 0.7);
      hangLantern(world, cx + sx * d, y + h - 2, cz + sz * d, 1);
    }
    y += h + 3;
  });

  // 八角攒尖顶 + 塔刹
  const r = buildOctRoof(world, {
    cx, cz, y, r: 8, layers: 8, tiles: 'gold', cap: true, upturn: 3, spire: 6
  });
  return { name: '七级浮屠', cx, cz, top: r.top };
}

/* =========================================================
 * ⑥ 院墙 —— 红墙青瓦，压顶出檐
 * ========================================================= */
export function wallRun(world, { x0, z0, x1, z1, height = 8 }) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
  const az = Math.min(z0, z1), bz = Math.max(z0, z1);
  world.box(ax, 0, az, bx, height - 1, bz, M.WALL_RED);
  world.box(ax, height - 3, az, bx, height - 3, bz, M.WALL_RED_DARK);
  // 瓦顶（出檐一格）
  world.box(ax - 1, height, az - 1, bx + 1, height, bz + 1, M.TILE_GREY);
  const midX = Math.round((ax + bx) / 2), midZ = Math.round((az + bz) / 2);
  if (bx - ax > bz - az) world.box(ax - 1, height + 1, midZ, bx + 1, height + 1, midZ, M.TILE_GREY_RIB);
  else world.box(midX, height + 1, az - 1, midX, height + 1, bz + 1, M.TILE_GREY_RIB);
}
