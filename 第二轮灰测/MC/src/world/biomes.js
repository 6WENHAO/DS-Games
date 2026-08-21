/**
 * world/biomes.js
 * ------------------------------------------------------------------
 * Biome table and climate-based biome selection.
 *
 * Colours are the vanilla grass/foliage/water tints (the values baked
 * into Minecraft's colormap textures) so foliage reads correctly per
 * biome. Surface composition, decoration density and tree species are
 * also per-biome, which is what makes generated worlds feel varied.
 */

/** Converts 0xRRGGBB into a normalised [r,g,b] triple. */
const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/** Tree species understood by world/features.js. */
export const TREE = {
  NONE: 'none',
  OAK: 'oak',
  BIG_OAK: 'big_oak',
  BIRCH: 'birch',
  SPRUCE: 'spruce',
  PINE: 'pine',
  JUNGLE: 'jungle',
  ACACIA: 'acacia',
  DARK_OAK: 'dark_oak',
  CACTUS: 'cactus',
  DEAD: 'dead',
  SWAMP_OAK: 'swamp_oak',
};

/**
 * @typedef {object} Biome
 * @property {number} id
 * @property {string} name
 * @property {string} displayName
 * @property {number[]} grass       normalised grass tint
 * @property {number[]} foliage     normalised leaf tint
 * @property {number[]} water       normalised water tint
 * @property {string} surface       top block name
 * @property {string} filler        block just below the surface
 * @property {string} underwater    surface block when submerged
 * @property {number} temperature   0 (frozen) .. 1 (hot)
 * @property {number} downfall      0 (arid) .. 1 (wet)
 * @property {boolean} snowy        precipitation falls as snow
 * @property {string} tree
 * @property {number} treeDensity  probability that an evenly spaced tree
 *   slot grows a tree, 0..1. Spacing yields about ten slots per chunk, so
 *   this is very close to "trees per chunk / 10" and can be read straight
 *   off vanilla's figures.
 * @property {number} grassChance
 * @property {number} flowerChance
 */

/** @type {Biome[]} */
export const BIOMES = [];
const biome = (name, opts) => {
  const b = {
    id: BIOMES.length,
    name,
    displayName: opts.displayName ?? name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    grass: rgb(opts.grass ?? 0x91bd59),
    foliage: rgb(opts.foliage ?? 0x77ab2f),
    water: rgb(opts.water ?? 0x3f76e4),
    surface: opts.surface ?? 'grass_block',
    filler: opts.filler ?? 'dirt',
    underwater: opts.underwater ?? 'gravel',
    temperature: opts.temperature ?? 0.5,
    downfall: opts.downfall ?? 0.5,
    snowy: opts.snowy ?? false,
    tree: opts.tree ?? TREE.NONE,
    treeDensity: opts.treeDensity ?? 0,
    grassChance: opts.grassChance ?? 0,
    flowerChance: opts.flowerChance ?? 0,
  };
  BIOMES.push(b);
  return b;
};

/* ---- ocean & water ---------------------------------------------- */
export const DEEP_OCEAN = biome('deep_ocean', {
  grass: 0x8ab689, foliage: 0x6fa42f, water: 0x3f76e4,
  surface: 'gravel', filler: 'stone', underwater: 'gravel',
  temperature: 0.5, downfall: 0.5,
});
export const OCEAN = biome('ocean', {
  grass: 0x8ab689, foliage: 0x6fa42f,
  surface: 'sand', filler: 'sand', underwater: 'sand',
  temperature: 0.5, downfall: 0.5,
});
export const FROZEN_OCEAN = biome('frozen_ocean', {
  grass: 0x80b497, foliage: 0x60a17b, water: 0x3938c9,
  surface: 'gravel', filler: 'stone', underwater: 'gravel',
  temperature: 0.0, downfall: 0.5, snowy: true,
});
export const RIVER = biome('river', {
  surface: 'sand', filler: 'sand', underwater: 'sand',
});
export const BEACH = biome('beach', {
  surface: 'sand', filler: 'sand', underwater: 'sand',
  temperature: 0.8, downfall: 0.4,
});
export const STONY_SHORE = biome('stony_shore', {
  grass: 0x8ab689, surface: 'stone', filler: 'stone', underwater: 'stone',
  temperature: 0.2, downfall: 0.3,
});

/* ---- temperate --------------------------------------------------- */
export const PLAINS = biome('plains', {
  grass: 0x91bd59, foliage: 0x77ab2f,
  temperature: 0.8, downfall: 0.4,
  tree: TREE.OAK, treeDensity: 0.03, grassChance: 0.16, flowerChance: 0.012,
});
export const SUNFLOWER_PLAINS = biome('sunflower_plains', {
  grass: 0x91bd59, foliage: 0x77ab2f,
  temperature: 0.8, downfall: 0.4,
  tree: TREE.OAK, treeDensity: 0.02, grassChance: 0.2, flowerChance: 0.09,
});
export const FOREST = biome('forest', {
  grass: 0x79c05a, foliage: 0x59ae30,
  temperature: 0.7, downfall: 0.8,
  tree: TREE.OAK, treeDensity: 0.95, grassChance: 0.14, flowerChance: 0.02,
});
export const BIRCH_FOREST = biome('birch_forest', {
  grass: 0x88bb67, foliage: 0x6ba941,
  temperature: 0.6, downfall: 0.6,
  tree: TREE.BIRCH, treeDensity: 0.90, grassChance: 0.12, flowerChance: 0.02,
});
export const DARK_FOREST = biome('dark_forest', {
  grass: 0x507a32, foliage: 0x507a32,
  temperature: 0.7, downfall: 0.8,
  tree: TREE.DARK_OAK, treeDensity: 0.95, grassChance: 0.1, flowerChance: 0.01,
});
export const SWAMP = biome('swamp', {
  grass: 0x6a7039, foliage: 0x6a7039, water: 0x617b64,
  filler: 'dirt', underwater: 'dirt',
  temperature: 0.8, downfall: 0.9,
  tree: TREE.SWAMP_OAK, treeDensity: 0.28, grassChance: 0.22, flowerChance: 0.005,
});

/* ---- cold -------------------------------------------------------- */
export const TAIGA = biome('taiga', {
  grass: 0x86b783, foliage: 0x68a464,
  temperature: 0.25, downfall: 0.8,
  tree: TREE.SPRUCE, treeDensity: 0.80, grassChance: 0.1, flowerChance: 0.004,
});
export const SNOWY_TAIGA = biome('snowy_taiga', {
  grass: 0x80b497, foliage: 0x60a17b,
  temperature: 0.05, downfall: 0.4, snowy: true,
  tree: TREE.PINE, treeDensity: 0.70, grassChance: 0.05,
});
export const SNOWY_PLAINS = biome('snowy_plains', {
  grass: 0x80b497, foliage: 0x60a17b,
  temperature: 0.0, downfall: 0.5, snowy: true,
  tree: TREE.PINE, treeDensity: 0.03, grassChance: 0.02,
});
export const WINDSWEPT_HILLS = biome('windswept_hills', {
  grass: 0x8ab689, foliage: 0x6da36b,
  temperature: 0.2, downfall: 0.3,
  tree: TREE.SPRUCE, treeDensity: 0.04, grassChance: 0.06,
});
export const SNOWY_SLOPES = biome('snowy_slopes', {
  grass: 0x80b497, foliage: 0x60a17b,
  surface: 'snow_block', filler: 'stone', underwater: 'stone',
  temperature: 0.0, downfall: 0.9, snowy: true,
  tree: TREE.NONE, grassChance: 0,
});
export const JAGGED_PEAKS = biome('jagged_peaks', {
  grass: 0x80b497, foliage: 0x60a17b,
  surface: 'stone', filler: 'stone', underwater: 'stone',
  temperature: 0.0, downfall: 0.9, snowy: true,
});

/* ---- hot --------------------------------------------------------- */
export const DESERT = biome('desert', {
  grass: 0xbfb755, foliage: 0xaea42a,
  surface: 'sand', filler: 'sand', underwater: 'sand',
  temperature: 2.0, downfall: 0.0,
  tree: TREE.CACTUS, treeDensity: 0.18, grassChance: 0.004,
});
export const SAVANNA = biome('savanna', {
  grass: 0xbfb755, foliage: 0xaea42a,
  temperature: 1.2, downfall: 0.0,
  tree: TREE.ACACIA, treeDensity: 0.15, grassChance: 0.26,
});
export const BADLANDS = biome('badlands', {
  grass: 0x90814d, foliage: 0x9e814d,
  surface: 'red_sand', filler: 'terracotta', underwater: 'red_sand',
  temperature: 2.0, downfall: 0.0,
  tree: TREE.DEAD, treeDensity: 0.05, grassChance: 0.002,
});
export const JUNGLE = biome('jungle', {
  grass: 0x59c93c, foliage: 0x30bb0b,
  temperature: 0.95, downfall: 0.9,
  tree: TREE.JUNGLE, treeDensity: 1.00, grassChance: 0.3, flowerChance: 0.02,
});

/** name -> Biome */
export const BIOME_BY_NAME = new Map(BIOMES.map((b) => [b.name, b]));

/* ------------------------------------------------------------------ */
/* tint palette                                                       */
/* ------------------------------------------------------------------ */

/**
 * Flat Float32Array of grass/foliage/water tints indexed by biome id.
 * The mesher reads these to write per-vertex tint bytes, and the
 * texture builder uses the grass entries to composite the per-biome
 * grass side overlay.
 */
export const GRASS_TINTS = new Float32Array(BIOMES.length * 3);
export const FOLIAGE_TINTS = new Float32Array(BIOMES.length * 3);
export const WATER_TINTS = new Float32Array(BIOMES.length * 3);
for (const b of BIOMES) {
  GRASS_TINTS.set(b.grass, b.id * 3);
  FOLIAGE_TINTS.set(b.foliage, b.id * 3);
  WATER_TINTS.set(b.water, b.id * 3);
}

/** Flat lookup tables for the hot generation paths. */
export const BIOME_SNOWY = new Uint8Array(BIOMES.map((b) => (b.snowy ? 1 : 0)));
export const BIOME_TEMPERATURE = new Float32Array(BIOMES.map((b) => b.temperature));
export const BIOME_DOWNFALL = new Float32Array(BIOMES.map((b) => b.downfall));

/* ------------------------------------------------------------------ */
/* selection                                                          */
/* ------------------------------------------------------------------ */

/**
 * Chooses a biome from climate parameters, in the spirit of the vanilla
 * multi-noise biome source but with a hand-written decision tree that is
 * easy to reason about.
 *
 * @param {number} temperature -1..1 (cold to hot)
 * @param {number} humidity    -1..1 (dry to wet)
 * @param {number} continent   -1..1 (deep ocean to inland)
 * @param {number} erosion     -1..1 (mountainous to flat)
 * @param {number} weirdness   -1..1 (variant selector)
 * @param {number} height      final terrain height in blocks
 * @param {number} seaLevel
 * @returns {Biome}
 */
export function selectBiome(temperature, humidity, continent, erosion, weirdness, height, seaLevel) {
  // --- water ------------------------------------------------------
  if (height < seaLevel - 1) {
    if (continent < -0.45 && height < seaLevel - 12) {
      return temperature < -0.45 ? FROZEN_OCEAN : DEEP_OCEAN;
    }
    if (continent > 0.05 && height > seaLevel - 8) return RIVER;
    return temperature < -0.45 ? FROZEN_OCEAN : OCEAN;
  }

  // --- coast ------------------------------------------------------
  if (height <= seaLevel + 2) {
    if (erosion < -0.35) return STONY_SHORE;
    if (temperature < -0.35) return SNOWY_PLAINS;
    if (temperature > 0.55 && humidity < -0.1) return DESERT;
    if (humidity > 0.6 && temperature > 0.2) return SWAMP;
    return BEACH;
  }

  // --- high mountains --------------------------------------------
  if (height > seaLevel + 52) return JAGGED_PEAKS;
  if (height > seaLevel + 40) return temperature < 0.35 ? SNOWY_SLOPES : WINDSWEPT_HILLS;
  if (height > seaLevel + 28 && erosion < -0.2) {
    return temperature < -0.2 ? SNOWY_SLOPES : WINDSWEPT_HILLS;
  }

  // --- by temperature band ---------------------------------------
  if (temperature < -0.45) {
    return humidity > 0.1 ? SNOWY_TAIGA : SNOWY_PLAINS;
  }
  if (temperature < -0.1) {
    if (humidity > 0.25) return TAIGA;
    return weirdness > 0.3 ? WINDSWEPT_HILLS : TAIGA;
  }
  if (temperature < 0.35) {
    if (humidity < -0.35) return PLAINS;
    if (humidity > 0.45) return DARK_FOREST;
    return weirdness > 0.15 ? BIRCH_FOREST : FOREST;
  }
  if (temperature < 0.75) {
    if (humidity < -0.5) return SAVANNA;
    if (humidity < -0.1) return weirdness > 0.4 ? SUNFLOWER_PLAINS : PLAINS;
    if (humidity > 0.65) return SWAMP;
    return FOREST;
  }
  // hot
  if (humidity < -0.55) return weirdness > 0.25 ? BADLANDS : DESERT;
  if (humidity < -0.1) return SAVANNA;
  if (humidity > 0.4) return JUNGLE;
  return weirdness > 0.35 ? SUNFLOWER_PLAINS : PLAINS;
}

/** Distinct grass tints, used to pre-composite grass side textures. */
export function grassTintPalette() {
  return BIOMES.map((b) => ({ id: b.id, name: b.name, colour: b.grass, snowy: b.snowy }));
}
