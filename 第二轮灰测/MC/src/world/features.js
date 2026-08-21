/**
 * world/features.js
 * ------------------------------------------------------------------
 * Decoration: trees, cacti, tall grass, flowers, sugar cane and ore
 * veins.
 *
 * Cross-chunk seams are avoided by making every placement decision a
 * pure function of the world coordinate and the seed. When chunk A
 * generates, it also evaluates the columns of its neighbours that are
 * within a feature's radius and stamps whatever part of that feature
 * falls inside A. Chunk B independently makes the identical decision and
 * stamps its own half, so trees straddle borders seamlessly without any
 * inter-chunk messaging.
 */

import { B, blockId } from './blocks.js';
import { TREE } from './biomes.js';
import { mulberry32, hashSeed } from './noise.js';

/** Largest horizontal reach of any feature, in blocks. */
export const FEATURE_RADIUS = 4;
/** Tallest feature, used to clamp vertical writes. */
export const FEATURE_HEIGHT = 24;

const OAK_SAPLING = B.OAK_SAPLING;
void OAK_SAPLING;

/* ------------------------------------------------------------------ */
/* deterministic per-column randomness                                */
/* ------------------------------------------------------------------ */

/**
 * Stable 32-bit hash of a world column plus a salt. Used both to decide
 * whether a feature exists and to seed its shape, so a feature looks the
 * same no matter which chunk stamps it.
 */
export function columnHash(seed, x, z, salt) {
  let h = seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform float in [0,1) from a column hash. */
export const hashFloat = (h) => (h >>> 8) / 16777216;

/* ------------------------------------------------------------------ */
/* tree slot selection                                                */
/* ------------------------------------------------------------------ */

/**
 * Tree placement is two-stage, which is what keeps forests looking like
 * forests instead of thickets:
 *
 *   1. **spacing** - a biome-independent dart-throwing pass picks evenly
 *      spread "slots". Every column rolls a candidate value, and a
 *      candidate only wins if no stronger candidate sits within
 *      TREE_SPACING blocks. That is a deterministic Poisson-disk style
 *      filter, so no two trunks can ever be adjacent;
 *   2. **density** - each winning slot then grows a tree with the biome's
 *      own probability.
 *
 * Separating the two means biome density can be tuned to vanilla's
 * trees-per-chunk figures without ever producing touching trunks, and
 * because both stages are pure functions of the world coordinate the
 * result is still seamless across chunk borders.
 */
export const TREE_SPACING = 2;
/**
 * Probability that a column is a spacing candidate. With a 5x5 exclusion
 * window this yields roughly ten slots per chunk, matching the number of
 * tree attempts vanilla makes in a forest.
 */
const CANDIDATE_RATE = 0.13;
const SALT_SLOT = 0x7a3e5;
const SALT_DENSITY = 0x1d3f7;

/**
 * True when this column is the winning tree slot in its neighbourhood.
 * @param {number} seed
 * @param {number} x @param {number} z world coordinates
 */
export function isTreeSlot(seed, x, z) {
  const h = columnHash(seed, x, z, SALT_SLOT);
  if (hashFloat(h) >= CANDIDATE_RATE) return false;
  for (let dz = -TREE_SPACING; dz <= TREE_SPACING; dz++) {
    for (let dx = -TREE_SPACING; dx <= TREE_SPACING; dx++) {
      if (dx === 0 && dz === 0) continue;
      const nh = columnHash(seed, x + dx, z + dz, SALT_SLOT);
      if (hashFloat(nh) >= CANDIDATE_RATE) continue;   // not a candidate
      // Strongest candidate in the window wins; ties break on coordinates
      // so exactly one column can ever be chosen.
      if (nh > h || (nh === h && (dz < 0 || (dz === 0 && dx < 0)))) return false;
    }
  }
  return true;
}

/**
 * Second stage: does this slot actually grow a tree in this biome?
 * @param {number} density biome trees-per-slot probability, 0..1
 */
export function slotGrowsTree(seed, x, z, density) {
  if (density <= 0) return false;
  if (density >= 1) return true;
  return hashFloat(columnHash(seed, x, z, SALT_DENSITY)) < density;
}

/* ------------------------------------------------------------------ */
/* tree shapes                                                        */
/* ------------------------------------------------------------------ */

const LOGS = {
  oak: B.OAK_LOG, big_oak: B.OAK_LOG, birch: B.BIRCH_LOG, spruce: B.SPRUCE_LOG,
  pine: B.SPRUCE_LOG, jungle: B.JUNGLE_LOG, acacia: B.ACACIA_LOG,
  dark_oak: B.DARK_OAK_LOG, swamp_oak: B.OAK_LOG, dead: B.OAK_LOG,
};
const LEAVES = {
  oak: B.OAK_LEAVES, big_oak: B.OAK_LEAVES, birch: B.BIRCH_LEAVES, spruce: B.SPRUCE_LEAVES,
  pine: B.SPRUCE_LEAVES, jungle: B.JUNGLE_LEAVES, acacia: B.ACACIA_LEAVES,
  dark_oak: B.DARK_OAK_LEAVES, swamp_oak: B.OAK_LEAVES, dead: B.OAK_LEAVES,
};

/**
 * Stamps a tree of the given species.
 * @param {object} w  ColumnWriter-like sink with set(x,y,z,id,soft)
 * @param {number} x  world x of the trunk
 * @param {number} y  world y of the block the trunk stands on
 * @param {number} z  world z of the trunk
 * @param {string} species
 * @param {() => number} rand deterministic RNG for this tree
 */
export function stampTree(w, x, y, z, species, rand) {
  const log = LOGS[species] ?? B.OAK_LOG;
  const leaf = LEAVES[species] ?? B.OAK_LEAVES;
  switch (species) {
    case TREE.SPRUCE: return spruceTree(w, x, y, z, log, leaf, rand);
    case TREE.PINE: return pineTree(w, x, y, z, log, leaf, rand);
    case TREE.BIRCH: return classicTree(w, x, y, z, log, leaf, rand, 6, 8);
    case TREE.JUNGLE: return jungleTree(w, x, y, z, log, leaf, rand);
    case TREE.ACACIA: return acaciaTree(w, x, y, z, log, leaf, rand);
    case TREE.DARK_OAK: return darkOakTree(w, x, y, z, log, leaf, rand);
    case TREE.SWAMP_OAK: return swampTree(w, x, y, z, log, leaf, rand);
    case TREE.BIG_OAK: return classicTree(w, x, y, z, log, leaf, rand, 7, 9);
    case TREE.CACTUS: return cactus(w, x, y, z, rand);
    case TREE.DEAD: return deadTree(w, x, y, z, log, rand);
    default: return classicTree(w, x, y, z, log, leaf, rand, 4, 7);
  }
}

/** Vanilla oak/birch: straight trunk, two wide leaf rings then a cap. */
function classicTree(w, x, y, z, log, leaf, rand, minH, maxH) {
  const h = minH + Math.floor(rand() * (maxH - minH + 1));
  const top = y + h;
  for (let i = 1; i <= h; i++) w.set(x, y + i, z, log);
  // two wide rings
  for (let dy = -2; dy <= -1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && rand() < 0.6) continue;
        w.set(x + dx, top + dy, z + dz, leaf, true);
      }
    }
  }
  // narrow ring
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      w.set(x + dx, top, z + dz, leaf, true);
    }
  }
  w.set(x, top + 1, z, leaf, true);
  if (rand() < 0.5) w.set(x + 1, top + 1, z, leaf, true);
  if (rand() < 0.5) w.set(x - 1, top + 1, z, leaf, true);
  if (rand() < 0.5) w.set(x, top + 1, z + 1, leaf, true);
  if (rand() < 0.5) w.set(x, top + 1, z - 1, leaf, true);
}

/** Conical spruce with alternating wide/narrow layers. */
function spruceTree(w, x, y, z, log, leaf, rand) {
  const h = 7 + Math.floor(rand() * 5);
  for (let i = 1; i <= h; i++) w.set(x, y + i, z, log);
  let radius = 0;
  for (let dy = h; dy >= 2; dy--) {
    const layer = h - dy;
    radius = layer % 3 === 0 ? Math.min(2, Math.floor(layer / 3) + 1) : Math.max(0, radius - 1);
    const r = Math.min(radius, 2);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && r === 2) continue;
        w.set(x + dx, y + dy, z + dz, leaf, true);
      }
    }
  }
  w.set(x, y + h + 1, z, leaf, true);
}

/** Tall snowy pine: bare trunk with a small crown. */
function pineTree(w, x, y, z, log, leaf, rand) {
  const h = 9 + Math.floor(rand() * 6);
  for (let i = 1; i <= h; i++) w.set(x, y + i, z, log);
  for (let dy = h - 4; dy <= h; dy++) {
    const r = dy >= h - 1 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        w.set(x + dx, y + dy, z + dz, leaf, true);
      }
    }
  }
  w.set(x, y + h + 1, z, leaf, true);
}

/** Jungle: tall, thick canopy, occasional vines-free 2x2 trunk. */
function jungleTree(w, x, y, z, log, leaf, rand) {
  const h = 9 + Math.floor(rand() * 9);
  const thick = rand() < 0.25;
  for (let i = 1; i <= h; i++) {
    w.set(x, y + i, z, log);
    if (thick) {
      w.set(x + 1, y + i, z, log);
      w.set(x, y + i, z + 1, log);
      w.set(x + 1, y + i, z + 1, log);
    }
  }
  const top = y + h;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy <= -1 ? 3 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r * r + 1) continue;
        w.set(x + dx, top + dy, z + dz, leaf, true);
        if (thick) w.set(x + 1 + dx, top + dy, z + 1 + dz, leaf, true);
      }
    }
  }
}

/** Acacia: leaning trunk with a flat umbrella canopy. */
function acaciaTree(w, x, y, z, log, leaf, rand) {
  const trunkH = 4 + Math.floor(rand() * 3);
  for (let i = 1; i <= trunkH; i++) w.set(x, y + i, z, log);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const [lx, lz] = dirs[Math.floor(rand() * 4)];
  let cx = x; let cz = z; let cy = y + trunkH;
  for (let i = 0; i < 3; i++) {
    cx += lx; cz += lz; cy += 1;
    w.set(cx, cy, cz, log);
  }
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 4) continue;
      w.set(cx + dx, cy + 1, cz + dz, leaf, true);
      if (Math.abs(dx) + Math.abs(dz) <= 2) w.set(cx + dx, cy + 2, cz + dz, leaf, true);
    }
  }
}

/** Dark oak: 2x2 trunk, broad heavy canopy. */
function darkOakTree(w, x, y, z, log, leaf, rand) {
  const h = 6 + Math.floor(rand() * 3);
  for (let i = 1; i <= h; i++) {
    w.set(x, y + i, z, log);
    w.set(x + 1, y + i, z, log);
    w.set(x, y + i, z + 1, log);
    w.set(x + 1, y + i, z + 1, log);
  }
  const top = y + h;
  for (let dy = -1; dy <= 1; dy++) {
    const r = dy === 1 ? 2 : 3;
    for (let dx = -r; dx <= r + 1; dx++) {
      for (let dz = -r; dz <= r + 1; dz++) {
        if (dx * dx + dz * dz > (r + 1) * (r + 1)) continue;
        w.set(x + dx, top + dy, z + dz, leaf, true);
      }
    }
  }
}

/** Swamp oak: short, wide, drooping canopy. */
function swampTree(w, x, y, z, log, leaf, rand) {
  const h = 5 + Math.floor(rand() * 3);
  for (let i = 1; i <= h; i++) w.set(x, y + i, z, log);
  const top = y + h;
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy < 0 ? 3 : 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > r * r) continue;
        w.set(x + dx, top + dy, z + dz, leaf, true);
      }
    }
  }
}

function deadTree(w, x, y, z, log, rand) {
  const h = 3 + Math.floor(rand() * 3);
  for (let i = 1; i <= h; i++) w.set(x, y + i, z, log);
}

function cactus(w, x, y, z, rand) {
  const h = 2 + Math.floor(rand() * 3);
  for (let i = 1; i <= h; i++) w.set(x, y + i, z, B.CACTUS);
}

/* ------------------------------------------------------------------ */
/* small ground cover                                                 */
/* ------------------------------------------------------------------ */

const FLOWER_IDS = Object.values(B.FLOWERS);

/**
 * Places grass tufts, ferns and flowers on top of a surface block.
 * Called once per in-chunk column, so no cross-chunk care is needed.
 */
export function decorateColumn(w, x, surfaceY, z, biome, seed) {
  const h = columnHash(seed, x, z, 0x5eed);
  const r1 = hashFloat(h);
  const r2 = hashFloat(columnHash(seed, x, z, 0xa11e));

  if (biome.flowerChance > 0 && r1 < biome.flowerChance) {
    const pick = FLOWER_IDS[Math.floor(r2 * FLOWER_IDS.length) % FLOWER_IDS.length];
    w.set(x, surfaceY + 1, z, pick, true);
    return;
  }
  if (biome.grassChance > 0 && r1 < biome.grassChance) {
    let id = B.SHORT_GRASS;
    if (biome.name === 'taiga' || biome.name === 'snowy_taiga') id = r2 < 0.5 ? B.FERN : B.SHORT_GRASS;
    else if (biome.name === 'jungle') id = r2 < 0.35 ? B.FERN : B.TALL_GRASS;
    else if (r2 < 0.18) id = B.TALL_GRASS;
    w.set(x, surfaceY + 1, z, id, true);
    return;
  }
  if (biome.name === 'desert' || biome.name === 'badlands') {
    if (r1 < 0.006) w.set(x, surfaceY + 1, z, B.DEAD_BUSH, true);
    return;
  }
  if ((biome.name === 'forest' || biome.name === 'dark_forest' || biome.name === 'taiga') && r1 < 0.004) {
    w.set(x, surfaceY + 1, z, r2 < 0.5 ? B.RED_MUSHROOM : B.BROWN_MUSHROOM, true);
  }
}

/**
 * Sugar cane along water edges.
 * @param {(x:number,y:number,z:number)=>number} peek reads the current block
 */
export function decorateWaterEdge(w, x, surfaceY, z, seed, peek) {
  const r = hashFloat(columnHash(seed, x, z, 0xca11e));
  if (r > 0.28) return;
  const adjacentWater = peek(x + 1, surfaceY, z) === B.WATER
    || peek(x - 1, surfaceY, z) === B.WATER
    || peek(x, surfaceY, z + 1) === B.WATER
    || peek(x, surfaceY, z - 1) === B.WATER;
  if (!adjacentWater) return;
  const h = 1 + Math.floor(hashFloat(columnHash(seed, x, z, 0x5aca)) * 3);
  for (let i = 1; i <= h; i++) w.set(x, surfaceY + i, z, B.SUGAR_CANE, true);
}

/* ------------------------------------------------------------------ */
/* ore veins                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ore distribution table. `count` veins are attempted per chunk within
 * [minY, maxY]; `size` is the number of blocks per blob.
 */
export const ORE_TABLE = [
  { block: 'coal_ore', count: 20, size: 14, minY: 6, maxY: 110 },
  { block: 'iron_ore', count: 20, size: 8, minY: 5, maxY: 68 },
  { block: 'gold_ore', count: 3, size: 8, minY: 5, maxY: 34 },
  { block: 'redstone_ore', count: 8, size: 7, minY: 4, maxY: 18 },
  { block: 'diamond_ore', count: 2, size: 6, minY: 3, maxY: 16 },
  { block: 'lapis_ore', count: 2, size: 6, minY: 5, maxY: 32 },
  { block: 'emerald_ore', count: 1, size: 3, minY: 6, maxY: 60, mountainsOnly: true },
  { block: 'granite', count: 6, size: 26, minY: 5, maxY: 70 },
  { block: 'diorite', count: 6, size: 26, minY: 5, maxY: 70 },
  { block: 'andesite', count: 6, size: 26, minY: 5, maxY: 70 },
  { block: 'dirt', count: 8, size: 26, minY: 8, maxY: 100 },
  { block: 'gravel', count: 6, size: 26, minY: 8, maxY: 100 },
];

const ORE_IDS = ORE_TABLE.map((o) => blockId(o.block));

/**
 * Scatters ore veins through a freshly generated chunk. Veins are
 * clipped to the chunk, which is visually indistinguishable from
 * vanilla's overlapping placement.
 *
 * @param {object} w ColumnWriter with replaceStone(x,y,z,id)
 * @param {number} cx chunk x
 * @param {number} cz chunk z
 * @param {number} seed
 * @param {boolean} mountainous whether emerald veins may spawn
 */
export function generateOres(w, cx, cz, seed, mountainous) {
  for (let t = 0; t < ORE_TABLE.length; t++) {
    const ore = ORE_TABLE[t];
    if (ore.mountainsOnly && !mountainous) continue;
    const id = ORE_IDS[t];
    const rand = mulberry32(hashSeed(seed, `ore${t}`) ^ Math.imul(cx, 0x9e3779b1) ^ Math.imul(cz, 0x85ebca6b));
    for (let v = 0; v < ore.count; v++) {
      const ox = cx * 16 + Math.floor(rand() * 16);
      const oz = cz * 16 + Math.floor(rand() * 16);
      const oy = ore.minY + Math.floor(rand() * Math.max(1, ore.maxY - ore.minY));
      // Grow a rough blob by random-walking from the seed point.
      let px = ox; let py = oy; let pz = oz;
      for (let s = 0; s < ore.size; s++) {
        w.replaceStone(px, py, pz, id);
        px += Math.round(rand() * 2 - 1);
        py += Math.round(rand() * 2 - 1);
        pz += Math.round(rand() * 2 - 1);
        if (py < ore.minY || py > ore.maxY) py = oy;
      }
    }
  }
}
