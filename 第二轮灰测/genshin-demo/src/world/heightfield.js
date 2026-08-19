// Authoritative world shape. Used by terrain meshing, collision, water, placement and AI.
import { simplex2, fbm2, ridged2 } from '../core/noise.js';
import { lerp, smoothstep, clamp } from '../core/utils.js';

export const WORLD = {
  size: 4096,          // full generated extent (ocean included)
  half: 2048,
  landRadius: 1500,    // coastline
  waterLevel: 0.0,
  villageCenter: { x: 0, z: 0 },
  villageRadius: 130,
  lake: { x: 520, z: 340, r: 210 },
};

/** Landmarks used by quests, map, teleport waypoints and props. */
export const REGIONS = [
  { id: 'mondstadt',  name: '风起地·蒙德城',   x: 0,     z: 0,     r: 150, biome: 'town',     desc: '自由之城，风神巴巴托斯的居所。' },
  { id: 'windrise',   name: '风起地大树',     x: -230,  z: 210,   r: 90,  biome: 'meadow',   desc: '巨树之下，风的低语最为清晰。' },
  { id: 'cider',      name: '晨曦酒庄',       x: -520,  z: -120,  r: 110, biome: 'meadow',   desc: '葡萄与麦酒的香气。' },
  { id: 'lake',       name: '塞西莉亚湖',     x: 520,   z: 340,   r: 220, biome: 'lake',     desc: '澄澈的湖水映着天光。' },
  { id: 'stormbearer','name': '奔狼领',       x: -820,  z: 520,   r: 200, biome: 'forest',   desc: '狼群与遗迹的领地。' },
  { id: 'dragonspine',name: '龙脊雪山',       x: -260,  z: -1080, r: 420, biome: 'snow',     desc: '终年不化的雪，掩埋着古国的秘密。' },
  { id: 'stonegate',  name: '石门峡谷',       x: 980,   z: -420,  r: 240, biome: 'canyon',   desc: '风蚀的岩柱之间藏着遗迹。' },
  { id: 'ruins',      name: '风龙废墟',       x: -1080, z: -420,  r: 260, biome: 'ruins',    desc: '被腐蚀的古老要塞。' },
  { id: 'beach',      name: '南风海岸',       x: 330,   z: 1640,  r: 300, biome: 'beach',    desc: '海浪与白沙，旅行者醒来的地方。' },
];

const V = WORLD.villageCenter, LK = WORLD.lake;

/** World height in metres at (x,z). Deterministic, no allocation. */
export function height(x, z) {
  const d = Math.sqrt(x * x + z * z);
  const land = 1 - smoothstep(WORLD.landRadius, WORLD.landRadius + 340, d);
  const shelf = 1 - smoothstep(WORLD.landRadius + 260, WORLD.landRadius + 900, d);

  let h = -26 + land * 48 + shelf * 4;
  h += fbm2(x * 0.00105, z * 0.00105, 4) * 27 * land;

  // ---- mountain belt: north + north-west arc, never near the village ----
  const belt = smoothstep(0.06, 0.60, fbm2(x * 0.00072 + 41.3, z * 0.00072 - 17.9, 3) * 0.5 + 0.5);
  const away = smoothstep(300, 860, Math.sqrt(x * x + (z + 220) * (z + 220)));
  const mMask = belt * away * land;
  h += ridged2(x * 0.00215, z * 0.00215, 6) * 182 * mMask;

  // ---- Dragonspine: a dedicated tall massif ----
  const dsD = Math.sqrt((x + 260) * (x + 260) + (z + 1080) * (z + 1080));
  const ds = 1 - smoothstep(120, 520, dsD);
  h += ds * (150 + ridged2(x * 0.0034, z * 0.0034, 5) * 120);

  // ---- Stonegate canyon: sharp pillars ----
  const cD = Math.sqrt((x - 980) * (x - 980) + (z + 420) * (z + 420));
  const cM = 1 - smoothstep(90, 300, cD);
  h += cM * (34 + Math.pow(ridged2(x * 0.0075 + 9.1, z * 0.0075 - 3.3, 4), 2.2) * 130);

  // ---- rolling mid hills + surface detail ----
  h += fbm2(x * 0.0072, z * 0.0072, 3) * 7.5 * land;
  h += fbm2(x * 0.0425, z * 0.0425, 2) * 0.95 * (0.35 + 0.65 * land);

  // ---- lake basin ----
  const lkT = (1 - smoothstep(LK.r * 0.42, LK.r, Math.sqrt((x - LK.x) * (x - LK.x) + (z - LK.z) * (z - LK.z)))) * 0.96;
  if (lkT > 0.001) h = lerp(h, -10 + fbm2(x * 0.011, z * 0.011, 2) * 3.4, lkT);

  // ---- village plateau ----
  const vpT = (1 - smoothstep(WORLD.villageRadius * 0.46, WORLD.villageRadius, Math.sqrt((x - V.x) * (x - V.x) + (z - V.z) * (z - V.z)))) * 0.94;
  if (vpT > 0.001) h = lerp(h, 23.5 + fbm2(x * 0.021, z * 0.021, 2) * 0.9, vpT);

  // ---- Windrise meadow: gentle bowl around the great tree ----
  const wrT = (1 - smoothstep(40, 105, Math.sqrt((x + 230) * (x + 230) + (z - 210) * (z - 210)))) * 0.8;
  if (wrT > 0.001) h = lerp(h, 17.0 + fbm2(x * 0.03, z * 0.03, 2) * 1.1, wrT);

  return h;
}

const _n = { x: 0, y: 1, z: 0 };
/** Surface normal via central differences. Reused object - copy if you keep it. */
export function normalAt(x, z, eps = 1.0) {
  const hL = height(x - eps, z), hR = height(x + eps, z);
  const hD = height(x, z - eps), hU = height(x, z + eps);
  const nx = hL - hR, ny = 2 * eps, nz = hD - hU;
  const l = Math.hypot(nx, ny, nz) || 1;
  _n.x = nx / l; _n.y = ny / l; _n.z = nz / l;
  return _n;
}

/** 0 = flat, 1 = vertical wall. */
export function slopeAt(x, z, eps = 1.2) { return 1 - normalAt(x, z, eps).y; }

/** Moisture drives grass tint + vegetation density. */
export function moistureAt(x, z) {
  const h = height(x, z);
  const base = fbm2(x * 0.0016 - 77, z * 0.0016 + 31, 3) * 0.5 + 0.5;
  const lakeBonus = 1 - smoothstep(LK.r * 0.6, LK.r * 2.2, Math.hypot(x - LK.x, z - LK.z));
  const dry = smoothstep(120, 260, h);
  return clamp(base * 0.85 + lakeBonus * 0.5 - dry * 0.7, 0, 1);
}

/** Dominant surface material at a point: grass | rock | sand | snow | dirt | water */
export function surfaceAt(x, z) {
  const h = height(x, z);
  if (h < WORLD.waterLevel - 0.25) return 'water';
  const s = slopeAt(x, z);
  if (h > 135 + fbm2(x * 0.01, z * 0.01, 2) * 22) return 'snow';
  if (s > 0.52) return 'rock';
  if (h < 3.2) return 'sand';
  const m = moistureAt(x, z);
  if (m < 0.22) return 'dirt';
  return 'grass';
}

/** Region containing a point (or null). */
export function regionAt(x, z) {
  let best = null, bestT = Infinity;
  for (const r of REGIONS) { const d = Math.hypot(x - r.x, z - r.z) / r.r; if (d < 1 && d < bestT) { bestT = d; best = r; } }
  return best;
}

/** Find a spawnable spot near (x,z): walkable slope, above water. */
export function findFlatSpot(x, z, rng, radius = 30, tries = 24) {
  let bx = x, bz = z, bestScore = -Infinity;
  for (let i = 0; i < tries; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const h = height(px, pz); if (h < WORLD.waterLevel + 0.6) continue;
    const score = -slopeAt(px, pz) * 10 + h * 0.001;
    if (score > bestScore) { bestScore = score; bx = px; bz = pz; }
  }
  return { x: bx, y: height(bx, bz), z: bz };
}
