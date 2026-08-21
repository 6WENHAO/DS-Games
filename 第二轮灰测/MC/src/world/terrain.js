/**
 * world/terrain.js
 * ------------------------------------------------------------------
 * Procedural world generation.
 *
 * Shape follows the spirit of modern Minecraft: independent climate
 * noises (continentalness, erosion, peaks-and-valleys, temperature,
 * humidity, weirdness) are combined through splines into a surface
 * height, the biome is chosen from that climate, then carvers cut caves
 * and decorators add ores, trees and ground cover.
 *
 * Cave density is evaluated on a coarse 4x4x4 lattice and trilinearly
 * interpolated, which is ~60x cheaper than per-voxel sampling and gives
 * smoother cave walls.
 *
 * This module is imported by the chunk worker and must stay free of DOM
 * and WebGL references.
 */

import {
  CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, localIndex,
} from './constants.js';
import { B, blockId, IS_OPAQUE } from './blocks.js';
import { BIOMES, selectBiome, TREE, PLAINS } from './biomes.js';
import { Noise2D, Noise3D, mulberry32, hashSeed, spline } from './noise.js';
import {
  stampTree, decorateColumn, decorateWaterEdge, generateOres,
  columnHash, FEATURE_RADIUS, isTreeSlot, slotGrowsTree,
} from './features.js';

const SNOWY_GRASS = blockId('snowy_grass_block');
const SNOW_BLOCK = B.SNOW_BLOCK;
const STONE = B.STONE;
const WATER = B.WATER;
const LAVA = B.LAVA;
const BEDROCK = B.BEDROCK;
const AIR = B.AIR;
const SAND = B.SAND;
const GRAVEL = B.GRAVEL;
const ICE = B.ICE;
const PLAINS_ID = PLAINS.id;

/** Highest terrain the generator will produce. */
const MAX_TERRAIN_Y = WORLD_HEIGHT - 12;
/** Cave lattice spacing. */
const CAVE_STEP = 4;

/**
 * Selectable world presets, mirroring vanilla's world types.
 *  - `default`   : the full climate/erosion/peaks pipeline
 *  - `amplified` : the same, with relief exaggerated
 *  - `flat`      : superflat - bedrock, dirt, grass, nothing else
 *  - `islands`   : continentalness pushed negative so land breaks up
 */
export const WORLD_TYPES = ['default', 'amplified', 'flat', 'islands'];

/** Superflat layer stack, bottom-up (vanilla's "Classic Flat" shape). */
const FLAT_LAYERS = [
  { block: 'bedrock', count: 1 },
  { block: 'dirt', count: 2 },
  { block: 'grass_block', count: 1 },
];
const FLAT_GROUND_Y = 64;

/* ------------------------------------------------------------------ */
/* shaping splines                                                    */
/* ------------------------------------------------------------------ */

/**
 * Terrain shaping follows the structure modern Minecraft uses, because
 * that structure - not the raw noise - is what makes terrain read as
 * "Minecraft":
 *
 *   1. a few *large scale* climate noises (continentalness, erosion,
 *      weirdness) with deliberately long wavelengths;
 *   2. peaks-and-valleys derived from weirdness by vanilla's own folding
 *      formula, which is what creates ridge/valley systems rather than
 *      isotropic lumps;
 *   3. splines that turn those into an `offset` (where the ground sits)
 *      and a `factor` (how much relief there is), so plains are genuinely
 *      flat while mountain regions are genuinely tall;
 *   4. `jaggedness` that is near zero everywhere except high mountains,
 *      so sharp rock only appears at peaks;
 *   5. evaluation on a 4-block lattice with smootherstep interpolation,
 *      the heightmap analogue of vanilla interpolating its density field
 *      on a 4x8x4 cell grid. This is what guarantees the ground is
 *      locally smooth instead of per-block noisy.
 */

/** continentalness -> height offset from sea level. */
const CONTINENT_OFFSET = [
  [-1.00, -38], [-0.70, -32], [-0.455, -26],   // deep ocean -> ocean
  [-0.30, -18], [-0.19, -9],                   // ocean -> coast shelf
  [-0.12, -2], [-0.06, 3],                     // shoreline
  [0.03, 7], [0.15, 11],                       // near inland
  [0.35, 17], [0.60, 24], [1.00, 30],          // mid -> far inland
];

/**
 * erosion -> relief factor. Low erosion means mountainous, high erosion
 * means flat: the long tail near +1 is what gives vanilla its wide, calm
 * plains.
 */
const EROSION_FACTOR = [
  [-1.00, 1.00], [-0.78, 0.86], [-0.55, 0.62],
  [-0.35, 0.42], [-0.10, 0.24], [0.10, 0.14],
  [0.30, 0.085], [0.50, 0.055], [0.70, 0.035], [1.00, 0.025],
];

/** Maximum relief above and below the offset, in blocks. */
const RELIEF_UP = 58;
const RELIEF_DOWN = 20;
/** Extra height added at jagged mountain peaks. */
const JAGGEDNESS = 14;
/** Spacing of the height lattice, in blocks. */
const HEIGHT_LATTICE = 4;

/**
 * Peaks and valleys, exactly vanilla's folding of weirdness:
 *   pv = 1 - |3|w| - 2|
 * so w = 0 gives -1 (valley floors, where rivers run), |w| = 2/3 gives
 * +1 (ridge crests) and |w| = 1 returns to 0.
 */
function peaksAndValleys(weirdness) {
  return 1 - Math.abs(3 * Math.abs(weirdness) - 2);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Smootherstep, used to interpolate the height lattice. */
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clampSigned = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);

/**
 * Gain applied to each climate field so it actually spans [-1, 1].
 *
 * Summed-octave noise is roughly Gaussian: measured over a 9.6 km square
 * these fields only reached about +-0.5, which left every spline knot past
 * that unreachable. The symptom was terrain that never rose more than ~25
 * blocks above sea level and a peaks-and-valleys term stuck at -0.56, i.e.
 * permanently "in a valley". These gains are taken from that measurement
 * (roughly 1 / p99) and the result is clamped.
 */
const CLIMATE_GAIN = {
  continent: 2.35,
  erosion: 2.15,
  weirdness: 2.05,
  temperature: 2.20,
  humidity: 2.30,
};

/* ------------------------------------------------------------------ */
/* chunk writer                                                       */
/* ------------------------------------------------------------------ */

/**
 * Write sink that clips world-space writes to one chunk. Features use it
 * so a tree straddling a chunk border simply writes the half that lands
 * inside this chunk.
 */
class ChunkWriter {
  constructor(blocks, cx, cz) {
    this.blocks = blocks;
    this.baseX = cx * CHUNK_SIZE;
    this.baseZ = cz * CHUNK_SIZE;
  }

  /**
   * @param {boolean} [soft] when true, only replace air/replaceable blocks
   *   so trunks are never overwritten by another tree's leaves.
   */
  set(x, y, z, id, soft = false) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const lx = x - this.baseX;
    const lz = z - this.baseZ;
    if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) return;
    const i = localIndex(lx, y, lz);
    if (soft) {
      const cur = this.blocks[i];
      if (cur !== AIR && cur !== WATER) return;
    }
    this.blocks[i] = id;
  }

  get(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const lx = x - this.baseX;
    const lz = z - this.baseZ;
    if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) return AIR;
    return this.blocks[localIndex(lx, y, lz)];
  }

  /** Ore placement: only substitute plain stone. */
  replaceStone(x, y, z, id) {
    if (y < 1 || y >= WORLD_HEIGHT) return;
    const lx = x - this.baseX;
    const lz = z - this.baseZ;
    if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) return;
    const i = localIndex(lx, y, lz);
    if (this.blocks[i] === STONE) this.blocks[i] = id;
  }
}

/* ------------------------------------------------------------------ */
/* generator                                                          */
/* ------------------------------------------------------------------ */

export class TerrainGenerator {
  /**
   * @param {number} seed
   * @param {{type?: string}} [options] world preset, see WORLD_TYPES
   */
  constructor(seed, options = {}) {
    this.seed = seed | 0;
    this.type = WORLD_TYPES.includes(options.type) ? options.type : 'default';
    this.amplified = this.type === 'amplified';
    this.islands = this.type === 'islands';
    const s = (name) => hashSeed(this.seed, name);

    this.continentNoise = new Noise2D(s('continent'));
    this.erosionNoise = new Noise2D(s('erosion'));
    this.weirdNoise = new Noise2D(s('weirdness'));
    this.tempNoise = new Noise2D(s('temperature'));
    this.humidNoise = new Noise2D(s('humidity'));
    this.detailNoise = new Noise2D(s('detail'));
    this.jaggedNoise = new Noise2D(s('jagged'));
    this.beachNoise = new Noise2D(s('beach'));

    this.caveA = new Noise3D(s('caveA'));
    this.caveB = new Noise3D(s('caveB'));
    this.caveCheese = new Noise3D(s('cheese'));

    /**
     * Memo for the height lattice. Keys are packed lattice coordinates, so
     * the four corners shared by neighbouring columns are only evaluated
     * once per region. `jagCache` is filled alongside it.
     */
    this.latticeCache = new Map();
    this.jagCache = new Map();

    /** Scratch lattices for cave interpolation, reused per chunk. */
    const gw = CHUNK_SIZE / CAVE_STEP + 1;
    const gh = Math.ceil(WORLD_HEIGHT / CAVE_STEP) + 1;
    this.latticeDims = { gw, gh };
    this.latticeA = new Float32Array(gw * gw * gh);
    this.latticeB = new Float32Array(gw * gw * gh);
    this.latticeC = new Float32Array(gw * gw * gh);
  }

  /* ---------------- climate ------------------------------------- */

  /**
   * Samples the climate parameters at a world column.
   *
   * Wavelengths are deliberately long. The previous version sampled
   * ridged noise at a 260-block wavelength with 4 octaves, which put
   * full-amplitude features at a ~32-block scale and shattered the
   * ground; every field here has its shortest feature well above 100
   * blocks, leaving fine detail to a single small term.
   */
  climateAt(x, z, out = {}) {
    /*
     * Note on the warp amount: `warpedFbm` displaces its *noise-space*
     * input, so the magnitude has to be comparable to the coordinate
     * itself (x/3000 is around 0.7 for a 2 km world). An earlier version
     * passed 140 here, treating it as a distance in blocks, which
     * randomised the sample position per block and turned continentalness
     * into white noise - the single biggest cause of shattered terrain.
     */
    out.continent = clampSigned(
      this.continentNoise.warpedFbm(x / 3000, z / 3000, 3, 0.35) * CLIMATE_GAIN.continent,
    );
    if (this.islands) out.continent = clampSigned(out.continent * 1.4 - 0.3);
    out.erosion = clampSigned(this.erosionNoise.fbm(x / 1800, z / 1800, 3) * CLIMATE_GAIN.erosion);
    /*
     * Ridge wavelength decides how *steep* mountains are, not how rough:
     * the peaks-and-valleys fold turns one weirdness sweep into a full
     * ridge-to-valley transition, so a 450-block wavelength puts a
     * ~60-block climb over ~75 horizontal blocks. That sustained slope is
     * what makes vanilla mountains feel like mountains; a much longer
     * wavelength produces gentle domes instead.
     */
    out.weirdness = clampSigned(
      this.weirdNoise.fbm(x / 450, z / 450, 2) * CLIMATE_GAIN.weirdness,
    );
    out.pv = peaksAndValleys(out.weirdness);
    out.temperature = clampSigned(
      this.tempNoise.fbm(x / 2200, z / 2200, 3) * CLIMATE_GAIN.temperature,
    );
    out.humidity = clampSigned(
      this.humidNoise.fbm(x / 1400, z / 1400, 3) * CLIMATE_GAIN.humidity,
    );
    return out;
  }

  /**
   * The expensive part of the height function, evaluated only on lattice
   * points. Returns a fractional height in blocks and records how jagged
   * this location should be, for the per-column pass in `heightAt`.
   */
  #rawHeight(x, z, key) {
    const c = this.climateAt(x, z, this._cRaw ??= {});
    const offset = spline(CONTINENT_OFFSET, c.continent);
    let factor = spline(EROSION_FACTOR, c.erosion);
    if (this.amplified) factor = Math.min(1.35, factor * 1.9);

    // Oceans keep muted relief so the sea floor stays a sea floor.
    const oceanMute = clamp01((c.continent + 0.62) / 0.45) * 0.75 + 0.25;
    const pv = c.pv;
    // Ridges rise much further than valleys sink, as in vanilla.
    const relief = pv >= 0
      ? pv * RELIEF_UP * factor * oceanMute
      : pv * RELIEF_DOWN * factor * oceanMute;

    /*
     * Jaggedness gate: sharp rock only where the land is both mountainous
     * (low erosion) and on a ridge (high peaks-and-valleys). Everywhere
     * else this is exactly zero, which is what keeps plains smooth. Only
     * the *gate* is computed here - the sharp detail itself is added per
     * column, because anything with a wavelength near the lattice spacing
     * would simply be interpolated away.
     */
    const mountainous = clamp01((-c.erosion - 0.12) / 0.55);
    const onRidge = clamp01((pv - 0.15) / 0.5);
    if (key !== undefined) this.jagCache.set(key, mountainous * onRidge);

    /*
     * Rivers follow the weirdness ~ 0 contour, which is also where
     * peaks-and-valleys bottoms out - so they naturally run along the
     * floors of valley systems instead of cutting across ridges. The band
     * is intentionally wide: a narrow one is crossed in a few blocks and
     * produces canyon walls rather than river banks.
     */
    let height = SEA_LEVEL + offset + relief;
    const riverness = 1 - clamp01(Math.abs(c.weirdness) / 0.16);
    if (riverness > 0 && c.continent > -0.14) {
      const target = Math.min(height, SEA_LEVEL - 2);
      const carve = smoother(riverness) * clamp01((c.continent + 0.14) / 0.22);
      height += (target - height) * carve;
    }
    return height;
  }

  /** Packs a lattice coordinate into a collision-free integer key. */
  #latticeKey(lx, lz) {
    // Bias into the positive range so negative world coordinates cannot
    // alias onto positive ones.
    return ((lx + 0x100000) * 0x200000) + (lz + 0x100000);
  }

  /** Height lattice value, memoised per region. */
  #latticeHeight(lx, lz) {
    const key = this.#latticeKey(lx, lz);
    const cached = this.latticeCache.get(key);
    if (cached !== undefined) return cached;
    // Keep the memo bounded; a chunk only needs a handful of entries.
    if (this.latticeCache.size > 8192) {
      this.latticeCache.clear();
      this.jagCache.clear();
    }
    const value = this.#rawHeight(lx * HEIGHT_LATTICE, lz * HEIGHT_LATTICE, key);
    this.latticeCache.set(key, value);
    return value;
  }

  /** Jaggedness gate at a lattice point (computed alongside the height). */
  #latticeJag(lx, lz) {
    const key = this.#latticeKey(lx, lz);
    if (!this.jagCache.has(key)) this.#latticeHeight(lx, lz);
    return this.jagCache.get(key) ?? 0;
  }

  /**
   * Surface height at a world column.
   *
   * The smooth components are interpolated from a 4-block lattice with
   * smootherstep - the heightmap equivalent of vanilla interpolating its
   * density field on a coarse cell grid - and the sharp components are
   * added per column afterwards. That split is what lets plains be flat
   * and peaks be craggy at the same time.
   */
  heightAt(x, z) {
    if (this.type === 'flat') return FLAT_GROUND_Y;

    const gx = Math.floor(x / HEIGHT_LATTICE);
    const gz = Math.floor(z / HEIGHT_LATTICE);
    const tx = smoother((x - gx * HEIGHT_LATTICE) / HEIGHT_LATTICE);
    const tz = smoother((z - gz * HEIGHT_LATTICE) / HEIGHT_LATTICE);

    const h00 = this.#latticeHeight(gx, gz);
    const h10 = this.#latticeHeight(gx + 1, gz);
    const h01 = this.#latticeHeight(gx, gz + 1);
    const h11 = this.#latticeHeight(gx + 1, gz + 1);
    const top = h00 + (h10 - h00) * tx;
    const bottom = h01 + (h11 - h01) * tx;
    let h = top + (bottom - top) * tz;

    // A single low-amplitude detail octave keeps the ground from looking
    // artificially rolling without reintroducing spikes.
    h += this.detailNoise.fbm(x / 190, z / 190, 2) * 1.3;

    /*
     * Sharp mountain relief. The gate is interpolated (smooth regions of
     * "this should be craggy"), while the crag itself is sampled per
     * column at a short wavelength so it survives as real cliffs. Using
     * 1 - |noise| produces creased ridges rather than round bumps.
     */
    const j00 = this.#latticeJag(gx, gz);
    const j10 = this.#latticeJag(gx + 1, gz);
    const j01 = this.#latticeJag(gx, gz + 1);
    const j11 = this.#latticeJag(gx + 1, gz + 1);
    const jTop = j00 + (j10 - j00) * tx;
    const jBottom = j01 + (j11 - j01) * tx;
    const gate = jTop + (jBottom - jTop) * tz;
    if (gate > 0.01) {
      // Short-wavelength creases give peaks their rocky surface; the
      // broader term keeps them from looking like uniform corrugation.
      const crag = 1 - Math.abs(this.jaggedNoise.sample(x / 21, z / 21));
      const broad = this.jaggedNoise.fbm(x / 95, z / 95, 2);
      h += (crag * 0.55 + broad * 0.75) * JAGGEDNESS * gate;
    }

    return Math.max(3, Math.min(MAX_TERRAIN_Y, Math.round(h)));
  }

  /** Biome at a world column. */
  biomeAt(x, z) {
    const c = this.climateAt(x, z, this._c2 ??= {});
    const h = this.heightAt(x, z);
    return selectBiome(
      c.temperature, c.humidity, c.continent, c.erosion, c.weirdness, h, SEA_LEVEL,
    );
  }

  /* ---------------- cave lattice -------------------------------- */

  /** Fills the coarse cave noise lattices for one chunk. */
  #buildCaveLattice(cx, cz) {
    const { gw, gh } = this.latticeDims;
    const bx = cx * CHUNK_SIZE;
    const bz = cz * CHUNK_SIZE;
    let i = 0;
    for (let gy = 0; gy < gh; gy++) {
      const wy = gy * CAVE_STEP;
      for (let gz = 0; gz < gw; gz++) {
        const wz = bz + gz * CAVE_STEP;
        for (let gxi = 0; gxi < gw; gxi++, i++) {
          const wx = bx + gxi * CAVE_STEP;
          this.latticeA[i] = this.caveA.sample(wx * 0.0135, wy * 0.021, wz * 0.0135);
          this.latticeB[i] = this.caveB.sample(wx * 0.0135 + 41.7, wy * 0.021 - 13.3, wz * 0.0135 + 91.2);
          this.latticeC[i] = this.caveCheese.fbm(wx * 0.0072, wy * 0.0115, wz * 0.0072, 2);
        }
      }
    }
  }

  /** Trilinear sample of a lattice at chunk-local coordinates. */
  #lattice(field, lx, y, lz) {
    const { gw, gh } = this.latticeDims;
    const fx = lx / CAVE_STEP; const fy = y / CAVE_STEP; const fz = lz / CAVE_STEP;
    const x0 = Math.min(gw - 2, fx | 0); const y0 = Math.min(gh - 2, fy | 0); const z0 = Math.min(gw - 2, fz | 0);
    const tx = fx - x0; const ty = fy - y0; const tz = fz - z0;
    const idx = (xi, yi, zi) => (yi * gw + zi) * gw + xi;
    const c000 = field[idx(x0, y0, z0)]; const c100 = field[idx(x0 + 1, y0, z0)];
    const c010 = field[idx(x0, y0 + 1, z0)]; const c110 = field[idx(x0 + 1, y0 + 1, z0)];
    const c001 = field[idx(x0, y0, z0 + 1)]; const c101 = field[idx(x0 + 1, y0, z0 + 1)];
    const c011 = field[idx(x0, y0 + 1, z0 + 1)]; const c111 = field[idx(x0 + 1, y0 + 1, z0 + 1)];
    const x00 = c000 + (c100 - c000) * tx;
    const x10 = c010 + (c110 - c010) * tx;
    const x01 = c001 + (c101 - c001) * tx;
    const x11 = c011 + (c111 - c011) * tx;
    const y0i = x00 + (x10 - x00) * ty;
    const y1i = x01 + (x11 - x01) * ty;
    return y0i + (y1i - y0i) * tz;
  }

  /* ---------------- main entry ---------------------------------- */

  /**
   * Generates one chunk column.
   * @param {number} cx
   * @param {number} cz
   * @param {{blocks: Uint16Array, biomes: Uint8Array, heights: Int16Array}} out
   */
  generate(cx, cz, out) {
    const { blocks, biomes, heights } = out;
    blocks.fill(AIR);
    if (this.type === 'flat') return this.#generateFlat(cx, cz, out);

    const bx = cx * CHUNK_SIZE;
    const bz = cz * CHUNK_SIZE;
    const climate = {};
    let mountainous = false;

    /* --- 1. height + biome per column --------------------------- */
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = bx + lx; const wz = bz + lz;
        this.climateAt(wx, wz, climate);
        const h = this.heightAt(wx, wz);
        const biome = selectBiome(
          climate.temperature, climate.humidity, climate.continent,
          climate.erosion, climate.weirdness, h, SEA_LEVEL,
        );
        const ci = lz * CHUNK_SIZE + lx;
        heights[ci] = h;
        biomes[ci] = biome.id;
        if (h > SEA_LEVEL + 30) mountainous = true;
      }
    }

    /* --- 2. stone / surface / water ----------------------------- */
    const bedrockRand = mulberry32(hashSeed(this.seed, 'bedrock') ^ Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263));
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const ci = lz * CHUNK_SIZE + lx;
        const h = heights[ci];
        const biome = BIOMES[biomes[ci]];
        const wx = bx + lx; const wz = bz + lz;
        const submerged = h < SEA_LEVEL;

        // surface composition
        let topBlock = blockId(biome.surface);
        let fillerBlock = blockId(biome.filler);
        if (submerged) {
          topBlock = blockId(biome.underwater);
          fillerBlock = topBlock === SAND ? SAND : fillerBlock;
        } else if (biome.snowy && SNOWY_GRASS && topBlock === B.GRASS_BLOCK) {
          topBlock = SNOWY_GRASS;
        }
        // bare rock and snow caps high up
        if (!submerged && h > SEA_LEVEL + 46) {
          topBlock = biome.temperature < 0.4 ? SNOW_BLOCK : STONE;
          fillerBlock = STONE;
        }
        // sandy beaches where the coast noise agrees
        if (!submerged && h <= SEA_LEVEL + 2 && h >= SEA_LEVEL - 2
          && biome.surface === 'grass_block'
          && this.beachNoise.sample(wx / 90, wz / 90) > -0.15) {
          topBlock = SAND; fillerBlock = SAND;
        }

        const fillerDepth = 3 + ((bedrockRand() * 2) | 0);
        for (let y = 0; y <= h; y++) {
          const i = localIndex(lx, y, lz);
          if (y === 0) { blocks[i] = BEDROCK; continue; }
          if (y <= 4 && bedrockRand() < (5 - y) / 5) { blocks[i] = BEDROCK; continue; }
          if (y === h) blocks[i] = topBlock;
          else if (y >= h - fillerDepth) blocks[i] = fillerBlock;
          else blocks[i] = STONE;
        }
        // oceans / lakes
        for (let y = h + 1; y <= SEA_LEVEL; y++) {
          blocks[localIndex(lx, y, lz)] = WATER;
        }
        // frozen surface
        if (submerged && biome.snowy && SEA_LEVEL >= h + 1) {
          blocks[localIndex(lx, SEA_LEVEL, lz)] = ICE;
        }
      }
    }

    /* --- 3. caves ---------------------------------------------- */
    this.#buildCaveLattice(cx, cz);
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const ci = lz * CHUNK_SIZE + lx;
        const surface = heights[ci];
        const ceiling = Math.min(surface - 2, MAX_TERRAIN_Y);
        for (let y = 2; y <= ceiling; y++) {
          const i = localIndex(lx, y, lz);
          const cur = blocks[i];
          if (cur === AIR || cur === BEDROCK || cur === WATER) continue;
          const a = this.#lattice(this.latticeA, lx, y, lz);
          const b = this.#lattice(this.latticeB, lx, y, lz);
          /*
           * Carving thresholds tighten smoothly as the surface nears, so
           * cave mouths taper instead of ending abruptly. The previous
           * version rolled a per-block random number here, which punched
           * salt-and-pepper holes through the top few metres of ground.
           */
          const depth = surface - y;
          const nearSurface = depth < 8 ? depth / 8 : 1;
          const taper = nearSurface * nearSurface;
          const tunnel = (a * a + b * b) < 0.0135 * taper;
          const cheese = this.#lattice(this.latticeC, lx, y, lz) > 0.615 + (1 - taper) * 0.3;
          if (!tunnel && !cheese) continue;
          blocks[i] = y <= 9 ? LAVA : AIR;
        }
      }
    }

    /* --- 4. ores ------------------------------------------------ */
    const writer = new ChunkWriter(blocks, cx, cz);
    generateOres(writer, cx, cz, this.seed, mountainous);

    /* --- 5. trees (including neighbours that overlap this chunk) - */
    this.#placeTrees(writer, cx, cz, blocks, heights, biomes);

    /* --- 6. ground cover --------------------------------------- */
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const ci = lz * CHUNK_SIZE + lx;
        const h = heights[ci];
        if (h < SEA_LEVEL) continue;
        const biome = BIOMES[biomes[ci]];
        const wx = bx + lx; const wz = bz + lz;
        const surfaceBlock = blocks[localIndex(lx, h, lz)];
        if (!IS_OPAQUE[surfaceBlock]) continue;
        const above = blocks[localIndex(lx, Math.min(h + 1, WORLD_HEIGHT - 1), lz)];
        if (above !== AIR) continue;
        if (h === SEA_LEVEL || h === SEA_LEVEL + 1) {
          decorateWaterEdge(writer, wx, h, wz, this.seed, (qx, qy, qz) => writer.get(qx, qy, qz));
        }
        decorateColumn(writer, wx, h, wz, biome, this.seed);
      }
    }
  }

  /**
   * Superflat generation: a fixed layer stack with no caves, ores or
   * decoration. Handy for building and used by the render tests because
   * every block is at a known position.
   */
  #generateFlat(cx, cz, out) {
    const { blocks, biomes, heights } = out;
    const stack = [];
    for (const layer of FLAT_LAYERS) {
      for (let i = 0; i < layer.count; i++) stack.push(blockId(layer.block));
    }
    const top = FLAT_GROUND_Y;
    const base = top - stack.length + 1;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let i = 0; i < stack.length; i++) {
          const y = base + i;
          if (y < 0 || y >= WORLD_HEIGHT) continue;
          blocks[localIndex(lx, y, lz)] = stack[i];
        }
        const ci = lz * CHUNK_SIZE + lx;
        heights[ci] = top;
        biomes[ci] = PLAINS_ID;
      }
    }
    void cx; void cz;
  }

  /**
   * Evaluates tree placement over this chunk expanded by FEATURE_RADIUS
   * so canopies crossing a chunk border are completed on both sides.
   */
  #placeTrees(writer, cx, cz, blocks, heights, biomes) {
    const bx = cx * CHUNK_SIZE;
    const bz = cz * CHUNK_SIZE;
    const r = FEATURE_RADIUS;
    const climate = {};

    for (let dz = -r; dz < CHUNK_SIZE + r; dz++) {
      for (let dx = -r; dx < CHUNK_SIZE + r; dx++) {
        const wx = bx + dx; const wz = bz + dz;
        const inside = dx >= 0 && dz >= 0 && dx < CHUNK_SIZE && dz < CHUNK_SIZE;

        let h; let biome;
        if (inside) {
          const ci = dz * CHUNK_SIZE + dx;
          h = heights[ci];
          biome = BIOMES[biomes[ci]];
        } else {
          this.climateAt(wx, wz, climate);
          h = this.heightAt(wx, wz);
          biome = selectBiome(
            climate.temperature, climate.humidity, climate.continent,
            climate.erosion, climate.weirdness, h, SEA_LEVEL,
          );
        }
        if (biome.tree === TREE.NONE || biome.treeDensity <= 0) continue;
        if (h < SEA_LEVEL || h > MAX_TERRAIN_Y - 12) continue;

        /*
         * Two-stage placement: an evenly spaced slot first, then the
         * biome's density. The spacing pass is what stops trunks from
         * touching - density alone produced 23 trees per chunk and 86%
         * canopy cover, i.e. an impassable thicket.
         */
        if (!isTreeSlot(this.seed, wx, wz)) continue;
        if (!slotGrowsTree(this.seed, wx, wz, biome.treeDensity)) continue;
        const hash = columnHash(this.seed, wx, wz, 0x7a3e5);

        // Keep trunks off sand unless the biome wants cacti, and never in water.
        if (inside) {
          const ground = blocks[localIndex(dx, h, dz)];
          const cactusBiome = biome.tree === TREE.CACTUS;
          if (ground === WATER) continue;
          if (!cactusBiome && (ground === SAND || ground === GRAVEL || ground === ICE)) continue;
          if (cactusBiome && ground !== SAND) continue;
        }
        const rand = mulberry32(hash ^ 0x9e3779b9);
        stampTree(writer, wx, h, wz, biome.tree, rand);
      }
    }
  }
}

/**
 * Picks a reasonable spawn point: walks outward from the origin looking
 * for dry land at a comfortable altitude.
 */
export function findSpawn(generator) {
  for (let radius = 0; radius < 2500; radius += 16) {
    const steps = radius === 0 ? 1 : 12;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = Math.round(Math.cos(angle) * radius);
      const z = Math.round(Math.sin(angle) * radius);
      const h = generator.heightAt(x, z);
      if (h <= SEA_LEVEL || h > SEA_LEVEL + 40) continue;
      const biome = generator.biomeAt(x, z);
      if (biome.name === 'ocean' || biome.name === 'deep_ocean' || biome.name === 'river') continue;
      return { x: x + 0.5, y: h + 1.2, z: z + 0.5 };
    }
  }
  return { x: 0.5, y: SEA_LEVEL + 12, z: 0.5 };
}
