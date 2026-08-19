import { M } from '../voxel/palette.js';
import { VoxelWorld } from '../voxel/VoxelWorld.js';
import {
  buildMainHall, buildSideHall, buildGate, buildTower, buildPagoda, wallRun
} from './buildings.js';
import {
  stoneLion, huabiao, pineTree, broadTree, censer, rockery, pond, cloud, bannerPole
} from './props.js';

/* ---------------- 场地尺度（单位 = 1 体素） ---------------- */
export const SITE = {
  wallX: 64,
  wallZ0: 4,
  wallZ1: 163,
  ground: { x0: -76, x1: 76, z0: -18, z1: 176 },
  gate: { cz: 14 },
  tower: { cx: 44, cz: 32 },
  sideHall: { cx: 44, cz: 68 },
  mainHall: { cz: 100 },
  pagoda: { cz: 147 },
  road: { half: 7, z0: 6, z1: 70 }
};

/* ---------------- 确定性随机 ---------------- */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noise = (x, z) => {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/* ---------------- 地面 ---------------- */
function layGround(world) {
  const g = SITE.ground;
  for (let x = g.x0; x <= g.x1; x++) {
    for (let z = g.z0; z <= g.z1; z++) {
      const patch = Math.sin(x * 0.085) * Math.cos(z * 0.062) + (noise(x, z) - 0.5) * 0.5;
      const mat = patch > 0.42 ? M.GRASS_DARK : patch < -0.45 ? M.MOSS : M.GRASS;
      world.set(x, 0, z, mat);
    }
  }
}

/** 石板铺装（3×3 板材棋格） */
function pave(world, x0, z0, x1, z1, base = M.PAVE, alt = M.PAVE_DARK) {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const bx = Math.floor((x + 999) / 3);
      const bz = Math.floor((z + 999) / 3);
      let mat = (bx + bz) % 2 === 0 ? base : alt;
      if (noise(x * 3, z * 3) > 0.965) mat = M.MOSS;             // 缝隙青苔
      world.set(x, 0, z, mat);
    }
}

/** 御道 */
function royalRoad(world, x0, z0, x1, z1, axis = 'z') {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const onEdge = axis === 'z' ? x === x0 || x === x1 : z === z0 || z === z1;
      let mat = M.PAVE_LIGHT;
      if (onEdge) mat = M.MARBLE_DARK;
      else if (axis === 'z' && z % 5 === 0) mat = M.MARBLE;
      else if (axis === 'x' && x % 5 === 0) mat = M.MARBLE;
      world.set(x, 0, z, mat);
    }
}

function grassPatch(world, x0, z0, x1, z1) {
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const n = noise(x * 1.7, z * 1.3);
      world.set(x, 0, z, n > 0.72 ? M.GRASS_DARK : n < 0.12 ? M.MOSS : M.GRASS);
    }
}

/** 石灯柱 */
function stoneLamp(world, x, z, y = 0) {
  world.box(x - 1, y, z - 1, x + 1, y, z + 1, M.MARBLE_DARK);
  world.box(x, y + 1, z, x, y + 3, z, M.MARBLE);
  world.box(x - 1, y + 4, z - 1, x + 1, y + 4, z + 1, M.MARBLE_DARK);
  world.set(x, y + 5, z, M.LANTERN);
  world.box(x - 1, y + 6, z - 1, x + 1, y + 6, z + 1, M.TILE_GREY);
  world.set(x, y + 7, z, M.GOLD);
}

/* ---------------- 种植 ---------------- */
function canPlant(world, x, z, clearance = 3) {
  const g = world.get(x, 0, z);
  if (g !== M.GRASS && g !== M.GRASS_DARK && g !== M.MOSS && g !== M.SOIL) return false;
  for (let dx = -clearance; dx <= clearance; dx++)
    for (let dz = -clearance; dz <= clearance; dz++) {
      if (world.has(x + dx, 1, z + dz) || world.has(x + dx, 4, z + dz)) return false;
    }
  return true;
}

function plantZone(world, rand, { x0, z0, x1, z1, count, kind = 'mix' }) {
  let placed = 0;
  for (let i = 0; i < count * 14 && placed < count; i++) {
    const x = Math.round(x0 + rand() * (x1 - x0));
    const z = Math.round(z0 + rand() * (z1 - z0));
    if (!canPlant(world, x, z, 4)) continue;
    const pick = kind === 'mix' ? rand() : kind === 'pine' ? 0 : 1;
    if (pick < 0.55) {
      pineTree(world, x, z, { height: 8 + Math.floor(rand() * 6), r0: 3 + Math.floor(rand() * 2) });
    } else {
      broadTree(world, x, z, {
        height: 7 + Math.floor(rand() * 4),
        r: 3 + Math.floor(rand() * 2),
        warm: rand() > 0.6
      });
    }
    placed++;
  }
  return placed;
}

/* =========================================================
 *                        场景总装
 * ========================================================= */
export function buildSite() {
  const world = new VoxelWorld();
  const rand = rng(20240819);
  const buildings = [];

  /* ---- 1. 地面 ---- */
  layGround(world);

  // 院内铺装
  pave(world, -62, 6, 62, 161);
  // 院外前导广场 + 香道
  pave(world, -22, SITE.ground.z0 + 2, 22, 3, M.PAVE_DARK, M.PAVE);
  royalRoad(world, -9, SITE.ground.z0 + 2, 9, 3);

  // 院内绿化区
  grassPatch(world, -61, 6, -22, 20);
  grassPatch(world, 22, 6, 61, 20);
  grassPatch(world, -61, 47, -20, 66);
  grassPatch(world, 20, 47, 61, 66);
  grassPatch(world, -61, 124, -16, 161);
  grassPatch(world, 16, 124, 61, 161);
  grassPatch(world, -61, 92, -32, 120);
  grassPatch(world, 32, 92, 61, 120);

  /* ---- 2. 动线：山门 → 庭院 → 主殿 → 塔 ---- */
  royalRoad(world, -SITE.road.half, SITE.road.z0, SITE.road.half, 78);       // 中轴御道
  royalRoad(world, -SITE.road.half, 121, SITE.road.half, 158);               // 后院甬道
  royalRoad(world, -34, 29, -8, 35, 'x');                                    // 通钟楼
  royalRoad(world, 8, 29, 34, 35, 'x');                                      // 通鼓楼
  royalRoad(world, -30, 63, -8, 73, 'x');                                    // 通西配殿
  royalRoad(world, 8, 63, 30, 73, 'x');                                      // 通东配殿
  pave(world, -32, 74, 32, 122, M.PAVE_LIGHT, M.PAVE);                       // 主殿前庭
  royalRoad(world, -13, 121, 13, 134, 'z');                                  // 塔前

  /* ---- 3. 院墙 ---- */
  const W = SITE.wallX;
  wallRun(world, { x0: 20, z0: SITE.wallZ0, x1: W, z1: SITE.wallZ0 + 1 });
  wallRun(world, { x0: -W, z0: SITE.wallZ0, x1: -20, z1: SITE.wallZ0 + 1 });
  wallRun(world, { x0: W - 1, z0: SITE.wallZ0, x1: W, z1: SITE.wallZ1 });
  wallRun(world, { x0: -W, z0: SITE.wallZ0, x1: -W + 1, z1: SITE.wallZ1 });
  wallRun(world, { x0: -W, z0: SITE.wallZ1 - 1, x1: W, z1: SITE.wallZ1 });

  /* ---- 4. 建筑群 ---- */
  buildings.push(buildGate(world, { cx: 0, cz: SITE.gate.cz }));
  buildings.push(buildTower(world, { cx: -SITE.tower.cx, cz: SITE.tower.cz, side: -1, kind: 'bell' }));
  buildings.push(buildTower(world, { cx: SITE.tower.cx, cz: SITE.tower.cz, side: 1, kind: 'drum' }));
  buildings.push(buildSideHall(world, { cx: -SITE.sideHall.cx, cz: SITE.sideHall.cz, side: -1 }));
  buildings.push(buildSideHall(world, { cx: SITE.sideHall.cx, cz: SITE.sideHall.cz, side: 1 }));
  buildings.push(buildMainHall(world, { cx: 0, cz: SITE.mainHall.cz }));
  buildings.push(buildPagoda(world, { cx: 0, cz: SITE.pagoda.cz }));

  /* ---- 5. 陈设 ---- */
  stoneLion(world, { x: -13, z: -1, face: -1 });
  stoneLion(world, { x: 13, z: -1, face: -1 });
  huabiao(world, { x: -19, z: -9, height: 17 });
  huabiao(world, { x: 19, z: -9, height: 17 });
  censer(world, { x: 0, z: 56 });
  bannerPole(world, { x: -20, z: 84, height: 20 });
  bannerPole(world, { x: 20, z: 84, height: 20 });

  pond(world, { x0: -52, z0: 7, x1: -40, z1: 18 });
  pond(world, { x0: 40, z0: 7, x1: 52, z1: 18 });
  rockery(world, { x: -46, z: 24, r: 4, h: 8 });
  rockery(world, { x: 46, z: 24, r: 4, h: 8 });
  rockery(world, { x: -50, z: 140, r: 5, h: 9 });
  rockery(world, { x: 50, z: 140, r: 5, h: 9 });

  // 御道两侧石灯
  for (let z = 24; z <= 68; z += 14) {
    stoneLamp(world, -11, z);
    stoneLamp(world, 11, z);
  }
  for (const z of [128, 142, 156]) {
    stoneLamp(world, -17, z);
    stoneLamp(world, 17, z);
  }

  /* ---- 6. 植栽 ---- */
  plantZone(world, rand, { x0: -60, z0: 8, x1: -24, z1: 20, count: 5 });
  plantZone(world, rand, { x0: 24, z0: 8, x1: 60, z1: 20, count: 5 });
  plantZone(world, rand, { x0: -60, z0: 48, x1: -22, z1: 66, count: 6 });
  plantZone(world, rand, { x0: 22, z0: 48, x1: 60, z1: 66, count: 6 });
  plantZone(world, rand, { x0: -60, z0: 94, x1: -34, z1: 120, count: 6, kind: 'pine' });
  plantZone(world, rand, { x0: 34, z0: 94, x1: 60, z1: 120, count: 6, kind: 'pine' });
  plantZone(world, rand, { x0: -58, z0: 126, x1: -18, z1: 158, count: 7 });
  plantZone(world, rand, { x0: 18, z0: 126, x1: 58, z1: 158, count: 7 });
  // 院外林带
  plantZone(world, rand, { x0: -74, z0: -16, x1: -68, z1: 172, count: 16, kind: 'pine' });
  plantZone(world, rand, { x0: 68, z0: -16, x1: 74, z1: 172, count: 16, kind: 'pine' });
  plantZone(world, rand, { x0: -74, z0: -16, x1: 74, z1: -4, count: 12 });
  plantZone(world, rand, { x0: -74, z0: 168, x1: 74, z1: 174, count: 10, kind: 'pine' });

  /* ---- 7. 体素云 ---- */
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const c = {
      x: Math.round(-70 + rand() * 140),
      y: 118 + Math.round(rand() * 26),
      z: Math.round(-10 + rand() * 190),
      w: 6 + Math.round(rand() * 6),
      d: 4 + Math.round(rand() * 3),
      h: 2
    };
    cloud(world, c);
    clouds.push(c);
  }

  return {
    world,
    buildings,
    focus: { x: 0, y: 24, z: 84 },
    bounds: SITE.ground
  };
}
